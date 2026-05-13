import { Fragment, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { fontFamily, radius, useTheme } from "../theme";
import {
  generateCommentary,
  type StatsRange,
  type Tier1Stats,
  type Tier2Stats,
} from "../data/portfolioStats";

interface Props {
  range: StatsRange;
  tier1: Tier1Stats;
  tier2: Tier2Stats;
  /** Formateador de moneda para los montos del cuerpo (income). */
  formatAmount: (n: number) => string;
}

/**
 * AI Portfolio Commentary card — sección de "Análisis" al tope de
 * /estadisticas. Toma las stats Tier 1 + Tier 2 y arma un texto
 * narrativo multi-párrafo en lenguaje natural.
 *
 * Para mock: usa generateCommentary() que arma el texto templated.
 * Para producción: el endpoint POST /api/portfolio/{userId}/commentary
 * llama a Claude Sonnet (system prompt en español, compliance-aware,
 * 3-5 párrafos máximo 250 palabras según spec sección 4).
 *
 * UI:
 *   - Header "Análisis" con zap icon brand al lado (premium AI feel).
 *   - Body: párrafos con **bolds** resaltando métricas clave en c.text.
 *   - Disclaimer obligatorio al pie en c.textFaint.
 */
export function AiCommentaryCard({
  range,
  tier1,
  tier2,
  formatAmount,
}: Props) {
  const { c } = useTheme();

  const paragraphs = useMemo(
    () => generateCommentary({ range, tier1, tier2, formatAmount }),
    [range, tier1, tier2, formatAmount],
  );

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Feather name="zap" size={16} color={c.brand} />
        <Text style={[s.title, { color: c.brand }]}>Análisis</Text>
      </View>

      {paragraphs.map((p, i) => (
        <Text
          key={i}
          style={[s.paragraph, { color: c.textSecondary }]}
        >
          {renderInlineBolds(p.text, c.text)}
        </Text>
      ))}

      <View style={[s.footerWrap, { borderTopColor: c.border }]}>
        {/* Disclaimer + AI provenance integrados en una sola frase
            premium — el user identifica que el análisis es generado
            con IA pero queda en el lenguaje natural del texto, sin
            stamps gritados ni emojis. La oración legal vive al final
            para cumplir compliance. */}
        <Text style={[s.disclaimer, { color: c.textFaint }]}>
          Análisis informativo potenciado por Inteligencia Artificial
          para que tomes mejores decisiones. No constituye
          recomendación de inversión.
        </Text>
      </View>
    </View>
  );
}

/**
 * Renderea inline bolds: el texto entre **dobles asteriscos** se
 * pinta en c.text con weight 700; el resto queda en el color base.
 * Devuelve un array de Text spans para componer dentro de un Text.
 */
function renderInlineBolds(text: string, boldColor: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const inner = part.slice(2, -2);
      return (
        <Text
          key={i}
          style={{
            color: boldColor,
            fontFamily: fontFamily[700],
          }}
        >
          {inner}
        </Text>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

const s = StyleSheet.create({
  card: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    marginTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  title: {
    fontFamily: fontFamily[800],
    fontSize: 22,
    letterSpacing: -0.5,
  },
  paragraph: {
    fontFamily: fontFamily[500],
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.15,
    marginBottom: 12,
  },
  footerWrap: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  disclaimer: {
    fontFamily: fontFamily[500],
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: -0.05,
  },
});
