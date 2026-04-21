# CLAUDE.md — Alamos Capital

## Qué es este proyecto

App móvil de inversiones para retail en Argentina. Productos: CEDEARs, bonos soberanos y fondos comunes de inversión. React Native + Expo.

## Stack

- **Framework:** React Native 0.81 + Expo SDK 54
- **Router:** Expo Router 6 (file-based)
- **Language:** TypeScript
- **Auth backend:** Manteca (ALyC argentina) — MOCK_MODE=true
- **Secure storage:** expo-secure-store
- **Styling:** StyleSheet — NO NativeWind
- **Tipografía:** Plus Jakarta Sans (via @expo-google-fonts)
- **SVG/Charts:** react-native-svg

## Estructura

```
app/
  _layout.tsx                → Root. Carga fuentes, splash, AuthProvider, AuthGate
  (auth)/
    welcome.tsx              → Landing-style welcome
    login.tsx                → Login email/password
    register.tsx             → Registro multi-step (email/pw/nombre/CUIL)
  (app)/
    _layout.tsx              → Tabs: Inicio / Mercado / Cartera / Noticias / Perfil
    index.tsx                → Home (mockup del landing: balance + chart + tabs + lista)
    explore.tsx              → Mercado (legacy, pendiente rediseño fase 2)
    portfolio.tsx            → Cartera (legacy, pendiente)
    news.tsx                 → Noticias (legacy, pendiente)
    profile.tsx              → Perfil (legacy, pendiente)
    detail.tsx, buy.tsx,
    confirm.tsx, success.tsx → Flow de compra (legacy)

lib/
  auth/
    context.tsx              → AuthProvider, SecureStore para tokens
    manteca.ts               → API client mockeado
  components/
    Button.tsx               → Botón reutilizable (primary/secondary/accent/ghost)
    Logo.tsx                 → <AlamosLogo /> — variants: mark/lockup/lockupShort
    AssetItem.tsx            → Legacy, pendiente refactor
  data/
    assets.ts                → CEDEARs, bonos, FCI + helpers formatARS/formatPct
  theme/
    index.ts                 → Tokens (light + dark), tipografía, radius, spacing

assets/
  brand-assets/              → Brand pack oficial (app/, empresa/, empresa-mono/)
  index.html                 → Landing de referencia (no se usa en app)
  icon.png, splash-icon.png  → Derivados del brand pack para Expo
```

## Design tokens

Copiados exactos del landing (`assets/index.html`).

### Colores (light — default)
```
bg:            #FAFAF7   // off-white cálido
bgWarm:        #F2F1EB
surface:       #FFFFFF
surfaceHover:  #F2F1EB
surfaceSunken: #EBEBE3
border:        #E5E4DC
text:          #0E0F0C   // ink
textSecondary: #2A2B27
textMuted:     #6B6C66
textFaint:     #B8B8B0
green:         #00E676   // brand
greenDark:     #00B85C   // chart lines, deltas
red:           #C83B3B   // negativos
```

### Tipografía
- **Plus Jakarta Sans** — pesos 400/500/600/700/800
- Display: 44-52px, weight 700, letter-spacing ~-2
- Body: 15-17px, weight 500
- Letter-spacing negativo en todo (entre -0.1 y -2 según tamaño)
- Helpers: `fontFamily[weight]` y `type.{display,h1,h2,body,small,...}` desde `lib/theme`

### Radius
```
sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, pill: 999
```

### Dark mode
Existe `dark` en `themes` pero por default se usa `light`. Pensado para Alamos Pro (terminal tipo Binance). No activo aún.

## Logos

3 familias en `assets/brand-assets/`:
- **app/** — app icon con halo (iOS/Android/favicon)
- **empresa/** — outline bold con verde + negro (uso general)
- **empresa-mono/** — un solo color (blanco/negro/verde, para fondos fuertes)

Usar `<AlamosLogo variant tone size />`:
- `variant="mark"` — isotipo (2 triángulos)
- `variant="lockup"` — ícono + "Alamos Capital"
- `variant="lockupShort"` — ícono + "Alamos"
- `tone="light"|"dark"` — según fondo

Regla: el verde de marca es `#00E676`. No inventar otros verdes.

## API de Manteca

- Base: `https://api.manteca.dev`
- Endpoints: POST /auth/login, POST /auth/register, GET /auth/me
- Auth: Bearer token en header
- MOCK_MODE=true en `lib/auth/manteca.ts`

## Convenciones

- Estilos: `StyleSheet.create()`, colores via `useTheme()` (preferido) o `colors` export (legacy)
- UI text en español; código en inglés
- Commits en español: "agregué X", "mejoré Y"
- Componentes compartidos en `lib/components/`
- Servicios de API en `lib/api/` (cuando se cree)

## Cómo correr

```bash
npm install --legacy-peer-deps
npx expo start
# Si no conecta el celular: npx expo start --tunnel
```

## Estado actual

- ✓ Branding nuevo completo (logo, colores, tipografía)
- ✓ Theme light-first con tokens del landing
- ✓ Home rediseñada matching el mockup
- ✓ Auth (welcome/login/register) con estilo landing
- ⚠ Otras pantallas (portfolio, explore, detail, buy, perfil, etc.) siguen usando
  el `colors` legacy (mapeado a light) — funcionan pero falta rediseño
- ⚠ Pantallas Robinhood (crypto, margin, options, lending, cash) eliminadas

## Próximos pasos (Fase 2)

- Rediseñar Mercado (explore) con categorías CEDEARs/Bonos/FCI al estilo landing
- Rediseñar Detalle de activo (tipos distintos: CEDEAR vs bono vs FCI)
- Rediseñar flow de compra (buy → confirm → success)
- Rediseñar Cartera (portfolio)
- Rediseñar Perfil y settings
- Sacar MOCK_MODE de Manteca y conectar API real
- Explorar modo Alamos Pro (dark + terminal densa)
