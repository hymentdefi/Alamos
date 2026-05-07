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

```
FONDOS
  bg: #FAFAF7        ← fondo principal. Off-white cálido, NO blanco puro.
  bgWarm: #F2F1EB     ← fondo secundario, secciones alternas.
  surface: #FFFFFF    ← cards, modales, elementos elevados.
  surfaceSunken: #EBEBE3 ← inputs, campos de texto.

TEXTO
  text: #0E0F0C       ← texto principal. Casi negro, NO #000000.
  textSecondary: #2A2B27 ← texto secundario.
  textMuted: #6B6C66   ← labels, placeholders.
  textFaint: #B8B8B0   ← texto deshabilitado.

MARCA
  brand: #00C805       ← ÚNICO verde de marca. Para el logo y branding SOLAMENTE.
  action: #5ac43e      ← verde tierra para CTAs, nav active pill, botones primarios.
  positive: #00A304    ← deltas positivos en charts/precios. NO para UI general.
  red: #C83B3B         ← deltas negativos, errores.

BORDES
  border: #E5E4DC      ← bordes sutiles. NO usar gris puro.
```

REGLA ABSOLUTA: `brand` (#00C805) es SOLO para el logo y elementos de identidad de marca. Para botones y CTAs usar `action` (#5ac43e). Para deltas de precio usar `positive`/`red`. Nunca mezclar estos roles.

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

1. **Colores hardcodeados**: NUNCA `color: '#333'` o `backgroundColor: 'white'`. Siempre tokens via `useTheme()`.
2. **Diseño genérico**: si podría ser cualquier app de fintech, rehacerlo. Debe sentirse Álamos.
3. **borderRadius sin borderCurve**: ya explicado. NUNCA.
4. **NativeWind/Tailwind**: NO existe en este proyecto. Solo `StyleSheet.create()`.
5. **Componentes inventados**: antes de crear un nuevo Button, Card, Input — revisar `lib/components/`.
6. **Verde de marca en CTAs**: brand (#00C805) es SOLO para logo. CTAs usan action (#5ac43e).
7. **Blanco puro como fondo**: el fondo es #FAFAF7, no #FFFFFF. Superficie es #FFFFFF.
8. **Texto negro puro**: el texto es #0E0F0C, no #000000.
9. **Letter-spacing positivo o cero**: Álamos usa letter-spacing negativo en toda la tipografía.
10. **Sombras fuertes**: si necesitás elevar, usar sombras sutiles. La elevación viene del color (surface sobre bg), no de drop-shadows pesados.

## Componentes existentes — USAR antes de crear

- `Button.tsx` — primary/secondary/accent/ghost. NO crear otro botón.
- `Logo.tsx` — `<AlamosLogo variant tone size />`. mark/lockup/lockupShort.
- `Sparkline.tsx` — chart reutilizable con `pathFromSeed()`.
- `Squircle.tsx` — wrapper para squircle cross-platform en componentes hero.

## Cómo testear si tu output es "Álamos-styled"

Preguntate:
1. ¿Usa SOLO colores de los tokens? → Si no, está mal.
2. ¿Tiene borderCurve: continuous en TODAS las esquinas redondeadas? → Si no, está mal.
3. ¿Usa Plus Jakarta Sans con letter-spacing negativo? → Si no, está mal.
4. ¿Se ve como algo que podría estar en Robinhood? → Si no, repensar.
5. ¿Se diferencia de una app genérica de finanzas? → Si no, está mal.
6. ¿El fondo principal es off-white (#FAFAF7), no blanco puro? → Si no, está mal.
