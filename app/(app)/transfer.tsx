import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme, fontFamily, radius } from "../../lib/theme";
import { useAuth } from "../../lib/auth/context";
import { Tap } from "../../lib/components/Tap";
import { FlagIcon } from "../../lib/components/FlagIcon";
import { PercentSlider } from "../../lib/components/PercentSlider";

/** Balances disponibles por moneda — mockeados. */
const BALANCES = {
  ars: 342180,
  usd: 1250,
};

/** Datos propios para recibir transferencias — mockeados por ahora. */
const RECEIVE = {
  ars: {
    alias: "chris.alamos.ars",
    cvu: "0000003100083868047594",
    legend: null as string | null,
  },
  usd: {
    alias: "aceite.ronco.inca",
    cvu: "3220001888042412530014",
    legend:
      "Al ingresar o transferir dólares, se verá como destino al Banco Industrial (BIND).",
  },
};

/** Cuentas externas vinculadas del usuario. Por ahora un mock; la idea
 *  es que el usuario pueda agregar más desde acá. */
interface LinkedAccount {
  id: string;
  bankName: string;
  accountType: string;
  tail: string;
  alias: string;
  cbu: string;
  currency: "ars" | "usd";
}

const LINKED_ACCOUNTS: LinkedAccount[] = [
  {
    id: "galicia-ars",
    bankName: "Banco Galicia",
    accountType: "Caja de ahorro en $",
    tail: "3847",
    alias: "alamos.christian.ars",
    cbu: "0070•••••••••••••3847",
    currency: "ars",
  },
  {
    id: "santander-usd",
    bankName: "Banco Santander",
    accountType: "Caja de ahorro en US$",
    tail: "9012",
    alias: "chris.santander.usd",
    cbu: "0720•••••••••••••9012",
    currency: "usd",
  },
];

type DepositCurrency = "ars" | "usd";

export default function TransferScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  // Ya no hay 'hub' — la pantalla default es la de depósito (alias + CVU).
  // Si vienen con mode=send (o el viejo 'withdraw' por compat), se
  // abre el flow de envío en 3 pasos.
  if (mode === "send" || mode === "withdraw") return <SendFlow />;
  return <DepositInfo />;
}

/* ─── Deposit info: alias + CVU para recibir ARS/USD ─── */

function DepositInfo() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [cur, setCur] = useState<DepositCurrency>("ars");

  const data = RECEIVE[cur];
  const linkedForCur = LINKED_ACCOUNTS.filter((a) => a.currency === cur);

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={18} color={c.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: c.text }]}>Ingresar dinero</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[s.depositTitle, { color: c.text }]}>
          Ingresá dinero con tus datos
        </Text>

        {/* Pill switch Pesos / Dólares con banderas AR/US. */}
        <View style={s.curPillsWrap}>
          <View style={[s.curPills, { backgroundColor: c.surfaceHover }]}>
            <CurPill
              label="Pesos"
              flag="AR"
              active={cur === "ars"}
              onPress={() => {
                if (cur !== "ars") Haptics.selectionAsync().catch(() => {});
                setCur("ars");
              }}
            />
            <CurPill
              label="Dólares"
              flag="US"
              active={cur === "usd"}
              onPress={() => {
                if (cur !== "usd") Haptics.selectionAsync().catch(() => {});
                setCur("usd");
              }}
            />
          </View>
        </View>

        {/* ── Card 1: tus datos de recepción ── */}
        <Text style={[s.depositEyebrow, { color: c.text }]}>
          Desde un banco o billetera
        </Text>
        <View
          style={[
            s.depositCard,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <CopyRow label="Alias" value={data.alias} onCopy={copyHaptic} />
          <View style={[s.depositRowDivider, { backgroundColor: c.border }]} />
          <CopyRow
            label={cur === "ars" ? "CVU" : "CBU"}
            value={data.cvu}
            mono
            onCopy={copyHaptic}
          />
          {data.legend ? (
            <>
              <View
                style={[s.depositRowDivider, { backgroundColor: c.border }]}
              />
              <Text style={[s.depositLegend, { color: c.textMuted }]}>
                {data.legend}
              </Text>
            </>
          ) : null}
        </View>

        {/* ── Card 2: cuentas vinculadas (externas) del usuario ── */}
        <Text style={[s.depositEyebrow, { color: c.text, marginTop: 28 }]}>
          Desde cuentas vinculadas
        </Text>
        {linkedForCur.length > 0 ? (
          <View
            style={[
              s.depositCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            {linkedForCur.map((acc, i) => (
              <View key={acc.id}>
                {i > 0 ? (
                  <View
                    style={[
                      s.depositRowDivider,
                      { backgroundColor: c.border },
                    ]}
                  />
                ) : null}
                <LinkedAccountRow acc={acc} />
              </View>
            ))}
          </View>
        ) : (
          <View
            style={[
              s.depositCard,
              s.emptyLinkedCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={[s.emptyLinkedText, { color: c.textMuted }]}>
              Todavía no tenés cuentas{" "}
              {cur === "ars" ? "en pesos" : "en dólares"} vinculadas.
            </Text>
          </View>
        )}

        <Tap
          style={s.addAccountBtn}
          haptic="light"
          onPress={() => {
            /* Flow de agregar cuenta — TODO: wizard. */
          }}
        >
          <Feather name="plus" size={16} color={c.text} />
          <Text style={[s.addAccountText, { color: c.text }]}>
            Agregar otra cuenta
          </Text>
        </Tap>

        <View
          style={[
            s.noteCard,
            {
              backgroundColor: c.surfaceHover,
              borderColor: c.border,
              marginTop: 20,
            },
          ]}
        >
          <Feather name="clock" size={14} color={c.textSecondary} />
          <Text style={[s.noteText, { color: c.textSecondary }]}>
            Los ingresos acreditan de inmediato cuando el banco confirme la
            transferencia.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function copyHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function CurPill({
  label,
  flag,
  active,
  onPress,
}: {
  label: string;
  flag: "AR" | "US";
  active: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.curPill,
        active && {
          backgroundColor: c.surface,
          shadowColor: c.ink,
          shadowOpacity: 0.08,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        },
      ]}
    >
      <View style={{ opacity: active ? 1 : 0.6 }}>
        <FlagIcon code={flag} size={22} />
      </View>
      <Text
        style={[s.curPillLabel, { color: active ? c.text : c.textMuted }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function CopyRow({
  label,
  value,
  mono,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy: () => void;
}) {
  const { c } = useTheme();
  return (
    <View style={s.copyRow}>
      <View style={{ flex: 1 }}>
        <Text style={[s.copyLabel, { color: c.textMuted }]}>{label}</Text>
        <Text
          style={[
            s.copyValue,
            { color: c.text },
            mono && { letterSpacing: 0.2 },
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
      <Tap
        haptic="light"
        onPress={onCopy}
        style={[s.copyBtn, { backgroundColor: c.surfaceHover }]}
        hitSlop={8}
      >
        <Feather name="copy" size={16} color={c.greenDark} />
      </Tap>
    </View>
  );
}

function LinkedAccountRow({ acc }: { acc: LinkedAccount }) {
  const { c } = useTheme();
  return (
    <View style={s.linkedRow}>
      <View style={[s.linkedIcon, { backgroundColor: c.surfaceHover }]}>
        <Feather name="home" size={16} color={c.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.linkedBank, { color: c.text }]} numberOfLines={1}>
          {acc.bankName}
        </Text>
        <Text style={[s.linkedSub, { color: c.textMuted }]} numberOfLines={1}>
          {acc.accountType} · ••••{acc.tail}
        </Text>
        <Text style={[s.linkedAlias, { color: c.textMuted }]} numberOfLines={1}>
          {acc.alias}
        </Text>
      </View>
      <Tap
        haptic="light"
        onPress={copyHaptic}
        style={[s.copyBtn, { backgroundColor: c.surfaceHover }]}
        hitSlop={8}
      >
        <Feather name="copy" size={16} color={c.greenDark} />
      </Tap>
    </View>
  );
}

/* ─── Send flow: enviar plata a una cuenta vinculada ───
   Tres pasos: (1) elegir moneda + monto, (2) elegir destino,
   (3) confirmación/success. */

const keys = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "back"],
] as const;

type SendStep = "amount" | "destination" | "done";

function formatMoney(value: number, cur: DepositCurrency): string {
  const num = value.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return cur === "ars" ? `$ ${num}` : `US$ ${num}`;
}

function SendFlow() {
  const [step, setStep] = useState<SendStep>("amount");
  const [cur, setCur] = useState<DepositCurrency>("ars");
  const [amount, setAmount] = useState("0");
  const [destination, setDestination] = useState<LinkedAccount | null>(null);

  const parsed = Number.parseFloat(amount) || 0;

  if (step === "done" && destination) {
    return (
      <SendSuccess cur={cur} amount={parsed} destination={destination} />
    );
  }

  if (step === "destination") {
    return (
      <DestinationStep
        cur={cur}
        amount={parsed}
        onBack={() => setStep("amount")}
        onPick={(d) => {
          setDestination(d);
          setStep("done");
        }}
      />
    );
  }

  return (
    <AmountStep
      cur={cur}
      onChangeCur={(v) => {
        setCur(v);
        setAmount("0");
      }}
      amount={amount}
      onChangeAmount={setAmount}
      onNext={() => setStep("destination")}
    />
  );
}

/* ─── Paso 1: monto + moneda ─── */

function AmountStep({
  cur,
  onChangeCur,
  amount,
  onChangeAmount,
  onNext,
}: {
  cur: DepositCurrency;
  onChangeCur: (v: DepositCurrency) => void;
  amount: string;
  onChangeAmount: (v: string) => void;
  onNext: () => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const max = BALANCES[cur];
  const parsed = Number.parseFloat(amount) || 0;
  const hasAmount = parsed > 0;
  const exceeds = parsed > max;

  const currentPct = useMemo(() => {
    if (max <= 0) return 0;
    return Math.min(100, (parsed / max) * 100);
  }, [parsed, max]);

  const applyPct = (pct: number) => {
    if (max <= 0) return;
    const ratio = pct / 100;
    // Para pesos redondeamos al entero; para dólares permitimos 2
    // decimales porque los montos son más chicos y 1 USD pesa.
    const raw = max * ratio;
    const v =
      pct >= 100
        ? Math.floor(max)
        : cur === "ars"
        ? Math.round(raw)
        : Math.round(raw * 100) / 100;
    onChangeAmount(String(v));
  };

  const handleKey = (k: string) => {
    if (k === "back") {
      onChangeAmount(amount.length <= 1 ? "0" : amount.slice(0, -1));
      return;
    }
    if (k === ".") {
      if (amount.includes(".")) return;
      onChangeAmount(amount + ".");
      return;
    }
    let next: string;
    if (amount === "0") {
      next = k;
    } else if (amount.includes(".") && amount.split(".")[1].length >= 2) {
      next = amount;
    } else {
      next = amount + k;
    }
    onChangeAmount(next);
  };

  const sign = cur === "ars" ? "$" : "US$";

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={18} color={c.text} />
        </Pressable>
        <Text style={[s.headerTitle, { color: c.text }]}>Enviar</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Pill Pesos / Dólares con banderas AR / US — mismo componente
          visual que la pantalla de Ingresar para mantener coherencia. */}
      <View style={s.curPillsWrap}>
        <View style={[s.curPills, { backgroundColor: c.surfaceHover }]}>
          <CurPill
            label="Pesos"
            flag="AR"
            active={cur === "ars"}
            onPress={() => {
              if (cur !== "ars") Haptics.selectionAsync().catch(() => {});
              onChangeCur("ars");
            }}
          />
          <CurPill
            label="Dólares"
            flag="US"
            active={cur === "usd"}
            onPress={() => {
              if (cur !== "usd") Haptics.selectionAsync().catch(() => {});
              onChangeCur("usd");
            }}
          />
        </View>
      </View>

      <View style={s.sendAmountSection}>
        <Text style={[s.amountLabel, { color: c.textMuted }]}>
          ¿Cuánto vas a mandar?
        </Text>
        <View style={s.amountRow}>
          <Text style={[s.amountSign, { color: c.textMuted }]}>{sign}</Text>
          <Text
            style={[s.amountValue, { color: exceeds ? c.red : c.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {Number.parseFloat(amount || "0").toLocaleString("es-AR", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}
            {amount.endsWith(".") ? "," : ""}
          </Text>
        </View>
        <Text style={[s.amountHint, { color: exceeds ? c.red : c.textMuted }]}>
          {exceeds
            ? `Supera el disponible (${formatMoney(max, cur)})`
            : `Disponible ${formatMoney(max, cur)}`}
        </Text>
      </View>

      <View style={s.sendSliderRow}>
        <PercentSlider
          value={currentPct}
          onChange={applyPct}
          disabled={max <= 0}
        />
      </View>

      <View style={s.keypad}>
        {keys.map((row, ri) => (
          <View key={ri} style={s.keyRow}>
            {row.map((k) => (
              <Tap
                key={k}
                onPress={() => handleKey(k)}
                haptic="selection"
                pressScale={0.92}
                style={s.keyBtn}
              >
                {k === "back" ? (
                  <Feather name="delete" size={22} color={c.text} />
                ) : (
                  <Text style={[s.keyText, { color: c.text }]}>{k}</Text>
                )}
              </Tap>
            ))}
          </View>
        ))}
      </View>

      <View style={[{ paddingBottom: insets.bottom + 14, paddingHorizontal: 20 }]}>
        <Pressable
          style={[
            s.cta,
            { backgroundColor: hasAmount && !exceeds ? c.ink : c.surfaceHover },
          ]}
          onPress={() => {
            if (!hasAmount || exceeds) return;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
              () => {},
            );
            onNext();
          }}
          disabled={!hasAmount || exceeds}
        >
          <Text
            style={[
              s.ctaText,
              { color: hasAmount && !exceeds ? c.bg : c.textMuted },
            ]}
          >
            Siguiente
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ─── Paso 2: destino ─── */

function DestinationStep({
  cur,
  amount,
  onBack,
  onPick,
}: {
  cur: DepositCurrency;
  amount: number;
  onBack: () => void;
  onPick: (acc: LinkedAccount) => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const accounts = LINKED_ACCOUNTS.filter((a) => a.currency === cur);

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
          onPress={onBack}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={18} color={c.text} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: c.text }]}>Enviar a</Text>
          <Text style={[s.headerSub, { color: c.textMuted }]}>
            {formatMoney(amount, cur)}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[s.destEyebrow, { color: c.text }]}>
          Tus cuentas vinculadas
        </Text>

        {accounts.length > 0 ? (
          <View
            style={[
              s.depositCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            {accounts.map((acc, i) => (
              <View key={acc.id}>
                {i > 0 ? (
                  <View
                    style={[
                      s.depositRowDivider,
                      { backgroundColor: c.border },
                    ]}
                  />
                ) : null}
                <Tap
                  haptic="light"
                  onPress={() => onPick(acc)}
                  style={s.destRow}
                >
                  <View style={[s.linkedIcon, { backgroundColor: c.surfaceHover }]}>
                    <Feather name="home" size={16} color={c.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.linkedBank, { color: c.text }]} numberOfLines={1}>
                      {acc.bankName}
                    </Text>
                    <Text style={[s.linkedSub, { color: c.textMuted }]} numberOfLines={1}>
                      {acc.accountType} · ••••{acc.tail}
                    </Text>
                    <Text style={[s.linkedAlias, { color: c.textMuted }]} numberOfLines={1}>
                      {acc.alias}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={c.textFaint} />
                </Tap>
              </View>
            ))}
          </View>
        ) : (
          <View
            style={[
              s.depositCard,
              s.emptyLinkedCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={[s.emptyLinkedText, { color: c.textMuted }]}>
              Todavía no tenés cuentas{" "}
              {cur === "ars" ? "en pesos" : "en dólares"} vinculadas.
            </Text>
          </View>
        )}

        <Tap
          style={s.addAccountBtn}
          haptic="light"
          onPress={() => {
            /* Flow de agregar cuenta — TODO wizard. */
          }}
        >
          <Feather name="plus" size={16} color={c.text} />
          <Text style={[s.addAccountText, { color: c.text }]}>
            Enviar a una cuenta nueva
          </Text>
        </Tap>
      </ScrollView>
    </View>
  );
}

/* ─── Paso 3: success ─── */

function SendSuccess({
  cur,
  amount,
  destination,
}: {
  cur: DepositCurrency;
  amount: number;
  destination: LinkedAccount;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top + 24 }]}>
      <View style={s.successBlock}>
        <View style={[s.checkCircle, { backgroundColor: c.green }]}>
          <Feather name="check" size={32} color={c.ink} />
        </View>
        <Text style={[s.successTitle, { color: c.text }]}>Enviado</Text>
        <Text style={[s.successBody, { color: c.textMuted }]}>
          Vamos a acreditar {formatMoney(amount, cur)} en{" "}
          {destination.bankName} (••••{destination.tail}) dentro de las
          próximas 24hs hábiles.
        </Text>
      </View>
      <View style={{ flex: 1 }} />
      <View style={[{ paddingBottom: insets.bottom + 14, paddingHorizontal: 20 }]}>
        <Pressable
          style={[s.cta, { backgroundColor: c.ink }]}
          onPress={() => router.replace("/(app)")}
        >
          <Text style={[s.ctaText, { color: c.bg }]}>Volver al inicio</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  headerSub: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    marginTop: 1,
  },

  /* Deposit info */
  depositTitle: {
    fontFamily: fontFamily[700],
    fontSize: 24,
    letterSpacing: -0.7,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  curPillsWrap: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  curPills: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radius.pill,
    gap: 4,
  },
  curPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  curPillLabel: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  depositEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  depositCard: {
    marginHorizontal: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  emptyLinkedCard: {
    paddingVertical: 18,
    alignItems: "center",
  },
  emptyLinkedText: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    textAlign: "center",
  },
  depositRowDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: -16,
  },
  copyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  copyLabel: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  copyValue: {
    fontFamily: fontFamily[700],
    fontSize: 16,
    letterSpacing: -0.2,
  },
  copyBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  depositLegend: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.1,
    paddingVertical: 12,
  },

  /* Linked account row */
  linkedRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  linkedIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  linkedBank: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  linkedSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.05,
  },
  linkedAlias: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.1,
  },
  addAccountBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 16,
    marginTop: 4,
  },
  addAccountText: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.15,
  },

  /* Note */
  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 20,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  noteText: {
    flex: 1,
    fontFamily: fontFamily[500],
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.1,
  },

  /* Send flow — paso 1 (monto + slider) */
  sendAmountSection: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  sendSliderRow: {
    paddingHorizontal: 28,
    paddingVertical: 6,
  },
  destEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
    paddingHorizontal: 20,
    paddingTop: 8,
    marginBottom: 10,
  },
  destRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },

  /* Amount flow legacy (reutilizado por send amount hero) */
  amountSection: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 12,
  },
  amountLabel: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingHorizontal: 24,
  },
  amountSign: {
    fontFamily: fontFamily[700],
    fontSize: 32,
    marginRight: 6,
  },
  amountValue: {
    fontFamily: fontFamily[700],
    fontSize: 58,
    letterSpacing: -2.4,
  },
  amountHint: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    marginTop: 8,
  },
  keypad: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  keyRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  keyBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: {
    fontFamily: fontFamily[600],
    fontSize: 26,
    letterSpacing: -0.5,
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

  /* Success */
  successBlock: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successTitle: {
    fontFamily: fontFamily[700],
    fontSize: 26,
    letterSpacing: -1,
    textAlign: "center",
    marginBottom: 10,
  },
  successBody: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.15,
    textAlign: "center",
  },
});
