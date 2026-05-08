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
        <Header
          ticker={ticker ?? ""}
          insetsTop={insets.top}
          onClose={() => router.back()}
        />
        <View style={s.fallback}>
          <Text style={{ color: c.textMuted }}>Activo no encontrado.</Text>
        </View>
      </View>
    );
  }

  const handleDelete = async (alert: PriceAlert) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await remove(alert.id);
      show("Alerta eliminada", { variant: "neutral" });
    } catch {
      show("No pudimos eliminar la alerta", { variant: "error" });
    }
  };

  const handleTogglePause = async (alert: PriceAlert) => {
    const willPause = alert.status === "active";
    Haptics.selectionAsync().catch(() => {});
    try {
      await setPaused(alert.id, willPause);
      show(willPause ? "Alerta en pausa" : "Alerta reactivada", {
        variant: "neutral",
      });
    } catch {
      show("No pudimos actualizar la alerta", { variant: "error" });
    }
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <Header
        ticker={asset.ticker}
        insetsTop={insets.top}
        onClose={() => router.back()}
      />

      {/* Banner del precio actual — referencia fija arriba de las
          tabs. El user siempre ve dónde está el activo aunque haya
          scrolleado por la lista. */}
      <View
        style={[
          s.priceBanner,
          { backgroundColor: c.surfaceHover, borderColor: c.border },
        ]}
      >
        <Text style={[s.priceBannerLabel, { color: c.textMuted }]}>
          Precio actual
        </Text>
        <Text style={[s.priceBannerValue, { color: c.text }]}>
          {formatMoney(asset.price, assetCurrency(asset))}
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
                text="Creá tus propios umbrales de precio. Te notificamos cuando el activo los cruza."
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

/* ─── Header ───────────────────────────────────────────────────── */

function Header({
  ticker,
  insetsTop,
  onClose,
}: {
  ticker: string;
  insetsTop: number;
  onClose: () => void;
}) {
  const { c } = useTheme();
  return (
    <View style={[s.header, { paddingTop: insetsTop + 12 }]}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onClose();
        }}
        hitSlop={12}
        style={s.closeBtn}
      >
        <Feather name="x" size={26} color={c.text} />
      </Pressable>
      <Text style={[s.title, { color: c.text }]}>
        {ticker} · Alertas custom
      </Text>
      <Text style={[s.subtitle, { color: c.textMuted }]}>
        Te avisamos como máximo una vez al día por cada alerta.
      </Text>
    </View>
  );
}

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
  return (
    <View
      style={[
        s.sortSeg,
        { backgroundColor: c.surfaceHover, borderColor: c.border },
      ]}
    >
      <Pressable
        onPress={() => onChange("proximity")}
        style={[
          s.sortSegBtn,
          sort === "proximity" && { backgroundColor: c.bg },
        ]}
        hitSlop={4}
      >
        <Text
          style={[
            s.sortSegText,
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
      <Pressable
        onPress={() => onChange("createdAt")}
        style={[
          s.sortSegBtn,
          sort === "createdAt" && { backgroundColor: c.bg },
        ]}
        hitSlop={4}
      >
        <Text
          style={[
            s.sortSegText,
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
  text,
}: {
  illustration: React.ReactNode;
  text: string;
}) {
  const { c } = useTheme();
  return (
    <View style={s.emptyWrap}>
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
  const dirIcon = alert.direction === "above" ? "arrow-up" : "arrow-down";
  const dirLabel = alert.direction === "above" ? "Sube a" : "Baja a";

  const distAbs = alert.threshold - asset.price;
  const distPct = asset.price > 0 ? (distAbs / asset.price) * 100 : 0;
  const distSign = distAbs > 0 ? "+" : distAbs < 0 ? "" : "";
  const distColor =
    Math.abs(distPct) < 0.1 ? c.textMuted : distAbs > 0 ? c.brand : c.red;

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
      // Clamp — no permitimos arrastrar más allá de SWIPE_REVEAL.
      tx.value = Math.max(
        -SWIPE_REVEAL * 1.4,
        Math.min(SWIPE_REVEAL * 1.4, next),
      );
    })
    .onEnd((e) => {
      "worklet";
      const final = startX.value + e.translationX;
      if (final < -SWIPE_TRIGGER) {
        // Swipe izquierda → DELETE
        tx.value = withTiming(-400, { duration: 220 }, (finished) => {
          "worklet";
          if (finished) runOnJS(triggerDelete)();
        });
      } else if (final > SWIPE_TRIGGER) {
        // Swipe derecha → PAUSE/RESUME
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
    /* Pausar action: opacity proporcional al swipe-right. */
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
          borderTopColor: c.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      {/* Action layers debajo de la row — quedan revelados al
          arrastrar. Pausar a la izquierda (azul/ink), eliminar a
          la derecha (rojo). */}
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
        <Animated.View
          style={[
            s.alertRow,
            { backgroundColor: c.bg },
            rowStyle,
          ]}
        >
          <Pressable
            onPress={onEdit}
            style={({ pressed }) => [
              s.alertRowTap,
              {
                opacity: pressed ? 0.7 : isPaused ? 0.55 : 1,
              },
            ]}
            accessibilityLabel={`Editar alerta — ${dirLabel} ${formatMoney(alert.threshold, cur)}`}
          >
            <View style={[s.dirBadge, { backgroundColor: c.surfaceHover }]}>
              <Feather name={dirIcon} size={16} color={c.text} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.alertTopRow}>
                <Text style={[s.alertLabel, { color: c.textMuted }]}>
                  {dirLabel}
                </Text>
                {isPaused ? (
                  <View style={[s.pausedPill, { backgroundColor: c.surfaceSunken }]}>
                    <Text style={[s.pausedPillText, { color: c.textMuted }]}>
                      EN PAUSA
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[s.alertPrice, { color: c.text }]}>
                {formatMoney(alert.threshold, cur)}
              </Text>
              <Text style={[s.alertDistance, { color: distColor }]}>
                {distSign}
                {distPct.toFixed(2)}% · {distSign}
                {formatMoney(Math.abs(distAbs), cur)} del actual
              </Text>
            </View>
          </Pressable>
          <Pressable
            hitSlop={10}
            onPress={onTogglePause}
            style={[
              s.toggleBtn,
              {
                backgroundColor: isPaused ? c.surfaceSunken : c.brandDim,
                borderColor: isPaused ? c.border : c.brand,
              },
            ]}
            accessibilityLabel={isPaused ? "Reactivar alerta" : "Pausar alerta"}
          >
            <Feather
              name={isPaused ? "play" : "pause"}
              size={14}
              color={isPaused ? c.textMuted : c.brand}
            />
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
  header: {
    paddingHorizontal: 24,
    paddingBottom: 14,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "flex-start",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 28,
    letterSpacing: -1,
    marginTop: 4,
  },
  subtitle: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    marginTop: 6,
  },
  priceBanner: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginHorizontal: 24,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderCurve: "continuous",
  },
  priceBannerLabel: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  priceBannerValue: {
    fontFamily: fontFamily[700],
    fontSize: 17,
    letterSpacing: -0.3,
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

  /* Sort segmented */
  sortSeg: {
    flexDirection: "row",
    padding: 3,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderCurve: "continuous",
  },
  sortSegBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderCurve: "continuous",
  },
  sortSegText: {
    fontSize: 11,
    letterSpacing: -0.05,
  },

  /* Empty state */
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  emptyIllustration: {
    marginBottom: 22,
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
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
  },
  triggeredRow: {
    paddingVertical: 12,
  },
  alertRowTap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  alertTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
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
  pausedPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderCurve: "continuous",
  },
  pausedPillText: {
    fontFamily: fontFamily[700],
    fontSize: 9,
    letterSpacing: 0.6,
  },
  toggleBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
    borderRadius: 16,
    borderWidth: 1,
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
