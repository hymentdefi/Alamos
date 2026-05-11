import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fontFamily, radius, useTheme } from "../../lib/theme";
import {
  assets,
  formatMoney,
  formatPct,
  assetCurrency,
  type Asset,
} from "../../lib/data/assets";
import { useAlerts } from "../../lib/alerts/context";
import { useToast } from "../../lib/toast/context";
import type { PriceAlert } from "../../lib/api/alerts";
import { AlertSheet } from "../../lib/components/AlertSheet";
import { IndicatorSheet } from "../../lib/components/IndicatorSheet";
import { IndicatorDetailSheet } from "../../lib/components/IndicatorDetailSheet";
import { AlertBellIllustration } from "../../lib/components/illustrations/AlertBellIllustration";
import { IndicatorChartIllustration } from "../../lib/components/illustrations/IndicatorChartIllustration";
import { Toggle } from "../../lib/components/Toggle";
import type { IndicatorAlert } from "../../lib/api/alerts";

type Tab = "price" | "indicator";
type Sort = "proximity" | "createdAt";

/**
 * Pantalla de Alertas custom de un activo. Se abre desde la
 * campana del header en stock detail.
 *
 * Layout:
 *   - Header: X (close) + título "[TICKER] · Alertas custom" +
 *     subtítulo de frecuencia.
 *   - Banner del precio actual — referencia fija.
 *   - Tabs: "Precio" / "Indicadores".
 *   - Sort control (Por proximidad / Por fecha).
 *   - Lista de alertas activas (active + paused) con distancia
 *     al precio actual, toggle de pausa, swipe gestures.
 *   - Historial (alertas que ya dispararon) con fecha/precio
 *     al disparo.
 *   - CTA bottom-fixed "Agregar alerta" → abre AlertSheet.
 *   - Tap en una alerta → AlertSheet en modo edit.
 */
export default function AssetAlertsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowW } = useWindowDimensions();
  const { c, mode } = useTheme();
  const refreshTint = mode === "dark" ? "#FFFFFF" : c.textMuted;
  const { show } = useToast();
  const { ticker } = useLocalSearchParams<{ ticker: string }>();

  const asset = useMemo<Asset | undefined>(
    () => assets.find((a) => a.ticker === ticker),
    [ticker],
  );

  const [tab, setTab] = useState<Tab>("price");
  const [sort, setSort] = useState<Sort>("proximity");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  /* Formato de la columna de distancia: % al objetivo (default) o
   * $. El usuario lo alterna tappeando el label "% al objetivo ▾"
   * en el header. Se aplica a todas las filas. */
  const [distFormat, setDistFormat] = useState<"%" | "$">("%");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<PriceAlert | null>(null);
  /* Indicator-tab equivalents — sheet de creación + alerta en edición
   * + alerta en preview (detail sheet). */
  const [indicatorCreateOpen, setIndicatorCreateOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] =
    useState<IndicatorAlert | null>(null);
  const [detailIndicator, setDetailIndicator] =
    useState<IndicatorAlert | null>(null);
  /* Ancla del popup de sort — medimos la posición exacta del ícono
   *  de sliders al abrir el menú así el popup sale pegado debajo. */
  const sortBtnRef = useRef<View>(null);
  const [sortAnchor, setSortAnchor] = useState<{
    top: number;
    right: number;
  }>({ top: 100, right: 24 });

  const {
    activeForAsset,
    triggeredForAsset,
    setPaused,
    remove,
    activeIndicatorsForAsset,
    setIndicatorPaused,
    removeIndicator,
    refresh,
  } = useAlerts();

  /* Pull-to-refresh — mantiene el spinner un mínimo de ~900 ms
   * aunque el refresh() mock resuelva más rápido. Sin el minDelay,
   * el spinner aparecía y desaparecía en <300 ms y casi no se
   * sentía. 900 ms es el sweet spot donde el gesto "registra" sin
   * sentirse lento. Mismo timing que el pull-to-refresh de
   * stock detail. Aplica a ambos tabs (Precio + Indicadores). */
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const minDelay = new Promise((r) => setTimeout(r, 900));
    try {
      await Promise.all([refresh(), minDelay]);
    } catch {
      // silent — un error de refresh no merece toast.
      await minDelay;
    }
    Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
    setRefreshing(false);
  }, [refresh]);

  const alertsForAsset = useMemo(
    () => (asset ? activeForAsset(asset.ticker) : []),
    [asset, activeForAsset],
  );

  const indicatorsForAsset = useMemo(
    () => (asset ? activeIndicatorsForAsset(asset.ticker) : []),
    [asset, activeIndicatorsForAsset],
  );

  const sortedIndicators = useMemo(() => {
    const copy = [...indicatorsForAsset];
    if (sort === "createdAt") {
      copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    // "proximity" no aplica para indicadores → quedan en orden de
    // creación inverso por default (mismo que createdAt).
    return copy;
  }, [indicatorsForAsset, sort]);

  const sortedAlerts = useMemo(() => {
    if (!asset) return [];
    const copy = [...alertsForAsset];
    if (sort === "proximity") {
      // Distancia al precio actual — la más cercana arriba.
      copy.sort(
        (a, b) =>
          Math.abs(a.threshold - asset.price) -
          Math.abs(b.threshold - asset.price),
      );
    } else {
      copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return copy;
  }, [alertsForAsset, sort, asset]);

  const triggeredAlerts = useMemo(
    () => (asset ? triggeredForAsset(asset.ticker) : []),
    [asset, triggeredForAsset],
  );

  if (!asset) {
    return (
      <View style={[s.root, { backgroundColor: c.bg }]}>
        <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={s.iconBtn}
          >
            <Feather name="x" size={26} color={c.text} />
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>
        <View style={s.fallback}>
          <Text style={{ color: c.textMuted }}>Activo no encontrado.</Text>
        </View>
      </View>
    );
  }

  const handleDelete = async (alert: PriceAlert) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    /* Sin toast de confirmación — la fila desaparece del listado y
     * eso ya comunica que el delete pasó. Sólo mostramos toast en
     * caso de error porque sino el revert del optimistic se vería
     * silencioso y el user no sabría qué falló. */
    try {
      await remove(alert.id);
    } catch {
      show("No pudimos eliminar la alerta", { variant: "error" });
    }
  };

  const handleTogglePause = async (alert: PriceAlert) => {
    const willPause = alert.status === "active";
    Haptics.selectionAsync().catch(() => {});
    /* Sin toast de confirmación — la fila pasa a 40 % opacity con
     * label "Pausada" (o vuelve a la apariencia normal). Esa
     * transición ya comunica el cambio de estado. */
    try {
      await setPaused(alert.id, willPause);
    } catch {
      show("No pudimos actualizar la alerta", { variant: "error" });
    }
  };

  /* Header sticky-style — mismo bloque centrado que aparece en el
   * stock detail al scrollear: precio grande + fila chica con
   * ticker · pct% del día. El X close va a la izquierda; spacer
   * del mismo ancho a la derecha para que el bloque centrado
   * quede REAL al medio (no comido por el botón). */
  const cur = assetCurrency(asset);
  const dayUp = asset.change >= 0;
  const deltaColor = dayUp ? c.brand : c.red;

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.back();
          }}
          hitSlop={12}
          style={s.iconBtn}
        >
          <Feather name="x" size={26} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {/* Spacer simétrico al iconBtn izquierdo para que el sticky
         *  overlay (centrado real con left:0 right:0) no quede
         *  visualmente desplazado hacia la derecha. */}
        <View style={s.iconBtn} />

        <View
          style={[s.stickyOverlay, { top: insets.top + 12 }]}
          pointerEvents="none"
        >
          <Text
            style={[s.stickyPrice, { color: c.text }]}
            numberOfLines={1}
          >
            {formatMoney(asset.price, cur)}
          </Text>
          <View style={s.stickyRow}>
            <Text style={[s.stickyTicker, { color: c.textMuted }]}>
              {asset.ticker}
            </Text>
            <Text style={[s.stickyDot, { color: c.textMuted }]}>·</Text>
            <Text style={[s.stickyPct, { color: deltaColor }]}>
              {formatPct(asset.change)}
            </Text>
          </View>
        </View>
      </View>

      {/* Título de la pantalla — arriba de los tabs. Bold + subtítulo
       *  gris tenue. Comunica DE QUÉ va esta pantalla antes de elegir
       *  Precio / Indicadores. */}
      <View style={s.screenIntro}>
        <Text style={[s.screenTitle, { color: c.text }]}>
          Alertas personalizadas
        </Text>
        <Text style={[s.screenSubtitle, { color: c.textMuted }]}>
          Monitoreamos el mercado por vos, las 24 horas.
        </Text>
      </View>

      <View style={[s.tabsRow, { paddingHorizontal: 24 }]}>
        <TabPill
          label="Precio"
          active={tab === "price"}
          onPress={() => setTab("price")}
        />
        <TabPill
          label="Indicadores"
          active={tab === "indicator"}
          onPress={() => setTab("indicator")}
        />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            key={mode}
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={refreshTint}
            colors={[refreshTint]}
            progressViewOffset={8}
          />
        }
      >
        {tab === "price" ? (
          <>
            {sortedAlerts.length === 0 && triggeredAlerts.length === 0 ? (
              <EmptyState
                illustration={<AlertBellIllustration size={184} />}
                text="Definí un precio objetivo y recibí una notificación instantánea en tu celular cuando el activo lo cruce."
              />
            ) : null}

            {sortedAlerts.length > 0 ? (
              <View style={s.section}>
                {/* Header columnado — espeja exactamente las columnas
                 *  del row de alertas: title (col 1, flex), label del
                 *  formato (col 2, mismo width que alertDist), ghost
                 *  slot del Toggle (col 3, mismo width 40), sort
                 *  (col 4, mismo width que el trash). Resultado: el
                 *  "% al objetivo ▾" queda centrado SOBRE la columna
                 *  de distancia, y el botón de orden queda ALINEADO
                 *  a la derecha igual que el trash de cada fila. */}
                <View style={s.sectionHeader}>
                  {/* Mismo layout que el row: left flex 1 +
                   *  center intrínseco + right flex 1. Centro
                   *  geométrico = x=fullWidth/2 → alineado con el
                   *  value de cada fila. */}
                  <View style={s.alertSideLeft}>
                    <Text
                      style={[s.sectionTitle, { color: c.text }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.45}
                    >
                      Alertas activas ({sortedAlerts.length})
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setDistFormat(distFormat === "%" ? "$" : "%");
                    }}
                    hitSlop={6}
                    style={s.alertCenter}
                    accessibilityLabel={
                      distFormat === "%"
                        ? "Cambiar a distancia en monto"
                        : "Cambiar a distancia en porcentaje"
                    }
                  >
                    <View style={s.distFormatBtn}>
                      {/* "%" / "$" sale como Text aparte para dejar
                          un margen visible (~2 px) entre el símbolo
                          y "al objetivo" — sin esto leía pegado. */}
                      <Text
                        style={[s.distFormatText, { color: c.textMuted }]}
                        numberOfLines={1}
                      >
                        {distFormat === "%" ? "%" : "$"}
                      </Text>
                      <Text
                        style={[
                          s.distFormatText,
                          s.distFormatTextRest,
                          { color: c.textMuted },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.45}
                      >
                        al objetivo
                      </Text>
                      <Feather
                        name="chevron-down"
                        size={14}
                        color={c.textMuted}
                        style={{ marginLeft: 2, marginTop: 1 }}
                      />
                    </View>
                  </Pressable>
                  <View style={s.alertSideRight}>
                    <Pressable
                      ref={sortBtnRef}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        sortBtnRef.current?.measureInWindow(
                          (x, y, width, height) => {
                            setSortAnchor({
                              top: y + height + 6,
                              right: Math.max(8, windowW - (x + width)),
                            });
                            setSortMenuOpen(true);
                          },
                        );
                      }}
                      hitSlop={10}
                      style={s.sortIconBtn}
                      accessibilityLabel="Cambiar orden de la lista"
                    >
                      <Feather name="sliders" size={16} color={c.textMuted} />
                    </Pressable>
                  </View>
                </View>
                <View style={s.list}>
                  {sortedAlerts.map((alert, i) => (
                    <SwipableAlertRow
                      key={alert.id}
                      alert={alert}
                      asset={asset}
                      withTopDivider={i > 0}
                      distFormat={distFormat}
                      onEdit={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setEditingAlert(alert);
                      }}
                      onDelete={() => handleDelete(alert)}
                      onTogglePause={() => handleTogglePause(alert)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {triggeredAlerts.length > 0 ? (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Text style={[s.sectionTitle, { color: c.text }]}>
                    Historial
                  </Text>
                  <Text style={[s.sectionMeta, { color: c.textMuted }]}>
                    {triggeredAlerts.length} disparada
                    {triggeredAlerts.length === 1 ? "" : "s"}
                  </Text>
                </View>
                <View style={s.list}>
                  {triggeredAlerts.map((alert, i) => (
                    <TriggeredRow
                      key={alert.id}
                      alert={alert}
                      asset={asset}
                      withTopDivider={i > 0}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <>
            {sortedIndicators.length === 0 ? (
              <EmptyState
                illustration={<IndicatorChartIllustration size={200} />}
                text="Elegí un indicador técnico y recibí una notificación instantánea en el celular cuando cruce el umbral que configuraste."
              />
            ) : null}

            {sortedIndicators.length > 0 ? (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <View style={s.alertSideLeft}>
                    <Text
                      style={[s.sectionTitle, { color: c.text }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.45}
                    >
                      Alertas activas ({sortedIndicators.length})
                    </Text>
                  </View>
                  <View style={s.alertCenter} />
                  <View style={s.alertSideRight}>
                    <Pressable
                      ref={sortBtnRef}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        sortBtnRef.current?.measureInWindow(
                          (x, y, width, height) => {
                            setSortAnchor({
                              top: y + height + 6,
                              right: Math.max(8, windowW - (x + width)),
                            });
                            setSortMenuOpen(true);
                          },
                        );
                      }}
                      hitSlop={10}
                      style={s.sortIconBtn}
                      accessibilityLabel="Cambiar orden de la lista"
                    >
                      <Feather name="sliders" size={16} color={c.textMuted} />
                    </Pressable>
                  </View>
                </View>
                <View style={s.list}>
                  {sortedIndicators.map((alert, i) => (
                    <SwipableIndicatorRow
                      key={alert.id}
                      alert={alert}
                      asset={asset}
                      withTopDivider={i > 0}
                      onEdit={() => setDetailIndicator(alert)}
                      onDelete={async () => {
                        try {
                          await removeIndicator(alert.id);
                        } catch {
                          show("No pudimos eliminar la alerta", {
                            variant: "error",
                          });
                        }
                      }}
                      onTogglePause={async () => {
                        const willPause = alert.status === "active";
                        Haptics.selectionAsync().catch(() => {});
                        try {
                          await setIndicatorPaused(alert.id, willPause);
                        } catch {
                          show("No pudimos actualizar la alerta", {
                            variant: "error",
                          });
                        }
                      }}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <View
        style={[
          s.ctaWrap,
          { paddingBottom: insets.bottom + 12 },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            s.cta,
            {
              /* Botón principal — ink/text neutro. El brand verde
               * lo reservamos para el CTA del AlertSheet (la
               * confirmación final). */
              backgroundColor: c.text,
              opacity: pressed ? 0.86 : 1,
            },
          ]}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            if (tab === "price") setCreateOpen(true);
            else setIndicatorCreateOpen(true);
          }}
        >
          <Text style={[s.ctaText, { color: c.bg }]}>
            Agregar alerta
          </Text>
        </Pressable>
      </View>

      <SortMenu
        visible={sortMenuOpen}
        sort={sort}
        onSelect={(next) => {
          if (next !== sort) {
            Haptics.selectionAsync().catch(() => {});
            setSort(next);
          }
          setSortMenuOpen(false);
        }}
        onClose={() => setSortMenuOpen(false)}
        anchor={sortAnchor}
      />

      <AlertSheet
        key={`create-${asset.ticker}`}
        visible={createOpen}
        asset={asset}
        onClose={() => setCreateOpen(false)}
      />

      {editingAlert ? (
        <AlertSheet
          key={`edit-${editingAlert.id}`}
          visible
          asset={asset}
          editingAlert={editingAlert}
          onClose={() => setEditingAlert(null)}
        />
      ) : null}

      <IndicatorSheet
        key={`ind-create-${asset.ticker}`}
        visible={indicatorCreateOpen}
        asset={asset}
        onClose={() => setIndicatorCreateOpen(false)}
      />

      {editingIndicator ? (
        <IndicatorSheet
          key={`ind-edit-${editingIndicator.id}`}
          visible
          asset={asset}
          editingAlert={editingIndicator}
          onClose={() => setEditingIndicator(null)}
        />
      ) : null}

      <IndicatorDetailSheet
        visible={!!detailIndicator}
        alert={detailIndicator}
        asset={asset}
        onClose={() => setDetailIndicator(null)}
        onEdit={(a) => {
          setDetailIndicator(null);
          // Pequeño delay para que el detail termine su slide-out
          // antes de que abra el sheet de edit, sino se solapan los
          // modales y queda raro.
          setTimeout(() => setEditingIndicator(a), 240);
        }}
      />
    </View>
  );
}

/* ─── Tabs ─────────────────────────────────────────────────────── */

function TabPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={[
        s.tabPill,
        {
          backgroundColor: active ? c.surfaceHover : "transparent",
        },
      ]}
    >
      <Text
        style={[
          s.tabPillText,
          {
            color: active ? c.text : c.textMuted,
            fontFamily: active ? fontFamily[700] : fontFamily[600],
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ─── Sort menu (popup chico al tocar el ícono de sliders) ──────── */

function SortMenu({
  visible,
  sort,
  onSelect,
  onClose,
  anchor,
}: {
  visible: boolean;
  sort: Sort;
  onSelect: (next: Sort) => void;
  onClose: () => void;
  /** Posición absoluta donde aparece el popup — top + right desde
   *  el viewport. Calculada midiendo el ícono que lo dispara. */
  anchor: { top: number; right: number };
}) {
  const { c } = useTheme();
  if (!visible) return null;
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop full-screen — tap fuera del menú lo cierra. Sin
       *  bg dim, queremos un menú "ligero" estilo iOS context menu. */}
      <Pressable style={s.sortMenuBackdrop} onPress={onClose} />

      {/* Menú anclado debajo del ícono de sliders — top + right en
       *  coordenadas de viewport, calculados con measureInWindow al
       *  abrir el popup. */}
      <View
        style={[
          s.sortMenu,
          {
            top: anchor.top,
            right: anchor.right,
            backgroundColor: c.surface,
            borderColor: c.border,
            shadowColor: "#000",
          },
        ]}
      >
        {(
          [
            { key: "proximity", label: "Proximidad al objetivo" },
            { key: "createdAt", label: "Fecha de creación" },
          ] as const
        ).map((opt, i) => {
          const selected = sort === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => onSelect(opt.key)}
              style={({ pressed }) => [
                s.sortMenuItem,
                i > 0 && {
                  borderTopColor: c.border,
                  borderTopWidth: StyleSheet.hairlineWidth,
                },
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text
                style={[
                  s.sortMenuLabel,
                  {
                    color: c.text,
                    fontFamily: selected ? fontFamily[700] : fontFamily[500],
                  },
                ]}
              >
                {opt.label}
              </Text>
              {selected ? (
                <Feather name="check" size={16} color={c.brand} />
              ) : (
                <View style={{ width: 16 }} />
              )}
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

/* ─── Empty state ──────────────────────────────────────────────── */

function EmptyState({
  illustration,
  title,
  text,
}: {
  illustration: React.ReactNode;
  title?: string;
  text: string;
}) {
  const { c } = useTheme();
  /* Centro ÓPTICO en lugar del matemático: spacer top 1 + bottom 2.
   * El centro visual queda en el primer tercio del espacio disponible
   * — se siente "centrado" sin estar pegado al medio (que se lee
   * como muy abajo). Truco clásico de empty states. */
  return (
    <View style={s.emptyWrap}>
      <View style={{ flex: 1 }} />
      {title ? (
        <Text style={[s.emptyTitle, { color: c.text }]}>{title}</Text>
      ) : null}
      <View style={s.emptyIllustration}>{illustration}</View>
      <Text style={[s.emptyText, { color: c.textMuted }]}>{text}</Text>
      <View style={{ flex: 2 }} />
    </View>
  );
}

/* ─── Row de alerta activa ─────────────────────────────────────── */

/* Distancia mínima en X para considerar la swipe como delete (px). */
const SWIPE_DELETE_THRESHOLD = 96;
/* Velocidad mínima para "fling-to-delete" sin llegar al threshold. */
const SWIPE_DELETE_VELOCITY = 900;
/* Resistance al pasarse del threshold — el row no se va para siempre,
 * frena visualmente para indicar que ya está listo. */
const SWIPE_OVERSHOOT_DAMPING = 0.45;

function SwipableAlertRow({
  alert,
  asset,
  withTopDivider,
  distFormat,
  onEdit,
  onDelete,
  onTogglePause,
}: {
  alert: PriceAlert;
  asset: Asset;
  withTopDivider: boolean;
  /** Formato del valor de distancia: "%" muestra +X.XX%, "$"
   *  muestra +X,XX (currency). Lo elige el toggle del header. */
  distFormat: "%" | "$";
  onEdit: () => void;
  onDelete: () => void;
  onTogglePause: () => void;
}) {
  const { c, mode } = useTheme();
  const cur = assetCurrency(asset);
  const isPaused = alert.status === "paused";
  const dirLabel = alert.direction === "above" ? "Sube a" : "Baja a";
  const dirColor = alert.direction === "above" ? c.brand : c.red;
  /* Convención de marca: cuando un botón / fondo es verde o naranja
   * (brand / c.red), el texto es BLANCO en light mode y NEGRO en
   * dark mode. Así el texto contrasta bien con el fondo en cada tema. */
  const onColorInk = mode === "dark" ? "#0E0F0C" : "#FFFFFF";

  const distAbs = alert.threshold - asset.price;
  const distPct = asset.price > 0 ? (distAbs / asset.price) * 100 : 0;
  /* Signo explícito para %; en $ el formatMoney recibe Math.abs y
   * el signo va por separado, así que también ponemos "-" cuando
   * el monto es negativo (sino el "$ al objetivo" mostraría sólo
   * el valor positivo y se confundiría con un Sube a). */
  const distSign = distAbs > 0 ? "+" : distAbs < 0 ? "-" : "";
  const rowOpacity = isPaused ? 0.4 : 1;

  /* Swipe-left-to-delete con react-native-gesture-handler.
   *
   *  - Pan se activa SOLO con movimiento horizontal ≥ 12 px (deja
   *    pasar taps y permite que ScrollView padre scrollee vertical).
   *  - failOffsetY([-12,12]): si el dedo se va a vertical primero,
   *    Pan falla (no captura, ScrollView gana).
   *  - Solo deja swipear hacia la izquierda. Hacia la derecha clamp
   *    a 0 con un poco de elasticidad (≤ 12 px) sólo para feel.
   *  - Al pasar el threshold (96 px) o velocidad alta (900 px/s),
   *    completa la animación + dispara onDelete vía runOnJS.
   *  - Sino spring-back a 0. */
  const tx = useSharedValue(0);
  const rowH = useSharedValue(72);
  const opacity = useSharedValue(1);

  const triggerDelete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onDelete();
  }, [onDelete]);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      "worklet";
      if (e.translationX < 0) {
        // Pasado el threshold, aplicamos damping para que el row no
        // se vaya volando — feel iOS Mail / Robinhood.
        if (e.translationX < -SWIPE_DELETE_THRESHOLD) {
          const overshoot = e.translationX + SWIPE_DELETE_THRESHOLD;
          tx.value =
            -SWIPE_DELETE_THRESHOLD + overshoot * SWIPE_OVERSHOOT_DAMPING;
        } else {
          tx.value = e.translationX;
        }
      } else {
        // Resistencia hacia la derecha (no se permite swipe-right).
        tx.value = Math.min(12, e.translationX * 0.25);
      }
    })
    .onEnd((e) => {
      "worklet";
      const shouldDelete =
        e.translationX < -SWIPE_DELETE_THRESHOLD ||
        e.velocityX < -SWIPE_DELETE_VELOCITY;
      if (shouldDelete) {
        // Slide off + collapse + fade in paralelo, después dispara delete.
        tx.value = withTiming(-500, {
          duration: 180,
          easing: Easing.out(Easing.cubic),
        });
        opacity.value = withTiming(0, { duration: 160 });
        rowH.value = withTiming(
          0,
          { duration: 220, easing: Easing.out(Easing.cubic) },
          (finished) => {
            "worklet";
            if (finished) runOnJS(triggerDelete)();
          },
        );
      } else {
        tx.value = withSpring(0, {
          damping: 22,
          stiffness: 240,
          mass: 0.6,
        });
      }
    });

  const rowAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));
  const containerAnimStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    height: rowH.value === 72 ? undefined : rowH.value,
  }));
  // Bg "Eliminar" — fade in a medida que el row se mueve hacia la
  // izquierda; el icono de trash se escala apenas pasa el threshold
  // para señalar que ya está listo.
  const bgAnimStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.abs(tx.value) / SWIPE_DELETE_THRESHOLD);
    return {
      opacity: interpolate(Math.abs(tx.value), [0, 24], [0, 1]),
      transform: [
        {
          scale: interpolate(progress, [0.6, 1, 1.2], [0.92, 1, 1.05]),
        },
      ],
    };
  });

  return (
    <Animated.View
      onLayout={(e) => {
        // Capturamos la altura real para poder colapsar a 0 en delete.
        if (rowH.value === 72) rowH.value = e.nativeEvent.layout.height;
      }}
      style={[
        s.swipeRoot,
        withTopDivider && {
          borderTopColor: c.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        containerAnimStyle,
      ]}
    >
      {/* Bg destructivo absoluto — vive debajo del row animado, se
          revela al swipear hacia la izquierda. Naranja c.red, label
          "Eliminar" + ícono trash en blanco. Pegado al borde derecho
          del row. */}
      <View
        pointerEvents="none"
        style={[s.swipeBg, { backgroundColor: c.red }]}
      >
        <Animated.View style={[s.swipeBgInner, bgAnimStyle]}>
          <Feather name="trash-2" size={18} color={onColorInk} />
          <Text style={[s.swipeBgLabel, { color: onColorInk }]}>
            Eliminar
          </Text>
        </Animated.View>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            s.alertRow,
            { backgroundColor: c.bg },
            rowAnimStyle,
          ]}
        >
          {/* 3 columnas en flex layout (NO absolute, NO posiciones
              hardcoded): left flex 1 + center intrínseco + right flex 1.
              El center toma su ancho de contenido y las dos cols
              flexibles se reparten lo que queda EQUITATIVAMENTE.
              Como el header usa el mismo esquema y el row tiene el
              mismo width, ambos centros caen en x=fullWidth/2 (centro
              geométrico). overflow hidden + adjustsFontSizeToFit en
              los Text de los lados fuerza el shrinkado del texto
              cuando es más ancho que el wrapper, así nunca se mete
              sobre el center. */}
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => [
              s.alertSideLeft,
              { opacity: pressed ? 0.7 : rowOpacity },
            ]}
            accessibilityLabel={`Editar alerta — ${dirLabel} ${formatMoney(alert.threshold, cur)}`}
          >
            {/* "Sube a" / "Baja a" + precio en una flex row con
                marginLeft 4 entre ellos, así hay un gap visible
                entre la dirección coloreada y el número objetivo
                (en vez del space-character pegado de antes). El
                precio shrinkea si no entra. */}
            <View style={s.alertLeftRow}>
              <Text
                style={[s.alertLeft, { color: dirColor }]}
                numberOfLines={1}
              >
                {dirLabel}
              </Text>
              <Text
                style={[
                  s.alertLeft,
                  s.alertLeftPrice,
                  { color: c.text },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.45}
              >
                {formatMoney(alert.threshold, cur)}
              </Text>
            </View>
          </Pressable>
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => [
              s.alertCenter,
              { opacity: pressed ? 0.7 : rowOpacity },
            ]}
            accessibilityLabel="Editar alerta"
          >
            <Text
              style={[s.alertDist, { color: dirColor }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.45}
            >
              {distFormat === "%"
                ? `${distSign}${Math.abs(distPct).toFixed(2)}%`
                : `${distSign}${formatMoney(Math.abs(distAbs), cur)}`}
            </Text>
          </Pressable>
          <View style={s.alertSideRight}>
            <Toggle
              value={!isPaused}
              onValueChange={() => onTogglePause()}
            />
          </View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

/* ─── Row de alerta de indicador (RSI/SMA/MACD/Bollinger/Volumen) ──
 *
 * Mismo lenguaje visual que SwipableAlertRow pero con datos de
 * indicator alerts. Layout 3-col 45/35/20:
 *   - Left (45 %): condición coloreada (verde/naranja según dirección)
 *   - Center (35 %): valor actual del indicador (mock determinístico)
 *   - Right (20 %): toggle de pausar
 *
 * Swipe-left para borrar (bg c.red con ícono trash + "Eliminar"),
 * tap → onEdit (abre IndicatorSheet con editingAlert pre-cargada).
 */

function SwipableIndicatorRow({
  alert,
  asset,
  withTopDivider,
  onEdit,
  onDelete,
  onTogglePause,
}: {
  alert: IndicatorAlert;
  asset: Asset;
  withTopDivider: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePause: () => void;
}) {
  const { c, mode } = useTheme();
  const isPaused = alert.status === "paused";
  const rowOpacity = isPaused ? 0.4 : 1;
  const onColorInk = mode === "dark" ? "#0E0F0C" : "#FFFFFF";

  const display = useMemo(
    () => describeIndicatorAlert(alert, asset, c),
    [alert, asset, c],
  );

  const tx = useSharedValue(0);
  const rowH = useSharedValue(72);
  const opacity = useSharedValue(1);

  const triggerDelete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onDelete();
  }, [onDelete]);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      "worklet";
      if (e.translationX < 0) {
        if (e.translationX < -SWIPE_DELETE_THRESHOLD) {
          const overshoot = e.translationX + SWIPE_DELETE_THRESHOLD;
          tx.value =
            -SWIPE_DELETE_THRESHOLD + overshoot * SWIPE_OVERSHOOT_DAMPING;
        } else {
          tx.value = e.translationX;
        }
      } else {
        tx.value = Math.min(12, e.translationX * 0.25);
      }
    })
    .onEnd((e) => {
      "worklet";
      const shouldDelete =
        e.translationX < -SWIPE_DELETE_THRESHOLD ||
        e.velocityX < -SWIPE_DELETE_VELOCITY;
      if (shouldDelete) {
        tx.value = withTiming(-500, {
          duration: 180,
          easing: Easing.out(Easing.cubic),
        });
        opacity.value = withTiming(0, { duration: 160 });
        rowH.value = withTiming(
          0,
          { duration: 220, easing: Easing.out(Easing.cubic) },
          (finished) => {
            "worklet";
            if (finished) runOnJS(triggerDelete)();
          },
        );
      } else {
        tx.value = withSpring(0, {
          damping: 22,
          stiffness: 240,
          mass: 0.6,
        });
      }
    });

  const rowAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));
  const containerAnimStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    height: rowH.value === 72 ? undefined : rowH.value,
  }));
  const bgAnimStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.abs(tx.value) / SWIPE_DELETE_THRESHOLD);
    return {
      opacity: interpolate(Math.abs(tx.value), [0, 24], [0, 1]),
      transform: [
        {
          scale: interpolate(progress, [0.6, 1, 1.2], [0.92, 1, 1.05]),
        },
      ],
    };
  });

  return (
    <Animated.View
      onLayout={(e) => {
        if (rowH.value === 72) rowH.value = e.nativeEvent.layout.height;
      }}
      style={[
        s.swipeRoot,
        withTopDivider && {
          borderTopColor: c.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        containerAnimStyle,
      ]}
    >
      <View
        pointerEvents="none"
        style={[s.swipeBg, { backgroundColor: c.red }]}
      >
        <Animated.View style={[s.swipeBgInner, bgAnimStyle]}>
          <Feather name="trash-2" size={18} color={onColorInk} />
          <Text style={[s.swipeBgLabel, { color: onColorInk }]}>
            Eliminar
          </Text>
        </Animated.View>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            s.alertRow,
            { backgroundColor: c.bg },
            rowAnimStyle,
          ]}
        >
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => [
              s.alertSideLeft,
              { opacity: pressed ? 0.7 : rowOpacity },
            ]}
            accessibilityLabel={`Editar alerta — ${display.label}`}
          >
            <Text
              style={[s.alertLeft, { color: display.color }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.45}
            >
              {display.label}
            </Text>
          </Pressable>
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => [
              s.alertCenter,
              { opacity: pressed ? 0.7 : rowOpacity },
            ]}
            accessibilityLabel="Editar alerta"
          >
            <Text
              style={[s.alertDist, { color: c.textMuted }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.45}
            >
              {display.value}
            </Text>
          </Pressable>
          <View style={s.alertSideRight}>
            <Toggle
              value={!isPaused}
              onValueChange={() => onTogglePause()}
            />
          </View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

/** Describe una IndicatorAlert para el row de la lista — devuelve
 *  el label coloreado (condición), el color del label, y el valor
 *  actual del indicador (mock determinístico basado en asset.price
 *  + ticker hash). En producción el valor vendría del backend en
 *  tiempo real. */
function describeIndicatorAlert(
  alert: IndicatorAlert,
  asset: Asset,
  c: ReturnType<typeof useTheme>["c"],
): { label: string; color: string; value: string } {
  // Hash determinístico simple del ticker para variar el mock value.
  const seed = Array.from(asset.ticker).reduce(
    (h, ch) => (h * 31 + ch.charCodeAt(0)) | 0,
    0,
  );
  const noise = (Math.abs(seed) % 100) / 100; // 0..1
  if (alert.type === "ma") {
    const above = alert.condition === "above";
    const factor = 0.92 + noise * 0.16; // ±8%
    const ma = asset.price * factor;
    const variantLabel = alert.variant.toUpperCase();
    return {
      label: above
        ? `Precio cruza sobre ${variantLabel} ${alert.period}`
        : `Precio cruza bajo ${variantLabel} ${alert.period}`,
      color: above ? c.brand : c.red,
      value: `${variantLabel} ${alert.period}: ${formatNumber(ma)}`,
    };
  }
  if (alert.type === "rsi") {
    const above = alert.condition === "above";
    const rsi = above ? 40 + noise * 30 : 35 + noise * 25;
    return {
      label: above
        ? `RSI cruza > ${alert.threshold}`
        : `RSI cruza < ${alert.threshold}`,
      color: above ? c.red : c.brand,
      value: `RSI: ${rsi.toFixed(1)}`,
    };
  }
  if (alert.type === "macd") {
    const macd = (noise - 0.5) * 0.5;
    let label: string;
    let color: string;
    if (alert.condition === "bullish_signal") {
      label = "MACD cruce alcista";
      color = c.brand;
    } else if (alert.condition === "bearish_signal") {
      label = "MACD cruce bajista";
      color = c.red;
    } else if (alert.condition === "zero_up") {
      label = "MACD cruza cero ↑";
      color = c.brand;
    } else {
      label = "MACD cruza cero ↓";
      color = c.red;
    }
    return {
      label,
      color,
      value: `MACD: ${macd >= 0 ? "+" : ""}${macd.toFixed(2)}`,
    };
  }
  if (alert.type === "bollinger") {
    if (alert.condition === "squeeze") {
      return {
        label: "Squeeze de bandas",
        color: c.text,
        value: `σ ${alert.deviation.toFixed(1).replace(".", ",")}`,
      };
    }
    const upper = alert.condition === "touch_upper";
    const factor = upper ? 1.04 + noise * 0.04 : 0.92 + noise * 0.04;
    const band = asset.price * factor;
    return {
      label: upper ? "Toca banda superior" : "Toca banda inferior",
      color: upper ? c.red : c.brand,
      value: `${upper ? "Sup" : "Inf"}: ${formatNumber(band)}`,
    };
  }
  // volume
  const cur = 0.8 + noise * 1.4; // 0.8x - 2.2x
  return {
    label: `Volumen > ${alert.multiplier.toFixed(1).replace(".", ",")}x prom.`,
    color: c.text,
    value: `${cur.toFixed(1).replace(".", ",")}x prom.`,
  };
}

function formatNumber(n: number): string {
  // Formato corto con 2 decimales, separador miles con ".".
  const abs = Math.abs(n);
  if (abs >= 1000) {
    return n.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return n.toFixed(2).replace(".", ",");
}

/* ─── Row de alerta disparada (historial) ──────────────────────── */

function TriggeredRow({
  alert,
  asset,
  withTopDivider,
}: {
  alert: PriceAlert;
  asset: Asset;
  withTopDivider: boolean;
}) {
  const { c } = useTheme();
  const cur = assetCurrency(asset);
  const dirIcon = alert.direction === "above" ? "arrow-up" : "arrow-down";
  const dirLabel = alert.direction === "above" ? "Subió a" : "Bajó a";
  const triggeredOn = alert.triggeredAt
    ? formatTriggeredDate(alert.triggeredAt)
    : "—";
  const triggeredAtPrice = alert.triggeredPrice ?? alert.threshold;
  return (
    <View
      style={[
        s.alertRow,
        s.triggeredRow,
        { backgroundColor: c.bg, opacity: 0.78 },
        withTopDivider && {
          borderTopColor: c.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={[s.dirBadge, { backgroundColor: c.surfaceHover }]}>
        <Feather name={dirIcon} size={16} color={c.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.alertLabel, { color: c.textMuted }]}>
          {dirLabel} · {triggeredOn}
        </Text>
        <Text style={[s.alertPrice, { color: c.text }]}>
          {formatMoney(alert.threshold, cur)}
        </Text>
        <Text style={[s.alertDistance, { color: c.textMuted }]}>
          Disparada a {formatMoney(triggeredAtPrice, cur)}
        </Text>
      </View>
      <View
        style={[s.checkBubble, { backgroundColor: c.brandDim }]}
      >
        <Feather name="check" size={14} color={c.brand} />
      </View>
    </View>
  );
}

function formatTriggeredDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `Hoy ${hh}:${mm}`;
  }
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}`;
}

const s = StyleSheet.create({
  root: { flex: 1 },

  /* Top bar — X (left) + sticky-style overlay centrado (precio +
   * ticker · pct%) replicando el header del stock detail. Misma
   * geometría que detail.tsx pero estática (no scroll-driven, la
   * pantalla de alertas no necesita el fade-in). */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    position: "relative",
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  stickyOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  stickyPrice: {
    fontFamily: fontFamily[500],
    fontSize: 17,
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  stickyRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 5,
    marginTop: 1,
  },
  stickyTicker: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: 0,
  },
  stickyDot: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    opacity: 0.6,
  },
  stickyPct: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: -0.05,
  },

  /* Intro de pantalla — título bold + subtítulo gris tenue arriba
   * de los tabs. Padding horizontal 24 para alinear con la lista
   * y los tabs. */
  screenIntro: {
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 14,
  },
  screenTitle: {
    fontFamily: fontFamily[700],
    fontSize: 28,
    letterSpacing: -0.9,
    lineHeight: 32,
  },
  screenSubtitle: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    marginTop: 6,
  },

  tabsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  tabPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    flex: 1,
    alignItems: "center",
  },
  tabPillText: {
    fontSize: 14,
    letterSpacing: -0.1,
  },

  /* Header right-side: estructura idéntica al row para que el
   * toggle quede arriba de la col de distancia y el sortIcon
   * arriba del trash. Mismo gap 12 que alertRow. */
  /* Mismo ancho que alertDist en el row + content centrado, así el
   * label "% al objetivo ▾" queda EXACTAMENTE centrado sobre el
   * valor de distancia de abajo. */
  distFormatBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  /* Label del formato — 13 / 500, sutil para no competir con el
   * título "Alertas activas (N)" (15 / 700) ni con la data del row. */
  distFormatText: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  /* Margen 2 px entre el símbolo "%" / "$" y "al objetivo" — sin
   * esto leía pegado al símbolo. */
  distFormatTextRest: {
    marginLeft: 2,
  },
  /* Sort icon — vive en la columna del Toggle (mismo width 40),
   * centrado adentro. El row de abajo tiene Toggle 40 en esta
   * misma posición, así el icono queda exactamente arriba. */
  sortIconBtn: {
    width: 40,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Sort menu (popup que se abre al tocar el ícono de sliders).
   * Anclado top-right, fuera del flujo, sin backdrop dim. */
  sortMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sortMenu: {
    position: "absolute",
    minWidth: 240,
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
    /* Sombra sutil para que se despegue visualmente del bg sin
     * sentirse pesado. iOS shadow + Android elevation. */
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  sortMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  sortMenuLabel: {
    fontSize: 14,
    letterSpacing: -0.15,
    flex: 1,
  },

  /* Empty state — bell + texto descriptivo viven como una sola
   * unidad. Centrado óptico via spacers internos (top 1, bottom 2)
   * en el componente — queda en el primer tercio visual del espacio
   * disponible para que se sienta centrado y no muy abajo. */
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.5,
    marginBottom: 16,
    textAlign: "center",
  },
  emptyIllustration: {
    marginBottom: 18,
  },
  emptyText: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: -0.1,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Sections (active list, history) */
  section: {
    marginBottom: 12,
  },
  /* Mismo paddingVertical que alertRow (12) para que el header y
   * cada fila tengan EXACTAMENTE el mismo alto vertical y la
   * grilla quede pareja. */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  sectionTitle: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  /* Layout 3-col con ANCHOS EXPLÍCITOS EN PORCENTAJE.
   *   Left 45 %  → más espacio para "Sube a $X" / título.
   *   Center 35 % → label "% al objetivo" + values.
   *   Right 20 %  → toggle / sort, alineado a la derecha.
   * Total 100 %. El center MIDDLE queda al 62.5 % del row, igual en
   * header y row → label y value en el mismo x exacto.
   * adjustsFontSizeToFit + overflow hidden absorben overflows. */
  alertSideLeft: {
    width: "45%",
    overflow: "hidden",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingLeft: 24,
    paddingRight: 6,
  },
  alertCenter: {
    width: "35%",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  alertSideRight: {
    width: "20%",
    overflow: "hidden",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingLeft: 6,
    paddingRight: 24,
  },
  sectionMeta: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
  },

  /* Lista — sin padding lateral. Cada row tiene su propio paddingHor
   * para permitir que el bg destructivo del swipe-to-delete se
   * revele edge-to-edge cuando arrastrás. */
  list: {
    paddingHorizontal: 0,
  },
  /* Wrapper de cada row swipeable. overflow hidden clipa el bg
   * destructivo absoluto del swipe-to-delete a los bordes del
   * wrapper — sin esto, el c.red se filtraba sobre el área del
   * borderTop al re-ordenar la lista (línea naranja entre filas). */
  swipeRoot: {
    overflow: "hidden",
  },
  /* Bg destructivo del swipe-to-delete — vive abajo del row, naranja
   * lleno, label "Eliminar" + ícono trash en blanco anclados a la
   * derecha. Position absolute para que no afecte el layout del row;
   * se revela cuando el row se desplaza por el Pan gesture. */
  swipeBg: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: 24,
  },
  swipeBgInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  /* Color del label se setea inline (depende del theme: blanco en
   * light, negro en dark — convención de marca para textos sobre
   * fondos brand/orange). */
  swipeBgLabel: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  /* Row de alerta — 3 columnas con proporciones fijas:
   *   col 1 (precio):      flex 5 → 50 %  (dentro de alertEditArea)
   *   col 2 (distancia):   flex 3 → 30 %  (dentro de alertEditArea)
   *   col 3 (toggle):      flex 2 → 20 %  (independiente)
   * Sin gap — las columnas se reparten todo el ancho disponible.
   * El delete vive como swipe-left; sin trash explícito. */
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  triggeredRow: {
    paddingVertical: 12,
  },
  /* Wrapper row para "Sube a"/"Baja a" + precio. flex shrink y
   * minWidth 0 permiten que el precio se shrinkee adentro de su
   * espacio sin empujar el wrapper. alignItems baseline alinea las
   * baselines de la dirección y el número (look más limpio). */
  alertLeftRow: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "baseline",
  },
  /* Texto del precio objetivo (col 1). 16 / 600. */
  alertLeft: {
    fontFamily: fontFamily[600],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  /* Margen 4 px entre la dirección "Sube a"/"Baja a" coloreada y
   * el precio objetivo. flexShrink 1 + minWidth 0 dejan que el
   * adjustsFontSizeToFit del Text se active cuando el precio es
   * más ancho que el espacio que le queda en el wrapper. */
  alertLeftPrice: {
    marginLeft: 4,
    flexShrink: 1,
    minWidth: 0,
  },
  /* Texto del % o $ de distancia (centro del row). 16 / 600 —
   * match con alertLeft. Centrado en el gap por los spacers flex 1
   * a cada lado. adjustsFontSizeToFit del Text shrinka en cripto
   * 100k+ si el valor crece más que el espacio disponible. */
  alertDist: {
    fontFamily: fontFamily[600],
    fontSize: 16,
    letterSpacing: -0.3,
    textAlign: "center",
  },

  /* Estilos del TriggeredRow (sección histórico) — layout viejo de
   * 2 líneas con dirBadge + label/precio/distance. Distinto del row
   * activo, así que mantienen sus propios styles. */
  dirBadge: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
    borderRadius: 18,
  },
  alertLabel: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
  },
  alertPrice: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  alertDistance: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
    marginTop: 2,
  },
  checkBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
  },

  /* CTA bottom */
  ctaWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  cta: {
    height: 54,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontFamily: fontFamily[800],
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
