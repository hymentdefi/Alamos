/**
 * Disclaimers legales para el feed de noticias y contenido informativo.
 *
 * Los textos se centralizan acá para que sean fácilmente traducibles (i18n)
 * y versionables. Cada vez que cambie el contenido sustancial del
 * disclaimer, incrementar DISCLAIMER_VERSION para forzar la re-aceptación.
 *
 * Las variables de identidad del ALyC están en ALYC y no deben ser
 * hardcoded en ningún otro lado del código — todos los disclaimers se
 * arman leyendo de acá.
 */

/** Identidad del Agente de Liquidación y Compensación (ALyC). Mover a
 *  config remoto / env var cuando esté definido el valor final. */
export const ALYC = {
  name: "Alamos Capital ALyC S.A.",
  matricula: "N° 000",
} as const;

/** Cambiar cuando se modifique el texto del disclaimer — forza a los
 *  usuarios a aceptar la nueva versión antes de volver a ver el feed. */
export const DISCLAIMER_VERSION = "2025.04.1";

/** Texto corto — se muestra en footers, sub-headers y junto al botón
 *  de compra en pantallas embebidas. */
export const DISCLAIMER_SHORT =
  "El contenido informativo es provisto por terceros y no constituye recomendación de inversión. Las decisiones de inversión son responsabilidad exclusiva del usuario.";

/** Texto largo — para el onboarding de primera vez, modal ⓘ, T&C. */
export const DISCLAIMER_LONG = [
  "Las noticias y contenidos informativos mostrados en Alamos Capital son provistos por fuentes de terceros debidamente identificadas. Alamos Capital no edita, verifica ni suscribe el contenido editorial de estas fuentes, y no se responsabiliza por su exactitud, completitud u oportunidad.",
  "Esta información tiene carácter meramente informativo y no constituye oferta, recomendación, asesoramiento ni sugerencia de inversión en los términos de la Ley 26.831 y las normas de la Comisión Nacional de Valores. Las decisiones de inversión son de exclusiva responsabilidad del usuario y deben tomarse considerando su perfil de riesgo, situación patrimonial y objetivos.",
  "Los resultados pasados no garantizan rendimientos futuros. Invertir en instrumentos financieros implica riesgos, incluida la posibilidad de pérdida del capital invertido.",
  `Alamos Capital opera a través de ${ALYC.name}, Agente de Liquidación y Compensación registrado ante la CNV bajo matrícula ${ALYC.matricula}.`,
] as const;
