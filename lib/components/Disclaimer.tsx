import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { fontFamily, radius, useTheme } from "../theme";
import {
  DISCLAIMER_LONG,
  DISCLAIMER_SHORT,
  ALYC,
} from "../legal/disclaimers";

/* ─── Texto corto inline (para detalle, card en activo, etc.) ─── */

export function DisclaimerShort({ muted = true }: { muted?: boolean }) {
  const { c } = useTheme();
  return (
    <Text
      style={[
        styles.short,
        { color: muted ? c.textMuted : c.textSecondary },
      ]}
    >
      {DISCLAIMER_SHORT}
    </Text>
  );
}

/* ─── Footer persistente con ⓘ ─── */

export function DisclaimerFooter({
  onOpen,
  dark = false,
}: {
  onOpen: () => void;
  /** true si el feed está sobre imágenes oscuras (footer translúcido oscuro). */
  dark?: boolean;
}) {
  const { c } = useTheme();
  const bg = dark ? "rgba(14,15,12,0.75)" : c.surface;
  const border = dark ? "transparent" : c.border;
  const text = dark ? "rgba(255,255,255,0.85)" : c.textMuted;
  const icon = dark ? "rgba(255,255,255,0.72)" : c.textMuted;

  return (
    <Pressable
      onPress={onOpen}
      style={[styles.footer, { backgroundColor: bg, borderTopColor: border }]}
    >
      <Text style={[styles.footerText, { color: text }]} numberOfLines={2}>
        {DISCLAIMER_SHORT}
      </Text>
      <Feather name="info" size={14} color={icon} />
    </Pressable>
  );
}

/* ─── Modal completo accesible desde el ⓘ ─── */

export function DisclaimerModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View
          style={[
            styles.modalBody,
            { backgroundColor: c.bg, paddingBottom: insets.bottom + 20 },
          ]}
        >
          <View style={styles.modalHandle} />
          <View style={styles.modalHead}>
            <Text style={[styles.modalTitle, { color: c.text }]}>
              Información legal
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={[styles.closeBtn, { backgroundColor: c.surfaceHover }]}
            >
              <Feather name="x" size={18} color={c.text} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {DISCLAIMER_LONG.map((p, i) => (
              <Text key={i} style={[styles.bodyP, { color: c.textSecondary }]}>
                {p}
              </Text>
            ))}
            <Text style={[styles.footerMeta, { color: c.textMuted }]}>
              {ALYC.name} · Matrícula CNV {ALYC.matricula}
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ─── Onboarding: bottom sheet obligatorio la primera vez ─── */

export function DisclaimerOnboarding({
  visible,
  onAccept,
}: {
  visible: boolean;
  onAccept: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAccept = async () => {
    if (!checked || submitting) return;
    setSubmitting(true);
    try {
      await onAccept();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // No permitimos cerrar sin aceptar — no hay back button ni swipe down.
      onRequestClose={() => {}}
      statusBarTranslucent
    >
      <View style={styles.modalRoot}>
        <View style={styles.modalBackdropSolid} />
        <View
          style={[
            styles.modalBody,
            { backgroundColor: c.bg, paddingBottom: insets.bottom + 20 },
          ]}
        >
          <View style={styles.modalHandle} />
          <Text style={[styles.onboardEyebrow, { color: c.textMuted }]}>
            ANTES DE CONTINUAR
          </Text>
          <Text style={[styles.modalTitle, { color: c.text, marginBottom: 14 }]}>
            Sobre el contenido informativo
          </Text>

          <ScrollView
            style={styles.onboardScroll}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {DISCLAIMER_LONG.map((p, i) => (
              <Text key={i} style={[styles.bodyP, { color: c.textSecondary }]}>
                {p}
              </Text>
            ))}
          </ScrollView>

          <Pressable
            onPress={() => setChecked((v) => !v)}
            style={[
              styles.checkRow,
              { backgroundColor: c.surfaceHover, borderColor: c.border },
            ]}
          >
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: checked ? c.ink : "transparent",
                  borderColor: checked ? c.ink : c.borderStrong,
                },
              ]}
            >
              {checked ? (
                <Feather name="check" size={14} color={c.bg} />
              ) : null}
            </View>
            <Text style={[styles.checkLabel, { color: c.text }]}>
              Entendí y acepto
            </Text>
          </Pressable>

          <Pressable
            onPress={handleAccept}
            disabled={!checked || submitting}
            style={[
              styles.cta,
              {
                backgroundColor: checked ? c.ink : c.surfaceHover,
                opacity: submitting ? 0.6 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.ctaText,
                { color: checked ? c.bg : c.textMuted },
              ]}
            >
              Continuar
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  /* ── Short inline ── */
  short: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.05,
  },

  /* ── Footer ── */
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: {
    flex: 1,
    fontFamily: fontFamily[500],
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: -0.05,
  },

  /* ── Modal compartido ── */
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  modalBackdropSolid: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.82)",
  },
  modalBody: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "88%",
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  modalHandle: {
    width: 44,
    height: 5,
    backgroundColor: "rgba(128,128,128,0.35)",
    borderRadius: 3,
    alignSelf: "center",
    marginTop: 10,
  },
  modalHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 10,
  },
  modalTitle: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.6,
    flex: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    paddingBottom: 20,
  },
  bodyP: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: -0.1,
    marginBottom: 14,
  },
  footerMeta: {
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: 0.2,
    textAlign: "center",
    marginTop: 10,
  },

  /* ── Onboarding ── */
  onboardEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    marginTop: 20,
  },
  onboardScroll: {
    maxHeight: 320,
    marginTop: 4,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 10,
    marginBottom: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkLabel: {
    fontFamily: fontFamily[600],
    fontSize: 15,
    letterSpacing: -0.15,
  },
  cta: {
    height: 52,
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
