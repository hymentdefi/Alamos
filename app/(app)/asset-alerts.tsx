import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fontFamily, radius, useTheme } from "../../lib/theme";
import {
  assets,
  formatMoney,
  assetCurrency,
  type Asset,
} from "../../lib/data/assets";
import { useAlerts } from "../../lib/alerts/context";
import { useToast } from "../../lib/toast/context";
import type { PriceAlert } from "../../lib/api/alerts";
import { AlertSheet } from "../../lib/components/AlertSheet";
import { AlertBellIllustration } from "../../lib/components/illustrations/AlertBellIllustration";

type Tab = "price" | "indicator";

/**
 * Pantalla de Alertas custom de un activo. Se abre desde la
 * campana del header en stock detail.
 *
 * Layout (mismo lenguaje que el reference de Robinhood pero
 * Alamos-styled):
 *   - Header: X (close) + título "[TICKER] · Alertas custom" +
 *     subtítulo de frecuencia.
 *   - Tabs: "Precio" / "Indicadores" (segundo tab placeholder
 *     hasta que tengamos signals técnicos).
 *   - Empty state: AlertBellIllustration grande + copy +
 *     "Próximamente" si la tab es indicador.
 *   - Lista de alertas existentes (si hay) con delete.
 *   - CTA bottom-fixed "Agregar alerta" → abre el AlertSheet
 *     con el form de creación.
 */
export default function AssetAlertsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { show } = useToast();
  const { ticker } = useLocalSearchParams<{ ticker: string }>();

  const asset = useMemo<Asset | undefined>(
    () => assets.find((a) => a.ticker === ticker),
    [ticker],
  );

  const [tab, setTab] = useState<Tab>("price");
  const [createOpen, setCreateOpen] = useState(false);

  const { activeForAsset, remove } = useAlerts();
  const alertsForAsset = useMemo(
    () => (asset ? activeForAsset(asset.ticker) : []),
    [asset, activeForAsset],
  );

  if (!asset) {
    return (
      <View style={[s.root, { backgroundColor: c.bg }]}>
        <Header
          ticker={ticker ?? ""}
          insetsTop={insets.top}
          onClose={() => router.back()}
        />
        <View style={s.fallback}>
          <Text style={{ color: c.textMuted }}>Activo no encontrado.</Text>
        </View>
      </View>
    );
  }

  const handleDelete = async (alert: PriceAlert) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await remove(alert.id);
      show("Alerta eliminada", { variant: "neutral" });
    } catch {
      show("No pudimos eliminar la alerta", { variant: "error" });
    }
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <Header
        ticker={asset.ticker}
        insetsTop={insets.top}
        onClose={() => router.back()}
      />

      <View style={[s.tabsRow, { paddingHorizontal: 24 }]}>
        <TabPill
          label="Precio"
          active={tab === "price"}
          onPress={() => setTab("price")}
        />
        <TabPill
          label="Indicadores"
          active={tab === "indicator"}
          onPress={() => setTab("indicator")}
        />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
      >
        {tab === "price" ? (
          alertsForAsset.length === 0 ? (
            <EmptyState
              illustration={<AlertBellIllustration size={220} />}
              text="Creá tus propios umbrales de precio. Te notificamos cuando el activo los cruza."
            />
          ) : (
            <View style={s.list}>
              {alertsForAsset.map((alert, i) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  asset={asset}
                  withTopDivider={i > 0}
                  onDelete={() => handleDelete(alert)}
                />
              ))}
            </View>
          )
        ) : (
          <EmptyState
            illustration={<AlertBellIllustration size={220} />}
            text="Las alertas por indicadores técnicos llegan próximamente — RSI, cruces de medias móviles y más."
          />
        )}
      </ScrollView>

      {/* CTA bottom-fixed. Sólo en la tab de Precio — la de
          Indicadores está en placeholder y no hay nada que
          crear todavía. */}
      {tab === "price" ? (
        <View
          style={[
            s.ctaWrap,
            { paddingBottom: insets.bottom + 12 },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              s.cta,
              {
                backgroundColor: c.text,
                opacity: pressed ? 0.86 : 1,
              },
            ]}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setCreateOpen(true);
            }}
          >
            <Text style={[s.ctaText, { color: c.bg }]}>
              Agregar alerta
            </Text>
          </Pressable>
        </View>
      ) : null}

      <AlertSheet
        key={asset.ticker}
        visible={createOpen}
        asset={asset}
        onClose={() => setCreateOpen(false)}
      />
    </View>
  );
}

function Header({
  ticker,
  insetsTop,
  onClose,
}: {
  ticker: string;
  insetsTop: number;
  onClose: () => void;
}) {
  const { c } = useTheme();
  return (
    <View style={[s.header, { paddingTop: insetsTop + 12 }]}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onClose();
        }}
        hitSlop={12}
        style={s.closeBtn}
      >
        <Feather name="x" size={26} color={c.text} />
      </Pressable>
      <Text style={[s.title, { color: c.text }]}>
        {ticker} · Alertas custom
      </Text>
      <Text style={[s.subtitle, { color: c.textMuted }]}>
        Te avisamos como máximo una vez al día por cada alerta.
      </Text>
    </View>
  );
}

function TabPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={[
        s.tabPill,
        {
          backgroundColor: active ? c.surfaceHover : "transparent",
        },
      ]}
    >
      <Text
        style={[
          s.tabPillText,
          {
            color: active ? c.text : c.textMuted,
            fontFamily: active ? fontFamily[700] : fontFamily[600],
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function EmptyState({
  illustration,
  text,
}: {
  illustration: React.ReactNode;
  text: string;
}) {
  const { c } = useTheme();
  return (
    <View style={s.emptyWrap}>
      <View style={s.emptyIllustration}>{illustration}</View>
      <Text style={[s.emptyText, { color: c.textMuted }]}>{text}</Text>
    </View>
  );
}

function AlertRow({
  alert,
  asset,
  withTopDivider,
  onDelete,
}: {
  alert: PriceAlert;
  asset: Asset;
  withTopDivider: boolean;
  onDelete: () => void;
}) {
  const { c } = useTheme();
  const cur = assetCurrency(asset);
  const dirIcon = alert.direction === "above" ? "arrow-up" : "arrow-down";
  const dirLabel = alert.direction === "above" ? "Sube a" : "Baja a";
  return (
    <View
      style={[
        s.alertRow,
        withTopDivider && {
          borderTopColor: c.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View
        style={[s.dirBadge, { backgroundColor: c.surfaceHover }]}
      >
        <Feather name={dirIcon} size={16} color={c.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.alertLabel, { color: c.textMuted }]}>
          {dirLabel}
        </Text>
        <Text style={[s.alertPrice, { color: c.text }]}>
          {formatMoney(alert.threshold, cur)}
        </Text>
      </View>
      <Pressable
        hitSlop={10}
        onPress={onDelete}
        style={[s.deleteBtn, { backgroundColor: c.surfaceHover }]}
      >
        <Feather name="trash-2" size={16} color={c.textMuted} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 18,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "flex-start",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 28,
    letterSpacing: -1,
    marginTop: 4,
  },
  subtitle: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
    marginTop: 6,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  tabPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    flex: 1,
    alignItems: "center",
  },
  tabPillText: {
    fontSize: 14,
    letterSpacing: -0.1,
  },

  /* Empty state */
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 24,
  },
  emptyIllustration: {
    marginBottom: 18,
  },
  emptyText: {
    fontFamily: fontFamily[500],
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: -0.1,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Lista */
  list: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  dirBadge: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
    borderRadius: 18,
  },
  alertLabel: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
  },
  alertPrice: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
    borderRadius: 18,
  },

  /* CTA bottom */
  ctaWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  cta: {
    height: 54,
    borderCurve: "continuous",
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontFamily: fontFamily[800],
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
