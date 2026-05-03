import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Share,
  StyleSheet,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useTheme, fontFamily, radius } from "../../lib/theme";
import { Tap } from "../../lib/components/Tap";
import { PercentSlider } from "../../lib/components/PercentSlider";
import { AccountFlag } from "../../lib/components/AccountFlag";
import { accounts, formatAccountBalance, type AccountId } from "../../lib/data/accounts";

/** Balances disponibles por moneda — mockeados. */
const BALANCES = {
  ars: 342180,
  usd: 1250,
};

/** Datos para recibir transferencias bancarias en cuentas argentinas
 *  (ARS y USD MEP/normal). */
const RECEIVE_BANK_AR: Record<"ars-ar" | "usd-ar", {
  alias: string;
  cbu: string;
  legend: string | null;
}> = {
  "ars-ar": {
    alias: "chris.alamos.ars",
    cbu: "0000003100083868047594",
    legend: null,
  },
  "usd-ar": {
    alias: "aceite.ronco.inca",
    cbu: "3220001888042412530014",
    legend:
      "Al ingresar dólares en tu cuenta argentina, se verá como destino al Banco Industrial (BIND).",
  },
};

/** Datos para wire transfer internacional — cuenta USD en USA. */
const RECEIVE_WIRE_US = {
  beneficiary: "Christian Gramajo",
  bankName: "Mercury Business",
  bankAddress: "650 California St, San Francisco, CA 94108",
  routing: "084009519",
  account: "9876543210",
  swift: "CHASUS33XXX",
  memo: "ALAMOS-USR-12345",
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

/* ─── Deposit info: picker fiat + entrada Crypto ─── */

function DepositInfo() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // null = hub picker (4 cards). AccountId = detalle de esa moneda.
  const [kindId, setKindId] = useState<AccountId | null>(null);
  // Sub-flow de ingresar desde una cuenta vinculada (sólo bancarias AR).
  const [depositFrom, setDepositFrom] = useState<LinkedAccount | null>(null);

  if (depositFrom) {
    return (
      <DepositFromAccount
        account={depositFrom}
        onBack={() => setDepositFrom(null)}
      />
    );
  }

  // Detalle de una moneda elegida — back vuelve al hub.
  if (kindId) {
    return (
      <View style={[s.root, { backgroundColor: c.bg }]}>
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <Pressable
            style={s.iconBtn}
            onPress={() => setKindId(null)}
            hitSlop={12}
          >
            <Feather name="arrow-left" size={22} color={c.text} />
          </Pressable>
          <Text style={[s.headerTitle, { color: c.text }]}>
            Ingresar {kindId === "usdt-crypto" ? "USDT" : currencyLabelOf(kindId)}
          </Text>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {kindId === "usd-us" ? (
            <WireDepositCard />
          ) : kindId === "usdt-crypto" ? (
            <CryptoDepositRedirect />
          ) : (
            <BankDepositCard
              kind={kindId as "ars-ar" | "usd-ar"}
              onPickLinked={setDepositFrom}
            />
          )}
        </ScrollView>
      </View>
    );
  }

  // Hub picker — 4 floating cards 2×2.
  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.headerBare, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={s.backBtnBare}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={24} color={c.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[s.depositTitle, { color: c.text }]}>
          ¿Qué moneda querés{"\n"}ingresar?
        </Text>
        <Text style={[s.hubSub, { color: c.textMuted }]}>
          Elegí la cuenta donde vas a recibir.
        </Text>

        <CurrencyHubCards
          mode="deposit"
          onPick={(id) => {
            Haptics.selectionAsync().catch(() => {});
            // Crypto navega a su propia pantalla (asset + red picker)
            // con `push` — así el back nativo regresa al hub. Antes
            // usábamos `replace` desde un sub-componente y se
            // perdía el hub del stack.
            if (id === "usdt-crypto") {
              router.push("/(app)/crypto-deposit");
              return;
            }
            setKindId(id);
          }}
        />
      </ScrollView>
    </View>
  );
}

/** Mini-component: en lugar del crypto-deposit inline acá, redirige
 *  al screen dedicado (que tiene asset list + network picker). */
function CryptoDepositRedirect() {
  const { c } = useTheme();
  const router = useRouter();
  useEffect(() => {
    router.replace("/(app)/crypto-deposit");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={{ padding: 20 }}>
      <Text style={{ color: c.textMuted, fontFamily: fontFamily[500] }}>
        Abriendo crypto deposit…
      </Text>
    </View>
  );
}

function currencyLabelOf(id: AccountId): string {
  const a = accounts.find((x) => x.id === id);
  return a?.currency ?? "";
}

/* ─── Hub picker: 4 floating cards en grid 2×2 con AccountFlag ─── */

interface HubProps {
  mode: "deposit" | "send";
  onPick: (id: AccountId) => void;
}

function CurrencyHubCards({ mode, onPick }: HubProps) {
  const { mode: themeMode } = useTheme();
  const isDark = themeMode === "dark";
  // Backing del badge AR del flag usd-ar — blanco en light, gris
  // oscuro en dark. Mismo patrón que el AccountRow del home.
  const badgeBacking = isDark ? "#1F1F1E" : "#FFFFFF";

  return (
    <View style={s.hubGrid}>
      {accounts.map((a) => {
        const disabled = mode === "send" && a.balance <= 0;
        return (
          <HubCard
            key={a.id}
            account={a}
            mode={mode}
            disabled={disabled}
            badgeBacking={badgeBacking}
            onPress={() => onPick(a.id)}
          />
        );
      })}
    </View>
  );
}

function HubCard({
  account,
  mode,
  disabled,
  badgeBacking,
  onPress,
}: {
  account: (typeof accounts)[number];
  mode: "deposit" | "send";
  disabled: boolean;
  badgeBacking: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  // En send, las cuentas sin saldo muestran "0 disponible" en gris
  // no clickeable. En el resto de los casos, saldo real formateado.
  const balanceLabel = disabled
    ? "0 disponible"
    : formatAccountBalance(account);
  const eyebrowLabel = disabled
    ? "SIN SALDO"
    : mode === "send"
      ? "DISPONIBLE"
      : "TU SALDO";

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.hubCard,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed && !disabled ? 0.97 : 1 }],
        },
      ]}
    >
      <View style={s.hubCardTop}>
        <AccountFlag
          accountId={account.id}
          size={44}
          badgeBackingColor={badgeBacking}
        />
      </View>
      <Text style={[s.hubCardCurrency, { color: c.text }]}>
        {account.currency === "USDT" ? "Cripto" : account.currency}
      </Text>
      <Text
        style={[s.hubCardLocation, { color: c.textMuted }]}
        numberOfLines={1}
      >
        {account.location}
      </Text>
      <View style={[s.hubCardDivider, { backgroundColor: c.border }]} />
      <Text style={[s.hubCardBalanceEyebrow, { color: c.textMuted }]}>
        {eyebrowLabel}
      </Text>
      <Text
        style={[s.hubCardBalance, { color: c.text }]}
        numberOfLines={1}
      >
        {balanceLabel}
      </Text>
    </Pressable>
  );
}

/* ─── Card de depósito bancario en cuenta argentina (ARS / USD) ─── */
function BankDepositCard({
  kind,
  onPickLinked,
}: {
  kind: "ars-ar" | "usd-ar";
  onPickLinked: (a: LinkedAccount) => void;
}) {
  const { c } = useTheme();
  const data = RECEIVE_BANK_AR[kind];
  const linkedCurrency = kind === "ars-ar" ? "ars" : "usd";
  const linked = LINKED_ACCOUNTS.filter((a) => a.currency === linkedCurrency);

  return (
    <>
      <Text style={[s.depositEyebrow, { color: c.text }]}>
        Desde un banco o billetera
      </Text>
      <View
        style={[
          s.depositCard,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <CopyRow label="Alias" value={data.alias} />
        <View style={[s.depositRowDivider, { backgroundColor: c.border }]} />
        <CopyRow label="CBU" value={data.cbu} mono />
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

      <Tap
        style={[
          s.shareAliasBtn,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
        haptic="light"
        onPress={() => {
          Share.share({ message: data.alias }).catch(() => {});
        }}
      >
        <Feather name="share" size={16} color={c.greenDark} />
        <Text style={[s.shareAliasText, { color: c.greenDark }]}>
          Compartir alias
        </Text>
      </Tap>

      <Text style={[s.depositEyebrow, { color: c.text, marginTop: 28 }]}>
        Desde cuentas vinculadas
      </Text>
      {linked.length > 0 ? (
        <View
          style={[
            s.depositCard,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          {linked.map((acc, i) => (
            <View key={acc.id}>
              {i > 0 ? (
                <View
                  style={[
                    s.depositRowDivider,
                    { backgroundColor: c.border },
                  ]}
                />
              ) : null}
              <LinkedAccountRow acc={acc} onPress={() => onPickLinked(acc)} />
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
            {kind === "ars-ar" ? "en pesos" : "en dólares"} vinculadas.
          </Text>
        </View>
      )}

      <Tap
        style={s.addAccountBtn}
        haptic="light"
        onPress={() => {
          /* TODO: wizard de agregar cuenta */
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
    </>
  );
}

/* ─── Card de wire transfer internacional (USD cuenta USA) ─── */
function WireDepositCard() {
  const { c } = useTheme();
  const w = RECEIVE_WIRE_US;
  return (
    <>
      <Text style={[s.depositEyebrow, { color: c.text }]}>
        Wire transfer (USD)
      </Text>
      <View
        style={[
          s.depositCard,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <CopyRow label="Beneficiario" value={w.beneficiary} />
        <View style={[s.depositRowDivider, { backgroundColor: c.border }]} />
        <CopyRow label="Banco" value={w.bankName} />
        <View style={[s.depositRowDivider, { backgroundColor: c.border }]} />
        <CopyRow label="Routing (ABA)" value={w.routing} mono />
        <View style={[s.depositRowDivider, { backgroundColor: c.border }]} />
        <CopyRow label="Cuenta" value={w.account} mono />
        <View style={[s.depositRowDivider, { backgroundColor: c.border }]} />
        <CopyRow label="SWIFT / BIC" value={w.swift} mono />
        <View style={[s.depositRowDivider, { backgroundColor: c.border }]} />
        <CopyRow label="Memo / Reference" value={w.memo} mono />
        <View style={[s.depositRowDivider, { backgroundColor: c.border }]} />
        <Text style={[s.depositLegend, { color: c.textMuted }]}>
          Dirección del banco: {w.bankAddress}
        </Text>
      </View>

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
          Los wire transfers internacionales acreditan en 1-3 días hábiles.
          Asegurate de incluir el memo para que podamos identificar tu
          depósito.
        </Text>
      </View>
    </>
  );
}

/**
 * Hook que maneja el estado 'recién copiado' — copia al clipboard,
 * dispara haptic, y retorna `copied` que vuelve a false después de
 * 1.5s para que el botón pueda mostrar un check breve.
 */
function useCopyFeedback() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const copy = (value: string) => {
    Clipboard.setStringAsync(value).catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  };

  return { copied, copy };
}

function CopyRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const { c } = useTheme();
  const { copied, copy } = useCopyFeedback();
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
        haptic="none"
        onPress={() => copy(value)}
        style={[
          s.copyBtn,
          {
            backgroundColor: copied ? c.greenDim : c.surfaceHover,
          },
        ]}
        hitSlop={8}
      >
        <Feather
          name={copied ? "check" : "copy"}
          size={16}
          color={c.greenDark}
        />
      </Tap>
    </View>
  );
}

function LinkedAccountRow({
  acc,
  onPress,
}: {
  acc: LinkedAccount;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Tap style={s.linkedRow} haptic="light" onPress={onPress}>
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
      {/* Flechita al tocar: dispara el sub-flow de ingresar desde
          esta cuenta. */}
      <View style={[s.linkedArrow, { backgroundColor: c.greenDim }]}>
        <Feather name="arrow-down-left" size={16} color={c.greenDark} />
      </View>
    </Tap>
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
  // Step inicial: 'currency' = picker de 4 cards. 'amount' = AmountStep
  // existente. Después destination/done.
  const [step, setStep] = useState<SendStep | "currency">("currency");
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

  if (step === "amount") {
    return (
      <AmountStep
        cur={cur}
        amount={amount}
        onChangeAmount={setAmount}
        onNext={() => setStep("destination")}
        onBack={() => setStep("currency")}
      />
    );
  }

  // step === "currency" — hub picker.
  return <SendCurrencyHub onPick={(id) => {
    // Mappeo de AccountId → DepositCurrency. usd-us también es 'usd'
    // (mismo flow del AmountStep). usdt-crypto: por ahora redirigimos
    // a un próximamente — el send de crypto requiere otro flow (asset
    // + red + dirección).
    if (id === "ars-ar") {
      setCur("ars");
      setAmount("0");
      setStep("amount");
    } else if (id === "usd-ar" || id === "usd-us") {
      setCur("usd");
      setAmount("0");
      setStep("amount");
    } else {
      // usdt-crypto — próximamente.
      Alert.alert(
        "Próximamente",
        "El envío de cripto va a estar disponible muy pronto.",
      );
    }
  }} />;
}

/* ─── Hub picker para Send ─── */

function SendCurrencyHub({ onPick }: { onPick: (id: AccountId) => void }) {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.headerBare, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={s.backBtnBare}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={24} color={c.text} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[s.depositTitle, { color: c.text }]}>
          ¿Qué moneda querés{"\n"}enviar?
        </Text>
        <Text style={[s.hubSub, { color: c.textMuted }]}>
          Solo podés enviar desde cuentas con saldo.
        </Text>
        <CurrencyHubCards
          mode="send"
          onPick={(id) => {
            Haptics.selectionAsync().catch(() => {});
            onPick(id);
          }}
        />
      </ScrollView>
    </View>
  );
}

/* ─── Paso 1: monto + moneda ─── */

function AmountStep({
  cur,
  amount,
  onChangeAmount,
  onNext,
  onBack,
}: {
  cur: DepositCurrency;
  amount: string;
  onChangeAmount: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

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
          style={s.iconBtn}
          onPress={onBack}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color={c.text} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: c.text }]}>Enviar</Text>
          <Text style={[s.headerSub, { color: c.textMuted }]}>
            {cur === "ars" ? "Pesos argentinos" : "Dólares"}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Bloque monto + slider centrado en el espacio disponible
          arriba del keypad — sin un flex spacer todo se apilaba al
          top y la pantalla se veía sub-balanceada. */}
      <View style={s.amountBlock}>
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

      <View
        style={{
          paddingTop: 28,
          paddingBottom: insets.bottom + 96,
          paddingHorizontal: 20,
        }}
      >
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
  const linked = LINKED_ACCOUNTS.filter((a) => a.currency === cur);

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={s.iconBtn}
          onPress={onBack}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color={c.text} />
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

        {linked.length > 0 ? (
          <View
            style={[
              s.depositCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            {linked.map((acc, i) => (
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

/* ─── Deposit desde una cuenta vinculada (sub-flow de Ingresar) ───
   Tap en una cuenta → pantalla de monto + slider + keypad + CTA.
   La moneda es fija (la de la cuenta). Confirmar → success. */

const DEPOSIT_LIMITS = {
  ars: 5_000_000,
  usd: 10_000,
};

function DepositFromAccount({
  account,
  onBack,
}: {
  account: LinkedAccount;
  onBack: () => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const cur = account.currency;
  const [amount, setAmount] = useState("0");
  const [done, setDone] = useState(false);

  const limit = DEPOSIT_LIMITS[cur];
  const parsed = Number.parseFloat(amount) || 0;
  const hasAmount = parsed > 0;
  const exceeds = parsed > limit;

  const currentPct = useMemo(() => {
    if (limit <= 0) return 0;
    return Math.min(100, (parsed / limit) * 100);
  }, [parsed, limit]);

  const applyPct = (pct: number) => {
    const ratio = pct / 100;
    const raw = limit * ratio;
    const v =
      pct >= 100
        ? Math.floor(limit)
        : cur === "ars"
        ? Math.round(raw)
        : Math.round(raw * 100) / 100;
    setAmount(String(v));
  };

  const handleKey = (k: string) => {
    if (k === "back") {
      setAmount((p) => (p.length <= 1 ? "0" : p.slice(0, -1)));
      return;
    }
    if (k === ".") {
      if (amount.includes(".")) return;
      setAmount((p) => p + ".");
      return;
    }
    setAmount((p) => {
      if (p === "0") return k;
      if (p.includes(".") && p.split(".")[1].length >= 2) return p;
      return p + k;
    });
  };

  const sign = cur === "ars" ? "$" : "US$";

  if (done) {
    return (
      <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top + 24 }]}>
        <View style={s.successBlock}>
          <View style={[s.checkCircle, { backgroundColor: c.green }]}>
            <Feather name="check" size={32} color={c.ink} />
          </View>
          <Text style={[s.successTitle, { color: c.text }]}>
            Ingreso en camino
          </Text>
          <Text style={[s.successBody, { color: c.textMuted }]}>
            Esperamos {formatMoney(parsed, cur)} desde {account.bankName}{" "}
            (••••{account.tail}). Cuando el banco confirme, el saldo queda
            acreditado al toque.
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

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          style={s.iconBtn}
          onPress={onBack}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color={c.text} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: c.text }]}>Ingresar</Text>
          <Text style={[s.headerSub, { color: c.textMuted }]} numberOfLines={1}>
            Desde {account.bankName} · ••••{account.tail}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.sendAmountSection}>
        <Text style={[s.amountLabel, { color: c.textMuted }]}>
          ¿Cuánto querés ingresar?
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
            ? `Supera el límite diario (${formatMoney(limit, cur)})`
            : `Límite diario ${formatMoney(limit, cur)}`}
        </Text>
      </View>

      <View style={s.sendSliderRow}>
        <PercentSlider
          value={currentPct}
          onChange={applyPct}
          disabled={limit <= 0}
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
            setDone(true);
          }}
          disabled={!hasAmount || exceeds}
        >
          <Text
            style={[
              s.ctaText,
              { color: hasAmount && !exceeds ? c.bg : c.textMuted },
            ]}
          >
            Confirmar ingreso
          </Text>
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
  /* Header alternativo sin título — solo arrow-back sin chrome.
     Usado en el hub picker (la pregunta del cuerpo es el título). */
  headerBare: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  /* Back button "naked" — sin pill de fondo, solo el ícono. */
  backBtnBare: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 36,
    letterSpacing: -1.4,
    lineHeight: 42,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  hubSub: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    letterSpacing: -0.15,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 36,
  },

  /* Currency hub — 4 floating cards en grid 2×2 */
  hubGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 14,
    gap: 12,
    rowGap: 12,
  },
  hubCard: {
    width: "47%",
    flexGrow: 1,
    flexBasis: "47%",
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    minHeight: 168,
  },
  hubCardTop: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 14,
  },
  hubCardCurrency: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.7,
  },
  hubCardLocation: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    letterSpacing: -0.05,
    marginTop: 2,
  },
  hubCardDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
    marginHorizontal: -16,
  },
  hubCardBalanceEyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 9.5,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  hubCardBalance: {
    fontFamily: fontFamily[700],
    fontSize: 14,
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
  /* Flechita verde al lado de cada cuenta vinculada — invita a
     ingresar plata desde esa cuenta. */
  linkedArrow: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
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
  shareAliasBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: radius.btn,
    borderWidth: 1,
  },
  shareAliasText: {
    fontFamily: fontFamily[700],
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
  amountBlock: {
    flex: 1,
    justifyContent: "center",
  },
  sendAmountSection: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 12,
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
