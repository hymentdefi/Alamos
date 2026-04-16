import { useState } from "react";
import {
  View, Text, Pressable, ScrollView, Switch, Modal, StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth/context";
import { colors } from "../../lib/theme";

/* ─── Sub-screen type ─── */
type SubScreen =
  | null
  | "notifications"
  | "appearance"
  | "security"
  | "options"
  | "dayTrade"
  | "crypto"
  | "recurring"
  | "drip"
  | "support";

/* ─── Options feature list ─── */
interface OptionFeature {
  label: string;
  enabled: boolean;
}

const optionFeatures: OptionFeature[] = [
  { label: "Comprar Calls y Puts", enabled: true },
  { label: "Vender Calls cubiertos", enabled: true },
  { label: "Vender Puts cubiertos", enabled: true },
  { label: "Ejercer opciones", enabled: true },
  { label: "Comprar y vender Spreads", enabled: false },
];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const [sub, setSub] = useState<SubScreen>(null);

  /* ── Modal states ── */
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showCashSweepModal, setShowCashSweepModal] = useState(false);

  /* ── Toggle states ── */
  const [notifPrices, setNotifPrices] = useState(true);
  const [notifOrders, setNotifOrders] = useState(true);
  const [notifNews, setNotifNews] = useState(true);
  const [notifDividends, setNotifDividends] = useState(true);
  const [notifPromo, setNotifPromo] = useState(false);

  const [appearance, setAppearance] = useState<"dark" | "light" | "system">("dark");

  const [pdtProtection, setPdtProtection] = useState(true);
  const [tradeOnExpiry, setTradeOnExpiry] = useState(true);
  const [dripEnabled, setDripEnabled] = useState(false);

  const initials = user?.fullName
    ? user.fullName.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase()
    : "??";

  /* ── Go back: if sub-screen, go to menu; else router.back ── */
  const handleBack = () => {
    if (sub) {
      setSub(null);
    } else {
      router.back();
    }
  };

  /* ════════════════════════════════════════
     MAIN MENU
     ════════════════════════════════════════ */
  const renderMenu = () => (
    <>
      {/* Avatar + name */}
      <View style={s.profileRow}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.profileName}>{user?.fullName || "Usuario"}</Text>
          <Text style={s.profileEmail}>{user?.email || "usuario@alamos.com"}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
      </View>

      <View style={s.menuDivider} />

      {/* ── Navigation items ── */}
      <MenuNavItem
        icon="trending-up-outline"
        label="Inversiones"
        subtitle="Saldos, recurrentes, DRIP, préstamo"
        onPress={() => router.push("/(app)/account")}
      />
      <MenuNavItem
        icon="logo-bitcoin"
        label="Crypto"
        subtitle="Límites de transferencia"
        onPress={() => setSub("crypto")}
      />
      <MenuNavItem
        icon="swap-horizontal-outline"
        label="Transferencias"
        subtitle="Depósitos, retiros, transferencias"
        onPress={() => router.push("/(app)/transfer")}
      />
      <MenuNavItem
        icon="time-outline"
        label="Historial"
        subtitle="Actividad de todas las cuentas"
        onPress={() => {}}
      />
      <MenuNavItem
        icon="document-text-outline"
        label="Extractos"
        subtitle="Documentos"
        onPress={() => {}}
      />
      <MenuNavItem
        icon="receipt-outline"
        label="Centro de impuestos"
        subtitle="Documentos fiscales"
        onPress={() => {}}
      />
      <MenuNavItem
        icon="shield-checkmark-outline"
        label="Seguridad y privacidad"
        subtitle="Contraseña, 2FA, datos"
        onPress={() => router.push("/(app)/security")}
      />

      <View style={s.menuDivider} />

      {/* ── Settings sub-section ── */}
      <Text style={s.menuGroupTitle}>Configuración</Text>

      <MenuNavItem
        icon="notifications-outline"
        label="Notificaciones y mensajes"
        onPress={() => setSub("notifications")}
      />
      <MenuNavItem
        icon="color-palette-outline"
        label="Apariencia"
        onPress={() => setSub("appearance")}
      />
      <MenuNavItem
        icon="analytics-outline"
        label="Opciones de trading"
        onPress={() => setSub("options")}
      />
      <MenuNavItem
        icon="flash-outline"
        label="Day trading"
        onPress={() => setSub("dayTrade")}
      />
      <MenuNavItem
        icon="repeat-outline"
        label="Inversiones recurrentes"
        onPress={() => setSub("recurring")}
      />
      <MenuNavItem
        icon="git-branch-outline"
        label="Reinversión de dividendos"
        onPress={() => setSub("drip")}
      />
      <MenuNavItem
        icon="trending-up-outline"
        label="Inversión con margen"
        onPress={() => router.push("/(app)/margin")}
      />

      <View style={s.menuDivider} />

      {/* ── Support ── */}
      <MenuNavItem
        icon="chatbubble-ellipses-outline"
        label="Soporte Álamos"
        subtitle="Centro de ayuda, contacto 24/7"
        onPress={() => router.push("/(app)/support")}
      />

      {/* ── Logout ── */}
      <Pressable style={s.logoutBtn} onPress={() => setShowLogoutConfirm(true)}>
        <Text style={s.logoutBtnText}>Cerrar sesión</Text>
      </Pressable>
    </>
  );

  /* ════════════════════════════════════════
     SUB: Notifications
     ════════════════════════════════════════ */
  const renderNotifications = () => (
    <View style={s.subContent}>
      <Text style={s.subTitle}>Notificaciones y mensajes</Text>
      <Text style={s.subDesc}>
        Elegí qué notificaciones querés recibir sobre tu cuenta y el mercado.
      </Text>

      <ToggleRow
        label="Alertas de precio"
        subtitle="Cuando un activo alcanza tu precio objetivo"
        value={notifPrices}
        onValueChange={setNotifPrices}
      />
      <ToggleRow
        label="Órdenes ejecutadas"
        subtitle="Confirmaciones de compra y venta"
        value={notifOrders}
        onValueChange={setNotifOrders}
      />
      <ToggleRow
        label="Noticias del mercado"
        subtitle="Noticias relevantes sobre tus activos"
        value={notifNews}
        onValueChange={setNotifNews}
      />
      <ToggleRow
        label="Dividendos y cupones"
        subtitle="Pagos de dividendos y vencimientos de bonos"
        value={notifDividends}
        onValueChange={setNotifDividends}
      />
      <ToggleRow
        label="Promociones y novedades"
        subtitle="Nuevas funcionalidades y ofertas"
        value={notifPromo}
        onValueChange={setNotifPromo}
      />
    </View>
  );

  /* ════════════════════════════════════════
     SUB: Appearance
     ════════════════════════════════════════ */
  const renderAppearance = () => (
    <View style={s.subContent}>
      <Text style={s.subTitle}>Apariencia</Text>
      <Text style={s.subDesc}>
        Elegí cómo se ve la app.
      </Text>

      {(["dark", "light", "system"] as const).map((opt) => {
        const labels = { dark: "Oscuro", light: "Claro", system: "Sistema" };
        const icons = {
          dark: "moon-outline" as const,
          light: "sunny-outline" as const,
          system: "phone-portrait-outline" as const,
        };
        return (
          <Pressable
            key={opt}
            style={s.radioRow}
            onPress={() => setAppearance(opt)}
          >
            <View style={s.radioLeft}>
              <View style={s.radioIconBox}>
                <Ionicons name={icons[opt]} size={20} color={colors.text.secondary} />
              </View>
              <Text style={s.radioLabel}>{labels[opt]}</Text>
            </View>
            <View style={[s.radio, appearance === opt && s.radioActive]}>
              {appearance === opt && <View style={s.radioDot} />}
            </View>
          </Pressable>
        );
      })}

      <View style={s.infoCard}>
        <Ionicons name="information-circle-outline" size={18} color={colors.text.muted} />
        <Text style={s.infoCardText}>
          Actualmente solo el modo oscuro está disponible. Próximamente más opciones.
        </Text>
      </View>
    </View>
  );

  /* ════════════════════════════════════════
     SUB: Security
     ════════════════════════════════════════ */
  const renderSecurity = () => (
    <View style={s.subContent}>
      <Text style={s.subTitle}>Seguridad y privacidad</Text>

      <SettingNavRow
        icon="key-outline"
        label="Cambiar contraseña"
        onPress={() => {}}
      />
      <SettingNavRow
        icon="shield-checkmark-outline"
        label="Verificación en dos pasos"
        subtitle="Activada"
        onPress={() => {}}
      />
      <SettingNavRow
        icon="finger-print-outline"
        label="Autenticación biométrica"
        subtitle="Face ID / Touch ID"
        onPress={() => {}}
      />
      <SettingNavRow
        icon="phone-portrait-outline"
        label="Dispositivos autorizados"
        subtitle="1 dispositivo"
        onPress={() => {}}
      />

      <View style={s.subDivider} />

      <Text style={s.subGroupTitle}>Privacidad</Text>

      <SettingNavRow
        icon="eye-off-outline"
        label="Compartir datos de uso"
        subtitle="Ayudanos a mejorar la app"
        onPress={() => {}}
      />
      <SettingNavRow
        icon="document-lock-outline"
        label="Descargar mis datos"
        onPress={() => {}}
      />
      <SettingNavRow
        icon="trash-outline"
        label="Eliminar mi cuenta"
        danger
        onPress={() => {}}
      />
    </View>
  );

  /* ════════════════════════════════════════
     SUB: Options Settings
     ════════════════════════════════════════ */
  const renderOptions = () => (
    <View style={s.subContent}>
      <Text style={s.subTitle}>Opciones de trading</Text>

      {/* Level */}
      <View style={s.levelRow}>
        <Text style={s.levelLabel}>Nivel 2</Text>
        <Pressable>
          <Text style={s.upgradeLink}>Solicitar upgrade</Text>
        </Pressable>
      </View>

      {/* Features */}
      {optionFeatures.map((f, i) => (
        <View key={i} style={s.featureRow}>
          <Ionicons
            name={f.enabled ? "checkmark-circle" : "close-circle"}
            size={22}
            color={f.enabled ? colors.brand[500] : colors.red}
          />
          <Text style={[s.featureLabel, !f.enabled && s.featureLabelDisabled]}>
            {f.label}
          </Text>
        </View>
      ))}

      <View style={s.subDivider} />

      {/* Trade on expiration toggle */}
      <ToggleRow
        label="Operar en fecha de vencimiento"
        subtitle="Podés abrir nuevas posiciones de opciones hasta las 15:00 en la fecha de vencimiento."
        value={tradeOnExpiry}
        onValueChange={setTradeOnExpiry}
      />

      <Pressable style={s.dangerBtn}>
        <Text style={s.dangerBtnText}>Desactivar trading de opciones</Text>
      </Pressable>
    </View>
  );

  /* ════════════════════════════════════════
     SUB: Day Trading
     ════════════════════════════════════════ */
  const renderDayTrade = () => (
    <View style={s.subContent}>
      <Text style={s.subTitle}>Day trading y restricciones</Text>

      <Text style={s.subDesc}>
        Según las regulaciones de la CNV, si realizás 4 o más operaciones intradiarias en 5 días hábiles, podés ser marcado como day trader patrón (PDT). Esto solo aplica a cuentas con margen.{" "}
        <Text style={s.linkText}>Más información</Text>
      </Text>

      <Text style={s.subDesc}>
        Si sos marcado como PDT, vas a tener restricciones para operar intradía si tu cuenta termina el día con menos de $25.000 USD (sin incluir crypto).
      </Text>

      <Text style={s.subDesc}>
        Para prevenir restricciones, podés activar la protección PDT o cambiar a una cuenta sin margen.
      </Text>

      {/* Stats */}
      <View style={s.statRow}>
        <Text style={s.statLabel}>Operaciones intradiarias realizadas</Text>
        <Text style={s.statValue}>0 de 3</Text>
      </View>

      <View style={s.subDivider} />

      <ToggleRow
        label="Protección Pattern Day Trade"
        subtitle="Te alertamos cuando estés por alcanzar el límite de operaciones intradiarias."
        value={pdtProtection}
        onValueChange={setPdtProtection}
      />

      <View style={s.subDivider} />

      <Text style={s.subGroupTitle}>Cambiar a cuenta sin margen</Text>
      <Text style={s.subDesc}>
        Si cambiás a una cuenta sin margen, no vas a estar sujeto a las restricciones PDT. Sin embargo, vas a perder acceso a depósitos instantáneos y otras funcionalidades.
      </Text>

      <Pressable style={s.outlineBtn}>
        <Text style={s.outlineBtnText}>Cambiar a cuenta sin margen</Text>
      </Pressable>
    </View>
  );

  /* ════════════════════════════════════════
     SUB: Crypto Settings
     ════════════════════════════════════════ */
  const renderCrypto = () => (
    <View style={s.subContent}>
      <Text style={s.subTitle}>Configuración Crypto</Text>

      <Text style={s.cryptoSectionTitle}>Límites de transferencia</Text>

      <View style={s.cryptoEmptyArea}>
        <View style={s.lockIconCircle}>
          <Ionicons name="lock-closed" size={28} color={colors.text.muted} />
        </View>
        <Text style={s.cryptoEmptyText}>
          Activá las transferencias crypto para empezar a enviar y recibir criptomonedas.
        </Text>
      </View>

      <Pressable style={s.primaryBtn}>
        <Text style={s.primaryBtnText}>Activar transferencias blockchain</Text>
      </Pressable>
    </View>
  );

  /* ════════════════════════════════════════
     SUB: Recurring Investments
     ════════════════════════════════════════ */
  const renderRecurring = () => (
    <View style={s.subContent}>
      <Text style={s.subTitle}>Inversiones recurrentes</Text>

      {/* Stats grid */}
      <View style={s.statsGrid}>
        <View style={s.statsCell}>
          <Text style={s.statsCellLabel}>Próxima orden</Text>
          <Text style={s.statsCellValue}>—</Text>
        </View>
        <View style={s.statsCell}>
          <Text style={s.statsCellLabel}>Total invertido</Text>
          <Text style={s.statsCellValue}>$0</Text>
        </View>
        <View style={s.statsCell}>
          <Text style={s.statsCellLabel}>Activas</Text>
          <Text style={s.statsCellValue}>0</Text>
        </View>
        <View style={s.statsCell}>
          <Text style={s.statsCellLabel}>Pausadas</Text>
          <Text style={s.statsCellValue}>0</Text>
        </View>
      </View>

      <View style={s.subDivider} />

      {/* Stocks section */}
      <Text style={s.recSectionTitle}>Acciones y CEDEARs</Text>
      <Text style={s.subDesc}>
        Creá una inversión recurrente en acciones o CEDEARs y va a aparecer acá.
      </Text>

      <View style={s.subDivider} />

      {/* Bonds section */}
      <Text style={s.recSectionTitle}>Bonos</Text>
      <Text style={s.subDesc}>
        Creá una inversión recurrente en bonos y va a aparecer acá.
      </Text>

      <View style={s.subDivider} />

      {/* Crypto section */}
      <Text style={s.recSectionTitle}>Criptomonedas</Text>
      <Text style={s.subDesc}>
        Creá una inversión recurrente en criptomonedas y va a aparecer acá.{" "}
        <Text style={s.linkText}>Explorá criptomonedas</Text>
      </Text>

      <Pressable style={s.greenBtn}>
        <Text style={s.greenBtnText}>Crear inversión recurrente</Text>
      </Pressable>
    </View>
  );

  /* ════════════════════════════════════════
     SUB: DRIP
     ════════════════════════════════════════ */
  const renderDrip = () => (
    <View style={s.subContent}>
      <Text style={s.subTitle}>Cuenta comitente</Text>

      <ToggleRow
        label="Reinversión de dividendos"
        subtitle=""
        value={dripEnabled}
        onValueChange={setDripEnabled}
      />

      <Text style={s.subDesc}>
        La reinversión de dividendos (DRIP) reinvierte automáticamente los pagos de dividendos en acciones adicionales del activo subyacente.{" "}
        <Text style={s.linkText}>Más información</Text>
      </Text>
    </View>
  );

  /* ════════════════════════════════════════
     SUB: Support
     ════════════════════════════════════════ */
  const renderSupport = () => (
    <View style={s.subContent}>
      <Text style={s.subTitle}>Soporte Álamos</Text>

      <SettingNavRow
        icon="help-circle-outline"
        label="Centro de ayuda"
        subtitle="Preguntas frecuentes y guías"
        onPress={() => {}}
      />
      <SettingNavRow
        icon="chatbubble-outline"
        label="Contactanos"
        subtitle="Chat disponible 24/7"
        onPress={() => {}}
      />
      <SettingNavRow
        icon="chatbubbles-outline"
        label="Tus conversaciones"
        subtitle="Historial de soporte"
        onPress={() => {}}
      />

      <View style={s.subDivider} />

      <View style={s.infoCard}>
        <Ionicons name="call-outline" size={18} color={colors.text.muted} />
        <Text style={s.infoCardText}>
          También podés llamarnos al 0800-555-ALMS (2567) de lunes a viernes de 9 a 18 hs.
        </Text>
      </View>
    </View>
  );

  /* ── Sub-screen router ── */
  const renderSubScreen = () => {
    switch (sub) {
      case "notifications": return renderNotifications();
      case "appearance": return renderAppearance();
      case "security": return renderSecurity();
      case "options": return renderOptions();
      case "dayTrade": return renderDayTrade();
      case "crypto": return renderCrypto();
      case "recurring": return renderRecurring();
      case "drip": return renderDrip();
      case "support": return renderSupport();
      default: return null;
    }
  };

  const subTitles: Record<string, string> = {
    notifications: "Notificaciones",
    appearance: "Apariencia",
    security: "Seguridad",
    options: "Opciones",
    dayTrade: "Day trading",
    crypto: "Crypto",
    recurring: "Recurrentes",
    drip: "Dividendos",
    support: "Soporte",
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={s.header}>
        {sub ? (
          <Pressable onPress={handleBack} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.brand[500]} />
          </Pressable>
        ) : (
          <View style={{ width: 26 }} />
        )}
        <Text style={s.headerTitle}>
          {sub ? subTitles[sub] || "Configuración" : "Perfil"}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {sub ? renderSubScreen() : renderMenu()}
      </ScrollView>

      {/* ═══ Logout confirmation modal ═══ */}
      <Modal
        visible={showLogoutConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutConfirm(false)}
      >
        <Pressable style={s.overlay} onPress={() => setShowLogoutConfirm(false)} />
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>¿Cerrar sesión?</Text>
          <Text style={s.modalDesc}>
            Vas a necesitar tu contraseña para volver a ingresar.
          </Text>
          <Pressable
            style={s.modalPrimaryBtn}
            onPress={() => {
              setShowLogoutConfirm(false);
              logout();
            }}
          >
            <Text style={s.modalPrimaryBtnText}>Sí, cerrar sesión</Text>
          </Pressable>
          <Pressable
            style={s.modalSecondaryBtn}
            onPress={() => setShowLogoutConfirm(false)}
          >
            <Text style={s.modalSecondaryBtnText}>Cancelar</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

/* ─── MenuNavItem subcomponent ─── */
interface MenuNavItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress: () => void;
}

function MenuNavItem({ icon, label, subtitle, onPress }: MenuNavItemProps) {
  return (
    <Pressable style={s.menuItem} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={s.menuItemLabel}>{label}</Text>
        {subtitle ? <Text style={s.menuItemSub}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
    </Pressable>
  );
}

/* ─── ToggleRow subcomponent ─── */
interface ToggleRowProps {
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}

function ToggleRow({ label, subtitle, value, onValueChange }: ToggleRowProps) {
  return (
    <View style={s.toggleRow}>
      <View style={{ flex: 1, marginRight: 16 }}>
        <Text style={s.toggleLabel}>{label}</Text>
        {subtitle ? <Text style={s.toggleSub}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.surface[200], true: colors.brand[500] }}
        thumbColor={colors.text.primary}
        style={{ transform: [{ scale: 0.9 }] }}
      />
    </View>
  );
}

/* ─── SettingNavRow subcomponent ─── */
interface SettingNavRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  danger?: boolean;
  onPress: () => void;
}

function SettingNavRow({ icon, label, subtitle, danger, onPress }: SettingNavRowProps) {
  return (
    <Pressable style={s.settingNavRow} onPress={onPress}>
      <View style={[s.settingNavIcon, danger && s.settingNavIconDanger]}>
        <Ionicons
          name={icon}
          size={18}
          color={danger ? colors.red : colors.text.secondary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.settingNavLabel, danger && { color: colors.red }]}>
          {label}
        </Text>
        {subtitle ? <Text style={s.settingNavSub}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
    </Pressable>
  );
}

/* ─── Styles ─── */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface[0] },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },

  /* Profile row */
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface[200],
    borderWidth: 2,
    borderColor: colors.brand[700],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text.primary,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 14,
    color: colors.text.secondary,
  },

  /* Menu items */
  menuDivider: {
    height: 6,
    backgroundColor: colors.surface[100],
  },
  menuGroupTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 3,
  },
  menuItemSub: {
    fontSize: 13,
    color: colors.text.secondary,
  },

  /* Logout */
  logoutBtn: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 20,
    marginTop: 30,
    marginBottom: 20,
  },
  logoutBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },

  /* Sub-screen content */
  subContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  subTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  subDesc: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  subGroupTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 8,
    marginTop: 4,
  },
  subDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  linkText: {
    color: colors.brand[500],
    fontWeight: "600",
    textDecorationLine: "underline",
  },

  /* Toggle rows */
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 3,
  },
  toggleSub: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },

  /* Radio options (appearance) */
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  radioLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  radioIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface[100],
    alignItems: "center",
    justifyContent: "center",
  },
  radioLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.text.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: colors.text.primary,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.text.primary,
  },

  /* Info card */
  infoCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.surface[100],
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  infoCardText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },

  /* Setting nav row */
  settingNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingNavIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface[100],
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  settingNavIconDanger: {
    backgroundColor: colors.redDim,
    borderColor: "transparent",
  },
  settingNavLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.text.primary,
  },
  settingNavSub: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },

  /* Options features */
  levelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 16,
  },
  levelLabel: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text.primary,
  },
  upgradeLink: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.brand[500],
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
  },
  featureLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: colors.text.primary,
  },
  featureLabelDisabled: {
    color: colors.text.muted,
  },

  /* Stat rows */
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text.primary,
  },

  /* Stats grid (recurring) */
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  statsCell: {
    width: "50%",
    paddingVertical: 14,
  },
  statsCellLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  statsCellValue: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text.primary,
  },

  /* Recurring sections */
  recSectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 8,
  },

  /* Crypto empty */
  cryptoSectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text.primary,
    marginBottom: 16,
  },
  cryptoEmptyArea: {
    alignItems: "center",
    paddingVertical: 60,
  },
  lockIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  cryptoEmptyText: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },

  /* Buttons */
  outlineBtn: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: colors.surface[200],
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  outlineBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.text.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.surface[0],
  },
  greenBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand[500],
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  greenBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.surface[0],
  },
  dangerBtn: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: colors.red,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  dangerBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.red,
  },

  /* Modal */
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
  },
  modalCard: {
    position: "absolute",
    left: 24,
    right: 24,
    top: "30%",
    backgroundColor: colors.surface[100],
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text.primary,
    marginBottom: 12,
    textAlign: "center",
  },
  modalDesc: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
  },
  modalPrimaryBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand[700],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  modalPrimaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },
  modalSecondaryBtn: {
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.brand[500],
  },
});
