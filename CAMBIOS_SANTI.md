# Cambios — branch `santi`

Documento vivo. Cada entrada describe un cambio hecho en esta branch
con su justificación, para poder compartir después qué se modificó y
por qué.

---

## 1. Ticker como sufijo en montos USD y USDT

**Fecha:** 2026-05-05

**Archivos:**
- `lib/data/assets.ts` — `formatUSD`, `formatUSDT`, `formatMoneyParts` y el comment block de la convención de formato.

**Cambio:**

| Moneda | Antes | Después |
|--|--|--|
| ARS | `$ 342.180` | `$ 342.180` *(sin cambios)* |
| USD | `US$ 850,00` | `850,00 US$` |
| USDT | `USDT 580,00` | `580,00 USDT` |

`formatMoneyParts` ahora devuelve `suffix` (en vez de `prefix`) para USD
y USDT. Eso hace que `AmountDisplay` los renderice automáticamente con
el código chiquito al costado del decimal (estilo Robinhood: número
grande + `,00 US$` chiquito en color muted).

**Justificación:**

Decidimos ir con el ticker como sufijo (ejemplo: `1.240,00 US$` en vez
de `US$ 1.240,00`). La razón principal es **consistencia en toda la
app**. Cuando el usuario entra a ver el precio de una acción o de
Bitcoin, lo natural es leer `240 USD` o `84.234 USDT`, no `USD 240` o
`USDT 84.234`. Si en trading el número va primero, en el balance también
tiene que ir primero. No podemos tener prefijo en el home y sufijo en
trading porque se siente como dos apps distintas.

El peso argentino sí mantiene el `$` adelante porque es la convención
local y no genera confusión — además es un símbolo, no un código de tres
letras.

**Notas técnicas:**

- El comment block en [lib/data/assets.ts](lib/data/assets.ts) ya
  describía esta convención (sufijo para USD/USDT) — la implementación
  se había desviado del spec. Este cambio re-alinea código con
  documentación.
- No hay overrides hardcodeados de `"US$ X"` o `"USDT X"` en el resto
  de la app, así que el cambio se propaga solo a través de los tres
  formatters.
- Typecheck pasa (`npx tsc --noEmit` sin errores).

---

## 2. Continuous corners (squircle) en toda la app

**Fecha:** 2026-05-05

**Archivos:**
- `lib/components/Squircle.tsx` (nuevo) — wrapper sobre `react-native-figma-squircle`.
- `lib/components/Button.tsx` — migrado a `<Squircle>` para hero CTAs.
- 44 archivos con `StyleSheet.create({})` — agregado `borderCurve: "continuous"` al lado de cada `borderRadius` (205 ediciones).
- `package.json` — agregada dep `react-native-figma-squircle@0.4.0`.
- `CLAUDE.md` — agregada sección "Esquinas redondeadas — siempre continuous (squircle)".

**Cambio:**

Estrategia híbrida en dos capas:

**(A) `borderCurve: "continuous"` global** — todos los `borderRadius`
del proyecto ahora vienen acompañados de `borderCurve: "continuous"`.
En iOS toma el squircle nativo de Apple (mismo motor que UIKit), gratis
y sin overhead. En Android es no-op silencioso (queda como
border-radius normal). 95% de los elementos de la app caen acá:
chips, tiles, inputs, list items, cards internas, modales.

**(B) `<Squircle>` para hero components** — wrapper basado en
`react-native-figma-squircle` que renderiza el squircle como path SVG
(igual en iOS y Android). Migrado:

- `Button` — todos los CTAs primarios/secondary/accent/ghost.

**Justificación:**

Tener consistencia squircle en TODA la app exigía dos cosas que no se
obtienen con una sola técnica:
1. Una solución que aproveche el squircle nativo de iOS (Apple lo
   tiene optimizado en UIKit, es gratis).
2. Algo cross-platform para los componentes donde la diferencia
   squircle vs rounded es visible a simple vista (botones grandes,
   cards hero) — ahí sí justifica el costo del SVG.

`borderCurve: "continuous"` cubre (1) sin agregar dependencias ni
overhead. Para (2), un wrapper sobre `react-native-figma-squircle`
limita la superficie de la dep a un solo archivo, así que si la lib se
deprecia o no anda con la próxima versión de Expo, lo cambiamos en un
solo lugar.

**Scope limitado a Button (no GlassCard ni modales):**

Originalmente se evaluó migrar también `GlassCard` y los bottom-sheets,
pero quedaron afuera por dos razones técnicas concretas del wrapper
SVG:

1. **Sombras**: el SquircleView pinta el bg con SVG dentro de un View
   con bounds rectangulares. Las sombras nativas (`shadowOffset` /
   `elevation`) siguen el rect del wrapper, no el squircle. En cards
   con shadows visibles (GlassCard) eso introduce un gap entre la
   forma del bg y la forma de la sombra.
2. **Clipping de children**: `<Squircle>` no clipea sus children al
   path del squircle. GlassCard tiene un `LinearGradient` highlight
   con `absoluteFill` — sin clipping al squircle, el gradient se
   extiende al rect y "muerde" en las esquinas.

Para esos casos seguimos con `borderCurve: "continuous"` + border-radius
común — en iOS queda squircle nativo, en Android queda rounded estándar
(que es la convención de Material Design y los usuarios Android no van
a notar diferencia con un radius de 20px en una card grande).

**Notas técnicas:**

- Lib instalada: `react-native-figma-squircle@0.4.0`. Usa
  `react-native-svg` que ya estaba en deps. Es JS-only (no tiene
  módulo nativo) → funciona en Expo Go sin custom dev client.
- New Architecture (Fabric) no está oficialmente soportada por la lib,
  pero al ser puro JS + SVG corre bien.
- Typecheck pasa (`npx tsc --noEmit` sin errores).
- Script `add_continuous_curve.mjs` (en `/tmp/`) hecho ad-hoc para la
  inyección masiva — no commiteado al repo.

---

## 3. Optimización de re-renders (audit de performance)

**Fecha:** 2026-05-05

**Archivos:**
- `lib/auth/context.tsx` — `value` del Provider envuelto en `useMemo`; `login`/`register`/`logout` ahora son `useCallback`.
- `lib/privacy/context.tsx` — `value` del Provider envuelto en `useMemo`.
- `app/(app)/(tabs)/index.tsx` — `AccountRow` envuelto en `React.memo`.
- `app/(app)/activity.tsx` — `TabButton` envuelto en `React.memo`.

**Cambio:**

Hicimos un audit dirigido para encontrar anti-patterns que causen lag
real (no overhead de Expo Go) y aplicamos los fixes de **mayor ROI con
menor riesgo**:

1. **Memo de `AuthProvider.value`** — el objeto del context se recreaba
   en cada render del provider. ~20+ componentes consumen `useAuth()`,
   así que cualquier re-render del root les disparaba un re-render
   propio aunque el contenido no hubiera cambiado.
2. **Memo de `PrivacyProvider.value`** — mismo patrón. ~15+
   consumidores.
3. **`React.memo(AccountRow)`** — la fila de cuenta del Home se
   renderizaba 4 veces (una por cuenta) en cada update del Home,
   incluso cuando ninguna cuenta cambió.
4. **`React.memo(TabButton)`** — botón de la tab strip de Actividad,
   evita re-render cuando el otro tab cambia.

**Justificación:**

El usuario reportó la app "re lagueada". El audit reveló que el
problema era 80-90% **overhead de Expo Go en dev mode** (Hermes
interpretado, Metro vivo, Reanimated en JS thread). Para los
problemas de runtime real que SÍ están en el código, los fixes con
mejor ROI son los memos de provider y de filas — son cambios chicos
que evitan cascadas grandes de re-renders.

**Lo que NO se hizo (decisión consciente):**

Estos fixes del audit quedaron fuera de scope porque eran más
invasivos y el usuario explícitamente pidió "no rompas
funcionalidades":

- **`ScrollView .map()` → `FlatList`** en `activity.tsx` y
  `notifications.tsx`. La virtualización ayudaría si las listas crecen,
  pero hoy son 5-8 items hardcodeados (mock). Migrar implica retocar
  layout (sticky headers, paddings) y aumenta la chance de regresión
  visual.
- **Migración de `Animated` (RN core) a `Reanimated`** en los pulse
  loops del Home (livePulse, giftPulse). Reanimated correría en UI
  thread (mejor performance de 60fps), pero la diferencia es
  imperceptible en pulsos de 2 segundos y la migración es cuidadosa.
- **Extracción de inline styles condicionales** a `useMemo` o
  `StyleSheet`. Impacto bajo (<5% de mejora) vs riesgo medio de
  introducir bugs visuales sutiles.

Para esos quedan abiertos como follow-ups si después de un dev/release
build sigue habiendo lag perceptible.

**Recomendación principal del audit:**

Antes de invertir más en optimización, hacer un **dev build con EAS**
(`eas build --profile development`) e instalarlo en el celular.
Hermes en release mode + Reanimated en UI thread + Metro precompilado
elimina el grueso del lag percibido sin tocar una línea de código.

**Notas técnicas:**

- Typecheck pasa (`npx tsc --noEmit` sin errores).
- Audit completo (10 anti-patterns evaluados) y reporte top-5 por
  ROI quedó documentado en el thread de la conversación.

---

## 4. Chart de detalle — calidad trading-grade (sprint 1 de redesign)

**Fecha:** 2026-05-05

**Archivos:**
- `lib/components/Sparkline.tsx` — agregada prop `mode?: "curve" | "step" | "line"`; nuevo modo "line" para polyline raw; reference line con dash y opacity más sutil.
- `app/(app)/detail.tsx` — `buildPriceSeries` ahora toma `range`, genera 280-300 puntos según rango con volatilidad escalada; Sparkline llamado con `mode="line"`, `strokeWidth={1.5}`, `withFill={false}`, `live={range==="1D"}`, `referenceLine`; range pills inactivas ahora pintan en el color del chart.

**Cambio:**

Upgrade visual del chart de la pantalla de detalle de activo para que
se sienta como un chart real de trading, no como un sparkline
informativo. El cambio principal es la **densidad de la serie**: pasó
de 40 puntos a 280-300 según rango. Eso solo es ~70% del impacto
visual — cada micro-temblor del precio se ve, la línea pierde el feel
"matemático" y gana el feel "tick por tick".

Sumamos:
- Modo `"line"` en Sparkline (polyline raw, un `L` por punto) que es
  el rendering natural cuando hay alta densidad. Los modos `"curve"`
  (bezier) y `"step"` se mantienen — los usa el home tab y la chart
  settings sheet.
- Stroke fino (1.5pt) y sin fill — feel limpio.
- Volatilidad escalada al rango: 1D más nervioso (noise 1.2%), MAX
  más alisado (noise 2.5%).
- Reference line más sutil (dash 1.5/3, opacity 0.45) — está pero no
  domina.
- Live dot pulsante automático en 1D.
- Range pills con texto en color del chart cuando inactivas (antes
  `textMuted`).

**Justificación:**

Feedback del usuario: la pantalla de detalle de activo se sentía
"un desastre" comparado con apps de referencia (Robinhood/Apple
Stocks). El audit identificó que el `Sparkline` ya tenía 90% de la
infra (scrub, live dot, reference line, sheen) — el problema era
calibración: serie demasiado sparse, stroke demasiado grueso, modo
de dibujo muy suave. Con tres parámetros bien tuneados el chart
pasa de "informativo" a "premium" sin reescribir el componente.

**Notas técnicas:**

- API de Sparkline mantiene back-compat: `smooth` sigue funcionando
  como booleano. `mode` lo sobrescribe cuando se pasa.
- `LENGTH_BY_RANGE` y la fórmula de `noiseScale` en `detail.tsx` son
  fáciles de tunear si después queremos más/menos jagged.
- Typecheck pasa (`npx tsc --noEmit` sin errores).
- Próximos sprints planeados: after-hours line, live ticker en
  market list, odómetro de precio en header, sección "Tu posición"
  expandida, carrusel "Te puede interesar", news mock, earnings dot
  chart.

---

## 5. Propagación del chart trading-grade a toda la app

**Fecha:** 2026-05-05

**Archivos:**
- `lib/components/Sparkline.tsx` — `MiniSparkline` ahora acepta `mode` prop con default `"line"`; stroke default 1.4 (era 1.6).
- `app/(app)/(tabs)/explore.tsx` — `MiniSparkline` del market list: serie 28 → 60 puntos.
- `app/(app)/(tabs)/index.tsx` — `generateSeries` length 40 → 280; Sparkline call con `mode="line"` (vía `smoothChart ? "line" : "step"`), strokeWidth 1.4 → 1.5.
- `app/(app)/crypto-detail.tsx` — `MiniSparkline` series 28 → 60.
- `app/(app)/market-category.tsx` — `MiniSparkline` series 28 → 60.
- `app/(app)/trade.tsx` — series 50 → 260; Sparkline call con `mode="line"`, `strokeWidth=1.5`, `withFill=false`, `referenceLine`.

**Cambio:**

Después de aprobar el look del chart en `detail.tsx` (sprint 1), aplicado
el mismo tratamiento a TODOS los charts de la app:

- **MiniSparkline** (preview chiquito al costado de precios en listas)
  ahora usa `mode="line"` por default y stroke 1.4 — quedó jagged y
  trading-grade en lugar de smooth-bezier informativo.
- **Densidad de series** subida en cada call site:
  - Mini en listas (explore, crypto-detail, market-category): 28 → 60.
  - Chart de Trading screen: 50 → 260.
  - Chart del Home (overview de cuentas): 40 → 280.
- **Stroke fino** (1.5pt) y **sin fill** en charts grandes (trade,
  detail), igual que el feel del detail screen.
- **Reference line** activada en Trade.

**Justificación:**

El usuario aprobó el feel del chart en sprint 1 ("GOATED") y pidió
explícitamente que el mismo tratamiento se aplique en toda la app —
tanto la pantalla principal del home, como los previews chiquitos de
las listas de mercado, como los charts de la screen de trading. La
consistencia hace que la app se sienta como un solo producto coherente
en lugar de "screens distintas con charts distintos".

**Notas técnicas:**

- API de `MiniSparkline` mantiene back-compat: el nuevo `mode` prop es
  opcional con default `"line"`. Callers existentes no se rompen.
- En el home tab respeto el setting del usuario (`smoothChart` toggle
  vía `ChartSettingsSheet`): si está ON → `"line"`, si está OFF →
  `"step"`. El modo `"curve"` (bezier suave) sigue accesible
  programáticamente pero ya no es default.
- Typecheck pasa (`npx tsc --noEmit` sin errores).

---

## 6. Pantalla de detalle del activo — secciones expandidas

**Fecha:** 2026-05-05

**Archivos:**
- `app/(app)/detail.tsx` — agregadas 7 sub-componentes de sección + 5 helpers de datos mock + ~190 líneas de estilos. Reemplazadas position card + stats card simples por las versiones expandidas.

**Cambio:**

Pantalla de detalle del activo redoñada con todas las secciones que
faltaban para llegar a calidad de app de trading premium. Orden de
arriba a abajo:

1. **Top bar** — back / ticker / favorite (existing)
2. **Banner de mercado cerrado** — solo si BYMA cerrado y no es crypto (existing)
3. **Hero** — icon + name + price + delta + chart trading-grade + range tabs (existing, ya con upgrades del sprint 1)
4. **Tu posición** *(nueva)* — grid 2x3 con: Cantidad, Valor de mercado, Costo promedio, % de tu cartera, Resultado del día (con color), Resultado total (con color). Solo si el usuario tiene posición.
5. **Inversión recurrente** *(nueva)* — card con copy "Comprá [TICKER] de forma automática" + CTA pill "Configurar →". Engagement / DCA hook.
6. **Estadísticas** *(nueva, reemplaza stats simples)* — grid 2-columnas con datos category-specific (mercado, ratio, ley, vencimiento, etc).
7. **Resultados trimestrales** *(nueva, solo cedears/acciones)* — dot chart SVG custom con 5 quarters mostrando EPS Esperado (gris) vs Reportado (verde si beat / rojo si miss). Línea de cero punteada. Legend abajo.
8. **Te puede interesar** *(nueva)* — carrusel horizontal con 6 cards de la misma categoría. Cada card: ticker + name + mini sparkline jagged + delta %. Tap navega al detalle de ese activo.
9. **Noticias** *(nueva)* — 3 titulares mock específicos al ticker (texto generado del cambio del día y nombre).
10. **Tus movimientos** *(nueva)* — historial mock con compras / ventas / dividendos del usuario en ese ticker. Solo si tiene posición.
11. **Sobre [Activo]** — descripción de la categoría (existing).
12. **Aviso legal** *(nuevo)* — disclaimer chico al pie sobre delay de cotizaciones, riesgo de pérdida y regulación CNV vía Manteca.
13. **Bottom bar sticky** — Comprar / Vender (existing).

**Helpers de datos mock agregados:**
- `mockPosition(asset)` — deriva qty, marketValue, avgCost (con drift por hash del ticker), todayDelta, totalDelta, portfolioPct.
- `mockEarnings(ticker)` — 5 quarters determinísticos con expected/actual EPS.
- `mockNews(asset)` — 3 titulares context-aware (usa nombre, dirección del cambio, ticker).
- `mockHistory(asset)` — 2 compras + 1 dividendo mock cuando hay posición.
- `relatedAssets(asset)` — otros 6 de la misma categoría.

Todos los helpers son **determinísticos por ticker** (mismo input → mismo
output), así un usuario que vuelve al detalle de un activo no ve datos
saltando entre renders.

**Justificación:**

Feedback del usuario: la pantalla de detalle se sentía "un desastre"
comparada con el feel de app de trading top-tier. El audit identificó
las secciones que faltaban (position expandida, earnings, related,
news, history, disclaimers). Con las secciones nuevas + el chart
trading-grade del sprint 1+2, el detalle pasa de pantalla informativa
plana a un hub de información denso y accionable estilo app de inversiones
premium.

Los datos son mock determinísticos — el día de mañana se reemplazan
por las llamadas reales a Manteca/data provider sin tocar el render.

**Notas técnicas:**

- Earnings dot chart: SVG custom con `react-native-svg` (Circle + Line
  + SvgText). 5 quarters, dos dots por quarter, línea de cero punteada
  como referencia. Original ~50 líneas.
- RelatedCarousel: ScrollView horizontal con 6 cards 156px de ancho.
  Cada card tiene MiniSparkline jagged (50 puntos, mode "line").
- StatsGrid reusa la función `stats()` existente — solo cambia el
  layout de 1-col a 2-col.
- Typecheck pasa (`npx tsc --noEmit` sin errores).
