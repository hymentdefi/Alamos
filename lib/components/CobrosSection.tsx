import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

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
}

/**
 * Cobros — sub-sección de Rendimiento dedicada a dividendos, cupones
 * y amortizaciones del portfolio. La diferencia con cualquier ALyC
 * argentino es el calendario forward: no muestra solo lo que ya
 * cobraste, sino lo que viene.
 *
 * Cuatro cards en orden de jerarquía:
 *   1. Hero — "Te queda por cobrar" en brand grande + sublabel con
 *      lo cobrado este año + bar chart de 12 meses (paid en brand,
 *      upcoming en border).
 *   2. Próximo cobro — destaca el siguiente evento con countdown.
 *   3. Cronograma — los próximos 5 eventos + "Ver el año completo"
 *      → navega al calendario anual estilo Apple Calendar (/cobros).
 *   4. Detalle del año — split por tipo (cupones/divs/amort).
 *
 * Los totales agregan a ARS via `convertAmount`. Las filas individuales
 * muestran la moneda nativa porque un cupón de AL30 en USD se lee con
 * más fidelidad que el equivalente en pesos.
 */
export function CobrosSection({ currency }: Props) {
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
      {/* ─── Section header — mismo lenguaje visual que la BriefingCard
          del stock detail: título en brand color + arrow-right + tap
          que navega a /cobros (la página completa con calendario
          anual). El info dot queda al lado para abrir el sheet con
          la explicación, sin interferir con el navigation gesture. */}
      <View style={s.sectionHeader}>
        <Tap
          onPress={() => router.push("/cobros")}
          haptic="selection"
          pressScale={0.97}
          hitSlop={8}
          style={s.sectionTitleTap}
        >
          <Text style={[s.sectionTitle, { color: c.brand }]}>Cobros</Text>
          <Feather name="arrow-right" size={18} color={c.brand} />
        </Tap>
        <Tap
          onPress={() => setInfoOpen(true)}
          haptic="selection"
          hitSlop={12}
          style={s.sectionInfoDot}
          accessibilityLabel="Qué son los cobros"
        >
          <Feather name="info" size={18} color={c.textMuted} />
        </Tap>
      </View>

      {/* ─── Card 1: Hero + bar chart ─────────────────────────────── */}
      <View style={[s.card, s.firstCard]}>
        {scrubBucket ? (
          <>
            <Text style={[s.heroLabel, { color: c.textMuted }]}>
              {monthFullLabel(scrubBucket)}
              {scrubBucket.paid ? "" : " · proyectado"}
            </Text>
            <AmountDisplay
              value={toDisplay(scrubBucket.totalArs)}
              size={36}
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
              size={36}
              color={c.brand}
              decimalsColor={c.brand}
              currency={currency}
            />
            {ytdDisplay > 0 ? (
              <Text style={[s.heroSub, { color: c.textMuted }]}>
                Cobraste{" "}
                <Text style={{ color: c.text, fontFamily: fontFamily[700] }}>
                  {formatMoney(ytdDisplay, currency)}
                </Text>{" "}
                este año
              </Text>
            ) : null}
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
              size={36}
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
            const baseColor = b.paid ? c.brand : c.border;
            const labelColor = active
              ? c.text
              : b.isCurrent
                ? c.text
                : c.textMuted;
            return (
              <Pressable
                key={b.key}
                onPressIn={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setScrubIdx(i);
                }}
                onPressOut={() => setScrubIdx(null)}
                style={s.barCol}
                hitSlop={4}
              >
                <View
                  style={[
                    s.bar,
                    {
                      height: h,
                      backgroundColor: baseColor,
                      opacity: scrubIdx == null || active ? 1 : 0.45,
                    },
                  ]}
                />
                <Text
                  style={[
                    s.barLabel,
                    {
                      color: labelColor,
                      fontFamily: b.isCurrent
                        ? fontFamily[700]
                        : fontFamily[500],
                    },
                  ]}
                >
                  {b.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={s.legendRow}>
          <View style={s.legendItem}>
            <View
              style={[s.legendDot, { backgroundColor: c.brand }]}
            />
            <Text style={[s.legendText, { color: c.textMuted }]}>
              Cobrado
            </Text>
          </View>
          <View style={s.legendItem}>
            <View
              style={[s.legendDot, { backgroundColor: c.border }]}
            />
            <Text style={[s.legendText, { color: c.textMuted }]}>
              Por cobrar
            </Text>
          </View>
        </View>
      </View>

      {/* ─── Card 2: Próximo cobro ─────────────────────────────────── */}
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
                {nextEvent.assetName} · {payoutTypeLabel(nextEvent.type)}
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

      {/* ─── Card 3: Cronograma — próximos eventos + ver más ───────── */}
      {upcomingList.length > 1 ? (
        <View style={s.card}>
          <Text style={[s.eyebrow, { color: c.text }]}>Cronograma</Text>
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
                <Text style={[s.cronoDateRel, { color: c.textMuted }]}>
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
            <Feather name="chevron-right" size={16} color={c.brand} />
          </Tap>
        </View>
      ) : null}

      {/* ─── Card 4: Detalle del año ───────────────────────────────── */}
      <View style={s.card}>
        <Text style={[s.eyebrow, { color: c.text }]}>Detalle del año</Text>
        {(["cupon", "dividendo", "amortizacion"] as const)
          .filter((t) => fullYear.byType[t] > 0)
          .map((t, i, arr) => {
            const ars = fullYear.byType[t];
            const pct = fullYear.totalArs > 0
              ? (ars / fullYear.totalArs) * 100
              : 0;
            return (
              <View
                key={t}
                style={[
                  s.statsRow,
                  i < arr.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: c.border,
                  },
                ]}
              >
                <Text style={[s.statsLabel, { color: c.textMuted }]}>
                  {payoutTypeLabel(t, true)}
                </Text>
                <View style={s.statsValueWrap}>
                  <Text
                    style={[s.statsValue, { color: c.text }]}
                    numberOfLines={1}
                  >
                    {formatMoney(toDisplay(ars), currency)}
                  </Text>
                  <Text style={[s.statsPct, { color: c.textMuted }]}>
                    {pct.toFixed(0)}%
                  </Text>
                </View>
              </View>
            );
          })}
        <Text style={[s.cardFooter, { color: c.textFaint }]}>
          Total proyectado{" "}
          <Text style={{ color: c.text, fontFamily: fontFamily[700] }}>
            {formatMoney(toDisplay(fullYear.totalArs), currency)}
          </Text>{" "}
          en {currentYear}
        </Text>
      </View>

      <CobrosInfoSheet
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
    </>
  );
}

const BAR_MAX_H = 96;

const s = StyleSheet.create({
  /* Section header — "Cobros" 48pt display + info dot. Vive fuera de
   * los cards porque es el header de toda la sección. Padding lateral
   * 24pt para alinear con el rail estándar. marginTop 32 para separar
   * del card anterior ("De dónde viene"). */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
    marginTop: 32,
  },
  /* Tap del título — mismo layout que briefingHead del stock detail
   * (flex row + gap 6 + alignItems center). Title + arrow viven en
   * un mismo press target que navega a /cobros. */
  sectionTitleTap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  /* Title style — clavado a briefingHeadText del stock detail:
   * fontFamily 800 (peso heaviest), fontSize 22, letterSpacing -0.5.
   * Brand color porque cobros son inherentemente positivos (income). */
  sectionTitle: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.5,
  },
  sectionInfoDot: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Card container — mismo lenguaje que rendimiento.tsx (s.card)
   * pero con paddings/margen más chicos para que los 4 cards de la
   * sección Cobros respiren como un bloque continuo en lugar de
   * cards islotes. paddingVertical 18 (vs 24) + marginTop 4 (vs 16)
   * reducen el gap visible entre cards de ~58pt → ~40pt. */
  card: {
    paddingHorizontal: 24,
    paddingVertical: 18,
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
    fontSize: 22,
    letterSpacing: -0.5,
    marginBottom: 16,
  },

  /* ─── Hero ─── */
  heroLabel: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  heroSub: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    marginTop: 10,
  },

  /* ─── Bar chart ─── */
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    marginTop: 22,
    height: BAR_MAX_H + 24,
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
  legendRow: {
    flexDirection: "row",
    gap: 18,
    marginTop: 14,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: fontFamily[500],
    fontSize: 12,
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
    fontSize: 24,
    letterSpacing: -0.5,
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
    fontSize: 18,
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
    paddingVertical: 14,
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

  /* ─── Stats rows (detalle del año) ─── */
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    gap: 12,
  },
  statsLabel: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.1,
  },
  statsValueWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  statsValue: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  statsPct: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    minWidth: 36,
    textAlign: "right",
  },
  cardFooter: {
    marginTop: 14,
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
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
