import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { fontFamily, fontMono, radius, useTheme } from "../theme";
import { MarketClosedIllustration } from "./illustrations/MarketClosedIllustration";
import type { MarketSession } from "../market/hours";

interface Props {
  visible: boolean;
  /** Tipo de instrumento — define el copy ("Acciones AR", "CEDEARs",
   *  "Bonos", etc.). */
  instrumentLabel: string;
  /** Sesión de mercado del activo — horario + días. */
  session: MarketSession;
  onClose: () => void;
}

/**
 * Bottom sheet que se muestra cuando el usuario intenta operar un
 * instrumento fuera del horario de mercado. Mismo patrón que el
 * "Mercado cerrado" de IOL pero con identidad Alamos: ilustración
 * propia (no stock art), tipografía editorial, mono para el horario.
 */
export function MarketClosedSheet({
  visible,
  instrumentLabel,
  session,
  onClose,
}: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} onPress={onClose} />
      <View
        style={[
          s.sheet,
          {
            backgroundColor: c.bg,
            borderColor: c.border,
            paddingBottom: insets.bottom + 18,
          },
        ]}
      >
        {/* Grabber */}
        <View style={s.grabber}>
          <View style={[s.grabberPill, { backgroundColor: c.borderStrong }]} />
        </View>

        {/* Close (X) arriba a la izquierda — patrón Alamos para
            sheets, mismo lugar que el StoryOverlay/ConvertSheet. */}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={[s.closeBtn, { backgroundColor: c.surfaceHover }]}
        >
          <Feather name="x" size={16} color={c.text} />
        </Pressable>

        <View style={s.content}>
          {/* Ilustración propia — triángulos apagados + candado verde. */}
          <View style={s.illustrationWrap}>
            <MarketClosedIllustration size={188} />
          </View>

          <Text style={[s.title, { color: c.text }]}>Mercado cerrado</Text>
          <Text style={[s.subtitle, { color: c.textMuted }]}>
            {instrumentLabel} se opera{" "}
            <Text style={[s.subtitleBold, { color: c.text }]}>
              {session.days}
            </Text>
            , de{" "}
            <Text style={[s.subtitleMono, { color: c.text }]}>
              {session.hours}
            </Text>
            .
          </Text>
        </View>

        <Pressable
          onPress={onClose}
          style={[s.cta, { backgroundColor: c.text }]}
        >
          <Text style={[s.ctaText, { color: c.bg }]}>Entendido</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  grabber: {
    alignItems: "center",
    paddingVertical: 8,
  },
  grabberPill: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 28,
    paddingHorizontal: 12,
  },
  illustrationWrap: {
    marginBottom: 16,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 26,
    letterSpacing: -1,
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.15,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  subtitleBold: {
    fontFamily: fontFamily[700],
  },
  subtitleMono: {
    fontFamily: fontMono[700],
    letterSpacing: 0,
  },
  cta: {
    height: 52,
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },
  ctaText: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
});
