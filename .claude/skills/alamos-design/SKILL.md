---
name: alamos-design
description: Use ALWAYS when creating or modifying ANY UI — screens, components, layouts, styles. Defines the Álamos visual identity, patterns, and anti-patterns. If you are about to write StyleSheet code, READ THIS FIRST.
---

# Álamos Design System

## Gold Standard

**Antes de crear cualquier pantalla nueva, LEER el archivo de stock detail** (buscar el archivo de detail/detalle de activo en `app/`). Esa pantalla es la referencia de cómo debe verse y sentirse Álamos. Estudiar su estructura, espaciado, uso de tokens, tipografía, y composición general. Toda pantalla nueva debe alcanzar ese nivel de calidad.

## Filosofía

Álamos NO es una app de finanzas genérica. Es una experiencia de inversión que se siente personal, cálida y accesible. La referencia estética es Robinhood: limpia, con espacio para respirar, donde cada elemento tiene propósito.

Si lo que estás construyendo podría pertenecer a cualquier app de fintech, ESTÁ MAL. Cada pantalla debe sentirse inequívocamente Álamos.

## Identidad visual

### Tono
- **Cálido, no corporativo.** Off-whites en vez de blancos puros. Verdes tierra en vez de verdes neón.
- **Confianza sin frialdad.** Los números financieros se presentan con calma, no con urgencia.
- **Simple pero no vacío.** Cada espacio en blanco es intencional.

### Color — NUNCA improvisar

Todos los colores salen de `lib/theme/index.ts` via `useTheme()`. SIN EXCEPCIONES.

**Theme-aware** — los tokens cambian según light/dark mode. Los hex de abajo son referencia, no hardcodearlos.

```
FONDOS (theme-aware)
  bg              ← fondo principal del screen
  bgWarm          ← fondo levemente elevado, secciones alternas
  surface         ← cards, modales, elementos elevados
  surfaceHover    ← estado hover/disabled/raised
  surfaceSunken   ← inputs, campos de texto

TEXTO (theme-aware)
  text            ← texto principal — invertido por theme (oscuro en light, claro en dark)
  textSecondary   ← texto secundario
  textMuted       ← labels, placeholders, inactive
  textFaint       ← texto deshabilitado

MARCA — UN solo verde, mismo en ambos modes
  brand: #00C805  ← TODO el verde de la app: logo, CTAs, selecciones activas,
                    deltas positivos. NO existe diferencia entre brand/action/
                    positive — es el mismo token usado en todos esos roles.
  onColor         ← ink que va SOBRE c.brand: blanco en light, casi-negro en dark.
                    Theme-aware automático. USAR esto para texto sobre brand.

DOWN (deltas negativos / destructive)
  red             ← naranja del down state (#EB5D2A light / #F26A3D dark).
                    NO es rojo puro — es naranja por feedback explícito del user.
                    Usar para deltas negativos Y destructive actions (eliminar).

BORDES
  border          ← bordes sutiles, inactive outlines
  borderStrong    ← bordes más visibles cuando hace falta
```

REGLA ABSOLUTA: hay UN solo verde (`c.brand` = #00C805). NO existen otros verdes en la app (los tokens `action`, `positive`, `green` históricos están consolidados en `brand`). Si necesitás "un verde", usá `c.brand`. NO inventes verdes nuevos. NO hardcodear `#00C805` ni `rgba(0,200,5,...)` — siempre vía `c.brand`.

REGLA ABSOLUTA: el down state es NARANJA (`c.red`, ~#EB5D2A), no rojo puro. Aplicar consistentemente para deltas negativos y destructive actions.

### Tipografía — Plus Jakarta Sans

- Font family: Plus Jakarta Sans. Pesos 400/500/600/700/800.
- Acceder via `fontFamily[peso]` desde `lib/theme`.
- Letter-spacing NEGATIVO en todo (-0.1 a -2 según tamaño). Esto es parte de la identidad.
- Display: 44-52px, weight 700, letterSpacing: -2
- H1: 28-32px, weight 700, letterSpacing: -1
- Body: 15-17px, weight 500, letterSpacing: -0.3
- Small: 13px, weight 500
- Usar helpers `type.{display,h1,h2,body,small,...}` desde `lib/theme`.

### Esquinas — SIEMPRE continuous (squircle)

NUNCA `borderRadius` solo. SIEMPRE con `borderCurve: "continuous"`.

```ts
// ✅ CORRECTO — siempre
{ borderCurve: "continuous", borderRadius: radius.lg }

// ❌ INCORRECTO — nunca
{ borderRadius: 16 }
```

Para componentes hero (Button principal, cards destacadas, modales): usar `<Squircle>` de `lib/components/Squircle.tsx`.

Radius tokens: sm:8, md:12, lg:16, xl:20, xxl:28, pill:999

### Espaciado

Consistente, generoso. No apretar elementos. El espacio es parte del diseño.
Usar los spacing tokens de `lib/theme` cuando existan.

## Sistema de jerarquía de botones — DOS CATEGORÍAS ESTRICTAS

Álamos tiene **solo dos tipos de botones interactivos**. Nada en el medio.

### A. PRIMARY CTA — filled brand (UNA por pantalla)

Acción principal de un screen. "Crear alerta", "Comprar", "Continuar", "Confirmar", "Aceptar", "Iniciar sesión", "Crear cuenta", "Agregar alerta", "Operar".

```ts
{
  backgroundColor: c.brand,
  borderCurve: "continuous",
  borderRadius: radius.pill,  // o radius.lg según contexto
}
// Texto: { color: c.onColor }  ← blanco en light, oscuro en dark
```

Estados:
- Disabled: `{ backgroundColor: c.surfaceHover }`, text `c.textMuted`
- Loading: `opacity: 0.7`
- Pressed: `opacity: 0.85-0.9`

### B. SECONDARY — outline brand (selecciones importantes, no primarias)

Chips activos, segmented activos, OptionList activo, filtros aplicados, "Ver detalle" si lo querés en brand.

```ts
{
  backgroundColor: "transparent",     // ← JAMÁS tint fill
  borderColor: c.brand,
  borderWidth: 1.5,
  borderCurve: "continuous",
}
// Texto: { color: c.brand }
```

### C. INACTIVE — outline gray

Chips/segmented disponibles pero no seleccionados.

```ts
{
  backgroundColor: "transparent",
  borderColor: c.border,
  borderWidth: 1.5,
}
// Texto: { color: c.textMuted }
```

### D. DESTRUCTIVE — outline red (naranja)

"Eliminar alerta", "Cerrar cuenta", "Borrar permanentemente".

```ts
{
  borderColor: c.red,
  borderWidth: 1.5,
}
// Texto: { color: c.red }
```

### Reglas absolutas del sistema

1. **NO medio fill.** Tinted bg (`${c.brand}10`, `rgba(0,200,5,0.X)`, etc) en un elemento interactivo está MAL. Outline puro.
2. **NO neutral white/black CTA.** `backgroundColor: c.ink` o `c.text` para CTAs es el patrón viejo abandonado. Usar brand.
3. **`c.onColor` para texto sobre brand**, no `c.bg` (no es lo mismo).
4. **Disabled mantiene la forma** del filled, baja a `c.surfaceHover` + `c.textMuted`.
5. **Excepciones permitidas para tinted bg**: hero illustration containers (display, no interactivo), tooltips, dim overlays, message bubbles, avatares. Eso NO son botones.

## Patrones de UI — cómo se ve Álamos

### Cards de activos
- Fondo `surface` sobre `bg`.
- Icono del activo a la izquierda (código de 2-4 letras en un circle).
- Nombre del activo + ticker en texto principal/secundario.
- Precio actual + delta porcentual a la derecha.
- Delta usa `positive` si positivo, `red` si negativo.
- Sparkline sutil debajo o al lado del delta.
- borderCurve: continuous. SIEMPRE.

### Pantallas de detalle
- Hero con precio grande (display size) y delta.
- Chart interactivo debajo.
- Stats del activo en grid o lista.
- Stats específicos por tipo (CEDEAR: ratio, subyacente; Bono: TIR, duration; FCI: TNA, patrimonio).
- CTA de compra fijo en el bottom.

### Flujo de compra
- Keypad para ingresar monto (estilo Robinhood/Cash App).
- Confirm: resumen claro de lo que va a pasar.
- Success: animación o feedback visual positivo, no solo texto.

### Bottom tabs
- 5 tabs: Inicio / Mercado / Cartera / Noticias / Perfil.
- Active tab: pill con `action` color, icon filled.
- Inactive: icon outline, `textMuted`.

### Headers
- Limpios, sin bordes bottom pesados. Usan `bg` como fondo.
- Título en weight 700, no 800.

## Anti-patterns — lo que NUNCA debe pasar

1. **Colores hardcodeados**: NUNCA `color: '#333'`, `backgroundColor: 'white'`, ni `BRAND_GREEN = "#00C805"` constants. Siempre tokens via `useTheme()`. No `rgba(0,200,5,...)` literal.
2. **Diseño genérico**: si podría ser cualquier app de fintech, rehacerlo. Debe sentirse Álamos.
3. **borderRadius sin borderCurve**: ya explicado. NUNCA.
4. **NativeWind/Tailwind**: NO existe en este proyecto. Solo `StyleSheet.create()`.
5. **Componentes inventados**: antes de crear un nuevo Button, Card, Input — revisar `lib/components/`.
6. **Medio fill en interactivos**: tinted bg (brand al 5-15% de opacity, sea via `rgba()` o `${c.brand}XX`) en chips/segmented/buttons activos está PROHIBIDO. Outline puro o filled solid, nada en el medio. Excepción única: hero illustration containers / display frames, que NO son táctiles.
7. **Neutral white/black CTA**: `backgroundColor: c.ink` o `c.text` para botones primarios es el patrón viejo abandonado. Usar `c.brand` + `c.onColor`.
8. **Letter-spacing positivo o cero**: Álamos usa letter-spacing negativo en toda la tipografía.
9. **Sombras fuertes**: si necesitás elevar, usar sombras sutiles. La elevación viene del color (surface sobre bg), no de drop-shadows pesados.
10. **Texto sobre brand con `c.bg`**: usar `c.onColor` (theme-aware: blanco en light, oscuro en dark). `c.bg` no se invierte correctamente.

## Componentes existentes — USAR antes de crear

- `Button.tsx` — variants:
  - `primary` y `accent`: filled brand (`c.brand` bg + `c.onColor` text)
  - `secondary`: outline gris con text `c.text` (theme-aware)
  - `ghost`: text-only sin chrome, text `c.text`
- `Logo.tsx` — `<AlamosLogo variant tone size />`. mark/lockup/lockupShort.
- `Sparkline.tsx` — chart reutilizable con `pathFromSeed()`.
- `Squircle.tsx` — wrapper para squircle cross-platform en componentes hero.

## Cómo testear si tu output es "Álamos-styled"

Preguntate:
1. ¿Usa SOLO colores de los tokens del theme (sin hardcoded hex / rgba)? → Si no, está mal.
2. ¿Tiene borderCurve: continuous en TODAS las esquinas redondeadas? → Si no, está mal.
3. ¿Usa Plus Jakarta Sans con letter-spacing negativo? → Si no, está mal.
4. ¿Los botones siguen las dos categorías estrictas (filled brand vs outline) sin medio fill? → Si no, está mal.
5. ¿Texto sobre brand usa `c.onColor`? → Si no, está mal.
6. ¿Se ve como algo que podría estar en Robinhood? → Si no, repensar.
7. ¿Se diferencia de una app genérica de finanzas? → Si no, está mal.
