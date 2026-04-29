import type { StoryConfig } from "../components/StoryOverlay";

/**
 * Catálogo de stories educativas — se muestran la primera vez que el
 * usuario activa un nuevo segmento (crypto, mercado USA, etc.). Persisten
 * en SecureStore con la key `story:<id>:seen` y no se vuelven a mostrar.
 */

export const CRYPTO_STORY: StoryConfig = {
  id: "crypto",
  bgTop: "#0E0F0C",
  bgBottom: "#0D2818",
  accent: "#5ac43e",
  slides: [
    {
      emoji: "⚡",
      title: "El mercado que nunca duerme",
      body: "Operás crypto 24 horas, los 7 días de la semana. Sin horarios de cierre, sin esperar a la apertura.",
    },
    {
      emoji: "₮",
      title: "USDT es tu dólar digital",
      body: "1 USDT siempre vale 1 USD. Es estable, sin volatilidad. Como un dólar, pero on-chain.",
    },
    {
      emoji: "🌱",
      title: "Empezá con poco",
      body: "Desde 1 USDT podés moverte. Sin mínimos altos, sin papeleo, todo desde tu celular.",
    },
  ],
};

export const US_MARKET_STORY: StoryConfig = {
  id: "us-market",
  bgTop: "#0E0F0C",
  bgBottom: "#1B2A4E",
  accent: "#5ac43e",
  slides: [
    {
      emoji: "🏛️",
      title: "Wall Street, en tu bolsillo",
      body: "Comprás directo en NYSE y NASDAQ — los dos mercados de capitales más grandes del mundo.",
    },
    {
      emoji: "📈",
      title: "Es la acción real, no un CEDEAR",
      body: "Comprás Apple, NVIDIA, Tesla en USD, sin tipo de cambio implícito ni spread local.",
    },
    {
      emoji: "✨",
      title: "Menos comisiones, más mercado",
      body: "Sin intermediarios argentinos. Operás como un inversor de Wall Street, desde Buenos Aires.",
    },
  ],
};
