import { useEffect, useRef } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";
import { useTheme, fontFamily, radius } from "../../../lib/theme";
import { registerTabTap } from "../../../lib/tabs/activeTap";
import { useFloatingTabBarHeight } from "../../../lib/components/FloatingTabBar";

/**
 * Tab Tarjeta — placeholder de la futura tarjeta de débito Álamos. La
 * pantalla todavía no tiene producto detrás: muestra una representación
 * visual de la tarjeta + copy minimal que comunica la idea. El contenido
 * real (activación, movimientos, límites, controles) se construirá
 * cuando el producto exista.
 */
export default function TarjetaScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const tabBarH = useFloatingTabBarHeight();

  useEffect(() => {
    return registerTabTap("tarjeta", {
      isAtTop: () => true,
      scrollToTop: () =>
        scrollRef.current?.scrollTo({ y: 0, animated: true }),
      // Placeholder no tiene data viva, así que el refresh es no-op.
      refresh: () => {},
    });
  }, []);

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: tabBarH + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.heroBlock}>
          <Text style={[s.title, { color: c.text }]}>Tarjeta</Text>
        </View>

        <View style={s.cardWrap}>
          <CardArt />
        </View>

        <View style={s.copyBlock}>
          <Text style={[s.copy, { color: c.textMuted }]}>
            Pagá con lo que tenés invertido. Sin tener que vender, sin
            esperar a que liquide.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Ilustración de la tarjeta — SVG flat con el monograma Álamos y un
 * chip simulado. Sin foto, sin gradient saturado. Look on-brand: bg
 * ink, texto en off-white, acentos en brand verde.
 */
function CardArt() {
  const W = 320;
  const H = 200;
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
      <Rect
        x={4}
        y={4}
        width={W - 8}
        height={H - 8}
        rx={20}
        fill="#0E0F0C"
      />
      <Rect
        x={28}
        y={62}
        width={42}
        height={32}
        rx={6}
        fill="#5FE850"
        opacity={0.85}
      />
      <Path
        d="M28 154 L52 142 L76 158 L100 144"
        stroke="#FAFAF7"
        strokeOpacity={0.18}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M232 152 L246 130 L260 152 Z"
        fill="#FAFAF7"
        opacity={0.92}
      />
      <Path
        d="M254 138 L268 116 L282 138 Z"
        fill="#FAFAF7"
        opacity={0.92}
      />
    </Svg>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  heroBlock: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 20,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.2,
  },
  /* Card art wrapper — aspect ratio fijo del PVC standard (1.586:1).
   * Centrado horizontalmente con padding lateral cómodo. */
  cardWrap: {
    aspectRatio: 320 / 200,
    marginHorizontal: 24,
    marginTop: 8,
    borderCurve: "continuous",
    borderRadius: radius.xl,
    overflow: "hidden",
  },
  copyBlock: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  copy: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
});
