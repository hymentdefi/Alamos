import { useRef, useState } from "react";
import {
  View, Text, ScrollView, Pressable, Modal, FlatList,
  Dimensions, StyleSheet, Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../lib/theme";
import { assets, formatARS } from "../../lib/data/assets";

const { width: SCREEN_W } = Dimensions.get("window");

/* ─── Expiration dates ─── */
const expirations = ["Ene 17", "Feb 21", "May 16", "Ago 15"];

/* ─── Mock option contracts ─── */
interface OptionContract {
  strike: number;
  premium: number;
  breakeven: number;
  toBreakeven: number;
  changeToday: number;
}

function generateContracts(price: number, isCall: boolean): OptionContract[] {
  const strikes = isCall
    ? [
        Math.round(price * 0.7),
        Math.round(price * 0.85),
        Math.round(price * 1.0),
        Math.round(price * 1.15),
        Math.round(price * 1.3),
        Math.round(price * 1.5),
        Math.round(price * 1.75),
        Math.round(price * 2.0),
      ]
    : [
        Math.round(price * 2.0),
        Math.round(price * 1.75),
        Math.round(price * 1.5),
        Math.round(price * 1.3),
        Math.round(price * 1.15),
        Math.round(price * 1.0),
        Math.round(price * 0.85),
        Math.round(price * 0.7),
      ];

  return strikes.map((strike) => {
    const diff = isCall ? strike - price : price - strike;
    const itm = diff < 0;
    const premium = itm
      ? Math.round(Math.abs(diff) + price * 0.03)
      : Math.max(Math.round(price * 0.01), 10);
    const breakeven = isCall ? strike + premium : strike - premium;
    const toBreakeven = ((breakeven - price) / price) * 100;
    const changeToday = Math.round((Math.random() - 0.5) * 40 * 100) / 100;

    return { strike, premium, breakeven, toBreakeven, changeToday };
  });
}

/* ─── Educational slides ─── */
interface EduSlide {
  title: string;
  body: string;
  highlight?: string;
}

const eduSlides: EduSlide[] = [
  {
    title: "Bienvenido a las opciones",
    body: "Las opciones son contratos que te dan el derecho de comprar o vender un activo a un precio determinado antes de una fecha de vencimiento.",
  },
  {
    title: "¿Cuántas acciones controla un contrato?",
    body: "En el mercado argentino, cada contrato de opciones generalmente representa 100 acciones del activo subyacente.",
    highlight: "100 acciones",
  },
  {
    title: "Si comprás una opción...",
    body: "Pagás una prima al vendedor por el derecho a ejercer el contrato. Tu riesgo máximo es la prima que pagaste.",
  },
  {
    title: "Si vendés una opción...",
    body: "Asumís una obligación y cobrás la prima como compensación. El riesgo puede ser mayor que la prima cobrada.",
  },
  {
    title: "Comprar un Call...",
    body: "Te da el derecho a comprar acciones a un precio fijo. Conviene cuando pensás que el precio va a subir.",
  },
  {
    title: "Comprar un Put...",
    body: "Te da el derecho a vender acciones a un precio fijo. Conviene cuando pensás que el precio va a bajar.",
  },
  {
    title: "¿Qué es el precio de ejercicio?",
    body: "El strike es el precio acordado para comprar o vender las acciones del activo subyacente al ejercer la opción.",
  },
  {
    title: "¡Eso es la cadena de opciones!",
    body: "Ahora podés explorar contratos, ver precios de ejercicio y primas. Recordá que todas las inversiones implican riesgo.",
  },
];

export default function OptionsScreen() {
  const { ticker } = useLocalSearchParams<{ ticker: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const asset = assets.find((a) => a.ticker === ticker) || assets[0];

  /* State */
  const [activeExp, setActiveExp] = useState(0);
  const [buyOrSell, setBuyOrSell] = useState<"buy" | "sell">("buy");
  const [callOrPut, setCallOrPut] = useState<"call" | "put">("call");
  const [showEdu, setShowEdu] = useState(true);
  const [eduIndex, setEduIndex] = useState(0);

  const eduFade = useRef(new Animated.Value(1)).current;
  const flatlistRef = useRef<FlatList>(null);

  const contracts = generateContracts(asset.price, callOrPut === "call");
  const sharePriceIdx = contracts.findIndex((c) =>
    callOrPut === "call" ? c.strike >= asset.price : c.strike <= asset.price
  );

  /* ─── Education helpers ─── */
  const animateEdu = (cb: () => void) => {
    Animated.timing(eduFade, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      cb();
      Animated.timing(eduFade, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const nextEdu = () => {
    if (eduIndex < eduSlides.length - 1) {
      animateEdu(() => setEduIndex((i) => i + 1));
    }
  };

  const finishEdu = () => {
    setShowEdu(false);
  };

  const isLastEdu = eduIndex === eduSlides.length - 1;
  const slide = eduSlides[eduIndex];

  /* ─── Type label ─── */
  const typeLabel = `${buyOrSell === "buy" ? "Comprar" : "Vender"} ${callOrPut === "call" ? "Call" : "Put"}`;

  return (
    <View style={s.container}>
      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTicker}>{asset.ticker}</Text>
          <Text style={s.headerType}>{typeLabel}</Text>
        </View>
        <Pressable>
          <Ionicons name="settings-outline" size={22} color={colors.text.primary} />
        </Pressable>
      </View>

      {/* ── Expiration tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.expScroll}
      >
        {expirations.map((exp, i) => (
          <Pressable
            key={exp}
            style={[s.expTab, activeExp === i && s.expTabActive]}
            onPress={() => setActiveExp(i)}
          >
            <Text style={[s.expTabText, activeExp === i && s.expTabTextActive]}>
              {exp}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Buy/Sell + Call/Put toggles ── */}
      <View style={s.toggleRow}>
        <View style={s.toggleGroup}>
          <Pressable
            style={[s.toggleBtn, buyOrSell === "buy" && s.toggleBtnActive]}
            onPress={() => setBuyOrSell("buy")}
          >
            <Text style={[s.toggleText, buyOrSell === "buy" && s.toggleTextActive]}>
              Comprar
            </Text>
          </Pressable>
          <Pressable
            style={[s.toggleBtn, buyOrSell === "sell" && s.toggleBtnActive]}
            onPress={() => setBuyOrSell("sell")}
          >
            <Text style={[s.toggleText, buyOrSell === "sell" && s.toggleTextActive]}>
              Vender
            </Text>
          </Pressable>
        </View>
        <View style={s.toggleGroup}>
          <Pressable
            style={[s.toggleBtn, callOrPut === "call" && s.toggleBtnActive]}
            onPress={() => setCallOrPut("call")}
          >
            <Text style={[s.toggleText, callOrPut === "call" && s.toggleTextActive]}>
              Call
            </Text>
          </Pressable>
          <Pressable
            style={[s.toggleBtn, callOrPut === "put" && s.toggleBtnActive]}
            onPress={() => setCallOrPut("put")}
          >
            <Text style={[s.toggleText, callOrPut === "put" && s.toggleTextActive]}>
              Put
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── Options chain list ── */}
      <ScrollView
        style={s.chainList}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {contracts.map((c, i) => {
          const showDivider = i === sharePriceIdx;
          const isUp = c.changeToday >= 0;
          const premiumColor = c.changeToday < 0 ? colors.red : colors.brand[500];

          return (
            <View key={c.strike}>
              {/* Share price divider */}
              {showDivider && (
                <View style={s.sharePriceDivider}>
                  <Text style={s.sharePriceText}>
                    Precio actual: {formatARS(asset.price)}
                  </Text>
                </View>
              )}

              <Pressable style={s.contractRow}>
                {/* Left: strike info */}
                <View style={s.contractLeft}>
                  <Text style={s.contractStrike}>
                    {formatARS(c.strike)} {callOrPut === "call" ? "Call" : "Put"}
                  </Text>
                  <View style={s.contractMeta}>
                    <View style={s.contractMetaItem}>
                      <Text style={s.contractMetaLabel}>Breakeven</Text>
                      <Text style={s.contractMetaValue}>{formatARS(c.breakeven)}</Text>
                    </View>
                    <View style={s.contractMetaItem}>
                      <Text style={s.contractMetaLabel}>Al breakeven</Text>
                      <Text style={s.contractMetaValue}>
                        {c.toBreakeven >= 0 ? "+" : ""}{c.toBreakeven.toFixed(2)}%
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Right: premium + add */}
                <View style={s.contractRight}>
                  <View style={[s.premiumBadge, { borderColor: premiumColor }]}>
                    <Text style={[s.premiumText, { color: premiumColor }]}>
                      {formatARS(c.premium)}
                    </Text>
                    <Pressable style={s.addBtn}>
                      <Ionicons name="add" size={16} color={premiumColor} />
                    </Pressable>
                  </View>
                  <Text style={[s.contractChange, { color: isUp ? colors.brand[500] : colors.red }]}>
                    {isUp ? "+" : ""}{c.changeToday.toFixed(2)}% Hoy
                  </Text>
                </View>
              </Pressable>
            </View>
          );
        })}

        {/* Disclosure */}
        <View style={s.disclosure}>
          <Text style={s.disclosureTitle}>Aviso sobre opciones</Text>
          <Text style={s.disclosureText}>
            La cadena de opciones se muestra con fines informativos y no constituye una recomendación de inversión. Las opciones involucran riesgo significativo y no son apropiadas para todos los inversores. Consultá con tu asesor financiero antes de operar.
          </Text>
        </View>
      </ScrollView>

      {/* ── Educational walkthrough modal ── */}
      <Modal
        visible={showEdu}
        transparent
        animationType="slide"
        onRequestClose={finishEdu}
      >
        <View style={s.eduOverlay}>
          {/* Dimmed chain preview behind */}
          <View style={[s.eduDimmed, { paddingTop: insets.top }]} />

          {/* Bottom sheet */}
          <View style={[s.eduSheet, { paddingBottom: insets.bottom + 16 }]}>
            {isLastEdu ? (
              /* Final slide */
              <>
                <View style={s.eduIconWrap}>
                  <Ionicons name="eye" size={36} color={colors.text.primary} />
                </View>
                <Text style={s.eduTitle}>{slide.title}</Text>
                <Text style={s.eduBody}>{slide.body}</Text>
                <Pressable>
                  <Text style={s.eduLink}>Aprender más sobre opciones</Text>
                </Pressable>
                <Pressable style={s.eduBtnPrimary} onPress={finishEdu}>
                  <Text style={s.eduBtnPrimaryText}>Continuar</Text>
                </Pressable>
                <Pressable
                  style={s.eduBtnSecondary}
                  onPress={() => animateEdu(() => setEduIndex(0))}
                >
                  <Text style={s.eduBtnSecondaryText}>Repasar de nuevo</Text>
                </Pressable>
              </>
            ) : eduIndex === 0 ? (
              /* Welcome slide */
              <>
                <View style={s.eduIconWrap}>
                  <Ionicons name="book" size={36} color={colors.text.primary} />
                </View>
                <Animated.View style={{ opacity: eduFade, alignItems: "center" }}>
                  <Text style={s.eduTitle}>{slide.title}</Text>
                  <Text style={s.eduBody}>{slide.body}</Text>
                </Animated.View>
                <Pressable style={s.eduBtnPrimary} onPress={nextEdu}>
                  <Text style={s.eduBtnPrimaryText}>Repasar conceptos</Text>
                </Pressable>
                <Pressable style={s.eduBtnSecondary} onPress={finishEdu}>
                  <Text style={s.eduBtnSecondaryText}>Ya sé cómo funciona</Text>
                </Pressable>
              </>
            ) : (
              /* Middle slides */
              <>
                <Pressable style={s.eduCloseBtn} onPress={finishEdu}>
                  <Ionicons name="close" size={22} color={colors.text.primary} />
                </Pressable>

                <Animated.View style={{ opacity: eduFade, alignItems: "center", flex: 1, justifyContent: "center" }}>
                  <Text style={s.eduSlideTitle}>{slide.title}</Text>
                  <Text style={s.eduSlideBody}>{slide.body}</Text>
                  {slide.highlight && (
                    <View style={s.eduHighlight}>
                      <Text style={s.eduHighlightText}>{slide.highlight}</Text>
                    </View>
                  )}
                </Animated.View>

                {/* Progress dots */}
                <View style={s.eduDots}>
                  {eduSlides.map((_, i) => (
                    <View
                      key={i}
                      style={[s.eduDot, i <= eduIndex && s.eduDotActive]}
                    />
                  ))}
                </View>

                {/* Next button */}
                <Pressable style={s.eduNextBtn} onPress={nextEdu}>
                  <Ionicons name="arrow-down" size={22} color={colors.text.primary} />
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerCenter: {
    alignItems: "center",
  },
  headerTicker: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text.primary,
  },
  headerType: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: "500",
  },

  /* Expiration tabs */
  expScroll: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 10,
  },
  expTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  expTabActive: {
    borderColor: colors.text.primary,
  },
  expTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.muted,
  },
  expTabTextActive: {
    color: colors.text.primary,
  },

  /* Toggle row */
  toggleRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 12,
  },
  toggleGroup: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.surface[100],
    borderRadius: 10,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  toggleBtnActive: {
    backgroundColor: colors.surface[200],
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.muted,
  },
  toggleTextActive: {
    color: colors.text.primary,
    fontWeight: "700",
  },

  /* Chain list */
  chainList: {
    flex: 1,
  },

  /* Share price divider */
  sharePriceDivider: {
    backgroundColor: colors.brand[500],
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  sharePriceText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
  },

  /* Contract row */
  contractRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contractLeft: {
    flex: 1,
  },
  contractStrike: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 6,
  },
  contractMeta: {
    flexDirection: "row",
    gap: 20,
  },
  contractMetaItem: {},
  contractMetaLabel: {
    fontSize: 11,
    color: colors.text.muted,
    marginBottom: 2,
  },
  contractMetaValue: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.secondary,
  },

  /* Right side */
  contractRight: {
    alignItems: "flex-end",
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingLeft: 10,
    gap: 6,
    marginBottom: 4,
  },
  premiumText: {
    fontSize: 14,
    fontWeight: "700",
    paddingVertical: 6,
  },
  addBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  contractChange: {
    fontSize: 11,
    fontWeight: "600",
  },

  /* Disclosure */
  disclosure: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  disclosureTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.secondary,
    marginBottom: 8,
  },
  disclosureText: {
    fontSize: 12,
    color: colors.text.muted,
    lineHeight: 18,
  },

  /* ── Educational modal ── */
  eduOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  eduDimmed: {
    flex: 1,
  },
  eduSheet: {
    backgroundColor: colors.surface[0],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 28,
    paddingTop: 28,
    alignItems: "center",
    minHeight: 380,
  },
  eduIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  eduTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  eduBody: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  eduLink: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.primary,
    textDecorationLine: "underline",
    marginBottom: 24,
  },
  eduBtnPrimary: {
    width: "100%",
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.text.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  eduBtnPrimaryText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },
  eduBtnSecondary: {
    width: "100%",
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
  },
  eduBtnSecondaryText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
  },

  /* Middle edu slides */
  eduCloseBtn: {
    position: "absolute",
    top: 16,
    left: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  eduSlideTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  eduSlideBody: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  eduHighlight: {
    backgroundColor: colors.accentDim,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 8,
  },
  eduHighlightText: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.brand[500],
  },
  eduDots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 20,
  },
  eduDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surface[200],
  },
  eduDotActive: {
    backgroundColor: colors.text.primary,
  },
  eduNextBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
});
