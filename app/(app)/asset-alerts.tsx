import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
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
                    Activas ({sortedAlerts.length})
                  </Text>
                  <SortToggle
                    sort={sort}
                    onChange={(next) => {
                      Haptics.selectionAsync().catch(() => {});
                      setSort(next);
                    }}
                  />
                </View>
                <View style={s.list}>
                  {sortedAlerts.map((alert, i) => (
                    <SwipableAlertRow
                      key={alert.id}
                      alert={alert}
                      asset={asset}
                      withTopDivider={i > 0}
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

/* ─── Sort segmented (Proximidad / Fecha) ──────────────────────── */

function SortToggle({
  sort,
  onChange,
}: {
  sort: Sort;
  onChange: (next: Sort) => void;
}) {
  const { c } = useTheme();
  /* Segmented sutil — sin pill ni borde. Solo dos labels chicos
   * separados por un dot, el activo en el color del texto, el otro
   * en muted. Un toque debajo del título de la sección. */
  return (
    <View style={s.sortRow}>
      <Pressable
        onPress={() => onChange("proximity")}
        hitSlop={6}
      >
        <Text
          style={[
            s.sortText,
            {
              color: sort === "proximity" ? c.text : c.textMuted,
              fontFamily:
                sort === "proximity" ? fontFamily[700] : fontFamily[500],
            },
          ]}
        >
          Proximidad
        </Text>
      </Pressable>
      <Text style={[s.sortDot, { color: c.textFaint }]}>·</Text>
      <Pressable
        onPress={() => onChange("createdAt")}
        hitSlop={6}
      >
        <Text
          style={[
            s.sortText,
            {
              color: sort === "createdAt" ? c.text : c.textMuted,
              fontFamily:
                sort === "createdAt" ? fontFamily[700] : fontFamily[500],
            },
          ]}
        >
          Recientes
        </Text>
      </Pressable>
    </View>
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
  return (
    <View style={s.emptyWrap}>
      {title ? (
        <Text style={[s.emptyTitle, { color: c.text }]}>{title}</Text>
      ) : null}
      <View style={s.emptyIllustration}>{illustration}</View>
      <Text style={[s.emptyText, { color: c.textMuted }]}>{text}</Text>
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
  onEdit,
  onDelete,
  onTogglePause,
}: {
  alert: PriceAlert;
  asset: Asset;
  withTopDivider: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePause: () => void;
}) {
  const { c } = useTheme();
  const cur = assetCurrency(asset);
  const isPaused = alert.status === "paused";
  const dirLabel = alert.direction === "above" ? "Sube a" : "Baja a";
  /* Color base de la fila — verde si "sube a", naranja/rojo si
   * "baja a". Cuando está pausada, todo se desatura a un gris al
   * 40 % opacity. Sin íconos circulares ni cards. */
  const baseColor = alert.direction === "above" ? c.brand : c.red;

  const distAbs = alert.threshold - asset.price;
  const distPct = asset.price > 0 ? (distAbs / asset.price) * 100 : 0;
  const distSign = distAbs > 0 ? "+" : "";

  const leftColor = isPaused ? c.text : baseColor;
  const centerColor = isPaused ? c.text : baseColor;
  const rightColor = c.textMuted;
  const rowOpacity = isPaused ? 0.4 : 1;

  /* Swipe shared values: translateX positivo expone "Pausar" a la
   * izquierda; negativo expone "Eliminar" a la derecha. */
  const tx = useSharedValue(0);
  const startX = useSharedValue(0);

  const triggerPause = () => {
    onTogglePause();
    tx.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
  };
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
      const next = startX.value + e.translationX;
      tx.value = Math.max(
        -SWIPE_REVEAL * 1.4,
        Math.min(SWIPE_REVEAL * 1.4, next),
      );
    })
    .onEnd((e) => {
      "worklet";
      const final = startX.value + e.translationX;
      if (final < -SWIPE_TRIGGER) {
        tx.value = withTiming(-400, { duration: 220 }, (finished) => {
          "worklet";
          if (finished) runOnJS(triggerDelete)();
        });
      } else if (final > SWIPE_TRIGGER) {
        tx.value = withTiming(0, { duration: 220 }, (finished) => {
          "worklet";
          if (finished) runOnJS(triggerPause)();
        });
      } else {
        tx.value = withTiming(0, { duration: 200 });
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  const leftActionStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, tx.value / SWIPE_TRIGGER)),
  }));

  const rightActionStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, -tx.value / SWIPE_TRIGGER)),
  }));

  return (
    <View
      style={[
        s.swipeRoot,
        withTopDivider && {
          /* Hairline divider sutil — gris al 15 % opacity. Sin
           * cards ni bordes pesados. */
          borderTopColor: c.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      {/* Action layers — pausar a la izquierda, eliminar a la derecha. */}
      <Animated.View
        style={[
          s.swipeLeftAction,
          { backgroundColor: c.surfaceSunken },
          leftActionStyle,
        ]}
      >
        <Feather
          name={isPaused ? "play" : "pause"}
          size={18}
          color={c.text}
        />
        <Text style={[s.swipeActionText, { color: c.text }]}>
          {isPaused ? "Reactivar" : "Pausar"}
        </Text>
      </Animated.View>
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
        <Animated.View style={[{ backgroundColor: c.bg }, rowStyle]}>
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => [
              s.alertRow,
              {
                opacity: pressed ? 0.7 : rowOpacity,
              },
            ]}
            accessibilityLabel={`Editar alerta — ${dirLabel} ${formatMoney(alert.threshold, cur)}`}
          >
            {/* Col izquierda: dirección + precio objetivo (16 / 600).
                Crece para empujar el % y el delta a la derecha. */}
            <Text
              style={[s.alertLeft, { color: leftColor }]}
              numberOfLines={1}
            >
              {dirLabel} {formatMoney(alert.threshold, cur)}
            </Text>
            {/* Col centro: distancia % (14, mismo color). */}
            <Text
              style={[s.alertCenter, { color: centerColor }]}
              numberOfLines={1}
            >
              {distSign}
              {distPct.toFixed(2)}%
            </Text>
            {/* Col derecha: distancia $ (14, gris tenue). */}
            <Text
              style={[s.alertRight, { color: rightColor }]}
              numberOfLines={1}
            >
              {distSign}
              {formatMoney(Math.abs(distAbs), cur)}
            </Text>
            {isPaused ? (
              <Text style={[s.pausedLabel, { color: c.textMuted }]}>
                Pausada
              </Text>
            ) : null}
          </Pressable>
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

  /* Sort — texto puro con dot separador, sin pill ni borde. */
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sortText: {
    fontSize: 12,
    letterSpacing: -0.05,
  },
  sortDot: {
    fontSize: 12,
  },

  /* Empty state — bell + texto descriptivo viven como una sola
   * unidad centrada verticalmente en el espacio disponible entre
   * los tabs y el CTA del bottom. flex 1 + justifyContent center
   * los pone en el medio del ScrollView (que ya tiene flexGrow 1
   * desde el container). */
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
  swipeLeftAction: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: SWIPE_REVEAL,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 8,
    flexDirection: "row",
    gap: 6,
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
  /* Row de alerta — 3 columnas en una sola fila. Sin cards, sin
   * íconos circulares, sin toggle. Filas separadas por hairline
   * border (configurado en s.swipeRoot). */
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    gap: 12,
  },
  triggeredRow: {
    paddingVertical: 12,
  },
  /* Col izquierda: dirección + precio objetivo. Crece para empujar
   * el resto a la derecha. 16 px / 600. */
  alertLeft: {
    flex: 1,
    fontFamily: fontFamily[600],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  /* Col centro: % de distancia, mismo color que la izquierda. */
  alertCenter: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.15,
    minWidth: 64,
    textAlign: "right",
  },
  /* Col derecha: $ de distancia, gris tenue. */
  alertRight: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.15,
    minWidth: 90,
    textAlign: "right",
  },
  /* Label "Pausada" — sólo visible cuando está pausada. Va al final
   * a la derecha del row, gris muy chico. */
  pausedLabel: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: -0.05,
    marginLeft: 8,
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
