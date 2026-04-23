import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { Tap } from "../../lib/components/Tap";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useTheme, fontFamily, radius, spacing } from "../../lib/theme";
import {
  assets,
  assetIconCode,
  formatARS,
  formatPct,
  type AssetCategory,
} from "../../lib/data/assets";
import { Sparkline, seriesFromSeed } from "../../lib/components/Sparkline";
import { AmountDisplay } from "../../lib/components/AmountDisplay";
import { useFavorites } from "../../lib/favorites/context";

const ranges = ["1D", "1S", "1M", "3M", "1A", "MAX"] as const;
type Range = (typeof ranges)[number];

/** Variación % por rango para el activo (mock, determinístico). */
function rangePctFor(ticker: string, range: Range): number {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) | 0;
  const base = ((Math.abs(h) % 200) - 100) / 10; // -10 a 10
  const mult: Record<Range, number> = {
    "1D": 0.3,
    "1S": 0.7,
    "1M": 1.2,
    "3M": 2.1,
    "1A": 3.5,
    MAX: 5.2,
  };
  return base * mult[range];
}

function buildPriceSeries(currentPrice: number, pct: number, seed: string): number[] {
  const length = 40;
  const start = currentPrice / (1 + pct / 100);
  const noise = seriesFromSeed(seed, length, "flat");
  const noiseScale = currentPrice * 0.015;
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    const t = i / (length - 1);
    const linear = start + (currentPrice - start) * t;
    const normalized = (noise[i] - 100) / 6;
    out.push(linear + normalized * noiseScale);
  }
  out[length - 1] = currentPrice;
  return out;
}

export default function DetailScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { isFavorite, toggle: toggleFav } = useFavorites();
  const [range, setRange] = useState<Range>("1D");
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const asset = useMemo(() => assets.find((a) => a.ticker === ticker), [ticker]);
  if (!asset) return null;
  const fav = isFavorite(asset.ticker);

  const pctForRange = rangePctFor(asset.ticker, range);
  const rangeUp = pctForRange >= 0;
  const color = rangeUp ? c.greenDark : c.red;

  const series = useMemo(
    () => buildPriceSeries(asset.price, pctForRange, `${asset.ticker}-${range}`),
    [asset.price, asset.ticker, pctForRange, range],
  );

  const current = scrubIndex != null ? series[scrubIndex] : series[series.length - 1];
  const rangeStart = series[0];
  const displayDelta = current - rangeStart;
  const displayPct = (displayDelta / rangeStart) * 100;
  const displayUp = displayDelta >= 0;

  const timeLabel =
    scrubIndex != null
      ? indexLabel(range, scrubIndex, series.length)
      : rangeLabel(range);

  const position = asset.held && asset.qty ? asset.qty : 0;
  const positionValue = position * asset.price;

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <Tap
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
          onPress={() => router.back()}
          hitSlop={12}
          haptic="selection"
        >
          <Feather name="arrow-left" size={18} color={c.text} />
        </Tap>
        <View style={s.topCenter}>
          <Text style={[s.topTicker, { color: c.text }]}>{asset.ticker}</Text>
          <Text style={[s.topSub, { color: c.textMuted }]} numberOfLines={1}>
            {asset.subLabel}
          </Text>
        </View>
        <Tap
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
          hitSlop={12}
          haptic="light"
          onPress={() => toggleFav(asset.ticker)}
        >
          <Ionicons
            name={fav ? "star" : "star-outline"}
            size={18}
            color={fav ? c.greenDark : c.text}
          />
        </Tap>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.heroBlock}>
          <View style={s.identRow}>
            <View
              style={[
                s.identIcon,
                {
                  backgroundColor:
                    asset.iconTone === "dark" ? c.ink : c.surfaceSunken,
                },
              ]}
            >
              <Text
                style={[
                  s.identIconText,
                  { color: asset.iconTone === "dark" ? c.bg : c.textSecondary },
                ]}
              >
                {assetIconCode(asset)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.identName, { color: c.text }]}>{asset.name}</Text>
              <Text style={[s.identLabel, { color: c.textMuted }]}>
                {categoryLabel(asset.category)}
              </Text>
            </View>
          </View>

          <AmountDisplay value={current} size={42} />
          <View style={s.deltaRow}>
            <Text style={[s.deltaTri, { color }]}>{displayUp ? "▲" : "▼"}</Text>
            <Text style={[s.deltaText, { color }]}>
              {formatARS(Math.abs(displayDelta))}
            </Text>
            <Text style={[s.deltaSep, { color }]}>·</Text>
            <Text style={[s.deltaText, { color }]}>{formatPct(displayPct)}</Text>
            <Text style={[s.deltaSep, { color: c.textMuted }]}>·</Text>
            <Text style={[s.deltaText, { color: c.textMuted }]}>{timeLabel}</Text>
          </View>

          <Sparkline
            series={series}
            color={color}
            height={160}
            style={{ marginTop: 20 }}
            onScrub={(idx) => setScrubIndex(idx)}
            onScrubEnd={() => setScrubIndex(null)}
          />

          <View style={s.rangeRow}>
            {ranges.map((r) => {
              const active = r === range;
              return (
                <Tap
                  key={r}
                  onPress={() => setRange(r)}
                  haptic="selection"
                  pressScale={0.9}
                  style={[
                    s.rangePill,
                    active && { backgroundColor: color },
                  ]}
                  hitSlop={8}
                >
                  <Text
                    style={[
                      s.rangeText,
                      { color: active ? c.bg : c.textMuted },
                    ]}
                  >
                    {r}
                  </Text>
                </Tap>
              );
            })}
          </View>
        </View>

        {position > 0 ? (
          <View
            style={[
              s.positionCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={[s.cardEyebrow, { color: c.textMuted }]}>Tu posición</Text>
            <View style={s.positionRow}>
              <View>
                <Text style={[s.positionLabel, { color: c.textMuted }]}>
                  Valor
                </Text>
                <Text style={[s.positionValue, { color: c.text }]}>
                  {formatARS(positionValue)}
                </Text>
              </View>
              <View>
                <Text
                  style={[
                    s.positionLabel,
                    { color: c.textMuted, textAlign: "right" },
                  ]}
                >
                  Unidades
                </Text>
                <Text
                  style={[
                    s.positionValue,
                    { color: c.text, textAlign: "right" },
                  ]}
                >
                  {position}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <View
          style={[
            s.statsCard,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text style={[s.cardEyebrow, { color: c.textMuted }]}>Información</Text>
          {stats(asset).map((row, i, arr) => (
            <View
              key={row.label}
              style={[
                s.statRow,
                i < arr.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: c.border,
                },
              ]}
            >
              <Text style={[s.statLabel, { color: c.textMuted }]}>{row.label}</Text>
              <Text style={[s.statValue, { color: c.text }]}>{row.value}</Text>
            </View>
          ))}
        </View>

        <View
          style={[
            s.aboutCard,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text style={[s.cardEyebrow, { color: c.textMuted }]}>
            Sobre {asset.name}
          </Text>
          <Text style={[s.aboutText, { color: c.textSecondary }]}>
            {aboutText(asset.category)}
          </Text>
        </View>
      </ScrollView>

      <View
        style={[
          s.bottomBar,
          {
            backgroundColor: c.surface,
            borderTopColor: c.border,
            shadowColor: c.ink,
            paddingBottom: insets.bottom + 6,
          },
        ]}
      >
        <Tap
          style={[s.btn, { backgroundColor: c.ink }]}
          haptic="medium"
          onPress={() =>
            router.push({
              pathname: "/(app)/buy",
              params: { ticker: asset.ticker, mode: "buy" },
            })
          }
        >
          <Text style={[s.btnText, { color: c.bg }]}>Comprar</Text>
        </Tap>
        {position > 0 ? (
          <Tap
            style={[s.btn, { backgroundColor: c.surfaceHover }]}
            haptic="light"
            onPress={() =>
              router.push({
                pathname: "/(app)/buy",
                params: { ticker: asset.ticker, mode: "sell" },
              })
            }
          >
            <Text style={[s.btnText, { color: c.text }]}>Vender</Text>
          </Tap>
        ) : null}
      </View>
    </View>
  );
}

function categoryLabel(cat: AssetCategory): string {
  const labels: Record<AssetCategory, string> = {
    efectivo: "Efectivo",
    cedears: "CEDEAR",
    bonos: "Bono soberano",
    fci: "Fondo común de inversión",
    acciones: "Acción argentina",
    obligaciones: "Obligación negociable",
    letras: "Letra del Tesoro",
    caucion: "Caución bursátil",
    cripto: "Cripto Spot",
    futuros: "Futuro perpetuo",
    opciones: "Opción",
  };
  return labels[cat];
}

function rangeLabel(r: Range): string {
  switch (r) {
    case "1D":
      return "hoy";
    case "1S":
      return "esta semana";
    case "1M":
      return "este mes";
    case "3M":
      return "3 meses";
    case "1A":
      return "1 año";
    case "MAX":
      return "histórico";
  }
}

function indexLabel(r: Range, index: number, length: number): string {
  const t = 1 - index / (length - 1);
  switch (r) {
    case "1D": {
      const h = Math.round(t * 24);
      if (h === 0) return "ahora";
      if (h === 1) return "hace 1h";
      return `hace ${h}h`;
    }
    case "1S": {
      const d = Math.round(t * 7);
      if (d === 0) return "hoy";
      if (d === 1) return "hace 1 día";
      return `hace ${d} días`;
    }
    case "1M": {
      const d = Math.round(t * 30);
      if (d === 0) return "hoy";
      return `hace ${d} días`;
    }
    case "3M": {
      const w = Math.round(t * 13);
      if (w === 0) return "hoy";
      return `hace ${w} sem`;
    }
    case "1A": {
      const m = Math.round(t * 12);
      if (m === 0) return "hoy";
      return `hace ${m} meses`;
    }
    case "MAX": {
      const y = Math.round(t * 5);
      if (y === 0) return "este año";
      return `hace ${y} años`;
    }
  }
}

function stats(asset: ReturnType<typeof useMemo<any>> | any): { label: string; value: string }[] {
  const rows = [
    { label: "Precio actual", value: formatARS(asset.price) },
    { label: "Variación", value: formatPct(asset.change) },
  ];
  switch (asset.category as AssetCategory) {
    case "cedears":
      rows.push(
        { label: "Mercado de origen", value: "NASDAQ / NYSE" },
        { label: "Ratio de conversión", value: "10:1" },
        { label: "Moneda origen", value: "USD" },
      );
      break;
    case "bonos":
      rows.push(
        { label: "Ley aplicable", value: asset.subLabel.includes("NY") ? "Nueva York" : "Argentina" },
        { label: "Moneda", value: "USD" },
        { label: "Vencimiento", value: "2030" },
      );
      break;
    case "fci":
      rows.push(
        { label: "Tipo de fondo", value: asset.subLabel.includes("Variable") ? "Renta variable" : "Renta fija" },
        { label: "Moneda", value: "Pesos" },
        { label: "Horizonte sugerido", value: "Corto plazo" },
      );
      break;
    case "obligaciones":
      rows.push(
        { label: "Emisor", value: asset.name.split(" ON")[0] },
        { label: "Moneda", value: "USD" },
      );
      break;
    case "letras":
      rows.push({ label: "Vencimiento", value: "Corto plazo" });
      break;
    case "caucion":
      rows.push({ label: "Plazo", value: "Según contrato" });
      break;
    default:
      rows.push({ label: "Tipo", value: categoryLabel(asset.category) });
  }
  return rows;
}

function aboutText(cat: AssetCategory): string {
  switch (cat) {
    case "efectivo":
      return "Saldo en pesos disponible en tu cuenta de Alamos. Lo usás para comprar cualquier activo o podés retirarlo a tu cuenta bancaria cuando quieras.";
    case "cedears":
      return "Certificado de depósito argentino que representa acciones de empresas del exterior. Operan en pesos en BYMA.";
    case "bonos":
      return "Título de deuda emitido por el Tesoro Nacional. Paga intereses periódicos y devuelve el capital al vencimiento.";
    case "fci":
      return "Fondo común de inversión administrado por una gestora local. Invertí un monto mínimo bajo y podés rescatar cuando quieras.";
    case "acciones":
      return "Acción de una empresa argentina que cotiza en BYMA. Te convertís en accionista y participás de los resultados de la compañía.";
    case "obligaciones":
      return "Título de deuda privado emitido por una empresa. Suele rendir más que los bonos del Tesoro.";
    case "letras":
      return "Letra capitalizable del Tesoro. Corto plazo, rendimiento fijo.";
    case "caucion":
      return "Préstamo de corto plazo entre inversores con garantía en títulos públicos. Rinde pesos a tasa de mercado.";
    case "cripto":
      return "Criptomoneda spot. Operable 24/7 en el mercado internacional con liquidación inmediata.";
    case "futuros":
      return "Contrato de futuro perpetuo con apalancamiento. Alto riesgo, solo para traders experimentados.";
    case "opciones":
      return "Derivado financiero. Da el derecho (no la obligación) de comprar o vender a un precio fijado.";
  }
}

const s = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  topCenter: {
    flex: 1,
    alignItems: "center",
  },
  topTicker: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  topSub: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    marginTop: 1,
  },
  heroBlock: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  identRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  identIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  identIconText: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.3,
  },
  identName: {
    fontFamily: fontFamily[700],
    fontSize: 18,
    letterSpacing: -0.4,
  },
  identLabel: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    marginTop: 2,
  },
  price: {
    fontFamily: fontFamily[700],
    fontSize: 42,
    letterSpacing: -1.8,
  },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  deltaTri: {
    fontFamily: fontFamily[700],
    fontSize: 11,
  },
  deltaText: {
    fontFamily: fontFamily[600],
    fontSize: 14,
  },
  deltaSep: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    opacity: 0.6,
  },
  rangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    marginHorizontal: -4,
  },
  rangePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  rangeText: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: 0.4,
  },
  positionCard: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 18,
  },
  cardEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  positionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  positionLabel: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  positionValue: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.7,
  },
  statsCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 18,
    paddingTop: 16,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  statLabel: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  statValue: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  aboutCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 18,
  },
  aboutText: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 16,
  },
  btn: {
    flex: 1,
    height: 52,
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontFamily: fontFamily[600],
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
