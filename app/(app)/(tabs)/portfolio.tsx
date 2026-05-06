import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import Animated, {
  FadeInDown,
  FadeOutUp,
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
import { AmountDisplay } from "../../../lib/components/AmountDisplay";
import { BalanceInfoSheet } from "../../../lib/components/BalanceInfoSheet";
import {
  MarketSegmented,
  type MarketSegmentedValue,
} from "../../../lib/components/MarketSegmented";
import { Feather } from "@expo/vector-icons";

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
            <AllocationBrick
              holdings={holdingsSorted}
              totalArs={totalArs}
              groupBy={marketFilter === "CRYPTO" ? "ticker" : "category"}
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
  /** Granularidad del grouping. "category" para AR/EE.UU/Todo,
   *  "ticker" para Crypto (donde la categoría sería siempre 100%
   *  y no aporta información). */
  groupBy: "category" | "ticker";
}

function AllocationBrick({
  holdings,
  totalArs,
  groupBy,
}: AllocationBrickProps) {
  const { c } = useTheme();
  const [containerW, setContainerW] = useState(0);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");
  const [infoOpen, setInfoOpen] = useState(false);
  const pagerRef = useRef<ScrollView | null>(null);

  // Geometría del viewBox — clavada al mockup. El viewBox total es
  // 340×180; la "pared" es 280 ancho × 100 alto, y suma 32 px de
  // depth en el plano superior y la cara derecha del último
  // bloque. xL se computa para CENTRAR la composición visible
  // (wall + depth) dentro del viewBox — antes el wall arrancaba
  // a 30 y se sentía corrido a la derecha por el bulge del depth.
  const W = 340;
  const H = 180;
  const wallW = 280;
  const wallH = 100;
  const depth = 32;
  const xL = (W - (wallW + depth)) / 2;
  const yTop = 36;
  const yBot = yTop + wallH;
  const topShift = depth * 0.55; // cuánto sube el plano superior

  // Para el tooltip necesitamos no sólo el % del grupo sino los
  // tickers individuales + su variación del día. Aprovechamos la
  // pasada de aggregation para arrastrar las rows ordenadas por
  // contribución descendente.
  //
  // En groupBy="ticker" cada bloque ES un ticker — el grouping
  // colapsa la lista de holdings tal cual. Arrastramos el `name`
  // (full name del activo, ej. "Bitcoin") y el `shortTicker`
  // ("BTC" en lugar de "BTC/USDT") para mostrarlos en el tooltip
  // y la legend en lugar del par cripto que se siente técnico.
  type Row = { ticker: string; shortTicker: string; change: number; ars: number };
  const blocks = useMemo(() => {
    const byKey = new Map<
      string,
      { ars: number; rows: Row[]; cat: AssetCategory; name: string }
    >();
    for (const h of holdings) {
      const key =
        groupBy === "ticker" ? h.asset.ticker : h.asset.category;
      const entry = byKey.get(key) ?? {
        ars: 0,
        rows: [],
        cat: h.asset.category,
        name: h.asset.name,
      };
      entry.ars += h.ars;
      entry.rows.push({
        ticker: h.asset.ticker,
        shortTicker: shortCryptoTicker(h.asset.ticker),
        change: h.asset.change,
        ars: h.ars,
      });
      byKey.set(key, entry);
    }
    const sorted = Array.from(byKey.entries())
      .map(([key, { ars, rows, cat, name }]) => ({
        key,
        cat,
        label: groupBy === "ticker" ? name : categoryLabels[cat],
        ars,
        pct: (ars / totalArs) * 100,
        rows: rows.sort((a, b) => b.ars - a.ars),
      }))
      .sort((a, b) => b.pct - a.pct);

    const totalPct = sorted.reduce((acc, a) => acc + a.pct, 0) || 1;
    let xAcc = xL;
    return sorted.map((a, i) => {
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
  }, [holdings, totalArs, groupBy, xL, wallW]);

  // El gesture object SE CONSTRUYE UNA SOLA VEZ — si el handleTouch
  // dependiera de state que cambia mid-press (activeIdx, blocks,
  // containerW), el useMemo del Pan se rebuildaría y el
  // GestureDetector recibiría una gesture nueva mientras el dedo
  // todavía está apoyado. La gesture in-flight queda zombie y no
  // dispara onEnd/onFinalize → highlight stuck.
  //
  // Solución: refs para todo lo mutable. handleTouch tiene deps
  // vacíos y lee siempre el último valor via .current.
  const activeIdxRef = useRef<number | null>(null);
  const containerWRef = useRef(0);
  const blocksRef = useRef(blocks);

  useEffect(() => {
    containerWRef.current = containerW;
  }, [containerW]);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  const handleTouch = useCallback((touchPx: number | null) => {
    let next: number | null = null;
    const cW = containerWRef.current;
    const blks = blocksRef.current;
    if (touchPx !== null && cW > 0) {
      const svgX = (touchPx / cW) * W;
      if (svgX >= xL && svgX <= xL + wallW) {
        const idx = blks.findIndex((b) => svgX >= b.x0 && svgX <= b.x1);
        next = idx >= 0 ? idx : null;
      }
    }
    if (next === activeIdxRef.current) return;
    activeIdxRef.current = next;
    setActiveIdx(next);
    if (next !== null) Haptics.selectionAsync().catch(() => {});
  // xL y wallW son constantes locales del componente — no cambian.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tracking del touch via responders nativos de RN. Después de
  // dos intentos con RNGH (Pan con activateAfterLongPress, después
  // con failOffsetY) el highlight quedaba stuck en algunas
  // condiciones — los workers de gesture-handler son async via
  // runOnJS y el ciclo de vida no siempre cerraba limpio.
  //
  // Los responder events de RN corren sincrónicos en JS thread:
  // onResponderGrant garantiza set del highlight, onResponderRelease
  // y onResponderTerminate garantizan el clear. No hay forma de
  // que se quede colgado.
  //
  // onResponderTerminationRequest=false impide que el ScrollView
  // padre robe el touch mid-press (sino el highlight quedaría
  // stuck si el scroll lo capturaba). Como el ladrillo ocupa ~150
  // px de alto, el usuario puede scrollear desde arriba o abajo
  // sin tocar el chart — UX aceptable.
  const startTouchY = useRef(0);

  const dimmedFront = c.surfaceSunken;
  const dimmedTop = c.surfaceHover;
  const dimmedRight = c.border;

  // Tooltip — flota arriba del bloque activo con caret hacia abajo.
  // Header con categoría + pct, abajo lista compacta de tickers
  // (top 5 por valor) con su variación del día.
  const activeBlock =
    activeIdx !== null ? blocks[activeIdx] ?? null : null;
  const tooltipLeftPx =
    activeBlock && containerW > 0
      ? (((activeBlock.x0 + activeBlock.x1) / 2) / W) * containerW
      : 0;

  return (
    <View
      style={[
        s.allocCard,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <View
        onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
      >
        <Text style={[s.allocEyebrow, { color: c.textMuted }]}>
          DISTRIBUCIÓN
        </Text>

        {/* Pager horizontal del total — 2 páginas (ARS / USD), cada
            una al ancho del card content. Mismo lenguaje que el
            balance del Home: paging-scroll nativo da prioridad al
            gesture horizontal sobre el ScrollView vertical, y los
            dots abajo indican qué página estás mirando. */}
        {containerW > 0 ? (
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="normal"
            directionalLockEnabled
            alwaysBounceVertical={false}
            bounces={false}
            contentOffset={{
              x: currency === "ARS" ? 0 : containerW,
              y: 0,
            }}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(
                e.nativeEvent.contentOffset.x / containerW,
              );
              const next: "ARS" | "USD" = idx === 0 ? "ARS" : "USD";
              if (next !== currency) {
                Haptics.selectionAsync().catch(() => {});
                setCurrency(next);
              }
            }}
            style={s.allocPager}
          >
            {(["ARS", "USD"] as const).map((cur) => {
              const value =
                cur === "ARS"
                  ? totalArs
                  : convertAmount(totalArs, "ARS", "USD");
              return (
                <View
                  key={cur}
                  style={[s.allocPagerPage, { width: containerW }]}
                >
                  {/* Mismo formato del balance del Home: integer
                      grande + decimales chicos arriba a la derecha
                      (estilo Robinhood). Sin flag — no aplica acá,
                      es el portfolio total agregado. */}
                  <View style={{ flex: 1 }}>
                    <AmountDisplay
                      value={value}
                      size={28}
                      weight={800}
                      currency={cur}
                    />
                  </View>
                  {/* Info icon — abre el bottom sheet con el detalle
                      de cómo se calcula el saldo unificado. Mismo
                      patrón que el infoDot del Home (Earnings). */}
                  <Pressable
                    hitSlop={10}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setInfoOpen(true);
                    }}
                    style={[
                      s.allocInfoDot,
                      { backgroundColor: c.surfaceHover },
                    ]}
                  >
                    <Feather
                      name="info"
                      size={12}
                      color={c.textSecondary}
                    />
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <AmountDisplay
            value={totalArs}
            size={28}
            weight={800}
            currency="ARS"
          />
        )}

        {/* Dots indicator — cada uno tappable para saltar a esa
            moneda directo, sin tener que swipear. */}
        <View style={s.allocCurrencyDots}>
          {(["ARS", "USD"] as const).map((cur) => {
            const active = cur === currency;
            return (
              <Pressable
                key={cur}
                hitSlop={10}
                onPress={() => {
                  if (cur === currency) return;
                  Haptics.selectionAsync().catch(() => {});
                  setCurrency(cur);
                  pagerRef.current?.scrollTo({
                    x: cur === "ARS" ? 0 : containerW,
                    y: 0,
                    animated: true,
                  });
                }}
              >
                <View
                  style={[
                    s.allocCurrencyDot,
                    {
                      backgroundColor: active ? c.text : c.textFaint,
                      width: active ? 7 : 5,
                      height: active ? 7 : 5,
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={s.brickWrap}>
        <View
          onStartShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(e) => {
            startTouchY.current = e.nativeEvent.locationY;
            handleTouch(e.nativeEvent.locationX);
          }}
          onResponderMove={(e) => {
            // Si el dedo se mueve más de 12px en Y, el usuario
            // está intentando scrollear → soltamos el highlight
            // pero seguimos siendo responder (RN no puede pasar
            // el responder al ScrollView una vez agarrado).
            const dy = Math.abs(
              e.nativeEvent.locationY - startTouchY.current,
            );
            if (dy > 12) {
              handleTouch(null);
            } else {
              handleTouch(e.nativeEvent.locationX);
            }
          }}
          onResponderRelease={() => handleTouch(null)}
          onResponderTerminate={() => handleTouch(null)}
        >
          <View>
            <Svg
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              height={containerW > 0 ? (containerW * H) / W : undefined}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Sombra del piso — centrada en el punto medio
                  visible (xL + (wallW + depth)/2). */}
              <Ellipse
                cx={xL + (wallW + depth) / 2}
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
                  <G key={blk.key}>
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
                  <G key={`div-${blk.key}`}>
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
        </View>

        {/* Tooltip — pop con FadeInDown. Posición absoluta centrada
            sobre el bloque activo. pointerEvents none para no robar
            el gesto de pan. */}
        {activeBlock && containerW > 0 ? (
          <Animated.View
            key={`tip-${activeIdx}`}
            entering={FadeInDown.duration(120)}
            exiting={FadeOutUp.duration(100)}
            pointerEvents="none"
            style={[
              s.tooltipAnchor,
              {
                left: tooltipLeftPx,
                // Anchor desde el bottom del brickWrap para que la
                // punta del caret quede JUSTO arriba del front face
                // del ladrillo (yTop). Así el dedo, que está sobre
                // el bloque, nunca tapa la pill.
                bottom:
                  ((H - yTop) * containerW) / W + 6,
              },
            ]}
          >
            <View style={[s.tooltipPill, { backgroundColor: c.ink }]}>
              <View style={s.tooltipHeader}>
                <Text style={[s.tooltipLabel, { color: c.bg }]}>
                  {activeBlock.label}
                </Text>
                <Text style={[s.tooltipPct, { color: c.brand }]}>
                  {formatTooltipPct(activeBlock.pct)}
                </Text>
              </View>
              {/* En groupBy="ticker" cada bloque ya ES un ticker —
                  el header lo muestra y la lista de rows debajo
                  sería redundante. Mostramos sólo la variación
                  del día inline en su propia row.
                  En groupBy="category" el header es la categoría
                  y las rows son los tickers que la componen. */}
              {groupBy === "ticker" && activeBlock.rows.length === 1 ? (
                <>
                  <View
                    style={[
                      s.tooltipDivider,
                      { backgroundColor: "rgba(255,255,255,0.12)" },
                    ]}
                  />
                  <View style={s.tooltipRow}>
                    <Text
                      style={[s.tooltipTicker, { color: "rgba(255,255,255,0.65)" }]}
                    >
                      {activeBlock.rows[0].shortTicker}
                    </Text>
                    <Text
                      style={[
                        s.tooltipChange,
                        {
                          color:
                            activeBlock.rows[0].change >= 0
                              ? c.brand
                              : "#FF6E5C",
                        },
                      ]}
                    >
                      {activeBlock.rows[0].change >= 0 ? "▲ " : "▼ "}
                      {formatPct(activeBlock.rows[0].change, false)}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  {activeBlock.rows.length > 0 ? (
                    <View
                      style={[
                        s.tooltipDivider,
                        { backgroundColor: "rgba(255,255,255,0.12)" },
                      ]}
                    />
                  ) : null}
                  {activeBlock.rows.slice(0, 5).map((r) => (
                    <View key={r.ticker} style={s.tooltipRow}>
                      <Text
                        style={[s.tooltipTicker, { color: c.bg }]}
                        numberOfLines={1}
                      >
                        {r.ticker}
                      </Text>
                      <Text
                        style={[
                          s.tooltipChange,
                          { color: r.change >= 0 ? c.brand : "#FF6E5C" },
                        ]}
                      >
                        {r.change >= 0 ? "▲ " : "▼ "}
                        {formatPct(r.change, false)}
                      </Text>
                    </View>
                  ))}
                  {activeBlock.rows.length > 5 ? (
                    <Text style={[s.tooltipMore, { color: "rgba(255,255,255,0.45)" }]}>
                      +{activeBlock.rows.length - 5} más
                    </Text>
                  ) : null}
                </>
              )}
            </View>
            <View style={[s.tooltipCaret, { backgroundColor: c.ink }]} />
          </Animated.View>
        ) : null}
      </View>

      <View style={s.allocLegendGrid}>
        {blocks.map((b) => (
          <View key={b.key} style={s.allocLegendRowGrid}>
            <View
              style={[s.allocLegendDot, { backgroundColor: b.color }]}
            />
            <Text
              style={[s.allocLegendLabel, { color: c.text }]}
              numberOfLines={1}
            >
              {b.label}
            </Text>
            <Text style={[s.allocLegendPct, { color: c.text }]}>
              {formatAllocationPct(b.pct / 100)}
            </Text>
          </View>
        ))}
      </View>

      <BalanceInfoSheet
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
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

/** Devuelve el ticker corto de un par crypto.
 *  "BTC/USDT" → "BTC", "BTCUSDT.P" → "BTC.P", el resto se devuelve
 *  tal cual (acciones / cedears etc no se tocan). En la pared 3D
 *  los pares completos se sienten técnicos y restan al lenguaje
 *  retail — preferimos mostrar el nombre full ("Bitcoin") con el
 *  short ticker como sub-label. */
function shortCryptoTicker(ticker: string): string {
  if (ticker.includes("/USDT")) return ticker.replace("/USDT", "");
  if (ticker.endsWith("USDT.P"))
    return ticker.replace("USDT.P", "") + ".P";
  return ticker;
}

/** Pct para el tooltip — un decimal siempre, con coma. */
function formatTooltipPct(p: number): string {
  return p.toFixed(1).replace(".", ",") + "%";
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
  allocEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  /* Pager horizontal de moneda — ScrollView pagingEnabled, dos
   * páginas (ARS / USD) cada una al ancho del card content. */
  allocPager: {
    flexGrow: 0,
  },
  allocPagerPage: {
    /* width se setea inline (containerW). Layout horizontal para
     * que el saldo y el info dot queden inline; el saldo ocupa
     * todo el espacio sobrante (flex: 1) y el dot queda anclado
     * a la derecha. */
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  allocInfoDot: {
    width: 22,
    height: 22,
    borderCurve: "continuous",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  allocCurrencyDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    marginBottom: 6,
    paddingVertical: 2,
  },
  allocCurrencyDot: {
    borderCurve: "continuous",
    borderRadius: 999,
  },
  brickWrap: {
    position: "relative",
    overflow: "visible",
  },
  /* Tooltip — anchor con width 0 + alignItems center centra el
   * children en el punto `left` que pasamos. `bottom` se setea
   * inline para que el caret termine justo arriba del front
   * face del ladrillo (la pill crece hacia arriba). */
  tooltipAnchor: {
    position: "absolute",
    width: 0,
    alignItems: "center",
    zIndex: 5,
  },
  /* Pill ahora vertical: header (categoría + pct) + lista de
   * tickers + change. minWidth para que se sienta consistente
   * entre categorías con pocos vs muchos activos. */
  tooltipPill: {
    minWidth: 168,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderCurve: "continuous",
    borderRadius: radius.md,
  },
  tooltipHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  tooltipLabel: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  tooltipPct: {
    fontFamily: fontFamily[800],
    fontSize: 13,
    letterSpacing: -0.2,
  },
  tooltipDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 7,
    marginBottom: 5,
  },
  tooltipRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 2,
  },
  tooltipTicker: {
    flex: 1,
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  tooltipChange: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  tooltipMore: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: -0.1,
    marginTop: 4,
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
