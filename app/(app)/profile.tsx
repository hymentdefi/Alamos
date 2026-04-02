import { useState } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet, Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth/context";
import { colors } from "../../lib/theme";
import { assets, formatARS } from "../../lib/data/assets";

const { width: SCREEN_W } = Dimensions.get("window");

/* ─── Allocation data ─── */
const heldAssets = assets.filter((a) => a.held);
const totalValue = heldAssets.reduce((s, a) => s + a.price * (a.qty || 1), 0);

const categoryTotals = {
  acciones: heldAssets.filter((a) => a.category === "acciones").reduce((s, a) => s + a.price * (a.qty || 1), 0),
  cedears: heldAssets.filter((a) => a.category === "cedears").reduce((s, a) => s + a.price * (a.qty || 1), 0),
  bonos: heldAssets.filter((a) => a.category === "bonos").reduce((s, a) => s + a.price * (a.qty || 1), 0),
};

const categoryPct = {
  acciones: totalValue > 0 ? Math.round((categoryTotals.acciones / totalValue) * 100) : 0,
  cedears: totalValue > 0 ? Math.round((categoryTotals.cedears / totalValue) * 100) : 0,
  bonos: totalValue > 0 ? Math.round((categoryTotals.bonos / totalValue) * 100) : 0,
};

/* ─── Tab definitions ─── */
type TabKey = "acciones" | "cedears" | "bonos";

interface TabDef {
  key: TabKey;
  label: string;
  description: string;
  learnMore: string;
}

const tabs: TabDef[] = [
  {
    key: "acciones",
    label: "Acciones",
    description: "Las acciones representan una participación en una empresa. Al comprar acciones, te convertís en copropietario de esa compañía.",
    learnMore: "Más información",
  },
  {
    key: "cedears",
    label: "CEDEARs",
    description: "Los CEDEARs son certificados que representan acciones de empresas extranjeras, operados en pesos en el mercado argentino.",
    learnMore: "Más información",
  },
  {
    key: "bonos",
    label: "Bonos",
    description: "Los bonos son instrumentos de deuda emitidos por el gobierno o empresas. Te pagan intereses periódicos y devuelven el capital al vencimiento.",
    learnMore: "Más información",
  },
];

/* ─── Sector breakdown by tab ─── */
interface Sector {
  name: string;
  pct: number;
  icon: string;
}

const sectorsByTab: Record<TabKey, Sector[]> = {
  acciones: [
    { name: "Energía", pct: 62, icon: "⚡" },
    { name: "Materiales e Industria", pct: 21, icon: "🏗️" },
    { name: "Comercio", pct: 10, icon: "🏪" },
    { name: "Finanzas", pct: 5, icon: "🏦" },
    { name: "Otros", pct: 2, icon: "📦" },
  ],
  cedears: [
    { name: "Tecnología", pct: 72, icon: "💻" },
    { name: "Consumo", pct: 15, icon: "🛒" },
    { name: "Automotriz", pct: 13, icon: "🚗" },
  ],
  bonos: [
    { name: "Soberanos en USD", pct: 58, icon: "🇺🇸" },
    { name: "Soberanos en ARS", pct: 42, icon: "🇦🇷" },
  ],
};

/* ─── Category pill data ─── */
interface CategoryPill {
  icon: string;
  label: string;
}

const categoryPillsByTab: Record<TabKey, CategoryPill[]> = {
  acciones: [
    { icon: "⚡", label: "Energía" },
    { icon: "🏗️", label: "Materiales" },
    { icon: "🏪", label: "Comercio" },
    { icon: "🏦", label: "Finanzas" },
    { icon: "💊", label: "Salud" },
    { icon: "🏨", label: "Servicios" },
  ],
  cedears: [
    { icon: "💻", label: "Tecnología" },
    { icon: "🛒", label: "Consumo" },
    { icon: "🚗", label: "Automotriz" },
    { icon: "💊", label: "Salud" },
    { icon: "🏦", label: "Finanzas" },
  ],
  bonos: [
    { icon: "🇺🇸", label: "Bonos en USD" },
    { icon: "🇦🇷", label: "Bonos en ARS" },
    { icon: "📈", label: "CER" },
    { icon: "💵", label: "Dollar linked" },
  ],
};

/* ─── Bubble sizes ─── */
const BUBBLE_MAIN = 150;
const BUBBLE_SM = 80;

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>("acciones");

  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "??";

  const tab = tabs.find((t) => t.key === activeTab)!;
  const sectors = sectorsByTab[activeTab];
  const pills = categoryPillsByTab[activeTab];

  /* Determine which bubble is "active" (big) */
  const bubbleData = tabs.map((t) => ({
    key: t.key,
    label: t.label,
    pct: categoryPct[t.key],
    isActive: t.key === activeTab,
  }));

  const activeBubble = bubbleData.find((b) => b.isActive)!;
  const inactiveBubbles = bubbleData.filter((b) => !b.isActive);

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Top bar ── */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.push("/(app)/settings")}>
          <Ionicons name="menu" size={26} color={colors.text.primary} />
        </Pressable>
        <View style={s.topBarRight}>
          <Pressable onPress={() => router.push("/(app)/explore")}>
            <Ionicons name="search" size={24} color={colors.text.primary} />
          </Pressable>
          <Pressable onPress={() => router.push("/(app)/notifications")}>
            <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
          </Pressable>
        </View>
      </View>

      {/* ── Profile header ── */}
      <View style={s.profileSection}>
        <View style={s.avatarLarge}>
          <Text style={s.avatarText}>{initials}</Text>
          <View style={s.avatarBadge}>
            <Ionicons name="add" size={14} color={colors.text.primary} />
          </View>
        </View>
        <Text style={s.userName}>@{user?.fullName?.replace(/\s/g, "") || "usuario"}</Text>
        <Pressable>
          <Text style={s.editProfile}>Editar perfil</Text>
        </Pressable>
      </View>

      {/* ── Total value section ── */}
      <View style={s.totalSection}>
        <Text style={s.totalValue}>{formatARS(totalValue)}</Text>
        <Text style={s.totalLabel}>Total en Álamos</Text>
      </View>

      {/* ── Investing breakdown ── */}
      <View style={s.investingSection}>
        <View style={s.investingHeader}>
          <Text style={s.investingTitle}>Inversiones</Text>
          <Pressable>
            <Ionicons name="information-circle-outline" size={20} color={colors.text.muted} />
          </Pressable>
        </View>

        <View style={s.breakdownRow}>
          <Text style={s.breakdownLabel}>Valor total invertido</Text>
          <Text style={s.breakdownValue}>{formatARS(totalValue)}</Text>
        </View>
        <View style={s.breakdownRow}>
          <Text style={s.breakdownLabel}>Acciones y CEDEARs</Text>
          <Text style={s.breakdownValue}>{formatARS(categoryTotals.acciones + categoryTotals.cedears)}</Text>
        </View>
        <View style={s.breakdownRow}>
          <Text style={s.breakdownLabel}>Bonos</Text>
          <Text style={s.breakdownValue}>{formatARS(categoryTotals.bonos)}</Text>
        </View>
        <View style={s.breakdownRow}>
          <Text style={s.breakdownLabel}>Efectivo disponible</Text>
          <Text style={s.breakdownValue}>{formatARS(342180)}</Text>
        </View>
      </View>

      {/* ── Category tabs ── */}
      <View style={s.tabRow}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            style={[s.tab, activeTab === t.key && s.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[s.tabText, activeTab === t.key && s.tabTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Bubble chart ── */}
      <View style={s.bubbleArea}>
        {/* Active (main) bubble */}
        <View style={[s.bubbleMain, { width: BUBBLE_MAIN, height: BUBBLE_MAIN, borderRadius: BUBBLE_MAIN / 2 }]}>
          <Text style={s.bubbleMainPct}>{activeBubble.pct}%</Text>
          <Text style={s.bubbleMainLabel}>{activeBubble.label}</Text>
        </View>

        {/* Inactive bubbles positioned around */}
        {inactiveBubbles.map((b, i) => {
          const positions = [
            { top: 0, right: 10 },
            { bottom: 10, right: 0 },
          ];
          const pos = positions[i] || { top: 0, left: 0 };
          return (
            <View
              key={b.key}
              style={[
                s.bubbleSmall,
                {
                  width: BUBBLE_SM,
                  height: BUBBLE_SM,
                  borderRadius: BUBBLE_SM / 2,
                  position: "absolute",
                  ...pos,
                },
              ]}
            >
              <Text style={s.bubbleSmPct}>{b.pct}%</Text>
              <Text style={s.bubbleSmLabel}>{b.label}</Text>
            </View>
          );
        })}
      </View>

      {/* ── Tab description ── */}
      <View style={s.descSection}>
        <Text style={s.descText}>{tab.description}</Text>
        <Pressable>
          <Text style={s.learnMore}>{tab.learnMore}</Text>
        </Pressable>
      </View>

      {/* ── Category pills ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.pillsScroll}
      >
        {pills.map((p) => (
          <Pressable key={p.label} style={s.pill}>
            <Text style={s.pillIcon}>{p.icon}</Text>
            <Text style={s.pillLabel}>{p.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Divider ── */}
      <View style={s.divider} />

      {/* ── Sector breakdown ── */}
      <View style={s.sectorSection}>
        {sectors.map((sec, i) => {
          const isHighlighted = i === 0;
          return (
            <View key={sec.name}>
              {isHighlighted ? (
                <View style={s.sectorRowHighlight}>
                  <View style={s.sectorNameRow}>
                    <Text style={s.sectorName}>{sec.name}</Text>
                    <Ionicons name="information-circle-outline" size={14} color={colors.text.muted} style={{ marginLeft: 4 }} />
                  </View>
                  <Text style={s.sectorPct}>{sec.pct}%</Text>
                </View>
              ) : (
                <Pressable style={s.sectorRow}>
                  <Text style={s.sectorName}>{sec.name}</Text>
                  <View style={s.sectorRight}>
                    <Text style={s.sectorPct}>{sec.pct}%</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
                  </View>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      {/* ── Divider ── */}
      <View style={s.divider} />

      {/* ── Settings / Account section ── */}
      <View style={s.settingsSection}>
        <Text style={s.settingsTitle}>Cuenta</Text>

        <MenuItem
          icon="card-outline"
          label="Datos bancarios"
          onPress={() => router.push("/(app)/account")}
        />
        <MenuItem
          icon="shield-checkmark-outline"
          label="Seguridad"
          onPress={() => router.push("/(app)/account")}
        />
        <MenuItem
          icon="help-circle-outline"
          label="Ayuda"
          onPress={() => router.push("/(app)/support")}
        />
        <MenuItem
          icon="document-text-outline"
          label="Legal"
          onPress={() => router.push("/(app)/account")}
        />
        <MenuItem
          icon="log-out-outline"
          label="Cerrar sesión"
          onPress={logout}
          danger
        />
      </View>

      {/* ── Disclaimer ── */}
      <View style={s.disclaimer}>
        <Text style={s.disclaimerText}>
          Todas las inversiones implican riesgo, incluyendo la posible pérdida del capital. Los valores negociables están ofrecidos a través de Álamos Capital S.A., agente registrado ante la CNV.
        </Text>
      </View>
    </ScrollView>
  );
}

/* ─── MenuItem subcomponent ─── */
interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  danger?: boolean;
}

function MenuItem({ icon, label, onPress, danger }: MenuItemProps) {
  return (
    <Pressable style={s.menuItem} onPress={onPress}>
      <View style={s.menuLeft}>
        <View style={[s.menuIconBox, danger && s.menuIconBoxDanger]}>
          <Ionicons name={icon} size={18} color={danger ? colors.red : colors.text.secondary} />
        </View>
        <Text style={[s.menuLabel, danger && { color: colors.red }]}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },

  /* Top bar */
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  topBarRight: { flexDirection: "row", gap: 20 },

  /* Profile */
  profileSection: {
    alignItems: "center",
    paddingVertical: 20,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text.primary,
  },
  avatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface[100],
    borderWidth: 2,
    borderColor: colors.surface[0],
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 4,
  },
  editProfile: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
    textDecorationLine: "underline",
  },

  /* Total value */
  totalSection: {
    backgroundColor: colors.surface[100],
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: "center",
  },
  totalValue: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },

  /* Investing breakdown */
  investingSection: {
    backgroundColor: colors.surface[100],
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  investingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingTop: 8,
  },
  investingTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  breakdownLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
  },

  /* Tabs */
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
    gap: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.text.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.muted,
  },
  tabTextActive: {
    color: colors.text.primary,
    fontWeight: "700",
  },

  /* Bubble chart */
  bubbleArea: {
    height: 240,
    paddingHorizontal: 40,
    paddingTop: 30,
    position: "relative",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  bubbleMain: {
    backgroundColor: colors.text.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleMainPct: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.surface[0],
    letterSpacing: -0.5,
  },
  bubbleMainLabel: {
    fontSize: 13,
    color: colors.surface[0],
    fontWeight: "500",
    marginTop: 2,
  },
  bubbleSmall: {
    backgroundColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleSmPct: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.primary,
  },
  bubbleSmLabel: {
    fontSize: 10,
    color: colors.text.secondary,
    marginTop: 1,
  },

  /* Description */
  descSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  descText: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: 8,
  },
  learnMore: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.primary,
    textDecorationLine: "underline",
  },

  /* Category pills */
  pillsScroll: {
    paddingHorizontal: 20,
    gap: 10,
    paddingBottom: 20,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface[100],
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillIcon: {
    fontSize: 18,
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text.primary,
  },

  /* Divider */
  divider: {
    height: 6,
    backgroundColor: colors.surface[100],
    marginVertical: 4,
  },

  /* Sector breakdown */
  sectorSection: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sectorRowHighlight: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface[100],
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 4,
  },
  sectorNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectorName: {
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: "500",
  },
  sectorRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectorPct: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
  },

  /* Settings */
  settingsSection: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  settingsTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconBoxDanger: {
    backgroundColor: colors.redDim,
    borderColor: "transparent",
  },
  menuLabel: {
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: "500",
  },

  /* Disclaimer */
  disclaimer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  disclaimerText: {
    fontSize: 12,
    color: colors.text.muted,
    lineHeight: 18,
  },
});
