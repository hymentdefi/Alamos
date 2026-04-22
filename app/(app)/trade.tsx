import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius, proAccent } from "../../lib/theme";
import {
  assets,
  formatPct,
  formatVolume,
} from "../../lib/data/assets";
import { Sparkline, seriesFromSeed } from "../../lib/components/Sparkline";
import { useFavorites } from "../../lib/favorites/context";

type TimeFrame = "1m" | "5m" | "15m" | "1h" | "4h" | "1D";
type OrderType = "limit" | "market" | "stop";
type Side = "buy" | "sell";

const timeframes: TimeFrame[] = ["1m", "5m", "15m", "1h", "4h", "1D"];
const orderTypes: { id: OrderType; label: string }[] = [
  { id: "limit", label: "Limit" },
  { id: "market", label: "Market" },
  { id: "stop", label: "Stop-Limit" },
];

const AVAILABLE_USDT = 1272.85;

export default function TradeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const { isFavorite, toggle: toggleFav } = useFavorites();

  const asset = useMemo(
    () => assets.find((a) => a.ticker === ticker),
    [ticker],
  );

  const [tf, setTf] = useState<TimeFrame>("15m");
  const [scrubIdx, setScrubIdx] = useState<number | null>(null);
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [side, setSide] = useState<Side>("buy");
  const [price, setPrice] = useState(asset?.price.toString() ?? "0");
  const [amount, setAmount] = useState("");
  const [sliderPct, setSliderPct] = useState(0);
  const [leverage, setLeverage] = useState(10);

  if (!asset) return null;

  const fav = isFavorite(asset.ticker);
  const isFutures = asset.category === "futuros";
  const up = asset.change >= 0;
  const trendColor = up ? c.green : c.red;

  const series = useMemo(
    () => seriesFromSeed(`trade-${asset.ticker}-${tf}`, 50, up ? "up" : "down"),
    [asset.ticker, tf, up],
  );

  const displayPrice = scrubIdx != null ? series[scrubIdx] : asset.price;

  // Mock orderbook (8 asks + 8 bids around current price)
  const orderbook = useMemo(() => {
    const step = asset.price * 0.0005;
    const asks = Array.from({ length: 8 }, (_, i) => ({
      price: asset.price + step * (i + 1),
      qty: Math.random() * 5 + 0.1,
      total: 0,
    }));
    const bids = Array.from({ length: 8 }, (_, i) => ({
      price: asset.price - step * (i + 1),
      qty: Math.random() * 5 + 0.1,
      total: 0,
    }));
    // Cumulative totals for depth bar
    let ta = 0;
    for (const a of asks) {
      ta += a.qty;
      a.total = ta;
    }
    let tb = 0;
    for (const b of bids) {
      tb += b.qty;
      b.total = tb;
    }
    return { asks: asks.reverse(), bids };
  }, [asset.price]);

  const maxDepth = Math.max(
    orderbook.asks[0]?.total ?? 1,
    orderbook.bids[orderbook.bids.length - 1]?.total ?? 1,
  );

  // Recent trades mock
  const recentTrades = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        price: asset.price + (Math.random() - 0.5) * asset.price * 0.001,
        qty: Math.random() * 2 + 0.01,
        side: Math.random() > 0.5 ? ("buy" as const) : ("sell" as const),
        time: `${14 - i}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`,
      })),
    [asset.price],
  );

  const amountNum = parseFloat(amount) || 0;
  const priceNum = parseFloat(price) || 0;
  const total = amountNum * priceNum;
  const effectiveAvailable =
    side === "buy" ? AVAILABLE_USDT : AVAILABLE_USDT / asset.price;

  const handleSlider = (pct: number) => {
    Haptics.selectionAsync().catch(() => {});
    setSliderPct(pct);
    const amt =
      side === "buy"
        ? (AVAILABLE_USDT * pct) / 100 / priceNum
        : (effectiveAvailable * pct) / 100;
    setAmount(amt.toFixed(asset.price < 1 ? 4 : 4));
  };

  const submit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // TODO: submit order
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      {/* ── Top bar ── */}
      <View style={[s.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
          onPress={() => router.back()}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={18} color={c.text} />
        </Pressable>
        <View style={s.topCenter}>
          <Text style={[s.topTicker, { color: c.text }]}>{asset.ticker}</Text>
          {isFutures ? (
            <View style={[s.perpBadge, { backgroundColor: proAccent.yellowDim }]}>
              <Text style={[s.perpBadgeText, { color: proAccent.yellow }]}>
                {asset.maxLeverage}x
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
            onPress={() => toggleFav(asset.ticker)}
            hitSlop={10}
          >
            <Ionicons
              name={fav ? "star" : "star-outline"}
              size={18}
              color={fav ? proAccent.yellow : c.text}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrubIdx == null}
      >
        {/* ── Price header ── */}
        <View style={s.priceBlock}>
          <Text style={[s.price, { color: trendColor }]}>
            {displayPrice.toLocaleString("en-US", {
              maximumFractionDigits: displayPrice < 1 ? 4 : 2,
            })}
          </Text>
          <Text style={[s.priceAlt, { color: c.textMuted }]}>
            ≈ ${" "}
            {(displayPrice * 1200).toLocaleString("es-AR", {
              maximumFractionDigits: 0,
            })}
          </Text>
          <View style={s.statsRow}>
            <Stat label="24h Cambio" value={formatPct(asset.change)} color={trendColor} />
            <Stat
              label="24h Max"
              value={(asset.price * 1.028).toFixed(
                asset.price < 1 ? 4 : 2,
              )}
              color={c.text}
            />
            <Stat
              label="24h Min"
              value={(asset.price * 0.974).toFixed(
                asset.price < 1 ? 4 : 2,
              )}
              color={c.text}
            />
            <Stat
              label="Vol 24h"
              value={asset.volume24h ? formatVolume(asset.volume24h) : "—"}
              color={c.text}
            />
          </View>
        </View>

        {/* ── Timeframe tabs ── */}
        <View
          style={[
            s.tfRow,
            { borderTopColor: c.border, borderBottomColor: c.border },
          ]}
        >
          {timeframes.map((t) => {
            const active = t === tf;
            return (
              <Pressable
                key={t}
                onPress={() => setTf(t)}
                style={s.tfItem}
                hitSlop={6}
              >
                <Text
                  style={[
                    s.tfLabel,
                    { color: active ? c.text : c.textMuted },
                  ]}
                >
                  {t}
                </Text>
                {active ? (
                  <View
                    style={[
                      s.tfUnderline,
                      { backgroundColor: proAccent.yellow },
                    ]}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* ── Chart ── */}
        <Sparkline
          series={series}
          color={trendColor}
          height={180}
          onScrub={(i) => setScrubIdx(i)}
          onScrubEnd={() => setScrubIdx(null)}
          style={{ marginTop: 8 }}
        />

        {/* ── Orderbook + Recent trades ── */}
        <View
          style={[
            s.bookWrap,
            { borderTopColor: c.border, borderBottomColor: c.border },
          ]}
        >
          <View style={s.bookHalf}>
            <Text style={[s.bookHead, { color: c.textMuted }]}>
              Orderbook
            </Text>
            <View style={s.bookColHead}>
              <Text style={[s.bookColText, { color: c.textFaint }]}>
                Precio
              </Text>
              <Text style={[s.bookColText, { color: c.textFaint, textAlign: "right" }]}>
                Cantidad
              </Text>
            </View>
            {orderbook.asks.map((row, i) => (
              <View key={`a${i}`} style={s.bookRow}>
                <View
                  style={[
                    s.depthBar,
                    {
                      backgroundColor: c.redDim,
                      width: `${(row.total / maxDepth) * 100}%`,
                    },
                  ]}
                />
                <Text style={[s.bookPrice, { color: c.red }]}>
                  {row.price.toLocaleString("en-US", {
                    maximumFractionDigits: row.price < 1 ? 4 : 2,
                  })}
                </Text>
                <Text style={[s.bookQty, { color: c.textSecondary }]}>
                  {row.qty.toFixed(3)}
                </Text>
              </View>
            ))}
            <View
              style={[
                s.bookMid,
                { borderTopColor: c.border, borderBottomColor: c.border },
              ]}
            >
              <Text style={[s.bookMidPrice, { color: trendColor }]}>
                {asset.price.toLocaleString("en-US", {
                  maximumFractionDigits: asset.price < 1 ? 4 : 2,
                })}
              </Text>
              <Text style={[s.bookMidHint, { color: c.textMuted }]}>
                ≈ ${" "}
                {(asset.price * 1200).toLocaleString("es-AR", {
                  maximumFractionDigits: 0,
                })}
              </Text>
            </View>
            {orderbook.bids.map((row, i) => (
              <View key={`b${i}`} style={s.bookRow}>
                <View
                  style={[
                    s.depthBar,
                    {
                      backgroundColor: c.greenDim,
                      width: `${(row.total / maxDepth) * 100}%`,
                    },
                  ]}
                />
                <Text style={[s.bookPrice, { color: c.green }]}>
                  {row.price.toLocaleString("en-US", {
                    maximumFractionDigits: row.price < 1 ? 4 : 2,
                  })}
                </Text>
                <Text style={[s.bookQty, { color: c.textSecondary }]}>
                  {row.qty.toFixed(3)}
                </Text>
              </View>
            ))}
          </View>

          <View style={[s.bookDivider, { backgroundColor: c.border }]} />

          <View style={s.bookHalf}>
            <Text style={[s.bookHead, { color: c.textMuted }]}>Trades</Text>
            <View style={s.bookColHead}>
              <Text style={[s.bookColText, { color: c.textFaint }]}>
                Precio
              </Text>
              <Text style={[s.bookColText, { color: c.textFaint, textAlign: "right" }]}>
                Hora
              </Text>
            </View>
            {recentTrades.map((t, i) => (
              <View key={i} style={s.tradeRow}>
                <Text
                  style={[
                    s.tradePrice,
                    { color: t.side === "buy" ? c.green : c.red },
                  ]}
                >
                  {t.price.toLocaleString("en-US", {
                    maximumFractionDigits: t.price < 1 ? 4 : 2,
                  })}
                </Text>
                <Text style={[s.tradeQty, { color: c.textSecondary }]}>
                  {t.qty.toFixed(3)}
                </Text>
                <Text style={[s.tradeTime, { color: c.textMuted }]}>
                  {t.time}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Order form ── */}
        <View style={s.formBlock}>
          {/* Buy/Sell toggle */}
          <View style={[s.sideToggle, { backgroundColor: c.surfaceSunken }]}>
            <Pressable
              onPress={() => setSide("buy")}
              style={[
                s.sideBtn,
                side === "buy" && { backgroundColor: c.green },
              ]}
            >
              <Text
                style={[
                  s.sideBtnText,
                  { color: side === "buy" ? "#FFFFFF" : c.textMuted },
                ]}
              >
                Comprar / Long
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSide("sell")}
              style={[
                s.sideBtn,
                side === "sell" && { backgroundColor: c.red },
              ]}
            >
              <Text
                style={[
                  s.sideBtnText,
                  { color: side === "sell" ? "#FFFFFF" : c.textMuted },
                ]}
              >
                Vender / Short
              </Text>
            </Pressable>
          </View>

          {/* Order type */}
          <View style={s.typeRow}>
            {orderTypes.map((t) => {
              const active = orderType === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setOrderType(t.id)}
                  style={s.typeBtn}
                >
                  <Text
                    style={[
                      s.typeLabel,
                      { color: active ? c.text : c.textMuted },
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Leverage (futures only) */}
          {isFutures ? (
            <View
              style={[
                s.levRow,
                { backgroundColor: c.surfaceSunken, borderColor: c.border },
              ]}
            >
              <Text style={[s.levLabel, { color: c.textMuted }]}>
                Apalancamiento
              </Text>
              <View style={s.levPills}>
                {[5, 10, 25, 50, asset.maxLeverage ?? 100].map((l) => {
                  const active = l === leverage;
                  return (
                    <Pressable
                      key={l}
                      onPress={() => setLeverage(l)}
                      style={[
                        s.levPill,
                        {
                          backgroundColor: active
                            ? proAccent.yellow
                            : "transparent",
                          borderColor: active
                            ? proAccent.yellow
                            : c.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          s.levPillText,
                          { color: active ? c.ink : c.textMuted },
                        ]}
                      >
                        {l}x
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Price input */}
          {orderType !== "market" ? (
            <View
              style={[
                s.field,
                { backgroundColor: c.surface, borderColor: c.border },
              ]}
            >
              <Text style={[s.fieldLabel, { color: c.textMuted }]}>
                Precio
              </Text>
              <TextInput
                style={[s.fieldInput, { color: c.text }]}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
              />
              <Text style={[s.fieldUnit, { color: c.textMuted }]}>USDT</Text>
            </View>
          ) : null}

          {/* Amount input */}
          <View
            style={[
              s.field,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={[s.fieldLabel, { color: c.textMuted }]}>
              Cantidad
            </Text>
            <TextInput
              style={[s.fieldInput, { color: c.text }]}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={c.textFaint}
              keyboardType="decimal-pad"
            />
            <Text style={[s.fieldUnit, { color: c.textMuted }]}>
              {asset.ticker.split("/")[0]?.replace(".P", "") ?? asset.ticker}
            </Text>
          </View>

          {/* Slider % */}
          <View style={s.sliderRow}>
            {[25, 50, 75, 100].map((p) => {
              const active = sliderPct === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => handleSlider(p)}
                  style={[
                    s.sliderBtn,
                    {
                      borderColor: active ? c.borderStrong : c.border,
                      backgroundColor: active ? c.surfaceHover : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.sliderText,
                      { color: active ? c.text : c.textMuted },
                    ]}
                  >
                    {p}%
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Total + available */}
          <View style={s.totalRow}>
            <Text style={[s.totalLabel, { color: c.textMuted }]}>
              Total
            </Text>
            <Text style={[s.totalValue, { color: c.text }]}>
              {total.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              USDT
            </Text>
          </View>
          <View style={s.totalRow}>
            <Text style={[s.totalLabel, { color: c.textMuted }]}>
              Disponible
            </Text>
            <Text style={[s.totalValue, { color: c.textSecondary }]}>
              {AVAILABLE_USDT.toFixed(2)} USDT
            </Text>
          </View>

          {/* Submit */}
          <Pressable
            onPress={submit}
            style={[
              s.submitBtn,
              { backgroundColor: side === "buy" ? c.green : c.red },
            ]}
          >
            <Text style={[s.submitText, { color: "#FFFFFF" }]}>
              {side === "buy" ? "Comprar" : "Vender"}{" "}
              {asset.ticker.split("/")[0]?.replace(".P", "") ?? asset.ticker}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const { c } = useTheme();
  return (
    <View style={s.statCol}>
      <Text style={[s.statLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[s.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  topCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  topTicker: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.2,
  },
  perpBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  perpBadgeText: {
    fontFamily: fontFamily[700],
    fontSize: 10,
    letterSpacing: 0.4,
  },

  /* Price block */
  priceBlock: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  price: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    letterSpacing: -1.2,
    lineHeight: 36,
  },
  priceAlt: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 14,
    justifyContent: "space-between",
  },
  statCol: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    fontFamily: fontFamily[500],
    fontSize: 10,
    letterSpacing: 0.2,
  },
  statValue: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.1,
  },

  /* Timeframe */
  tfRow: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    gap: 22,
  },
  tfItem: {
    paddingVertical: 10,
    position: "relative",
  },
  tfLabel: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  tfUnderline: {
    position: "absolute",
    bottom: 0,
    left: -2,
    right: -2,
    height: 2,
  },

  /* Orderbook */
  bookWrap: {
    flexDirection: "row",
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  bookHalf: {
    flex: 1,
    paddingHorizontal: 12,
  },
  bookDivider: {
    width: StyleSheet.hairlineWidth,
  },
  bookHead: {
    fontFamily: fontFamily[700],
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 6,
  },
  bookColHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  bookColText: {
    fontFamily: fontFamily[500],
    fontSize: 9,
    letterSpacing: 0.2,
  },
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
    position: "relative",
  },
  depthBar: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
  },
  bookPrice: {
    flex: 1,
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: -0.05,
  },
  bookQty: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: -0.05,
    textAlign: "right",
  },
  bookMid: {
    paddingVertical: 8,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  bookMidPrice: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  bookMidHint: {
    fontFamily: fontFamily[500],
    fontSize: 9,
    marginTop: 2,
  },
  tradeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
    gap: 4,
  },
  tradePrice: {
    flex: 1,
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: -0.05,
  },
  tradeQty: {
    flex: 1,
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: -0.05,
    textAlign: "right",
  },
  tradeTime: {
    fontFamily: fontFamily[500],
    fontSize: 10,
    letterSpacing: -0.05,
    textAlign: "right",
    minWidth: 50,
  },

  /* Form */
  formBlock: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sideToggle: {
    flexDirection: "row",
    borderRadius: radius.sm,
    padding: 3,
    gap: 3,
    marginBottom: 12,
  },
  sideBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 6,
  },
  sideBtnText: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  typeRow: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 18,
  },
  typeBtn: {
    paddingVertical: 4,
  },
  typeLabel: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  levRow: {
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: 12,
  },
  levLabel: {
    fontFamily: fontFamily[600],
    fontSize: 10,
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  levPills: {
    flexDirection: "row",
    gap: 6,
  },
  levPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  levPillText: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: -0.05,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: 8,
    gap: 10,
  },
  fieldLabel: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: -0.05,
    width: 64,
  },
  fieldInput: {
    flex: 1,
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.1,
    padding: 0,
  },
  fieldUnit: {
    fontFamily: fontFamily[600],
    fontSize: 12,
  },
  sliderRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
    marginBottom: 14,
  },
  sliderBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 4,
    borderWidth: 1,
  },
  sliderText: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: -0.1,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalLabel: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  totalValue: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  submitBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
});
