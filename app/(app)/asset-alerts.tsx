import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
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
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
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
import { AlertBellIllustration } from "../../lib/components/illustrations/AlertBellIllustration";

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
  const { c } = useTheme();
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
   * $. Lo elige un mini segmented en el header de la sección y se
   * aplica a todas las filas. */
  const [distFormat, setDistFormat] = useState<"%" | "$">("%");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<PriceAlert | null>(null);

  const { activeForAsset, triggeredForAsset, setPaused, remove } = useAlerts();

  const alertsForAsset = useMemo(
    () => (asset ? activeForAsset(asset.ticker) : []),
    [asset, activeForAsset],
  );

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
      >
        {tab === "price" ? (
          <>
            {sortedAlerts.length === 0 && triggeredAlerts.length === 0 ? (
              <EmptyState
                illustration={<AlertBellIllustration size={160} />}
                text="Definí un precio objetivo y recibí una notificación instantánea en tu celular cuando el activo lo cruce."
              />
            ) : null}

            {sortedAlerts.length > 0 ? (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Text style={[s.sectionTitle, { color: c.text }]}>
                    Alertas activas ({sortedAlerts.length})
                  </Text>
                  {/* Mini segmented "% / $" + ícono de sort.
                   *  Mismo lenguaje visual que los tabs Precio/
                   *  Indicadores pero en miniatura. El segmented
                   *  decide qué muestra la col de distancia en cada
                   *  fila (porcentaje o monto en moneda nativa). */}
                  <View style={s.headerControls}>
                    <View
                      style={[
                        s.distSeg,
                        { backgroundColor: c.surfaceHover },
                      ]}
                    >
                      <Pressable
                        onPress={() => {
                          if (distFormat !== "%") {
                            Haptics.selectionAsync().catch(() => {});
                            setDistFormat("%");
                          }
                        }}
                        style={[
                          s.distSegBtn,
                          distFormat === "%" && {
                            backgroundColor: c.surfaceSunken,
                          },
                        ]}
                        hitSlop={4}
                      >
                        <Text
                          style={[
                            s.distSegText,
                            {
                              color:
                                distFormat === "%" ? c.text : c.textMuted,
                              fontFamily:
                                distFormat === "%"
                                  ? fontFamily[700]
                                  : fontFamily[600],
                            },
                          ]}
                        >
                          %
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          if (distFormat !== "$") {
                            Haptics.selectionAsync().catch(() => {});
                            setDistFormat("$");
                          }
                        }}
                        style={[
                          s.distSegBtn,
                          distFormat === "$" && {
                            backgroundColor: c.surfaceSunken,
                          },
                        ]}
                        hitSlop={4}
                      >
                        <Text
                          style={[
                            s.distSegText,
                            {
                              color:
                                distFormat === "$" ? c.text : c.textMuted,
                              fontFamily:
                                distFormat === "$"
                                  ? fontFamily[700]
                                  : fontFamily[600],
                            },
                          ]}
                        >
                          $
                        </Text>
                      </Pressable>
                    </View>
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setSortMenuOpen(true);
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
          <EmptyState
            illustration={<AlertBellIllustration size={220} />}
            text="Las alertas por indicadores técnicos llegan próximamente — RSI, cruces de medias móviles y más."
          />
        )}
      </ScrollView>

      {tab === "price" ? (
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
              setCreateOpen(true);
            }}
          >
            <Text style={[s.ctaText, { color: c.bg }]}>
              Agregar alerta
            </Text>
          </Pressable>
        </View>
      ) : null}

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
        topOffset={insets.top + 100}
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
  topOffset,
}: {
  visible: boolean;
  sort: Sort;
  onSelect: (next: Sort) => void;
  onClose: () => void;
  topOffset: number;
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

      {/* Menú anclado top-right cerca del ícono de sliders. */}
      <View
        style={[
          s.sortMenu,
          {
            top: topOffset,
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

/* ─── Row de alerta activa con swipe gestures ──────────────────── */

const SWIPE_REVEAL = 84; // ancho del action expuesto al hacer swipe
const SWIPE_TRIGGER = 40; // px mínimos para considerar swipe válido

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
   *  muestra +X,XX (currency). Lo elige el segmented del header. */
  distFormat: "%" | "$";
  onEdit: () => void;
  onDelete: () => void;
  onTogglePause: () => void;
}) {
  const { c } = useTheme();
  const cur = assetCurrency(asset);
  const isPaused = alert.status === "paused";
  const dirLabel = alert.direction === "above" ? "Sube a" : "Baja a";
  /* "Sube a" verde brand, "Baja a" red/naranja. Cuando está pausada,
   * todo el texto va a 40 % opacity (incluyendo el verbo coloreado). */
  const dirColor = alert.direction === "above" ? c.brand : c.red;

  const distAbs = alert.threshold - asset.price;
  const distPct = asset.price > 0 ? (distAbs / asset.price) * 100 : 0;
  const distSign = distAbs > 0 ? "+" : "";
  const rowOpacity = isPaused ? 0.4 : 1;

  /* Swipe sólo a la izquierda → DELETE. El pause/resume vive en el
   * toggle iOS de la columna 4. */
  const tx = useSharedValue(0);
  const startX = useSharedValue(0);

  const triggerDelete = () => {
    onDelete();
    tx.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onBegin(() => {
      "worklet";
      startX.value = tx.value;
    })
    .onUpdate((e) => {
      "worklet";
      // Sólo permitimos arrastrar hacia la izquierda (translationX < 0).
      const next = startX.value + e.translationX;
      tx.value = Math.max(-SWIPE_REVEAL * 1.4, Math.min(0, next));
    })
    .onEnd((e) => {
      "worklet";
      const final = startX.value + e.translationX;
      if (final < -SWIPE_TRIGGER) {
        tx.value = withTiming(-400, { duration: 220 }, (finished) => {
          "worklet";
          if (finished) runOnJS(triggerDelete)();
        });
      } else {
        tx.value = withTiming(0, { duration: 200 });
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  const rightActionStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, -tx.value / SWIPE_TRIGGER)),
  }));

  return (
    <View
      style={[
        s.swipeRoot,
        withTopDivider && {
          borderTopColor: c.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      {/* Action layer — eliminar a la derecha (queda revelado al
       *  arrastrar la fila hacia la izquierda). */}
      <Animated.View
        style={[
          s.swipeRightAction,
          { backgroundColor: c.red },
          rightActionStyle,
        ]}
      >
        <Feather name="trash-2" size={18} color={c.onColor} />
        <Text style={[s.swipeActionText, { color: c.onColor }]}>
          Eliminar
        </Text>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[s.alertRow, { backgroundColor: c.bg }, rowStyle]}
        >
          {/* Cols 1-3 dentro de un Pressable que abre el editor.
              El toggle (col 4) vive AFUERA del Pressable para que su
              tap no dispare el editor. */}
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => [
              s.alertRowMain,
              { opacity: pressed ? 0.7 : rowOpacity },
            ]}
            accessibilityLabel={`Editar alerta — ${dirLabel} ${formatMoney(alert.threshold, cur)}`}
          >
            {/* Col 1: dirección + precio objetivo en el color de la
             *  dirección (verde si sube, naranja si baja). 16 / 600. */}
            <Text
              style={[s.alertLeft, { color: dirColor }]}
              numberOfLines={1}
            >
              {dirLabel} {formatMoney(alert.threshold, cur)}
            </Text>
            {/* Col 2 (única): distancia al objetivo en el formato
             *  elegido por el segmented del header (% o $). Gris
             *  tenue, 14 px. */}
            <Text
              style={[s.alertDist, { color: c.textMuted }]}
              numberOfLines={1}
            >
              {distFormat === "%"
                ? `${distSign}${distPct.toFixed(2)}%`
                : `${distSign}${formatMoney(Math.abs(distAbs), cur)}`}
            </Text>
          </Pressable>
          {/* Col 4: toggle iOS-style. ON = activa, OFF = pausada. */}
          <Switch
            value={!isPaused}
            onValueChange={() => onTogglePause()}
            trackColor={{ false: c.surfaceHover, true: c.brand }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={c.surfaceHover}
            style={s.alertToggle}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
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

  /* Header right-side: mini segmented "% | $" + ícono sort. Mismo
   * lenguaje visual que los tabs Precio/Indicadores pero ~60 px
   * total de ancho (chico). */
  headerControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  distSeg: {
    flexDirection: "row",
    padding: 2,
    borderRadius: radius.pill,
    borderCurve: "continuous",
  },
  distSegBtn: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  distSegText: {
    fontSize: 12,
    letterSpacing: 0,
  },
  sortIconBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -4,
  },

  /* Sort menu (popup que se abre al tocar el ícono de sliders).
   * Anclado top-right, fuera del flujo, sin backdrop dim. */
  sortMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sortMenu: {
    position: "absolute",
    right: 16,
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  sectionMeta: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
  },

  /* Lista */
  list: {
    paddingHorizontal: 24,
  },
  swipeRoot: {
    position: "relative",
    overflow: "hidden",
  },
  swipeRightAction: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: SWIPE_REVEAL,
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 8,
    flexDirection: "row",
    gap: 6,
  },
  swipeActionText: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.05,
  },
  /* Row de alerta — 4 columnas: ticker+dir+precio | % | $ | toggle.
   * Sin cards, sin íconos circulares. Filas separadas por hairline
   * border (configurado en s.swipeRoot). */
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  /* Pressable que envuelve cols 1-3 — su tap abre el editor. El
   * Switch (col 4) queda afuera para no compartir gesto. */
  alertRowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  triggeredRow: {
    paddingVertical: 12,
  },
  /* Col 1: dirección + precio objetivo. 16 / 600. Crece para
   * empujar la distancia y el toggle a la derecha. */
  alertLeft: {
    flex: 1,
    fontFamily: fontFamily[600],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  /* Col 2: distancia (% o $ según el segmented del header). Gris
   * tenue, 14 px. Alineada a la derecha contra el toggle. */
  alertDist: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.15,
    minWidth: 100,
    textAlign: "right",
  },
  /* Col 4: toggle iOS-style. Lo escalamos un toque para que no
   * domine la fila. */
  alertToggle: {
    transform: [{ scale: 0.85 }],
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
