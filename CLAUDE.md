# Álamos Capital

App de inversiones retail para Argentina. 3 mercados: argentino (CEDEARs, bonos, FCI), estadounidense, crypto. 3 divisas: ARS, USD, USDT. React Native 0.81 + Expo SDK 54.

## Map
- `app/` — screens (Expo Router 6, file-based). Auth + tabs (Inicio/Mercado/Cartera/Noticias/Perfil)
- `lib/components/` — componentes compartidos (Button, Logo, Sparkline, Squircle)
- `lib/theme/` — tokens, tipografía, radius, colores. FUENTE DE VERDAD para diseño.
- `lib/auth/` — auth context + API client (MOCK_MODE=true)
- `lib/data/` — mock assets (CEDEARs, bonos, FCI)
- `context/` — sistema de contexto para IA (strategy, domains, decisions)
- `thoughts/` — research, planes, handoffs entre sesiones
- `assets/brand-assets/` — brand pack oficial

## Commands
- Install: `npm install --legacy-peer-deps`
- Run: `npx expo start` (o `--tunnel` si no conecta)
- NO hay backend propio todavía. Solo app mobile con datos mockeados.

## Comunicación
- Español. Términos técnicos en inglés.
- Directo, técnico, sin padding.
- Outputs exhaustivos > resumidos.
- Leer `context/strategy/decisions.md` antes de proponer alternativas ya evaluadas.

## DO NOT
- NO usar NativeWind, Tailwind, ni styled-components. Solo `StyleSheet.create()`.
- NO inventar colores. Usar SOLO los tokens de `lib/theme/index.ts`.
- NO usar `borderRadius` sin `borderCurve: "continuous"`. NUNCA.
- NO inventar componentes genéricos. Revisar `lib/components/` primero.
- NO sugerir Y Combinator. Descartado.
- NO mencionar "Alamos Pro". Fue descartado. El dark mode es simplemente una preferencia de usuario.
- NO asumir que decisiones abiertas están cerradas. Verificar status en `decisions.md`.
- NO escribir contenido in-app genérico. Leer `.claude/skills/alamos-copy/SKILL.md`.
- NO usar guiones largos (—) como muletilla en contenido de la app.
- NO usar exclamaciones (!) en contenido de la app.

<important if="you are creating or modifying any UI component or screen">
LEER `.claude/skills/alamos-design/SKILL.md` ANTES de escribir una sola línea.
El stock detail es el gold standard. Estudiarlo antes de crear pantallas nuevas.
Álamos tiene un design system específico. Nada genérico. Si el output podría
pertenecer a cualquier app de finanzas, está mal.
</important>

<important if="you are writing ANY user-facing text — labels, titles, descriptions, errors, buttons, empty states">
LEER `.claude/skills/alamos-copy/SKILL.md` ANTES de escribir.
Contenido in-app en español, tuteo suave, profesional y corto.
Si suena a IA genérica, reescribir.
</important>

<important if="you are evaluating legal, fiscal, or corporate structure options">
La estructura corporativa NO está decidida. Hay múltiples opciones en evaluación.
NO asumir BVI como decidido. Leer `context/domains/` para estado actual.
</important>
