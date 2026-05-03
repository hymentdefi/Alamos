import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme, fontFamily, radius, spacing } from "../../lib/theme";
import { assets, assetCurrency, formatMoney } from "../../lib/data/assets";
import { AlamosIcon } from "../../lib/components/AlamosIcon";
import { useAuth } from "../../lib/auth/context";
import { useConfetti } from "../../lib/hooks/useConfetti";

/**
 * Genera un ID de comprobante mock — el formato `AC-YYYY-XXXXXX` es el
 * mismo que usamos en la papelería de marca (ver brand-kit/06-letterhead).
 * En prod va a ser el `orderId` que devuelva la API de Manteca.
 */
function buildReceiptId(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const yr = new Date().getFullYear();
  const num = (Math.abs(h) % 999999).toString().padStart(6, "0");
  return `AC-${yr}-${num}`;
}

export default function SuccessScreen() {
  const { ticker, amount, qty, mode } = useLocalSearchParams<{
    ticker: string;
    amount: string;
    qty: string;
    mode?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  const { user, markFirstTrade } = useAuth();
  const isSell = mode === "sell";
  const asset = assets.find((a) => a.ticker === ticker);
  const numAmount = Number(amount) || 0;
  const numQty = Number(qty) || 0;

  // Layout celebración: SOLO en la primera compra del usuario
  // (`user.hasFirstTrade === false`) y no aplica a ventas — celebrar
  // una venta no tiene la misma carga emocional.
  //
  // El valor lo snapshoteamos AL MONTAR la pantalla con useState
  // inicializador. Después llamamos markFirstTrade() (flippea
  // user.hasFirstTrade en el AuthContext), eso re-renderea esta
  // pantalla; sin el snapshot, isFirstTrade pasaría de true a
  // false instantáneamente y el layout celebración desaparecería.
  // El snapshot mantiene el layout "primera compra" durante toda
  // la vida de esta instancia de la pantalla.
  const [isFirstTrade] = useState(
    () => !!user && !user.hasFirstTrade && !isSell,
  );
  const firstName = user?.fullName?.split(" ")[0]?.trim() || "vos";
  const subheadlineBold =
    user?.gender === "female"
      ? "Ya sos inversora."
      : user?.gender === "male"
        ? "Ya sos inversor."
        : "Ya empezaste a invertir.";

  // El comprobante necesita un ID estable durante toda la sesión. Lo
  // derivamos de los params para que abrir/cerrar el receipt o
  // compartirlo más de una vez reutilice el mismo número.
  const receiptId = useMemo(
    () => buildReceiptId(`${ticker ?? ""}-${amount ?? ""}-${qty ?? ""}-${mode ?? ""}`),
    [ticker, amount, qty, mode],
  );

  // Animación del check verde:
  //   - Pop-in (siempre): scale 0 → 1.1 → 1.0 (300+200ms = 500ms).
  //   - Si NO es first trade: pulse infinito sutil 1.0 ↔ 1.03 cada
  //     2s, mantiene el ojo enganchado.
  //   - Si SÍ es first trade: el pulse no corre, porque la secuencia
  //     anticipation/peak del burst (ver onCheckLayout más abajo)
  //     toma el control del checkScale a t=+500ms con un pulse
  //     fuerte (1.15) seguido de un spring overshoot (1.3 → 1.0).
  //     Coreografiar las dos cosas a la vez se sentía caótico — el
  //     pulse infinito queda solo para el modo "compra subsiguiente"
  //     donde no hay celebración.
  const checkScale = useSharedValue(0);
  useEffect(() => {
    if (isFirstTrade) {
      checkScale.value = withSequence(
        withTiming(1.1, {
          duration: 300,
          easing: Easing.out(Easing.back(1.4)),
        }),
        withTiming(1.0, {
          duration: 200,
          easing: Easing.out(Easing.cubic),
        }),
      );
    } else {
      checkScale.value = withSequence(
        withTiming(1.1, {
          duration: 300,
          easing: Easing.out(Easing.back(1.4)),
        }),
        withTiming(1.0, {
          duration: 200,
          easing: Easing.out(Easing.cubic),
        }),
        withDelay(
          700,
          withRepeat(
            withSequence(
              withTiming(1.03, {
                duration: 1000,
                easing: Easing.inOut(Easing.sin),
              }),
              withTiming(1.0, {
                duration: 1000,
                easing: Easing.inOut(Easing.sin),
              }),
            ),
            -1,
            false,
          ),
        ),
      );
    }
  }, [checkScale, isFirstTrade]);
  const checkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  // Flash blanco overlay — pulso opacity 0 → 0.35 → 0 disparado
  // desde el `onPeak` del burst. Da el "fogonazo" gacha-style
  // sincrónico con el haptic Success y el spring overshoot del check.
  const flashOpacity = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));

  // El sonido de orden ejecutada NO se dispara acá — vive en
  // confirm.tsx en el mismo tick que setStatusText("Orden Ejecutada"),
  // para que el ding sincronice con el momento perceptible de la
  // ejecución (cambio de texto + cover verde + check). Disparar acá
  // sería ~1 frame tarde y se sentiría desconectado.

  // Burst del confetti: SOLO si es el primer trade del usuario.
  // Origen = centro del check verde (medido vía measureInWindow).
  //
  // Disparo a t=+500ms post-mount: deja que el pop-in del check
  // termine limpio antes de que la secuencia anticipation/peak
  // tome el control del mismo `checkScale`. Si lo disparábamos
  // antes (250ms, valor previo), las dos animaciones se pisaban.
  //
  // Callbacks:
  //   - onAnticipation (t=+500ms): pulse 1.0 → 1.15 → 1.0 en 100ms.
  //     Telegrafia "viene algo grande". cancelAnimation primero
  //     porque podría seguir corriendo el último frame del pop-in.
  //   - onPeak (t=+600ms): spring overshoot del check (1.0 → 1.3
  //     → 1.0) + flash blanco overlay (0 → 0.35 → 0 en 90ms).
  //     Sincrónico con el haptic Success y el burst de partículas.
  const { burst } = useConfetti();
  const checkRef = useRef<View>(null);
  const burstedRef = useRef(false);
  const onCheckLayout = (_e: LayoutChangeEvent) => {
    if (burstedRef.current) return;
    if (!isFirstTrade) return;
    burstedRef.current = true;
    checkRef.current?.measureInWindow((x, y, width, height) => {
      const cx = x + width / 2;
      const cy = y + height / 2;
      setTimeout(() => {
        burst({
          x: cx,
          y: cy,
          onAnticipation: () => {
            cancelAnimation(checkScale);
            checkScale.value = withSequence(
              withTiming(1.15, {
                duration: 50,
                easing: Easing.out(Easing.cubic),
              }),
              withTiming(1.0, {
                duration: 50,
                easing: Easing.out(Easing.cubic),
              }),
            );
          },
          onPeak: () => {
            cancelAnimation(checkScale);
            // Spring overshoot estilo gacha — friction baja /
            // damping bajo para que rebote visiblemente al pico.
            checkScale.value = withSequence(
              withSpring(1.3, {
                damping: 7,
                stiffness: 200,
                mass: 0.7,
              }),
              withSpring(1.0, {
                damping: 12,
                stiffness: 200,
                mass: 0.7,
              }),
            );
            // Flash blanco — corto y agresivo. 30ms ramp-up para
            // sincronizar con el haptic, 60ms decay para fadear
            // antes de que el ojo lo lea como "pantalla apagada".
            flashOpacity.value = withSequence(
              withTiming(0.35, {
                duration: 30,
                easing: Easing.out(Easing.cubic),
              }),
              withTiming(0, {
                duration: 60,
                easing: Easing.out(Easing.cubic),
              }),
            );
          },
        });
        // Marca el flag en AuthContext (in-memory en mock; POST en
        // prod). Idempotente — siguientes compras de la sesión ya
        // no disparan.
        markFirstTrade();
      }, 500);
    });
  };

  // Moneda nativa del activo (ARS para CEDEARs/bonos AR, USD para
  // acciones US, USDT para crypto). Default ARS por seguridad si el
  // ticker no matchea.
  const orderCurrency = asset ? assetCurrency(asset) : "ARS";

  const rows = [
    { label: "Activo", value: asset?.name ?? "—" },
    { label: "Monto", value: formatMoney(numAmount, orderCurrency) },
    {
      label: "Precio de ejecución",
      value: asset ? formatMoney(asset.price, orderCurrency) : "—",
    },
    {
      label: isSell ? "Unidades vendidas" : "Unidades compradas",
      value: `${numQty.toFixed(4)} ${ticker}`,
    },
  ];

  return (
    <View
      style={[
        s.root,
        { backgroundColor: c.bg, paddingTop: insets.top + 24 },
      ]}
    >
      <View style={s.heroBlock}>
        <Animated.View
          ref={checkRef}
          onLayout={onCheckLayout}
          style={[
            s.checkCircle,
            { backgroundColor: c.positive },
            checkAnimStyle,
          ]}
        >
          {/* Mismo path del check que dibuja la animación de
              confirm.tsx — para que la transición animación → success
              sea visualmente continua (mismo trazo, mismo grosor). */}
          <Svg width={44} height={44} viewBox="0 0 24 24">
            <Path
              d="M5 12 L10 17 L19 7"
              stroke="#FFFFFF"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
        {isFirstTrade ? (
          <>
            <Text style={[s.title, { color: c.text }]}>
              Felicitaciones, {firstName}.
            </Text>
            <Text
              style={[
                s.subtitle,
                { color: c.text, fontFamily: fontFamily[700] },
              ]}
            >
              Hiciste tu primera compra. {subheadlineBold}
            </Text>
            <Text style={[s.subtitleTech, { color: c.textMuted }]}>
              Tu orden de mercado por {formatMoney(numAmount, orderCurrency)} de{" "}
              <Text style={{ color: c.text, fontFamily: fontFamily[700] }}>
                {ticker}
              </Text>{" "}
              fue ejecutada correctamente.
            </Text>
          </>
        ) : (
          <>
            <Text style={[s.title, { color: c.text }]}>
              Orden ejecutada
            </Text>
            <Text style={[s.subtitle, { color: c.textMuted }]}>
              Tu orden de mercado por {formatMoney(numAmount, orderCurrency)} de{" "}
              <Text style={{ color: c.text, fontFamily: fontFamily[700] }}>
                {ticker}
              </Text>{" "}
              fue ejecutada correctamente.
            </Text>
          </>
        )}
      </View>

      <View
        style={[
          s.card,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        {rows.map((row, i) => (
          <View
            key={row.label}
            style={[
              s.row,
              i < rows.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: c.border,
              },
            ]}
          >
            <Text style={[s.rowLabel, { color: c.textMuted }]}>{row.label}</Text>
            <Text style={[s.rowValue, { color: c.text }]}>{row.value}</Text>
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      <View style={[s.bottom, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable
          style={[s.cta, { backgroundColor: c.ink }]}
          onPress={() => router.replace("/(app)")}
        >
          <Text style={[s.ctaText, { color: c.bg }]}>Volver al inicio</Text>
        </Pressable>

        {/* Compartir comprobante — link editorial sin chrome, alineado
            central. La acción está, sin gritar. */}
        <Pressable
          style={s.shareLink}
          onPress={() =>
            router.push({
              pathname: "/(app)/receipt",
              params: {
                ticker: ticker ?? "",
                amount: String(numAmount),
                qty: String(numQty),
                mode: isSell ? "sell" : "buy",
                receiptId,
              },
            })
          }
          hitSlop={8}
        >
          <Text style={[s.shareLinkText, { color: c.textMuted }]}>
            Compartir comprobante
          </Text>
          <AlamosIcon name="arrow" size={13} color={c.textMuted} />
        </Pressable>
      </View>

      {/* Flash blanco overlay — invisible 99% del tiempo, pulsa en el
          `onPeak` del burst para dar el "fogonazo" sincrónico con el
          haptic Success. pointerEvents=none así no come taps. Está
          DEBAJO del ConfettiPortal (que vive en el root layout) — el
          confetti se ve sobre el flash. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: "#FFFFFF" },
          flashStyle,
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  heroBlock: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 12,
    paddingBottom: 32,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -1.1,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.15,
    textAlign: "center",
  },
  /* Linea técnica adicional debajo del subheadline en el layout
     'primera compra' — tamaño un escalón abajo para que la jerarquía
     sea: headline > subheadline emocional > detalle técnico. */
  subtitleTech: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: -0.1,
    textAlign: "center",
    marginTop: 12,
  },
  card: {
    marginHorizontal: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 18,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  rowLabel: {
    fontFamily: fontFamily[500],
    fontSize: 14,
  },
  rowValue: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.15,
  },
  bottom: {
    paddingHorizontal: 20,
    gap: 16,
  },
  cta: {
    height: 52,
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontFamily: fontFamily[600],
    fontSize: 16,
    letterSpacing: -0.2,
  },
  shareLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
  },
  shareLinkText: {
    fontFamily: fontFamily[600],
    fontSize: 13,
    letterSpacing: -0.1,
  },
});
