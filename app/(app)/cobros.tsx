import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { fontFamily, radius, useTheme } from "../../lib/theme";
import { Tap } from "../../lib/components/Tap";
import {
  MOCK_TODAY,
  formatRelativeDate,
  formatShortDate,
  generatePayouts,
  monthNameFull,
  payoutTypeLabel,
  type PayoutEvent,
} from "../../lib/data/payouts";
import { formatMoney } from "../../lib/data/assets";

/**
 * Pantalla dedicada de Cobros — calendario anual al estilo de Apple
 * Calendar. Accedida desde el "Ver el año completo" del Cronograma
 * en la sub-pantalla de Rendimiento.
 *
 * Estructura:
 *   - Top bar con back arrow + botón "Hoy" cuando estamos navegados
 *     fuera del mes actual.
 *   - Title "Cobros" en h1 (32pt).
 *   - Month nav: ◀ Mayo 2026 ▶ (centro).
 *   - Weekday header L M X J V S D (Apple Calendar Spanish convention:
 *     X para miércoles, evita el M duplicado).
 *   - Grid 7 columnas × N filas, semana inicia lunes. Día con eventos
 *     pinta 1-3 dots brand bajo el número. Día actual con círculo
 *     brand + número en onColor.
 *   - Lista de eventos del mes visible, ordenada por fecha.
 *
 * El usuario puede navegar libremente fuera de la ventana de ±12 meses
 * que genera el mock; los meses sin eventos muestran el grid limpio
 * sin la lista debajo.
 */

/* Convención Apple Calendar es: L M X J V S D. Se usa X para
 * "miércoles" porque la M se repite con martes y crea ambigüedad. */
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

export default function CobrosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [cursor, setCursor] = useState(
    () => new Date(MOCK_TODAY.getFullYear(), MOCK_TODAY.getMonth(), 1),
  );

  const events = useMemo(() => generatePayouts(), []);

  const month = cursor.getMonth();
  const year = cursor.getFullYear();

  /* Eventos que caen dentro del mes visible. */
  const monthEvents = useMemo(
    () =>
      events.filter((e) => {
        const [y, m] = e.date.split("-").map(Number);
        return y === year && m - 1 === month;
      }),
    [events, year, month],
  );

  /* Agrupados por día-del-mes para los dots de la grid. */
  const eventsByDay = useMemo(() => {
    const map = new Map<number, PayoutEvent[]>();
    for (const e of monthEvents) {
      const day = Number(e.date.split("-")[2]);
      const arr = map.get(day) ?? [];
      arr.push(e);
      map.set(day, arr);
    }
    return map;
  }, [monthEvents]);

  /* Grid: 7 columnas, filas variables (5 ó 6 según el mes). Padding
   * inicial = offset hasta el primer lunes. Lleno hasta cerrar la
   * última semana con celdas vacías. */
  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startWeekday = firstDay.getDay(); // 0=Sun ... 6=Sat
    const startOffset = (startWeekday + 6) % 7; // 0=Mon ... 6=Sun
    const arr: Array<{ day: number | null }> = [];
    for (let i = 0; i < startOffset; i++) arr.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) arr.push({ day: d });
    while (arr.length % 7 !== 0) arr.push({ day: null });
    return arr;
  }, [year, month]);

  const isToday = (day: number) =>
    day === MOCK_TODAY.getDate() &&
    month === MOCK_TODAY.getMonth() &&
    year === MOCK_TODAY.getFullYear();

  const isCurrentMonth =
    month === MOCK_TODAY.getMonth() && year === MOCK_TODAY.getFullYear();

  const goPrev = () => setCursor(new Date(year, month - 1, 1));
  const goNext = () => setCursor(new Date(year, month + 1, 1));
  const goToday = () =>
    setCursor(
      new Date(MOCK_TODAY.getFullYear(), MOCK_TODAY.getMonth(), 1),
    );

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      {/* Top bar — back arrow + (opcional) botón "Hoy". Mismo lenguaje
          que detail.tsx / rendimiento.tsx. */}
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <Tap
          onPress={() => router.back()}
          haptic="selection"
          hitSlop={12}
          style={s.iconBtn}
        >
          <Feather name="arrow-left" size={24} color={c.text} />
        </Tap>
        <View style={{ flex: 1 }} />
        {!isCurrentMonth ? (
          <Tap onPress={goToday} haptic="selection" hitSlop={8}>
            <Text style={[s.todayBtn, { color: c.brand }]}>Hoy</Text>
          </Tap>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[s.title, { color: c.text }]}>Cobros</Text>

        {/* Month nav */}
        <View style={s.monthNav}>
          <Tap
            onPress={goPrev}
            haptic="selection"
            hitSlop={12}
            style={s.navBtn}
          >
            <Feather name="chevron-left" size={22} color={c.text} />
          </Tap>
          <Text style={[s.monthLabel, { color: c.text }]}>
            {monthNameFull(month)} {year}
          </Text>
          <Tap
            onPress={goNext}
            haptic="selection"
            hitSlop={12}
            style={s.navBtn}
          >
            <Feather name="chevron-right" size={22} color={c.text} />
          </Tap>
        </View>

        {/* Weekday header */}
        <View style={s.weekHeader}>
          {WEEKDAYS.map((w, i) => (
            <Text key={i} style={[s.weekday, { color: c.textMuted }]}>
              {w}
            </Text>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={s.grid}>
          {cells.map((cell, i) => {
            if (cell.day == null) {
              return <View key={i} style={s.cell} />;
            }
            const dayEvents = eventsByDay.get(cell.day) ?? [];
            const today = isToday(cell.day);
            return (
              <View key={i} style={s.cell}>
                <View
                  style={[
                    s.dayInner,
                    today && {
                      backgroundColor: c.brand,
                      borderCurve: "continuous",
                      borderRadius: 16,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.dayNum,
                      {
                        color: today ? c.onColor : c.text,
                        fontFamily: today
                          ? fontFamily[700]
                          : fontFamily[500],
                      },
                    ]}
                  >
                    {cell.day}
                  </Text>
                </View>
                {dayEvents.length > 0 ? (
                  <View style={s.dotsRow}>
                    {dayEvents.slice(0, 3).map((_, j) => (
                      <View
                        key={j}
                        style={[
                          s.dot,
                          { backgroundColor: c.brand },
                        ]}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Events list — solo si el mes tiene eventos. Mismo lenguaje
            que el cronograma de la sub-sección Cobros. */}
        {monthEvents.length > 0 ? (
          <View style={s.eventsCard}>
            <Text style={[s.eventsTitle, { color: c.text }]}>
              Cobros de {monthNameFull(month).toLowerCase()}
            </Text>
            {monthEvents.map((e, i, arr) => (
              <View
                key={e.id}
                style={[
                  s.eventRow,
                  i < arr.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: c.border,
                  },
                ]}
              >
                <View style={s.eventDate}>
                  <Text style={[s.eventDateText, { color: c.text }]}>
                    {formatShortDate(e.date)}
                  </Text>
                  <Text
                    style={[s.eventDateRel, { color: c.textMuted }]}
                  >
                    {formatRelativeDate(e.date)}
                  </Text>
                </View>
                <View style={s.eventMid}>
                  <Text
                    style={[s.eventTicker, { color: c.text }]}
                    numberOfLines={1}
                  >
                    {e.ticker}
                  </Text>
                  <Text
                    style={[s.eventType, { color: c.textMuted }]}
                    numberOfLines={1}
                  >
                    {payoutTypeLabel(e.type)}
                  </Text>
                </View>
                <Text
                  style={[s.eventAmount, { color: c.text }]}
                  numberOfLines={1}
                >
                  {formatMoney(e.amount, e.currency)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.empty}>
            <Text style={[s.emptyText, { color: c.textMuted }]}>
              No hay cobros este mes.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  topBar: {
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
  todayBtn: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  title: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    letterSpacing: -1,
    paddingHorizontal: 24,
    marginTop: 4,
    marginBottom: 24,
  },

  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginBottom: 18,
  },
  navBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.5,
  },

  weekHeader: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontFamily: fontFamily[600],
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 6,
  },
  dayInner: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNum: {
    fontSize: 16,
    letterSpacing: -0.3,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 3,
    marginTop: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  eventsCard: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    marginTop: 20,
  },
  eventsTitle: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  eventDate: {
    width: 72,
  },
  eventDateText: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  eventDateRel: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    letterSpacing: -0.05,
    marginTop: 1,
  },
  eventMid: {
    flex: 1,
    minWidth: 0,
  },
  eventTicker: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  eventType: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
    marginTop: 1,
  },
  eventAmount: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },

  empty: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.1,
  },
});
