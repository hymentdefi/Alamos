---
name: alamos-components
description: Use when creating or modifying React Native components. Lists all existing components with their APIs to prevent duplication. Check here BEFORE creating any new component.
---

# Componentes Álamos

## Regla #1: no duplicar

Antes de crear CUALQUIER componente nuevo, verificar si ya existe uno que sirva.
Si existe, usarlo. Si necesita extensión, extenderlo. No crear otro.

## Componentes existentes

### Button (`lib/components/Button.tsx`)
Variantes: primary, secondary, accent, ghost.
Props: variant, onPress, disabled, loading, children.
Usa `<Squircle>` internamente para el background.
NO crear otro componente de botón. Extender este si hace falta.

### AlamosLogo (`lib/components/Logo.tsx`)
Props: variant (mark | lockup | lockupShort), tone (light | dark), size.
- mark: isotipo (2 triángulos)
- lockup: ícono + "Alamos Capital"
- lockupShort: ícono + "Alamos"
Verde de marca: #00C805 (constante `brand.green`).

### Sparkline (`lib/components/Sparkline.tsx`)
Chart reutilizable para mini-gráficos de precio.
Incluye `pathFromSeed()` para generar datos mock.
Usa react-native-svg.

### Squircle (`lib/components/Squircle.tsx`)
Wrapper cross-platform para esquinas continuous (squircle real en iOS y Android).
Encapsula `react-native-figma-squircle`.
Usar para componentes hero (Button, cards destacadas, modales).
Para el resto, `borderCurve: "continuous"` + `borderRadius` alcanza.

## Theme system (`lib/theme/index.ts`)

### Acceso a tokens
```ts
const { c, type, radius, spacing, fontFamily } = useTheme();
```

- `c` — colores del theme actual (light/dark)
- `type` — estilos de tipografía predefinidos (display, h1, h2, body, small, etc.)
- `radius` — sm:8, md:12, lg:16, xl:20, xxl:28, pill:999
- `fontFamily` — objeto con pesos: fontFamily[400], fontFamily[700], etc.

### Patrón de estilos
```ts
export default function MyScreen() {
  const { c, type, radius } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <Text style={[type.h1, { color: c.text }]}>Título</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
});
```

## Mock data (`lib/data/assets.ts`)

Contiene arrays de CEDEARs, bonos y FCI con datos mockeados.
Helpers: `formatARS()`, `formatPct()`, `assetIconCode()`.
Usar estos para cualquier pantalla que necesite datos de activos.
