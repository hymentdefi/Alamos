import { StyleSheet, Text, View } from "react-native";
import Svg, { Polygon } from "react-native-svg";
import type { AssetMarket } from "../data/assets";
import { fontFamily, radius, useTheme } from "../theme";
import { FlagIcon } from "./FlagIcon";
import { Tap } from "./Tap";

/**
 * Segmented control de mercados — AR / EE.UU / Crypto. Usado en la
 * tab Mercado y reutilizado en Portfolio. Cuando `withAll` es true,
 * agrega un tab "Todo" al principio con el isotipo Alamos como flag.
 *
 * Geometría idéntica entre callers — único punto de verdad del
 * lenguaje visual del segmented (pill bg sutil verde, label en
 * brand cuando active, tint del 4% sobre la bandera).
 */

export type MarketSegmentedValue = AssetMarket | "all";

interface Tab {
  id: MarketSegmentedValue;
  short: string;
}

const BASE_TABS: Tab[] = [
  { id: "AR", short: "AR" },
  { id: "US", short: "EE.UU" },
  { id: "CRYPTO", short: "Crypto" },
];

interface Props {
  value: MarketSegmentedValue;
  onChange: (v: MarketSegmentedValue) => void;
  /** Si true, agrega un tab "Todo" al principio con el isotipo
   *  Alamos como glyph. */
  withAll?: boolean;
}

export function MarketSegmented({ value, onChange, withAll }: Props) {
  const { mode, c } = useTheme();
  const isDark = mode === "dark";

  const tabs: Tab[] = withAll
    ? [{ id: "all", short: "Todo" }, ...BASE_TABS]
    : BASE_TABS;

  return (
    <View style={[s.marketControl, { backgroundColor: c.surfaceHover }]}>
      <View style={s.marketSeg}>
        {tabs.map((m) => {
          const active = m.id === value;
          return (
            <Tap
              key={m.id}
              onPress={() => onChange(m.id)}
              haptic="selection"
              pressScale={0.96}
              rippleContained
              style={[
                s.marketSegBtn,
                active && {
                  backgroundColor: isDark
                    ? "rgba(14, 203, 129, 0.07)"
                    : "rgba(0, 200, 5, 0.05)",
                  borderColor: isDark
                    ? "rgba(14, 203, 129, 0.12)"
                    : "rgba(0, 200, 5, 0.10)",
                  borderWidth: 1,
                },
              ]}
            >
              <MarketGlyph id={m.id} active={active} />
              <Text
                style={[
                  s.marketSegLabel,
                  {
                    color: active ? c.brand : c.textMuted,
                    fontFamily: active ? fontFamily[800] : fontFamily[600],
                  },
                ]}
                numberOfLines={1}
              >
                {m.short}
              </Text>
            </Tap>
          );
        })}
      </View>
    </View>
  );
}

function MarketGlyph({
  id,
  active,
}: {
  id: MarketSegmentedValue;
  active?: boolean;
}) {
  const { c } = useTheme();
  if (id === "AR" || id === "US") {
    return (
      <View style={gs.flagWrap}>
        <FlagIcon code={id} size={18} />
        {active ? (
          <View
            pointerEvents="none"
            style={[
              gs.flagTint,
              { backgroundColor: "rgba(0, 200, 5, 0.04)" },
            ]}
          />
        ) : null}
      </View>
    );
  }
  if (id === "CRYPTO") {
    return (
      <View style={[gs.cryptoBadge, { backgroundColor: c.brand }]}>
        <Text style={[gs.cryptoBadgeText, { color: c.bg }]}>₿</Text>
      </View>
    );
  }
  // "all" — flag redondo con fondo verde brand y los 2 triángulos del
  // isotipo Alamos en blanco. Mismo formato circle que las flags AR/US
  // y el badge de Crypto. Variante "alamos-iso-blanco sobre verde" del
  // brand-kit.
  return (
    <View style={[gs.allBadge, { backgroundColor: c.brand }]}>
      <Svg width={14} height={14} viewBox="0 0 100 100">
        <Polygon
          points="38,26 16,86 60,86"
          stroke="#FFFFFF"
          strokeWidth={10}
          strokeLinejoin="round"
          fill="none"
        />
        <Polygon
          points="56,12 29,86 83,86"
          stroke="#FFFFFF"
          strokeWidth={10}
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  marketControl: {
    borderCurve: "continuous",
    borderRadius: radius.lg,
    paddingTop: 4,
    paddingBottom: 4,
    marginBottom: 14,
  },
  marketSeg: {
    flexDirection: "row",
    gap: 2,
  },
  marketSegBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderCurve: "continuous",
    borderRadius: radius.pill,
  },
  marketSegLabel: {
    fontSize: 13,
    letterSpacing: -0.1,
  },
});

const gs = StyleSheet.create({
  flagWrap: {
    width: 18,
    height: 18,
    position: "relative",
  },
  flagTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderCurve: "continuous",
    borderRadius: 999,
  },
  cryptoBadge: {
    width: 18,
    height: 18,
    borderCurve: "continuous",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  cryptoBadgeText: {
    fontFamily: fontFamily[800],
    fontSize: 11,
    lineHeight: 13,
  },
  /* Flag del tab "Todo" — circle de 18 con fondo brand green y los
   * triángulos blancos adentro. Mismo tamaño que las flags AR/US y
   * el badge de Crypto. */
  allBadge: {
    width: 18,
    height: 18,
    borderCurve: "continuous",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
});
