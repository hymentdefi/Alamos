import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Share,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useTheme, fontFamily, radius } from "../../lib/theme";
import { Tap } from "../../lib/components/Tap";
import { FlagIcon } from "../../lib/components/FlagIcon";
import { PercentSlider } from "../../lib/components/PercentSlider";
import { AccountAvatar } from "../../lib/components/AccountAvatar";
import { accounts, type AccountId } from "../../lib/data/accounts";

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

/** Redes soportadas para depósitos USDT. */
interface CryptoNetwork {
  id: string;
  label: string;
  /** Etiqueta corta del protocolo (TRC20, ERC20, etc.) — para warning. */
  protocol: string;
  /** Dirección de depósito en esa red. Mock — en prod viene del backend. */
  address: string;
  /** Tiempo aproximado para confirmar. */
  eta: string;
  /** Comisión típica de la red (display only). */
  fee: string;
}

const RECEIVE_CRYPTO: { networks: CryptoNetwork[] } = {
  networks: [
    {
      id: "trc20",
      label: "Tron",
      protocol: "TRC20",
      address: "TXp9N8mE3kP6sZQq7rV2WfJ5HdYn4Lc1aB",
      eta: "~1 min",
      fee: "≈ 1 USDT",
    },
    {
      id: "erc20",
      label: "Ethereum",
      protocol: "ERC20",
      address: "0x4f5A2cBd7e91FdA38b3C0a9e21Db88E45fC7aB12",
      eta: "~3 min",
      fee: "≈ 3 USDT",
    },
    {
      id: "polygon",
      label: "Polygon",
      protocol: "MATIC",
      address: "0x7c2E9aB4F3D8b51eA0c92Df45a78Bd1cE3F09a98",
      eta: "~30 seg",
      fee: "< 0,1 USDT",
    },
    {
      id: "solana",
      label: "Solana",
      protocol: "SPL",
      address: "5qHe8kP3nL9XwT2YzQrV4Bf7mAcRdGpJuN6sWvHt2Wn",
      eta: "~10 seg",
      fee: "< 0,01 USDT",
    },
  ],
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

/* ─── Deposit info: picker de cuenta + instrucciones por tipo ─── */

function DepositInfo() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [kindId, setKindId] = useState<AccountId>("ars-ar");
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
          ¿A qué cuenta querés ingresar?
        </Text>

        {/* Picker 2x2 — cada cuenta es un card. */}
        <View style={s.kindGrid}>
          {accounts.map((a) => {
            const active = a.id === kindId;
            return (
              <Pressable
                key={a.id}
                onPress={() => {
                  if (a.id !== kindId) Haptics.selectionAsync().catch(() => {});
                  setKindId(a.id);
                }}
                style={[
                  s.kindCard,
                  {
                    backgroundColor: active ? c.surface : c.surfaceHover,
                    borderColor: active ? c.ink : c.border,
                  },
                ]}
              >
                <AccountAvatar account={a} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.kindCardTitle, { color: c.text }]}>
                    {a.currency}
                  </Text>
                  <Text
                    style={[s.kindCardSub, { color: c.textMuted }]}
                    numberOfLines={1}
                  >
                    {a.location}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {kindId === "usdt" ? (
          <CryptoDepositCard />
        ) : kindId === "usd-us" ? (
          <WireDepositCard />
        ) : (
          <BankDepositCard
            kind={kindId}
            onPickLinked={setDepositFrom}
          />
        )}
      </ScrollView>
    </View>
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

/* ─── Card de depósito crypto (USDT, multi-red) ─── */
function CryptoDepositCard() {
  const { c } = useTheme();
  const [networkId, setNetworkId] = useState(RECEIVE_CRYPTO.networks[0].id);
  const network =
    RECEIVE_CRYPTO.networks.find((n) => n.id === networkId) ??
    RECEIVE_CRYPTO.networks[0];

  return (
    <>
      <Text style={[s.depositEyebrow, { color: c.text }]}>Elegí la red</Text>
      <View style={s.networkRow}>
        {RECEIVE_CRYPTO.networks.map((n) => {
          const active = n.id === networkId;
          return (
            <Pressable
              key={n.id}
              onPress={() => {
                if (n.id !== networkId)
                  Haptics.selectionAsync().catch(() => {});
                setNetworkId(n.id);
              }}
              style={[
                s.networkPill,
                {
                  backgroundColor: active ? c.ink : c.surfaceHover,
                  borderColor: active ? c.ink : c.border,
                },
              ]}
            >
              <Text
                style={[
                  s.networkLabel,
                  { color: active ? c.bg : c.text },
                ]}
              >
                {n.label}
              </Text>
              <Text
                style={[
                  s.networkProto,
                  { color: active ? c.bg : c.textMuted },
                ]}
              >
                {n.protocol}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[s.depositEyebrow, { color: c.text, marginTop: 22 }]}>
        Tu dirección de depósito
      </Text>
      <View
        style={[
          s.depositCard,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <CopyRow label={`Dirección USDT · ${network.protocol}`} value={network.address} mono />
        <View style={[s.depositRowDivider, { backgroundColor: c.border }]} />
        <View style={s.cryptoMetaRow}>
          <View>
            <Text style={[s.copyLabel, { color: c.textMuted }]}>Tiempo</Text>
            <Text style={[s.cryptoMetaValue, { color: c.text }]}>
              {network.eta}
            </Text>
          </View>
          <View>
            <Text style={[s.copyLabel, { color: c.textMuted }]}>
              Comisión de red
            </Text>
            <Text style={[s.cryptoMetaValue, { color: c.text }]}>
              {network.fee}
            </Text>
          </View>
        </View>
      </View>

      <Tap
        style={[
          s.shareAliasBtn,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
        haptic="light"
        onPress={() => {
          Share.share({ message: network.address }).catch(() => {});
        }}
      >
        <Feather name="share" size={16} color={c.greenDark} />
        <Text style={[s.shareAliasText, { color: c.greenDark }]}>
          Compartir dirección
        </Text>
      </Tap>

      <View
        style={[
          s.noteCard,
          {
            backgroundColor: "rgba(200, 59, 59, 0.08)",
            borderColor: "rgba(200, 59, 59, 0.25)",
            marginTop: 20,
          },
        ]}
      >
        <Feather name="alert-triangle" size={14} color={c.red} />
        <Text style={[s.noteText, { color: c.red }]}>
          Enviá únicamente USDT por la red {network.protocol}. Si usás otra
          red o mandás otro token, los fondos se pierden.
        </Text>
      </View>
    </>
  );
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
  const linked = LINKED_ACCOUNTS.filter((a) => a.currency === cur);

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
          style={[s.iconBtn, { backgroundColor: c.surfaceHover }]}
          onPress={onBack}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={18} color={c.text} />
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
  /* Picker 2x2 de cuentas para depositar. */
  kindGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    gap: 10,
    marginTop: 16,
    marginBottom: 24,
  },
  kindCard: {
    flexBasis: "47%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  kindCardTitle: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.2,
  },
  kindCardSub: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    marginTop: 2,
    letterSpacing: -0.05,
  },
  /* Selector de red para depósito crypto. */
  networkRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 8,
  },
  networkPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
  },
  networkLabel: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.15,
  },
  networkProto: {
    fontFamily: fontFamily[500],
    fontSize: 10,
    letterSpacing: 0.4,
    marginTop: 1,
  },
  cryptoMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    gap: 16,
  },
  cryptoMetaValue: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.15,
    marginTop: 2,
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
