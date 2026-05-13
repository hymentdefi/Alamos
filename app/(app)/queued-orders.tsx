import { useCallback, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { fontFamily, radius, useTheme } from "../../lib/theme";
import { Tap } from "../../lib/components/Tap";
import { AlamosRefreshControl } from "../../lib/components/AlamosRefreshControl";
import { useQueuedOrders } from "../../lib/queued-orders/context";
import { useToast } from "../../lib/toast/context";
import {
  assets,
  formatMoney,
  formatQty,
  type Asset,
} from "../../lib/data/assets";
import {
  type OrderStatus,
  type QueuedOrder,
} from "../../lib/api/queued-orders";

/**
 * Pantalla "Órdenes pendientes" — accesible desde el perfil. Lista
 * todas las órdenes encoladas (queued, executed, failed, cancelled)
 * con badge de status y opción de cancelar las que todavía están
 * queued.
 */
export default function QueuedOrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c, mode } = useTheme();
  const { orders, isLoading, cancel, refresh } = useQueuedOrders();
  const { show: showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const handleCancel = useCallback(
    async (order: QueuedOrder) => {
      // Sin toast — la orden desaparece del listado al cancelarse.
      try {
        await cancel(order.id);
      } catch {
        showToast("No pudimos cancelar la orden", { variant: "error" });
      }
    },
    [cancel, showToast],
  );

  const assetByTicker = useMemo(() => {
    const m = new Map<string, Asset>();
    for (const a of assets) m.set(a.ticker, a);
    return m;
  }, []);

  const queuedCount = orders.filter((o) => o.status === "queued").length;

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <Tap
          style={s.iconBtn}
          onPress={() => router.back()}
          hitSlop={12}
          haptic="selection"
        >
          <Feather name="arrow-left" size={22} color={c.text} />
        </Tap>
        <View style={s.topCenter}>
          <Text style={[s.topTitle, { color: c.text }]}>
            Órdenes pendientes
          </Text>
        </View>
        <View style={s.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: insets.bottom + 28,
        }}
        refreshControl={
          <AlamosRefreshControl
            refreshing={refreshing || isLoading}
            onRefresh={onRefresh}
            tintColor={mode === "dark" ? "#FFFFFF" : c.textMuted}
          />
        }
      >
        {orders.length === 0 ? (
          <View style={s.emptyState}>
            <View style={[s.emptyIcon, { backgroundColor: c.surfaceHover }]}>
              <Feather name="clock" size={28} color={c.textMuted} />
            </View>
            <Text style={[s.emptyTitle, { color: c.text }]}>
              No tenés órdenes pendientes
            </Text>
            <Text style={[s.emptyBody, { color: c.textMuted }]}>
              Las órdenes que programes mientras el mercado está
              cerrado aparecen acá hasta que el mercado abre y se
              ejecutan.
            </Text>
          </View>
        ) : (
          <>
            <View style={s.summaryRow}>
              <Text style={[s.summaryText, { color: c.textMuted }]}>
                {queuedCount}{" "}
                {queuedCount === 1 ? "orden esperando ejecución" : "órdenes esperando ejecución"}
                {orders.length > queuedCount
                  ? ` · ${orders.length - queuedCount} históricas`
                  : ""}
              </Text>
            </View>

            <View style={s.list}>
              {orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  asset={assetByTicker.get(order.assetId)}
                  onCancel={() => handleCancel(order)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

interface RowProps {
  order: QueuedOrder;
  asset: Asset | undefined;
  onCancel: () => void;
}

function OrderRow({ order, asset, onCancel }: RowProps) {
  const { c } = useTheme();
  const sideLabel = order.side === "buy" ? "Compra" : "Venta";
  const isQueued = order.status === "queued";
  const dim = !isQueued;

  return (
    <View
      style={[
        s.row,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          opacity: dim ? 0.65 : 1,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <View style={s.rowHead}>
          <Text style={[s.ticker, { color: c.text }]}>
            {asset?.ticker ?? order.assetId}
          </Text>
          <Text style={[s.statusPill, { color: statusColor(order.status, c) }]}>
            {labelFor(order.status)}
          </Text>
        </View>
        <Text style={[s.detail, { color: c.textSecondary }]}>
          {sideLabel} de{" "}
          <Text style={[s.detailStrong, { color: c.text }]}>
            {formatQty(order.quantity)}
          </Text>{" "}
          {asset?.name ?? order.assetId}
        </Text>
        <Text style={[s.subline, { color: c.textMuted }]}>
          {isQueued
            ? order.orderType === "limit" && order.limitPrice != null
              ? `Se ejecuta cuando el precio toque ${formatMoney(order.limitPrice, order.currency)}`
              : `Se ejecuta cuando abra el mercado · ${formatScheduledTime(order.estimatedExecutionAt)}`
            : order.executedAt && order.executionPrice != null
              ? `Ejecutada a ${formatMoney(order.executionPrice, order.currency)}`
              : order.failureReason ?? labelFor(order.status)}
        </Text>
      </View>
      {isQueued ? (
        <Tap
          style={s.cancelBtn}
          haptic="light"
          onPress={onCancel}
          accessibilityLabel="Cancelar orden"
        >
          <Feather name="x" size={18} color={c.textMuted} />
        </Tap>
      ) : null}
    </View>
  );
}

function labelFor(status: OrderStatus): string {
  switch (status) {
    case "queued":
      return "En cola";
    case "executed":
      return "Ejecutada";
    case "failed":
      return "Falló";
    case "cancelled":
      return "Cancelada";
  }
}

function statusColor(
  status: OrderStatus,
  c: ReturnType<typeof useTheme>["c"],
): string {
  switch (status) {
    case "queued":
      return c.textSecondary;
    case "executed":
      return c.brand;
    case "failed":
      return c.red;
    case "cancelled":
      return c.textMuted;
  }
}

function formatScheduledTime(iso: string): string {
  try {
    const date = new Date(iso);
    const days = [
      "domingo",
      "lunes",
      "martes",
      "miércoles",
      "jueves",
      "viernes",
      "sábado",
    ];
    const utcMs = date.getTime() + date.getTimezoneOffset() * 60_000;
    const ar = new Date(utcMs - 3 * 60 * 60_000);
    const day = days[ar.getDay()];
    const hh = String(ar.getHours()).padStart(2, "0");
    const mm = String(ar.getMinutes()).padStart(2, "0");
    return `${day} ${hh}:${mm} hs`;
  } catch {
    return "próxima apertura";
  }
}

const s = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  topCenter: {
    flex: 1,
    alignItems: "center",
  },
  topTitle: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 36,
    paddingTop: 80,
    gap: 14,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: fontFamily[700],
    fontSize: 20,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  emptyBody: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.15,
    textAlign: "center",
  },
  summaryRow: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  summaryText: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.1,
  },
  list: {
    paddingHorizontal: 16,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 8,
  },
  rowHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  ticker: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
  },
  statusPill: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  detail: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    letterSpacing: -0.1,
  },
  detailStrong: {
    fontFamily: fontFamily[700],
  },
  subline: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 4,
    letterSpacing: -0.1,
  },
  cancelBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
