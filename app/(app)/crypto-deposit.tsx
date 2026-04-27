import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Share,
  StyleSheet,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useTheme, fontFamily, radius } from "../../lib/theme";
import { Tap } from "../../lib/components/Tap";
import { CryptoIcon } from "../../lib/components/CryptoIcon";
import {
  cryptoDepositAssets,
  type CryptoAsset,
  type CryptoNetwork,
} from "../../lib/data/cryptoDeposits";

/**
 * Flow de depósito crypto en 3 sub-vistas:
 *   1. Asset list (con buscador)
 *   2. Network picker para el asset elegido
 *   3. Address card con copy + warning + metadata de la red
 *
 * Single-screen state machine para que volver atrás sea instantáneo
 * (no hay route stack que desmonte). El back button cubre las 3 capas.
 */
export default function CryptoDepositScreen() {
  const [asset, setAsset] = useState<CryptoAsset | null>(null);
  const [network, setNetwork] = useState<CryptoNetwork | null>(null);

  if (asset && network) {
    return (
      <AddressView
        asset={asset}
        network={network}
        onBack={() => setNetwork(null)}
      />
    );
  }
  if (asset) {
    return (
      <NetworkPicker
        asset={asset}
        onBack={() => setAsset(null)}
        onPick={(n) => setNetwork(n)}
      />
    );
  }
  return <AssetList onPick={(a) => setAsset(a)} />;
}

/* ─── Sub-view 1: lista de assets crypto con buscador ─── */

function AssetList({ onPick }: { onPick: (a: CryptoAsset) => void }) {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cryptoDepositAssets;
    return cryptoDepositAssets.filter(
      (a) =>
        a.ticker.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q),
    );
  }, [query]);

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
        <Text style={[s.headerTitle, { color: c.text }]}>Depositar crypto</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.searchWrap}>
        <View
          style={[
            s.searchBar,
            { backgroundColor: c.surfaceHover, borderColor: c.border },
          ]}
        >
          <Feather name="search" size={16} color={c.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar moneda"
            placeholderTextColor={c.textMuted}
            style={[s.searchInput, { color: c.text }]}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Feather name="x" size={16} color={c.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[s.eyebrow, { color: c.textMuted }]}>
          ELEGÍ LA MONEDA
        </Text>
        {filtered.length > 0 ? (
          <View
            style={[
              s.card,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            {filtered.map((a, i) => (
              <View key={a.ticker}>
                {i > 0 ? (
                  <View
                    style={[s.rowDivider, { backgroundColor: c.border }]}
                  />
                ) : null}
                <Tap
                  haptic="light"
                  onPress={() => onPick(a)}
                  style={s.assetRow}
                >
                  <CryptoIcon
                    ticker={a.ticker}
                    bg={a.bg}
                    fg={a.fg}
                    iconText={a.iconText}
                    size={40}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.assetTicker, { color: c.text }]}>
                      {a.ticker}
                    </Text>
                    <Text style={[s.assetName, { color: c.textMuted }]}>
                      {a.name}
                    </Text>
                  </View>
                  <View style={s.assetMeta}>
                    <Text style={[s.assetMetaText, { color: c.textMuted }]}>
                      {a.networks.length}{" "}
                      {a.networks.length === 1 ? "red" : "redes"}
                    </Text>
                    <Feather
                      name="chevron-right"
                      size={18}
                      color={c.textFaint}
                    />
                  </View>
                </Tap>
              </View>
            ))}
          </View>
        ) : (
          <View
            style={[
              s.emptyCard,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Text style={[s.emptyText, { color: c.textMuted }]}>
              No encontramos "{query}". Probá con otro ticker.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ─── Sub-view 2: redes soportadas para el asset elegido ─── */

function NetworkPicker({
  asset,
  onBack,
  onPick,
}: {
  asset: CryptoAsset;
  onBack: () => void;
  onPick: (n: CryptoNetwork) => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

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
          <Text style={[s.headerTitle, { color: c.text }]}>
            Depositar {asset.ticker}
          </Text>
          <Text style={[s.headerSub, { color: c.textMuted }]}>
            Elegí la red
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.assetHeroRow}>
          <CryptoIcon
            ticker={asset.ticker}
            bg={asset.bg}
            fg={asset.fg}
            iconText={asset.iconText}
            size={56}
          />
          <View style={{ flex: 1 }}>
            <Text style={[s.assetHeroTicker, { color: c.text }]}>
              {asset.ticker}
            </Text>
            <Text style={[s.assetHeroName, { color: c.textMuted }]}>
              {asset.name}
            </Text>
          </View>
        </View>

        <Text style={[s.eyebrow, { color: c.textMuted }]}>REDES DISPONIBLES</Text>
        <View
          style={[
            s.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          {asset.networks.map((n, i) => (
            <View key={n.id}>
              {i > 0 ? (
                <View style={[s.rowDivider, { backgroundColor: c.border }]} />
              ) : null}
              <Tap
                haptic="light"
                onPress={() => onPick(n)}
                style={s.networkRow}
              >
                <View style={{ flex: 1 }}>
                  <View style={s.networkRowHead}>
                    <Text style={[s.networkLabel, { color: c.text }]}>
                      {n.label}
                    </Text>
                    <View
                      style={[
                        s.networkProtoBadge,
                        { backgroundColor: c.surfaceHover },
                      ]}
                    >
                      <Text
                        style={[
                          s.networkProtoText,
                          { color: c.textSecondary },
                        ]}
                      >
                        {n.protocol}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[s.networkSub, { color: c.textMuted }]}
                    numberOfLines={1}
                  >
                    {n.eta} · Comisión {n.fee} · Mín. {n.minDeposit}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={c.textFaint} />
              </Tap>
            </View>
          ))}
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
          <Feather name="info" size={14} color={c.textSecondary} />
          <Text style={[s.noteText, { color: c.textSecondary }]}>
            Asegurate de elegir la misma red desde la que vas a enviar. Si
            elegís otra, los fondos se pierden.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── Sub-view 3: dirección de depósito + copy + warning ─── */

function AddressView({
  asset,
  network,
  onBack,
}: {
  asset: CryptoAsset;
  network: CryptoNetwork;
  onBack: () => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { copied, copy } = useCopyFeedback();

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
          <Text style={[s.headerTitle, { color: c.text }]}>
            Depositar {asset.ticker}
          </Text>
          <Text style={[s.headerSub, { color: c.textMuted }]}>
            Red {network.protocol}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.assetHeroRow}>
          <CryptoIcon
            ticker={asset.ticker}
            bg={asset.bg}
            fg={asset.fg}
            iconText={asset.iconText}
            size={56}
          />
          <View style={{ flex: 1 }}>
            <Text style={[s.assetHeroTicker, { color: c.text }]}>
              {asset.ticker}
            </Text>
            <Text style={[s.assetHeroName, { color: c.textMuted }]}>
              {asset.name} · {network.label}
            </Text>
          </View>
        </View>

        <Text style={[s.eyebrow, { color: c.textMuted }]}>
          TU DIRECCIÓN DE DEPÓSITO
        </Text>
        <View
          style={[
            s.card,
            s.addressCard,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <Text style={[s.addressMono, { color: c.text }]} selectable>
            {network.address}
          </Text>
        </View>

        <View style={s.addressActionsRow}>
          <Tap
            haptic="none"
            onPress={() => copy(network.address)}
            style={[
              s.addressAction,
              {
                backgroundColor: copied ? c.greenDim : c.surface,
                borderColor: c.border,
              },
            ]}
          >
            <Feather
              name={copied ? "check" : "copy"}
              size={16}
              color={c.greenDark}
            />
            <Text style={[s.addressActionText, { color: c.greenDark }]}>
              {copied ? "Copiada" : "Copiar"}
            </Text>
          </Tap>
          <Tap
            haptic="light"
            onPress={() => Share.share({ message: network.address }).catch(() => {})}
            style={[
              s.addressAction,
              { backgroundColor: c.surface, borderColor: c.border },
            ]}
          >
            <Feather name="share" size={16} color={c.greenDark} />
            <Text style={[s.addressActionText, { color: c.greenDark }]}>
              Compartir
            </Text>
          </Tap>
        </View>

        <Text style={[s.eyebrow, { color: c.textMuted, marginTop: 28 }]}>
          DETALLES DE LA RED
        </Text>
        <View
          style={[
            s.card,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <MetaRow label="Red" value={`${network.label} · ${network.protocol}`} />
          <View style={[s.rowDivider, { backgroundColor: c.border }]} />
          <MetaRow label="Tiempo de acreditación" value={network.eta} />
          <View style={[s.rowDivider, { backgroundColor: c.border }]} />
          <MetaRow label="Comisión de red" value={network.fee} />
          <View style={[s.rowDivider, { backgroundColor: c.border }]} />
          <MetaRow label="Depósito mínimo" value={network.minDeposit} />
          <View style={[s.rowDivider, { backgroundColor: c.border }]} />
          <MetaRow
            label="Confirmaciones"
            value={
              network.confirmations === 0
                ? "Instant"
                : `${network.confirmations}`
            }
          />
        </View>

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
            Enviá únicamente {asset.ticker} por la red {network.protocol}.
            Si usás otra red o mandás otro token, los fondos se pierden.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={s.metaRow}>
      <Text style={[s.metaLabel, { color: c.textMuted }]}>{label}</Text>
      <Text
        style={[s.metaValue, { color: c.text }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {value}
      </Text>
    </View>
  );
}

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
    timerRef.current = setTimeout(() => setCopied(false), 1800);
  };

  return { copied, copy };
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
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },

  searchWrap: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 18,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: -0.15,
    padding: 0,
  },

  eyebrow: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  card: {
    marginHorizontal: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: -16,
  },
  emptyCard: {
    marginHorizontal: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: 22,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
    textAlign: "center",
  },

  /* Asset list */
  assetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  assetTicker: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  assetName: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 2,
    letterSpacing: -0.05,
  },
  assetMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  assetMetaText: {
    fontFamily: fontFamily[600],
    fontSize: 12,
    letterSpacing: -0.05,
  },

  /* Asset hero (en NetworkPicker y AddressView) */
  assetHeroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  assetHeroTicker: {
    fontFamily: fontFamily[700],
    fontSize: 22,
    letterSpacing: -0.5,
  },
  assetHeroName: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    marginTop: 2,
    letterSpacing: -0.1,
  },

  /* Network row */
  networkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  networkRowHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  networkLabel: {
    fontFamily: fontFamily[700],
    fontSize: 15,
    letterSpacing: -0.2,
  },
  networkProtoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  networkProtoText: {
    fontFamily: fontFamily[700],
    fontSize: 11,
    letterSpacing: 0.4,
  },
  networkSub: {
    fontFamily: fontFamily[500],
    fontSize: 12,
    marginTop: 4,
    letterSpacing: -0.05,
  },

  /* Address view */
  addressCard: {
    paddingVertical: 16,
  },
  addressMono: {
    fontFamily: fontFamily[600],
    fontSize: 14,
    letterSpacing: 0.2,
    lineHeight: 20,
    textAlign: "center",
  },
  addressActionsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 14,
    marginBottom: 4,
  },
  addressAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.btn,
    borderWidth: 1,
  },
  addressActionText: {
    fontFamily: fontFamily[700],
    fontSize: 14,
    letterSpacing: -0.15,
  },

  /* Meta rows */
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  metaLabel: {
    fontFamily: fontFamily[500],
    fontSize: 13,
    letterSpacing: -0.1,
  },
  metaValue: {
    fontFamily: fontFamily[700],
    fontSize: 13,
    letterSpacing: -0.1,
    flexShrink: 1,
    textAlign: "right",
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
});
