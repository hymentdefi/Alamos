import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { fontFamily, radius, useTheme } from "../theme";
import { AmountDisplay } from "./AmountDisplay";
import { CobrosInfoSheet } from "./CobrosInfoSheet";
import { Tap } from "./Tap";
import {
  MOCK_TODAY,
  daysUntil,
  formatRelativeDate,
  formatShortDate,
  generatePayouts,
  isPaid,
  monthlyBuckets,
  monthNameFull,
  payoutTypeLabel,
  summarizeYear,
  type MonthBucket,
} from "../data/payouts";
import { formatMoney, type AssetCurrency } from "../data/assets";
import { convertAmount } from "../data/accounts";

interface Props {
  /** Moneda en la que se muestran los totales. Las filas individuales
   *  mantienen su moneda nativa (USD para bonos, ARS para acciones AR). */
  currency: "ARS" | "USD";
  /** Callback que se dispara cuando el usuario selecciona un mes
   *  (no cuando deselecciona). El parent suele usarlo para hacer
   *  auto-scroll y dejar el header de Cobros arriba de todo. */
  onMonthSelect?: () => void;
}

/* Bar — barra del bar chart con animación de lift cuando se activa.
 * Extraída a su propio componente para llamar useAnimatedStyle sin
 * violar rules of hooks dentro del .map() del chart. La animación
 * de translateY -6pt + opacity 1 le da el look "elevado" Robinhood-
 * style a la barra seleccionada. */
function Bar({
  height,
  color,
  label,
  labelColor,
  labelWeight,
  isActive,
  isFaded,
  onPress,
}: {
  height: number;
  color: string;
  label: string;
  labelColor: string;
  labelWeight: string;
  isActive: boolean;
  isFaded: boolean;
  onPress: () => void;
}) {
  const lift = useSharedValue(0);

  useEffect(() => {
    lift.value = withTiming(isActive ? -6 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [isActive, lift]);

  const barAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }],
  }));

  return (
    <Tap
      onPress={onPress}
      haptic="selection"
      pressScale={0.94}
      style={s.barCol}
      hitSlop={4}
    >
      <Animated.View
        style={[
          s.bar,
          {
            height,
            backgroundColor: color,
            opacity: isFaded ? 0.4 : 1,
          },
          barAnim,
        ]}
      />
      <Text
        style={[
          s.barLabel,
          { color: labelColor, fontFamily: labelWeight },
        ]}
      >
        {label}
      </Text>
    </Tap>
  );
}

/**
 * Cobros — sub-sección de Rendimiento dedicada a dividendos, cupones
 * y amortizaciones del portfolio. La diferencia con cualquier ALyC
 * argentino es el calendario forward: no muestra solo lo que ya
 * cobraste, sino lo que viene.
 *
 * Tres cards en orden de jerarquía:
 *   1. Hero — "Te queda por cobrar" en brand grande + sublabel con
 *      lo cobrado este año + bar chart de 12 meses (paid en brand,
 *      upcoming en border).
 *   2. Próximo cobro — destaca el siguiente evento con countdown.
 *   3. Cronograma — los próximos 5 eventos + "Ver el año completo"
 *      → navega al calendario anual estilo Apple Calendar (/cobros).
 *
 * Los totales agregan a ARS via `convertAmount`. Las filas individuales
 * muestran la moneda nativa porque un cupón de AL30 en USD se lee con
 * más fidelidad que el equivalente en pesos.
 */
export function CobrosSection({ currency, onMonthSelect }: Props) {
  const { c } = useTheme();
  const router = useRouter();
  const [scrubIdx, setScrubIdx] = useState<number | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const events = useMemo(() => generatePayouts(), []);

  const toArs = useMemo(
    () => (n: number, cur: AssetCurrency) => convertAmount(n, cur, "ARS"),
    [],
  );
  const toDisplay = (ars: number) =>
    currency === "ARS" ? ars : convertAmount(ars, "ARS", currency);

  const currentYear = MOCK_TODAY.getFullYear();

  /* Cobrado YTD = solo los eventos ya pagados del año en curso. */
  const ytdPaid = useMemo(
    () => summarizeYear(events.filter((e) => isPaid(e)), currentYear, toArs),
    [events, currentYear, toArs],
  );
  /* Año completo proyectado = todos los eventos del año (paid + upcoming).
   * Sirve para "lo que falta cobrar" y para los breakdowns. */
  const fullYear = useMemo(
    () => summarizeYear(events, currentYear, toArs),
    [events, currentYear, toArs],
  );

  const buckets = useMemo(
    () => monthlyBuckets(events, toArs),
    [events, toArs],
  );
  const maxBucket = useMemo(
    () => Math.max(1, ...buckets.map((b) => b.totalArs)),
    [buckets],
  );

  const upcomingList = useMemo(
    () => events.filter((e) => !isPaid(e)).slice(0, 6),
    [events],
  );
  const nextEvent = upcomingList[0];

  /* Eventos del mes seleccionado (cuando hay scrub). Se usa para
   * mostrar el detalle del mes que reemplaza a los cards normales. */
  const scrubKey = scrubIdx != null ? buckets[scrubIdx]?.key : null;
  const selectedMonthEvents = useMemo(() => {
    if (!scrubKey) return [];
    return events.filter((e) => e.date.startsWith(scrubKey));
  }, [scrubKey, events]);

  /* Si no hay eventos, no renderizamos nada — para holdings sin renta
   * (solo crypto, solo FCI, etc.) la sección no aporta. */
  if (events.length === 0) return null;

  const ytdDisplay = toDisplay(ytdPaid.totalArs);
  const remainingDisplay = toDisplay(fullYear.totalArs - ytdPaid.totalArs);

  /* Bar chart — el bucket "scrubbeado" muestra su label/valor en el
   * header. Si no hay scrub, mostramos el monto por cobrar (el número
   * más interesante, generalmente el más grande). */
  const scrubBucket = scrubIdx != null ? buckets[scrubIdx] : null;
  const monthFullLabel = (b: MonthBucket) =>
    monthNameFull(b.month) +
    (b.year !== currentYear ? ` ${b.year}` : "");

  return (
    <>
      {/* ─── Section header — título "Cobros" en brand (estilo
          BriefingCard del stock detail pero sin arrow, más grande)
          + info dot al lado también en brand. Tap del título navega
          a /cobros, tap del info dot abre el sheet de explicación. */}
      <View style={s.sectionHeader}>
        <Tap
          onPress={() => router.push("/cobros")}
          haptic="selection"
          pressScale={0.97}
          hitSlop={8}
        >
          <Text style={[s.sectionTitle, { color: c.brand }]}>
            Flujos del año
          </Text>
        </Tap>
        <Tap
          onPress={() => setInfoOpen(true)}
          haptic="selection"
          hitSlop={12}
          style={s.sectionInfoDot}
          accessibilityLabel="Qué son los flujos del año"
        >
          <Feather name="info" size={15} color={c.brand} />
        </Tap>
      </View>

      {/* ─── Card 1: Hero + bar chart ─────────────────────────────── */}
      <View style={[s.card, s.firstCard]}>
        {scrubBucket ? (
          <>
            <Text style={[s.heroLabel, { color: c.textMuted }]}>
              {monthFullLabel(scrubBucket)}
              {scrubBucket.paid ? "" : " proyectado"}
            </Text>
            <AmountDisplay
              value={toDisplay(scrubBucket.totalArs)}
              size={32}
              color={scrubBucket.paid ? c.brand : c.text}
              decimalsColor={c.textMuted}
              currency={currency}
            />
          </>
        ) : remainingDisplay > 0 ? (
          <>
            <Text style={[s.heroLabel, { color: c.textMuted }]}>
              Te queda por cobrar
            </Text>
            <AmountDisplay
              value={remainingDisplay}
              size={32}
              color={c.brand}
              decimalsColor={c.brand}
              currency={currency}
            />
          </>
        ) : (
          // Fallback fin de año: si ya no queda nada por cobrar, mostramos
          // como hero el total cobrado para no dejar un "$0" gigante.
          <>
            <Text style={[s.heroLabel, { color: c.textMuted }]}>
              Cobraste este año
            </Text>
            <AmountDisplay
              value={ytdDisplay}
              size={32}
              color={c.brand}
              decimalsColor={c.brand}
              currency={currency}
            />
          </>
        )}

        <View style={s.barChart}>
          {buckets.map((b, i) => {
            const h = b.totalArs > 0
              ? Math.max(4, (b.totalArs / maxBucket) * BAR_MAX_H)
              : 2;
            const active = scrubIdx === i;
            /* Barra activa siempre en brand (incluso si es mes
             * futuro), para que se destaque sobre el resto. */
            const baseColor = active ? c.brand : b.paid ? c.brand : c.border;
            const labelColor = active
              ? c.brand
              : b.isCurrent
                ? c.text
                : c.textMuted;
            const labelWeight =
              active || b.isCurrent
                ? fontFamily[700]
                : fontFamily[500];
            return (
              <Bar
                key={b.key}
                height={h}
                color={baseColor}
                label={b.label}
                labelColor={labelColor}
                labelWeight={labelWeight}
                isActive={active}
                isFaded={scrubIdx != null && !active}
                onPress={() => {
                  if (active) {
                    setScrubIdx(null);
                  } else {
                    setScrubIdx(i);
                    onMonthSelect?.();
                  }
                }}
              />
            );
          })}
        </View>

        {/* Footer del card 1 — "Cobraste $X este año" debajo de las
            barras. Solo cuando NO hay scrub activo (durante scrub el
            hero ya muestra el monto del mes) y hay algo cobrado. */}
        {scrubBucket == null && ytdDisplay > 0 ? (
          <Text style={[s.heroFooter, { color: c.textMuted }]}>
            Cobraste{" "}
            <Text style={{ color: c.text, fontFamily: fontFamily[700] }}>
              {formatMoney(ytdDisplay, currency)}
            </Text>{" "}
            este año
          </Text>
        ) : null}
      </View>

      {scrubIdx == null ? (
        <>
          {/* ─── Card 2: Próximo cobro ─────────────────────────────── */}
          {nextEvent ? (
            <View style={s.card}>
              <Text style={[s.eyebrow, { color: c.text }]}>
                Próximo cobro
              </Text>
              <View style={s.nextRow}>
                <View style={s.nextLeft}>
                  <Text style={[s.nextTicker, { color: c.text }]}>
                    {nextEvent.ticker}
                  </Text>
                  <Text
                    style={[s.nextSub, { color: c.textMuted }]}
                    numberOfLines={1}
                  >
                    {nextEvent.assetName} ·{" "}
                    {payoutTypeLabel(nextEvent.type)}
                  </Text>
                </View>
                <View style={s.nextRight}>
                  <Text style={[s.nextAmount, { color: c.text }]}>
                    {formatMoney(nextEvent.amount, nextEvent.currency)}
                  </Text>
                  <Text style={[s.nextWhen, { color: c.brand }]}>
                    {formatRelativeDate(nextEvent.date)}
                    {daysUntil(nextEvent.date) > 1
                      ? ` · ${formatShortDate(nextEvent.date)}`
                      : ""}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* ─── Card 3: Cronograma — próximos eventos + ver más ─── */}
          {upcomingList.length > 1 ? (
            <View style={s.card}>
              <Text style={[s.eyebrow, { color: c.text }]}>
                Cronograma
              </Text>
              {upcomingList.slice(1, 6).map((e, i, arr) => (
                <View
                  key={e.id}
                  style={[
                    s.cronoRow,
                    i < arr.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: c.border,
                    },
                  ]}
                >
                  <View style={s.cronoDate}>
                    <Text style={[s.cronoDateText, { color: c.text }]}>
                      {formatShortDate(e.date)}
                    </Text>
                    <Text
                      style={[s.cronoDateRel, { color: c.textMuted }]}
                    >
                      {formatRelativeDate(e.date)}
                    </Text>
                  </View>
                  <View style={s.cronoMid}>
                    <Text
                      style={[s.cronoTicker, { color: c.text }]}
                      numberOfLines={1}
                    >
                      {e.ticker}
                    </Text>
                    <Text
                      style={[s.cronoType, { color: c.textMuted }]}
                      numberOfLines={1}
                    >
                      {payoutTypeLabel(e.type)}
                    </Text>
                  </View>
                  <Text
                    style={[s.cronoAmount, { color: c.text }]}
                    numberOfLines={1}
                  >
                    {formatMoney(e.amount, e.currency)}
                  </Text>
                </View>
              ))}
              <Tap
                onPress={() => router.push("/cobros")}
                haptic="selection"
                pressScale={0.97}
                style={[s.seeMore, { borderTopColor: c.border }]}
              >
                <Text style={[s.seeMoreText, { color: c.brand }]}>
                  Ver el año completo
                </Text>
                <Feather
                  name="chevron-right"
                  size={16}
                  color={c.brand}
                />
              </Tap>
            </View>
          ) : null}

          {/* ─── Card 4: Por tipo — desglose de los flujos cobrados
              YTD en cupones / dividendos / amortizaciones. Dot
              colorado a la izquierda de cada label, totales del
              año a la derecha. */}
          {ytdPaid.totalArs > 0 ? (
            <View style={s.card}>
              <Text style={[s.eyebrow, { color: c.text }]}>
                Detalle
              </Text>
              {(["cupon", "dividendo", "amortizacion"] as const)
                .filter((t) => ytdPaid.byType[t] > 0)
                .map((t, i, arr) => (
                  <View
                    key={t}
                    style={[
                      s.tipoRow,
                      i < arr.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: c.border,
                      },
                    ]}
                  >
                    <View style={s.tipoLeft}>
                      <View
                        style={[
                          s.tipoDot,
                          { backgroundColor: TYPE_COLORS[t] },
                        ]}
                      />
                      <Text
                        style={[s.tipoLabel, { color: c.text }]}
                      >
                        {payoutTypeLabel(t, true)}
                      </Text>
                    </View>
                    <Text
                      style={[s.tipoAmount, { color: c.text }]}
                      numberOfLines={1}
                    >
                      {formatMoney(
                        toDisplay(ytdPaid.byType[t]),
                        currency,
                      )}
                    </Text>
                  </View>
                ))}
            </View>
          ) : null}
        </>
      ) : (
        /* ─── Mes seleccionado: detalle de los eventos que arman el
            total de ese mes. Replaza a los 3 cards inferiores
            mientras hay scrub activo. Tap a la misma barra (o a
            otra) cambia o limpia el detalle. */
        <View style={s.card}>
          <Text style={[s.eyebrow, { color: c.text }]}>
            Cobros de{" "}
            {scrubBucket
              ? monthNameFull(scrubBucket.month).toLowerCase()
              : ""}
          </Text>
          {selectedMonthEvents.length > 0 ? (
            selectedMonthEvents.map((e, i, arr) => (
              <View
                key={e.id}
                style={[
                  s.cronoRow,
                  i < arr.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: c.border,
                  },
                ]}
              >
                <View style={s.cronoDate}>
                  <Text style={[s.cronoDateText, { color: c.text }]}>
                    {formatShortDate(e.date)}
                  </Text>
                  <Text
                    style={[s.cronoDateRel, { color: c.textMuted }]}
                  >
                    {formatRelativeDate(e.date)}
                  </Text>
                </View>
                <View style={s.cronoMid}>
                  <Text
                    style={[s.cronoTicker, { color: c.text }]}
                    numberOfLines={1}
                  >
                    {e.ticker}
                  </Text>
                  <Text
                    style={[s.cronoType, { color: c.textMuted }]}
                    numberOfLines={1}
                  >
                    {payoutTypeLabel(e.type)}
                  </Text>
                </View>
                <Text
                  style={[s.cronoAmount, { color: c.text }]}
                  numberOfLines={1}
                >
                  {formatMoney(e.amount, e.currency)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[s.emptyText, { color: c.textMuted }]}>
              No hay cobros este mes.
            </Text>
          )}
        </View>
      )}

      <CobrosInfoSheet
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
    </>
  );
}

const BAR_MAX_H = 84;

/* Tres shades de brand para los dots del breakdown "Por tipo": el
 * vivido para cupones (típicamente el contributor más grande), mint
 * para dividendos, deep para amortizaciones. Hex fijos porque es
 * paleta de chart, mismo criterio que el resto del proyecto. */
const TYPE_COLORS: Record<"cupon" | "dividendo" | "amortizacion", string> = {
  cupon: "#00C805",
  dividendo: "#5AC53A",
  amortizacion: "#00B864",
};

const s = StyleSheet.create({
  /* Section header — "Cobros" 48pt display + info dot. Vive fuera de
   * los cards porque es el header de toda la sección. Padding lateral
   * 24pt para alinear con el rail estándar. marginTop 32 para separar
   * del card anterior ("De dónde viene"). */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 24,
    marginTop: 32,
  },
  /* Title style — heaviest weight + brand color, más grande que el
   * briefing del stock detail porque acá funciona como section
   * header de una sub-sección entera (no como label de un card). */
  sectionTitle: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.5,
  },
  sectionInfoDot: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },

  /* Card container — mismo lenguaje que rendimiento.tsx (s.card)
   * pero con paddings/margen más chicos para que los 4 cards de la
   * sección Cobros respiren como un bloque continuo en lugar de
   * cards islotes. paddingVertical 18 (vs 24) + marginTop 4 (vs 16)
   * reducen el gap visible entre cards de ~58pt → ~40pt. */
  card: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    marginTop: 4,
  },
  /* Override del primer card: pegado al section header (sin gap
   * externo extra), así el título "Cobros" se siente como heading
   * del card. El paddingTop:24 interno provee la respiración. */
  firstCard: {
    marginTop: 0,
  },
  eyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 20,
    letterSpacing: -0.4,
    marginBottom: 14,
  },

  /* ─── Hero ─── */
  heroLabel: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  /* Footer del card 1: "Cobraste $X este año" debajo del bar chart,
   * en el lugar donde antes vivía el legend. Misma tipografía que
   * el legendText anterior (12pt 500 muted) para mantener ese
   * weight visual ya familiarizado. */
  heroFooter: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.05,
    marginTop: 14,
  },

  /* ─── Bar chart ─── */
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    marginTop: 10,
    height: BAR_MAX_H + 20,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderCurve: "continuous",
    borderRadius: radius.sm,
  },
  barLabel: {
    marginTop: 8,
    fontSize: 10,
    letterSpacing: -0.05,
  },

  /* ─── Próximo cobro ─── */
  nextRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
  },
  nextLeft: {
    flex: 1,
    minWidth: 0,
  },
  nextTicker: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  nextSub: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  nextRight: {
    alignItems: "flex-end",
  },
  nextAmount: {
    fontFamily: fontFamily[700],
    fontSize: 17,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  nextWhen: {
    fontFamily: fontFamily[700],
    fontSize: 12,
    letterSpacing: -0.1,
  },

  /* ─── Cronograma ─── */
  cronoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  cronoDate: {
    width: 72,
  },
  cronoDateText: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  cronoDateRel: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: -0.05,
    marginTop: 1,
  },
  cronoMid: {
    flex: 1,
    minWidth: 0,
  },
  cronoTicker: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  cronoType: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
    marginTop: 1,
  },
  cronoAmount: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },

  /* ─── Por tipo (cupones / dividendos / amortizaciones) ─── */
  tipoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    gap: 12,
  },
  tipoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  tipoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tipoLabel: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.1,
  },
  tipoAmount: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },

  emptyText: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 22,
    letterSpacing: -0.1,
    paddingVertical: 8,
  },

  /* ─── Ver más (cronograma → calendario completo) ─── */
  seeMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  seeMoreText: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
});
