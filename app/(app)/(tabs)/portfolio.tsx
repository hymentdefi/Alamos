import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Ellipse,
  G,
  Line,
  Polygon,
  Text as SvgText,
} from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeInDown,
  FadeOutUp,
  runOnJS,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { fontFamily, radius, useTheme } from "../../../lib/theme";
import {
  assets,
  assetCurrency,
  assetIconCode,
  assetMarket,
  categoryLabels,
  formatARS,
  formatMoney,
  formatPct,
  formatQty,
  type Asset,
  type AssetCategory,
} from "../../../lib/data/assets";
import { convertAmount } from "../../../lib/data/accounts";
import {
  MiniSparkline,
  seriesFromSeed,
} from "../../../lib/components/Sparkline";
import { GlassCard } from "../../../lib/components/GlassCard";
import {
  MarketSegmented,
  type MarketSegmentedValue,
} from "../../../lib/components/MarketSegmented";

/**
 * Tab 'Portfolio' — vista enfocada en tus tenencias.
 *
 * Sin hero de balance ni chart: el usuario quiere ver directo el
 * filtro de mercado y la lista de posiciones. Layout:
 *   1. Header fijo (mismo layout que Mercado): title "Portfolio" +
 *      MarketSegmented (AR / EE.UU / Crypto + tab "Todo" extra al
 *      principio con el isotipo Alamos como flag).
 *   2. ScrollView debajo: GlassCard con un row por holding, después
 *      el card de "Resultado del día".
 *
 * El segmented filtra los holdings — "Todo" muestra todos, AR/US/CRYPTO
 * filtran por `assetMarket(asset)`. El "Resultado del día" se computa
 * sobre el subset filtrado para que sea consistente con la lista.
 */

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { c } = useTheme();
  const [marketFilter, setMarketFilter] =
    useState<MarketSegmentedValue>("all");
  const [refreshing, setRefreshing] = useState(false);

  /* ─── Holdings filtrados por el segmented ───────────────────── */

  const holdings = useMemo(() => {
    const all = assets.filter(
      (a) => a.held && (a.qty ?? 0) > 0 && a.category !== "efectivo",
    );
    if (marketFilter === "all") return all;
    return all.filter((a) => assetMarket(a) === marketFilter);
  }, [marketFilter]);

  const holdingsSorted = useMemo(() => {
    const withVal = holdings.map((a) => {
      const native = a.price * (a.qty ?? 0);
      const ars = convertAmount(native, assetCurrency(a), "ARS");
      return { asset: a, native, ars };
    });
    return withVal.sort((x, y) => y.ars - x.ars);
  }, [holdings]);

  const totalArs = useMemo(
    () => holdingsSorted.reduce((acc, h) => acc + h.ars, 0),
    [holdingsSorted],
  );

  const todayDeltaArs = useMemo(() => {
    let acc = 0;
    for (const a of holdings) {
      const dayDelta = a.price * (a.qty ?? 0) * (a.change / 100);
      acc += convertAmount(dayDelta, assetCurrency(a), "ARS");
    }
    return acc;
  }, [holdings]);

  const todayPct = totalArs > 0 ? (todayDeltaArs / totalArs) * 100 : 0;

  /* ─── Handlers ──────────────────────────────────────────────── */

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Mock — en MOCK_MODE no hay nada que hacer; simulamos el delay.
    setTimeout(() => setRefreshing(false), 700);
  }, []);

  /* ─── Render ────────────────────────────────────────────────── */

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      {/* Header fijo — clavado a la altura del header de Mercado para
          que el MarketSegmented quede en el mismo Y de pantalla. */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.titleRow}>
          <Text style={[s.title, { color: c.text }]}>Portfolio</Text>
        </View>
        <MarketSegmented
          value={marketFilter}
          onChange={setMarketFilter}
          withAll
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.textMuted}
            colors={[c.textMuted]}
            progressBackgroundColor={c.surface}
          />
        }
      >
        {holdingsSorted.length > 0 && totalArs > 0 ? (
          <View style={[s.sectionBlock, { marginBottom: 28 }]}>
            <View style={s.sectionHead}>
              <Text style={[s.sectionTitle, { color: c.textMuted }]}>
                Distribución
              </Text>
            </View>
            <AllocationBrick
              holdings={holdingsSorted}
              totalArs={totalArs}
            />
          </View>
        ) : null}

        <View style={s.sectionBlock}>
          <View style={s.sectionHead}>
            <Text style={[s.sectionTitle, { color: c.textMuted }]}>
              Tus posiciones
            </Text>
            <Text style={[s.sectionCount, { color: c.textFaint }]}>
              {holdingsSorted.length} activo
              {holdingsSorted.length === 1 ? "" : "s"}
            </Text>
          </View>

          {holdingsSorted.length > 0 ? (
            <GlassCard padding={4}>
              {holdingsSorted.map(({ asset, native }, i) => (
                <HoldingRow
                  key={asset.ticker}
                  asset={asset}
                  marketValueNative={native}
                  withTopDivider={i > 0}
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/detail",
                      params: { ticker: asset.ticker },
                    })
                  }
                />
              ))}
            </GlassCard>
          ) : (
            <GlassCard padding={16}>
              <Text style={[s.empty, { color: c.textMuted }]}>
                {marketFilter === "all"
                  ? "Todavía no tenés posiciones. Entrá a Mercado para empezar a invertir."
                  : "No tenés posiciones en este mercado."}
              </Text>
            </GlassCard>
          )}
        </View>

        <View style={[s.sectionBlock, { marginTop: 28 }]}>
          <View
            style={[
              s.resultCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={[s.resultLabel, { color: c.textMuted }]}>
              Resultado del día
            </Text>
            <View style={{ flexDirection: "row", alignItems: "baseline" }}>
              <Text
                style={[
                  s.resultAmount,
                  { color: todayDeltaArs >= 0 ? c.greenDark : c.red },
                ]}
              >
                {todayDeltaArs >= 0 ? "+" : "−"}
                {formatARS(Math.abs(todayDeltaArs))}
              </Text>
              <Text
                style={[
                  s.resultPct,
                  { color: todayDeltaArs >= 0 ? c.greenDark : c.red },
                ]}
              >
                {" "}
                ({formatPct(todayPct)})
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── Holding row ───────────────────────────────────────────────
 *
 * Layout copiado de la fila de market-category.tsx pero con dos
 * cambios:
 *   - El precio principal es el VALOR DE TU TENENCIA (qty × price)
 *     en moneda nativa, no el precio de mercado individual.
 *   - Bajo el ticker: la cantidad de unidades + unit suffix
 *     ("unidades", "VN", "cuotapartes", el ticker para crypto).
 */
interface HoldingRowProps {
  asset: Asset;
  marketValueNative: number;
  withTopDivider: boolean;
  onPress: () => void;
}

function HoldingRow({
  asset,
  marketValueNative,
  withTopDivider,
  onPress,
}: HoldingRowProps) {
  const { c } = useTheme();
  const cur = assetCurrency(asset);
  const up = asset.change >= 0;
  const series = useMemo(
    () => seriesFromSeed(asset.ticker, 60, up ? "up" : "down"),
    [asset.ticker, up],
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        withTopDivider && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.border,
        },
        { transform: [{ scale: pressed ? 0.99 : 1 }] },
      ]}
    >
      <View
        style={[
          s.rowIcon,
          {
            backgroundColor:
              asset.iconTone === "dark" ? c.ink : c.surfaceSunken,
          },
        ]}
      >
        <Text
          style={[
            s.rowIconText,
            {
              color:
                asset.iconTone === "dark" ? c.bg : c.textSecondary,
            },
          ]}
        >
          {assetIconCode(asset)}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowTicker, { color: c.text }]}>{asset.ticker}</Text>
        <Text
          style={[s.rowSub, { color: c.textMuted }]}
          numberOfLines={1}
        >
          {formatQty(asset.qty ?? 0)} {qtyUnit(asset)}
        </Text>
      </View>
      <View style={s.rowChart}>
        <MiniSparkline series={series} color={up ? c.greenDark : c.red} />
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[s.rowValue, { color: c.text }]} numberOfLines={1}>
          {formatMoney(marketValueNative, cur)}
        </Text>
        <Text
          style={[
            s.rowDelta,
            { color: up ? c.positive : c.red },
          ]}
        >
          {formatPct(asset.change)}
        </Text>
      </View>
    </Pressable>
  );
}

/* ─── Pared 3D de distribución ──────────────────────────────────
 *
 * Diseño: stacked-bar con perspectiva isométrica — una "pared" o
 * "ladrillo" que muestra cómo está distribuido el portfolio por
 * categoría. La cara frontal carga el color, la cara superior va
 * shaded más claro (luz de arriba) y el lado derecho del último
 * bloque va shaded más oscuro (sombra propia). Outline en ink 1.5px
 * para definir geometría — feeling de illustration handcrafted, no
 * "chart genérico de dashboard".
 *
 * Interacción: hold + drag con el dedo highlightea el bloque debajo
 * y dimea el resto a gris. Un pill negro flota arriba con la
 * categoría + el porcentaje. Pop con FadeInDown de Reanimated.
 * El gesto activa después de 150ms de long-press para no robarle
 * el scroll vertical al ScrollView padre.
 *
 * Geometría 1:1 con el mockup (PortfolioDistribution.jsx):
 *   viewBox 340×180 — pared 280×100, depth 32, top inclinado 55%.
 *
 * Paleta: rampa verde brand-aligned (el más grande del portfolio
 * pop con #00E676 vivid mint) → ink → mint pálido → green medium →
 * cool gray. Definida por índice (no por categoría) — siempre el
 * activo dominante captura el vivid green.
 */

const BRICK_PALETTE = [
  "#00E676", // vivid mint — slice más grande
  "#0E0F0C", // ink
  "#7EE9A6", // mint pálido
  "#00B864", // green medium
  "#94A3B8", // cool gray
  "#5ac43e", // action green (fallback)
  "#6B6C66", // textMuted (fallback)
];

interface AllocationBrickProps {
  holdings: { asset: Asset; native: number; ars: number }[];
  totalArs: number;
}

function AllocationBrick({ holdings, totalArs }: AllocationBrickProps) {
  const { c } = useTheme();
  const [containerW, setContainerW] = useState(0);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const allocations = useMemo(() => {
    const byCategory = new Map<AssetCategory, number>();
    for (const h of holdings) {
      byCategory.set(
        h.asset.category,
        (byCategory.get(h.asset.category) ?? 0) + h.ars,
      );
    }
    return Array.from(byCategory.entries())
      .map(([cat, ars]) => ({ cat, ars, pct: (ars / totalArs) * 100 }))
      .sort((a, b) => b.pct - a.pct);
  }, [holdings, totalArs]);

  // Geometría del viewBox — clavada al mockup.
  const W = 340;
  const H = 180;
  const wallW = 280;
  const wallH = 100;
  const depth = 32;
  const xL = (W - wallW) / 2;
  const yTop = 36;
  const yBot = yTop + wallH;
  const topShift = depth * 0.55; // cuánto sube el plano superior

  const blocks = useMemo(() => {
    const totalPct = allocations.reduce((acc, a) => acc + a.pct, 0) || 1;
    let xAcc = xL;
    return allocations.map((a, i) => {
      const w = (a.pct / totalPct) * wallW;
      const x0 = xAcc;
      xAcc += w;
      return {
        ...a,
        x0,
        x1: xAcc,
        color: BRICK_PALETTE[i % BRICK_PALETTE.length],
      };
    });
  }, [allocations]);

  // Resolver de touch X → bloque activo. CORRE EN JS — los workers
  // de gesture (onBegin/onUpdate) no pueden llamar funciones JS
  // regulares directamente (crashea). Pasamos sólo `x` por runOnJS
  // y todo el resto de la lógica vive acá.
  const handleTouch = useCallback(
    (touchPx: number | null) => {
      if (touchPx === null || containerW === 0) {
        if (activeIdx !== null) setActiveIdx(null);
        return;
      }
      const svgX = (touchPx / containerW) * W;
      let next: number | null = null;
      if (svgX >= xL && svgX <= xL + wallW) {
        const idx = blocks.findIndex((b) => svgX >= b.x0 && svgX <= b.x1);
        next = idx >= 0 ? idx : null;
      }
      if (next === activeIdx) return;
      setActiveIdx(next);
      if (next !== null) Haptics.selectionAsync().catch(() => {});
    },
    [containerW, blocks, xL, wallW, activeIdx],
  );

  // Pan después de 150ms de long-press — evita conflicto con el
  // scroll vertical del ScrollView padre. El usuario "agarra" el
  // ladrillo y desliza para inspeccionar. Todos los callbacks
  // sólo despachan x a JS via runOnJS — evitamos llamar funciones
  // no-worklet desde el thread UI.
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .activateAfterLongPress(150)
        .onBegin((e) => {
          "worklet";
          runOnJS(handleTouch)(e.x);
        })
        .onUpdate((e) => {
          "worklet";
          runOnJS(handleTouch)(e.x);
        })
        .onEnd(() => {
          "worklet";
          runOnJS(handleTouch)(null);
        })
        .onFinalize(() => {
          "worklet";
          runOnJS(handleTouch)(null);
        }),
    [handleTouch],
  );

  const dimmedFront = c.surfaceSunken;
  const dimmedTop = c.surfaceHover;
  const dimmedRight = c.border;

  // Tooltip — flota arriba del bloque activo con caret hacia abajo.
  let tooltipLeftPx = 0;
  let tooltipLabel = "";
  let tooltipPct = 0;
  if (activeIdx !== null && blocks[activeIdx] && containerW > 0) {
    const b = blocks[activeIdx];
    const centerSvg = (b.x0 + b.x1) / 2;
    tooltipLeftPx = (centerSvg / W) * containerW;
    tooltipLabel = categoryLabels[b.cat];
    tooltipPct = b.pct;
  }

  return (
    <View
      style={[
        s.allocCard,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <View style={s.allocHeader}>
        <Text style={[s.allocEyebrow, { color: c.textMuted }]}>
          DISTRIBUCIÓN
        </Text>
        <Text style={[s.allocTotal, { color: c.text }]}>
          {formatArsCompact(totalArs)}
        </Text>
      </View>

      <View
        style={s.brickWrap}
        onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
      >
        <GestureDetector gesture={panGesture}>
          <View>
            <Svg
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              height={containerW > 0 ? (containerW * H) / W : undefined}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Sombra del piso. */}
              <Ellipse
                cx={W / 2 + depth / 2}
                cy={yBot + 14}
                rx={wallW / 2 + 14}
                ry={7}
                fill="rgba(14,15,12,0.10)"
              />

              {/* Cuerpos de cada bloque (front + top). */}
              {blocks.map((blk, i) => {
                const dimmed = activeIdx !== null && activeIdx !== i;
                const front = dimmed ? dimmedFront : blk.color;
                const top = dimmed ? dimmedTop : shadeHex(blk.color, 0.22);
                const labelW = blk.x1 - blk.x0;
                const showLabel = labelW > 38 && !dimmed;
                return (
                  <G key={String(blk.cat)}>
                    {/* Front face */}
                    <Polygon
                      points={`${blk.x0},${yTop} ${blk.x1},${yTop} ${blk.x1},${yBot} ${blk.x0},${yBot}`}
                      fill={front}
                    />
                    {/* Top face — depth */}
                    <Polygon
                      points={`${blk.x0},${yTop} ${blk.x1},${yTop} ${blk.x1 + depth},${yTop - topShift} ${blk.x0 + depth},${yTop - topShift}`}
                      fill={top}
                    />
                    {showLabel ? (
                      <SvgText
                        x={(blk.x0 + blk.x1) / 2}
                        y={(yTop + yBot) / 2 + 5}
                        textAnchor="middle"
                        fontSize="14"
                        fontWeight="800"
                        fill={textOnHex(blk.color)}
                        fontFamily={fontFamily[800]}
                      >
                        {Math.round(blk.pct)}%
                      </SvgText>
                    ) : null}
                  </G>
                );
              })}

              {/* Cara derecha del último bloque — sombra propia. */}
              {blocks.length > 0
                ? (() => {
                    const last = blocks[blocks.length - 1];
                    const lastIdx = blocks.length - 1;
                    const dimmed =
                      activeIdx !== null && activeIdx !== lastIdx;
                    const fillR = dimmed
                      ? dimmedRight
                      : shadeHex(last.color, -0.2);
                    return (
                      <Polygon
                        points={`${last.x1},${yTop} ${last.x1 + depth},${yTop - topShift} ${last.x1 + depth},${yBot - topShift} ${last.x1},${yBot}`}
                        fill={fillR}
                      />
                    );
                  })()
                : null}

              {/* Outlines en ink. */}
              <G
                stroke="#0E0F0C"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                fill="none"
              >
                {blocks.slice(0, -1).map((blk) => (
                  <G key={`div-${String(blk.cat)}`}>
                    <Line x1={blk.x1} y1={yTop} x2={blk.x1} y2={yBot} />
                    <Line
                      x1={blk.x1}
                      y1={yTop}
                      x2={blk.x1 + depth}
                      y2={yTop - topShift}
                    />
                  </G>
                ))}
                <Polygon
                  points={`${xL},${yTop} ${xL + wallW},${yTop} ${xL + wallW},${yBot} ${xL},${yBot}`}
                />
                <Polygon
                  points={`${xL},${yTop} ${xL + wallW},${yTop} ${xL + wallW + depth},${yTop - topShift} ${xL + depth},${yTop - topShift}`}
                />
                <Polygon
                  points={`${xL + wallW},${yTop} ${xL + wallW + depth},${yTop - topShift} ${xL + wallW + depth},${yBot - topShift} ${xL + wallW},${yBot}`}
                />
              </G>
            </Svg>
          </View>
        </GestureDetector>

        {/* Tooltip — pop con FadeInDown. Posición absoluta centrada
            sobre el bloque activo. pointerEvents none para no robar
            el gesto de pan. */}
        {activeIdx !== null && containerW > 0 ? (
          <Animated.View
            key={`tip-${activeIdx}`}
            entering={FadeInDown.duration(140).springify().damping(18)}
            exiting={FadeOutUp.duration(110)}
            pointerEvents="none"
            style={[s.tooltipAnchor, { left: tooltipLeftPx }]}
          >
            <View style={[s.tooltipPill, { backgroundColor: c.ink }]}>
              <Text style={[s.tooltipLabel, { color: c.bg }]}>
                {tooltipLabel}
              </Text>
              <Text style={[s.tooltipPct, { color: c.brand }]}>
                {formatTooltipPct(tooltipPct)}
              </Text>
            </View>
            <View style={[s.tooltipCaret, { backgroundColor: c.ink }]} />
          </Animated.View>
        ) : null}
      </View>

      <View style={s.allocLegendGrid}>
        {blocks.map((b) => (
          <View key={String(b.cat)} style={s.allocLegendRowGrid}>
            <View
              style={[s.allocLegendDot, { backgroundColor: b.color }]}
            />
            <Text
              style={[s.allocLegendLabel, { color: c.text }]}
              numberOfLines={1}
            >
              {categoryLabels[b.cat]}
            </Text>
            <Text style={[s.allocLegendPct, { color: c.text }]}>
              {formatAllocationPct(b.pct / 100)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Mezcla un hex con blanco (amt > 0) o negro (amt < 0). amt en
 *  rango [-1, 1]. Devuelve "rgb(r,g,b)". */
function shadeHex(hex: string, amt: number): string {
  if (!hex.startsWith("#")) return hex;
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const f = (v: number) =>
    Math.max(
      0,
      Math.min(
        255,
        Math.round(
          v + (255 - v) * Math.max(0, amt) - v * Math.max(0, -amt),
        ),
      ),
    );
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** Texto blanco sobre fondos oscuros, ink sobre claros. */
function textOnHex(color: string): string {
  return color === "#0E0F0C" || color === "#000000" ? "#FAFAF7" : "#0E0F0C";
}

/** Pct para el tooltip — un decimal siempre, con coma. */
function formatTooltipPct(p: number): string {
  return p.toFixed(1).replace(".", ",") + "%";
}

/** "$ 12,4M" / "$ 850K" / "$ 420" — compacto para el centro del
 *  donut. Para ARS principalmente, donde los millones son moneda
 *  corriente. */
function formatArsCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000)
    return "$ " + (n / 1_000_000_000).toFixed(1).replace(".", ",") + "B";
  if (abs >= 1_000_000)
    return "$ " + (n / 1_000_000).toFixed(1).replace(".", ",") + "M";
  if (abs >= 10_000)
    return "$ " + Math.round(n / 1_000).toString() + "K";
  if (abs >= 1_000)
    return "$ " + (n / 1_000).toFixed(1).replace(".", ",") + "K";
  return formatARS(n);
}

/** Pct sin signo, máximo un decimal cuando es chico (< 10%) — en
 *  legend queremos que las cifras dominantes se vean limpias y las
 *  pequeñas no caigan a 0%. */
function formatAllocationPct(p: number): string {
  const v = p * 100;
  if (v >= 10) return Math.round(v).toString() + "%";
  return v.toFixed(1).replace(".", ",") + "%";
}

/* Unidad de tenencia según categoría — coincide con el qtyLabel del
 * detail.tsx pero plural simple para la subline. */
function qtyUnit(asset: Asset): string {
  switch (asset.category) {
    case "cedears":
    case "acciones":
      return "unidades";
    case "bonos":
    case "obligaciones":
    case "letras":
      return "VN";
    case "fci":
      return "cuotapartes";
    case "crypto":
      return asset.ticker;
    default:
      return "unidades";
  }
}

const s = StyleSheet.create({
  root: { flex: 1 },

  /* Header fijo — paddings clavados al header de Mercado para que el
   * segmented quede en el mismo Y de pantalla. */
  header: {
    paddingHorizontal: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.2,
  },

  /* Section block container — paddingHorizontal 20 (matchea Inicio).
   * El "sectionHead" usa el mismo lenguaje que las secciones de
   * Inicio: título tipo eyebrow + count compacto a la derecha. */
  sectionBlock: {
    paddingHorizontal: 20,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: fontFamily[800],
    fontSize: 21,
    letterSpacing: -0.7,
    lineHeight: 24,
  },
  sectionCount: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  empty: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    textAlign: "center",
    paddingHorizontal: 8,
  },

  /* Holding row — copia del market-category.tsx con price→valor. */
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderCurve: "continuous",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconText: {
    fontFamily: fontFamily[800],
    fontSize: 13,
    letterSpacing: 0.4,
  },
  rowTicker: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  rowSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  rowChart: {
    width: 60,
    height: 28,
    marginRight: 4,
  },
  rowValue: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  rowDelta: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.1,
    marginTop: 2,
  },

  /* Pared 3D de distribución — card vertical: header (eyebrow +
   * total) → SVG con la pared → legend en grid 2 columnas. */
  allocCard: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderCurve: "continuous",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  allocHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 12,
  },
  allocEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  allocTotal: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.7,
  },
  brickWrap: {
    position: "relative",
    overflow: "visible",
  },
  /* Tooltip — anchor con width 0 + alignItems center centra el
   * children en el punto `left` que pasamos. Patrón clásico de RN
   * para evitar tener que medir el width del tooltip. */
  tooltipAnchor: {
    position: "absolute",
    top: 0,
    width: 0,
    alignItems: "center",
    zIndex: 5,
  },
  tooltipPill: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderCurve: "continuous",
    borderRadius: radius.sm,
  },
  tooltipLabel: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  tooltipPct: {
    fontFamily: fontFamily[800],
    fontSize: 13,
    letterSpacing: -0.2,
  },
  /* Caret — square rotado 45° debajo del pill. marginTop negativo
   * para que la mitad de arriba quede oculta tras el pill y solo
   * sobresalga la mitad de abajo (forma de triángulo). */
  tooltipCaret: {
    width: 8,
    height: 8,
    marginTop: -4,
    transform: [{ rotate: "45deg" }],
  },
  allocLegendGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
  },
  allocLegendRowGrid: {
    width: "50%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    paddingRight: 12,
  },
  /* Cuadradito (no círculo) para alinear con el lenguaje "ladrillo"
   * del chart — cada legend dot es un mini-bloque. */
  allocLegendDot: {
    width: 9,
    height: 9,
    borderCurve: "continuous",
    borderRadius: 2,
  },
  allocLegendLabel: {
    flex: 1,
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  allocLegendPct: {
    fontFamily: fontFamily[800],
    fontSize: 12,
    letterSpacing: -0.1,
  },

  /* Resultado del día — card simple, mismos paddings que las cards
   * del detail. */
  resultCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderCurve: "continuous",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  resultLabel: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  resultAmount: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.6,
  },
  resultPct: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.1,
  },
});
