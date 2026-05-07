/**
 * Briefings AI-powered por activo. Por ahora hardcodeo el de
 * Apple para todos los tickers — más adelante, con la API real,
 * cada ticker resuelve a su propio briefing live (fetch + cache
 * con TTL de unos minutos).
 *
 * Cada briefing tiene:
 *   - summary: resumen corto (~4 líneas) que va en la card del
 *     stock detail debajo del chart.
 *   - title: titular largo de la "noticia AI" (en la página
 *     completa).
 *   - sections: bloques temáticos que componen el cuerpo del
 *     briefing — cada uno con su propio título + descripción.
 *   - updatedAt: epoch ms de cuándo se generó. La UI lo formatea
 *     como "hace X min" / "hace X h" / "hace X d".
 */

export interface BriefingSection {
  title: string;
  body: string;
}

export interface Briefing {
  ticker: string;
  /** Resumen corto que va en la card del detail. Longitud
   *  pensada para 4 líneas a 14px. */
  summary: string;
  /** Titular largo del briefing (se muestra como heading en la
   *  página completa). */
  title: string;
  /** Cuerpo del briefing partido en secciones temáticas. */
  sections: BriefingSection[];
  /** Epoch ms cuando se generó el briefing. */
  updatedAt: number;
}

/* Placeholder Apple — todos los tickers usan esto por ahora.
 * Generado a las 09:48 (5 min atrás respecto a la hora de la
 * sesión típica de mercado en CABA). */
const APPLE_BRIEFING: Briefing = {
  ticker: "AAPL",
  summary:
    "Apple sube 0.34% por anuncios de servicios cloud y nuevos iPad. Los analistas mantienen recomendaciones de compra con price targets en torno a USD 245. Volumen 18% por encima del promedio de 30 días.",
  title:
    "Apple sube 0.34% impulsada por anuncios de servicios cloud y línea iPad refresh",
  sections: [
    {
      title: "Servicios cloud",
      body:
        "Apple anunció una expansión de iCloud+ con nuevos tiers de almacenamiento y un servicio de IA on-device en partnership con OpenAI. La unidad Services creció 14% año contra año en el último trimestre y representa ya el 23% de los ingresos totales — un margen estructuralmente más alto que hardware.",
    },
    {
      title: "Nuevos iPad",
      body:
        "Refresh completo de la línea iPad con chips M4 Pro y nueva pantalla OLED en los modelos altos. Wedbush proyecta un upside de USD 4 mil millones en revenue del segmento durante el próximo fiscal year. Pre-orders abren la semana próxima con shipments en diciembre.",
    },
    {
      title: "Recomendaciones de analistas",
      body:
        "Morgan Stanley elevó su price target de USD 235 a USD 245 (Overweight). HSBC mantiene Buy con target USD 250 citando margen Services + ramp del super-cycle de iPhone 17. BofA reiteró Buy con USD 240. Consenso: Buy con upside del 8% sobre el precio actual.",
    },
    {
      title: "Lo que mirar",
      body:
        "El próximo earnings call (28 de enero) traerá guidance del segundo trimestre fiscal y el peso del nuevo line-up de iPad sobre los márgenes. Además, la mirada está sobre la migración de servicios a IA propia — el costo de esos partnerships (incluyendo el anuncio de hoy con OpenAI) puede comer puntos de margen en el corto plazo aunque genere stickiness a largo.",
    },
  ],
  // 5 minutos atrás. En producción esto viene del backend.
  updatedAt: Date.now() - 5 * 60 * 1000,
};

/** Devuelve el briefing del ticker pedido. Por ahora todos
 *  resuelven al placeholder de Apple. */
export function briefingFor(_ticker: string): Briefing {
  return APPLE_BRIEFING;
}

/** Formato relativo "hace X min/h/d" para el timestamp. */
export function formatBriefingAge(updatedAt: number): string {
  const seconds = Math.max(0, (Date.now() - updatedAt) / 1000);
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return "hace instantes";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}
