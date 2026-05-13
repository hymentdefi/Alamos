import { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Polyline,
} from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius } from "../../lib/theme";
import { assets } from "../../lib/data/assets";
import { Tap } from "../../lib/components/Tap";
import { useToast } from "../../lib/toast/context";

type OrderKind =
  | "market"
  | "recurring"
  | "limit"
  | "trailingStop"
  | "stop"
  | "stopLimit";

interface OrderOption {
  key: OrderKind;
  title: string;
  /** Texto descriptivo del comportamiento. Se sustituye `{ticker}`
   *  por el ticker actual del activo si está disponible. */
  description: (ticker: string, side: "buy" | "sell") => string;
  /** Si el tipo está disponible en v1. El resto muestra "Próximamente"
   *  y el tap dispara un toast informativo. */
  available: boolean;
}

const OPTIONS: OrderOption[] = [
  {
    key: "market",
    title: "A mercado",
    description: (t, side) =>
      side === "sell"
        ? `Vendé ${t} al precio disponible ahora.`
        : `Comprá ${t} al precio disponible ahora.`,
    available: true,
  },
  {
    key: "recurring",
    title: "Inversión recurrente",
    description: (t) => `Invertí en ${t} con un calendario recurrente.`,
    available: false,
  },
  {
    key: "limit",
    title: "Orden límite",
    description: (t, side) =>
      side === "sell"
        ? `Vender ${t} a un precio mínimo o superior.`
        : `Comprar ${t} a un precio máximo o inferior.`,
    available: true,
  },
  {
    key: "trailingStop",
    title: "Trailing stop",
    description: (t, side) =>
      side === "sell"
        ? `Si ${t} cae un % desde su máximo, dispara una venta a mercado.`
        : `Si ${t} sube un % desde su mínimo, dispara una compra a mercado.`,
    available: false,
  },
  {
    key: "stop",
    title: "Stop",
    description: (t, side) =>
      side === "sell"
        ? `Si ${t} baja a un precio fijo, dispara una venta a mercado.`
        : `Si ${t} sube a un precio fijo, dispara una compra a mercado.`,
    available: false,
  },
  {
    key: "stopLimit",
    title: "Stop limit",
    description: (t, side) =>
      side === "sell"
        ? `Si ${t} baja a un stop, dispara una venta con límite.`
        : `Si ${t} sube a un stop, dispara una compra con límite.`,
    available: false,
  },
];

/**
 * Pantalla con la lista de tipos de orden condicional. Entrada desde
 * el /buy via un link discreto. En v1, sólo "Orden límite" está
 * disponible; el resto muestra estado "Próximamente" con un toast al
 * tap. Cada item es una row con glyph + título + descripción + chevron.
 */
export default function ConditionalOrdersScreen() {
  const { ticker, mode, current } = useLocalSearchParams<{
    ticker: string;
    mode?: string;
    /** Tipo de orden actualmente activo en el screen que abrió este
     *  selector. Sirve para marcar el row con un check visual y
     *  hacer obvio cuál es "donde está parado el user" — sino,
     *  desde /limit-order el user no entiende cómo "volver" a
     *  market. Default "market" (caso /buy). */
    current?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { show: showToast } = useToast();

  const asset = useMemo(
    () => assets.find((a) => a.ticker === ticker),
    [ticker],
  );
  const side: "buy" | "sell" = mode === "sell" ? "sell" : "buy";
  const currentKind: OrderKind = (current as OrderKind) || "market";

  if (!asset) return null;

  const onSelect = (opt: OrderOption) => {
    if (!opt.available) {
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Warning,
      ).catch(() => {});
      showToast(`${opt.title} todavía no está disponible.`);
      return;
    }
    /* Si el user tapeó la opción que ya tiene activa, no abrimos
     *  pantalla nueva — sólo cerramos este selector y volvemos
     *  atrás. Sino, tapear "A mercado" estando en market causa
     *  una pila duplicada de /buy. */
    if (opt.key === currentKind) {
      Haptics.selectionAsync().catch(() => {});
      router.back();
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    if (opt.key === "market") {
      /* Volver al /buy. El stack siempre tiene /buy abajo porque
       *  /conditional-orders sólo se llega desde /buy (push) o
       *  desde /limit-order (replace). router.back() cae en /buy
       *  en ambos casos. */
      router.back();
      return;
    }
    if (opt.key === "limit") {
      router.replace({
        pathname: "/(app)/limit-order",
        params: { ticker: asset.ticker, mode: side },
      });
    }
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Tap
          style={s.iconBtn}
          onPress={() => router.back()}
          hitSlop={12}
          haptic="selection"
        >
          <Feather name="x" size={22} color={c.text} />
        </Tap>
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[s.title, { color: c.text }]}>Tipo de orden</Text>
        <Text style={[s.subtitle, { color: c.textMuted }]}>
          Elegí cómo querés que se ejecute tu orden de {asset.ticker}.
        </Text>

        <View style={s.list}>
          {OPTIONS.map((opt) => (
            <OrderRow
              key={opt.key}
              option={opt}
              ticker={asset.ticker}
              side={side}
              isCurrent={opt.key === currentKind}
              onPress={() => onSelect(opt)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function OrderRow({
  option,
  ticker,
  side,
  isCurrent,
  onPress,
}: {
  option: OrderOption;
  ticker: string;
  side: "buy" | "sell";
  isCurrent: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const muted = !option.available;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        {
          backgroundColor: c.surface,
          /* La opción activa se distingue con un borde brand más
           * grueso — patrón outline-brand del sistema de jerarquía. */
          borderColor: isCurrent ? c.brand : c.border,
          borderWidth: isCurrent ? 1.6 : 1,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <OrderGlyph kind={option.key} color={muted ? c.textFaint : c.brand} />
      <View style={{ flex: 1 }}>
        <View style={s.rowTitleRow}>
          <Text
            style={[
              s.rowTitle,
              { color: muted ? c.textMuted : c.text },
            ]}
          >
            {option.title}
          </Text>
          {muted ? (
            <Text style={[s.soonPill, { color: c.textMuted }]}>
              Próximamente
            </Text>
          ) : null}
          {isCurrent && !muted ? (
            <Text style={[s.currentPill, { color: c.brand }]}>Actual</Text>
          ) : null}
        </View>
        <Text
          style={[s.rowDesc, { color: c.textMuted }]}
          numberOfLines={2}
        >
          {option.description(ticker, side)}
        </Text>
      </View>
      {isCurrent && !muted ? (
        <Feather name="check" size={20} color={c.brand} />
      ) : (
        <Feather name="chevron-right" size={18} color={c.textFaint} />
      )}
    </Pressable>
  );
}

/**
 * Glyphs vectoriales para cada tipo de orden condicional. Squircle
 * oscuro con un trazo brand verde por dentro evocando la mecánica:
 *   recurring     → flecha circular cerrada
 *   limit         → línea horizontal punteada + trazo cruzándola
 *   trailingStop  → zigzag ascendente + flecha
 *   stop          → triángulo de stop sólido apuntando a una línea
 *   stopLimit     → combinación stop + límite (línea + tope)
 */
function OrderGlyph({
  kind,
  color,
}: {
  kind: OrderKind;
  color: string;
}) {
  const { c } = useTheme();
  return (
    <View
      style={[
        s.glyphWrap,
        {
          backgroundColor: c.ink,
        },
      ]}
    >
      <Svg width={26} height={26} viewBox="0 0 48 48">
        <G fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          {kind === "market" ? (
            <>
              {/* Bolt / rayo — "ejecuta ya, instantáneo". */}
              <Polyline points="26,6 12,28 22,28 18,42 36,18 26,18 30,6 26,6" />
            </>
          ) : null}
          {kind === "recurring" ? (
            <>
              <Path d="M14 18a12 12 0 0 1 22 4" />
              <Polyline points="36,12 36,22 26,22" />
              <Path d="M34 30a12 12 0 0 1-22-4" />
              <Polyline points="12,36 12,26 22,26" />
            </>
          ) : null}
          {kind === "limit" ? (
            <>
              <Line
                x1="6"
                y1="28"
                x2="42"
                y2="28"
                strokeDasharray="3,3"
              />
              <Polyline points="8,36 18,22 28,30 40,14" />
            </>
          ) : null}
          {kind === "trailingStop" ? (
            <>
              <Polyline points="6,38 16,28 24,32 32,20 42,24" />
              <Polyline points="34,16 42,24 34,32" />
            </>
          ) : null}
          {kind === "stop" ? (
            <>
              <Line x1="6" y1="28" x2="42" y2="28" />
              <Polyline points="8,40 22,16 36,40" />
              <Line x1="14" y1="40" x2="30" y2="40" />
            </>
          ) : null}
          {kind === "stopLimit" ? (
            <>
              <Line
                x1="6"
                y1="14"
                x2="42"
                y2="14"
                strokeDasharray="3,3"
              />
              <Line x1="6" y1="34" x2="42" y2="34" />
              <Polyline points="14,40 24,20 34,40" />
            </>
          ) : null}
        </G>
        {kind === "limit" || kind === "stopLimit" ? (
          <Circle cx="40" cy={kind === "limit" ? 14 : 14} r={2.6} fill={color} />
        ) : null}
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 32,
    letterSpacing: -1,
    lineHeight: 36,
  },
  subtitle: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    marginTop: 8,
    marginBottom: 24,
  },
  list: {
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderCurve: "continuous",
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  rowTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowTitle: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.3,
  },
  soonPill: {
    fontFamily: fontFamily[600],
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  /* Pill "Actual" — chiquito al lado del título de la opción que ya
   * está activa en la pantalla que abrió el selector. Brand verde,
   * uppercase, mismo treatment que el soonPill pero con tono brand. */
  currentPill: {
    fontFamily: fontFamily[700],
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  rowDesc: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.05,
    marginTop: 2,
  },
  glyphWrap: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
    borderRadius: 23,
  },
});
