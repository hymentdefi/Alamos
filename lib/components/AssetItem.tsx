import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "../theme";
import { type Asset, formatARS } from "../data/assets";

interface Props {
  asset: Asset;
  onPress: (asset: Asset) => void;
  showValue?: boolean;
}

export default function AssetItem({ asset, onPress, showValue }: Props) {
  const isPositive = asset.change >= 0;
  const sign = isPositive ? "+" : "";
  const displayPrice = showValue && asset.held && asset.qty
    ? formatARS(asset.price * asset.qty)
    : formatARS(asset.price);
  const subtitle = showValue && asset.held && asset.qty
    ? `${asset.qty} unidad${asset.qty > 1 ? "es" : ""}`
    : asset.ticker;

  return (
    <Pressable style={s.item} onPress={() => onPress(asset)}>
      <View style={s.icon}>
        <Text style={s.iconText}>{asset.ticker.substring(0, 2)}</Text>
      </View>
      <View style={s.info}>
        <Text style={s.name}>{showValue ? asset.ticker : asset.name}</Text>
        <Text style={s.ticker}>{subtitle}</Text>
      </View>
      <View style={s.priceCol}>
        <Text style={s.price}>{displayPrice}</Text>
        <Text style={[s.change, isPositive ? s.positive : s.negative]}>
          {sign}{asset.change.toFixed(2)}%
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.cardHover,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.primary,
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600", color: colors.text.primary },
  ticker: { fontSize: 12, color: colors.text.secondary, marginTop: 1 },
  priceCol: { alignItems: "flex-end" },
  price: { fontSize: 15, fontWeight: "600", color: colors.text.primary },
  change: { fontSize: 12, fontWeight: "600", marginTop: 1 },
  positive: { color: colors.accent.positive },
  negative: { color: colors.red },
});
