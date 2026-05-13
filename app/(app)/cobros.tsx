import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { fontFamily, radius, useTheme } from "../../lib/theme";
import { CobrosInfoSheet } from "../../lib/components/CobrosInfoSheet";
import { Tap } from "../../lib/components/Tap";
import {
  MOCK_TODAY,
  formatRelativeDate,
  formatShortDate,
  generatePayouts,
  monthNameFull,
  monthNameShort,
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(
    () => MOCK_TODAY.getFullYear(),
  );
  const [infoOpen, setInfoOpen] = useState(false);

  const events = useMemo(() => generatePayouts(), []);

  /* Cantidad de eventos por (año, mes) — para los dots del picker.
   * Key = "YYYY-MM". */
  const eventCountByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      const k = e.date.slice(0, 7);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [events]);

  const hasEventsIn = (y: number, m: number) => {
    const k = `${y}-${(m + 1).toString().padStart(2, "0")}`;
    return (eventCountByMonth.get(k) ?? 0) > 0;
  };

  const openPicker = () => {
    setPickerYear(cursor.getFullYear());
    setPickerOpen(true);
  };
  const selectMonth = (y: number, m: number) => {
    setCursor(new Date(y, m, 1));
    setPickerOpen(false);
  };

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
        {/* Title row — "Cobros" en display size + info dot a la
            derecha (mismo patrón que "PyG HOY" en portfolio.tsx).
            Tap del info dot abre el CobrosInfoSheet con explicación
            sencilla. */}
        <View style={s.titleRow}>
          <Text style={[s.title, { color: c.text }]}>Cobros</Text>
          <Tap
            onPress={() => setInfoOpen(true)}
            haptic="selection"
            hitSlop={12}
            style={s.infoDot}
            accessibilityLabel="Qué son los cobros"
          >
            <Feather name="info" size={18} color={c.textMuted} />
          </Tap>
        </View>

        {/* Month nav — el label central es tappable y abre el picker
            de mes/año. Affordance: chevron-down al lado del texto. */}
        <View style={s.monthNav}>
          <Tap
            onPress={goPrev}
            haptic="selection"
            hitSlop={12}
            style={s.navBtn}
          >
            <Feather name="chevron-left" size={22} color={c.text} />
          </Tap>
          <Tap
            onPress={openPicker}
            haptic="selection"
            pressScale={0.96}
            hitSlop={8}
            style={s.monthLabelTap}
          >
            <Text style={[s.monthLabel, { color: c.text }]}>
              {monthNameFull(month)} {year}
            </Text>
            <Feather name="chevron-down" size={18} color={c.text} />
          </Tap>
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

      {/* Month/year picker — bottom sheet con nav de año arriba +
          grid 3×4 de meses. Mes seleccionado en brand, meses con
          eventos con dot. Tap fuera del sheet → cierra. */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
        statusBarTranslucent
      >
        <View style={s.modalRoot}>
          <Pressable
            style={s.modalOverlay}
            onPress={() => setPickerOpen(false)}
          />
          <View
            style={[
              s.sheet,
              {
                backgroundColor: c.surface,
                paddingBottom: insets.bottom + 24,
              },
            ]}
          >
            <View
              style={[s.sheetHandle, { backgroundColor: c.border }]}
            />

            <View style={s.pickerYearNav}>
              <Tap
                onPress={() => setPickerYear((y) => y - 1)}
                haptic="selection"
                hitSlop={12}
                style={s.navBtn}
              >
                <Feather
                  name="chevron-left"
                  size={22}
                  color={c.text}
                />
              </Tap>
              <Text
                style={[s.pickerYearLabel, { color: c.text }]}
              >
                {pickerYear}
              </Text>
              <Tap
                onPress={() => setPickerYear((y) => y + 1)}
                haptic="selection"
                hitSlop={12}
                style={s.navBtn}
              >
                <Feather
                  name="chevron-right"
                  size={22}
                  color={c.text}
                />
              </Tap>
            </View>

            <View style={s.pickerGrid}>
              {Array.from({ length: 12 }, (_, m) => {
                const selected =
                  pickerYear === year && m === month;
                const has = !selected && hasEventsIn(pickerYear, m);
                return (
                  <Tap
                    key={m}
                    onPress={() => selectMonth(pickerYear, m)}
                    haptic="selection"
                    pressScale={0.94}
                    style={[
                      s.pickerCell,
                      {
                        backgroundColor: selected
                          ? c.brand
                          : c.surfaceHover,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.pickerMonthLabel,
                        { color: selected ? c.onColor : c.text },
                      ]}
                    >
                      {monthNameShort(m)}
                    </Text>
                    {has ? (
                      <View
                        style={[
                          s.pickerDot,
                          { backgroundColor: c.brand },
                        ]}
                      />
                    ) : null}
                  </Tap>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      <CobrosInfoSheet
        visible={infoOpen}
        onClose={() => setInfoOpen(false)}
      />
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

  /* Title row — title display size + info dot al lado. El info dot
   * vive en flex sin width fijo así matchea la baseline del título. */
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
    marginTop: 4,
    marginBottom: 24,
  },
  title: {
    fontFamily: fontFamily[700],
    fontSize: 48,
    letterSpacing: -2,
  },
  infoDot: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6, // alinea el ícono con el corte óptico del título
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
  /* Wrap del label central — pone label + chevron en fila y permite
   * pressScale en el conjunto cuando se tappea para abrir el picker. */
  monthLabelTap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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

  /* ─── Month/year picker (bottom sheet) ─── */
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderCurve: "continuous",
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 22,
  },
  pickerYearNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  pickerYearLabel: {
    fontFamily: fontFamily[700],
    fontSize: 28,
    letterSpacing: -0.8,
  },
  pickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  pickerCell: {
    width: "31.5%",
    height: 64,
    borderCurve: "continuous",
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  pickerMonthLabel: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  pickerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
