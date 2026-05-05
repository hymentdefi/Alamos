import { useCallback, useMemo, useState } from "react";
import {
  RefreshControl,
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
import { useAlerts } from "../../lib/alerts/context";
import { useToast } from "../../lib/toast/context";
import {
  assets,
  formatMoney,
  type Asset,
} from "../../lib/data/assets";
import {
  type AlertStatus,
  type PriceAlert,
} from "../../lib/api/alerts";

/**
 * Pantalla "Mis alertas" — accesible desde el perfil.
 *
 * Lista todas las alertas del usuario (active + triggered + las que
 * fueron borradas siguen sin verse — el delete es definitivo en v1).
 * Cada fila: activo, dirección, threshold, estado, acción eliminar.
 *
 * Pull-to-refresh para forzar GET /alerts.
 *
 * Empty state: ilustración + copy + sugerencia de cómo crear una.
 */
export default function AlertsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { alerts, isLoading, remove, refresh } = useAlerts();
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

  const handleDelete = useCallback(
    async (alert: PriceAlert) => {
      try {
        await remove(alert.id);
        showToast("Alerta eliminada", { variant: "neutral" });
      } catch {
        showToast("No pudimos eliminar la alerta", { variant: "error" });
      }
    },
    [remove, showToast],
  );

  // Mapa ticker→asset para resolver nombres rápido.
  const assetByTicker = useMemo(() => {
    const m = new Map<string, Asset>();
    for (const a of assets) m.set(a.ticker, a);
    return m;
  }, []);

  const activeCount = alerts.filter((a) => a.status === "active").length;

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
          <Text style={[s.topTitle, { color: c.text }]}>Mis alertas</Text>
        </View>
        <View style={s.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: insets.bottom + 28,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isLoading}
            onRefresh={onRefresh}
            tintColor={c.textMuted}
          />
        }
      >
        {alerts.length === 0 ? (
          <View style={s.emptyState}>
            <View style={[s.emptyIcon, { backgroundColor: c.surfaceHover }]}>
              <Feather name="bell-off" size={28} color={c.textMuted} />
            </View>
            <Text style={[s.emptyTitle, { color: c.text }]}>
              No tenés alertas activas
            </Text>
            <Text style={[s.emptyBody, { color: c.textMuted }]}>
              Creá una alerta desde la pantalla de cualquier activo
              tocando la campana del header. Te avisamos cuando el
              precio toque tu objetivo.
            </Text>
          </View>
        ) : (
          <>
            <View style={s.summaryRow}>
              <Text style={[s.summaryText, { color: c.textMuted }]}>
                {activeCount} {activeCount === 1 ? "activa" : "activas"}
                {alerts.length > activeCount
                  ? ` · ${alerts.length - activeCount} históricas`
                  : ""}
              </Text>
            </View>

            <View style={s.list}>
              {alerts.map((alert) => {
                const asset = assetByTicker.get(alert.assetId);
                return (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    asset={asset}
                    onDelete={() => handleDelete(alert)}
                  />
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

interface RowProps {
  alert: PriceAlert;
  asset: Asset | undefined;
  onDelete: () => void;
}

function AlertRow({ alert, asset, onDelete }: RowProps) {
  const { c } = useTheme();
  const directionLabel =
    alert.direction === "above" ? "Sube a" : "Baja a";
  const statusLabel = labelFor(alert.status);
  const dim = alert.status !== "active";

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
            {asset?.ticker ?? alert.assetId}
          </Text>
          <Text style={[s.statusPill, { color: c.textMuted }]}>
            {statusLabel}
          </Text>
        </View>
        <Text style={[s.detail, { color: c.textSecondary }]}>
          {directionLabel}{" "}
          <Text style={[s.detailStrong, { color: c.text }]}>
            {formatMoney(alert.threshold, alert.currency)}
          </Text>
        </Text>
        {asset ? (
          <Text style={[s.subline, { color: c.textMuted }]}>
            {asset.subLabel}
          </Text>
        ) : null}
      </View>
      <Tap
        style={s.deleteBtn}
        haptic="light"
        onPress={onDelete}
        accessibilityLabel="Eliminar alerta"
      >
        <Feather name="trash-2" size={18} color={c.textMuted} />
      </Tap>
    </View>
  );
}

function labelFor(status: AlertStatus): string {
  switch (status) {
    case "active":
      return "Activa";
    case "triggered":
      return "Disparada";
    case "cancelled":
      return "Cancelada";
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
    fontFamily: fontFamily[600],
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
    marginTop: 2,
    letterSpacing: -0.1,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
