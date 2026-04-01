# CLAUDE.md — Alamos Capital

## Qué es este proyecto

App móvil de inversiones para retail investors en Argentina. Hecha con React Native + Expo.

## Stack

- **Framework:** React Native 0.81 + Expo SDK 54
- **Router:** Expo Router 6 (file-based routing)
- **Language:** TypeScript
- **Auth backend:** Manteca (ALyC argentina) — JWT tokens
- **Secure storage:** expo-secure-store
- **Styling:** StyleSheet objects (NO NativeWind — se removió por bugs con Metro en Windows)

## Estructura del proyecto

```
app/
  _layout.tsx          → Root layout, AuthProvider + AuthGate
  (auth)/
    _layout.tsx        → Stack navigator sin header
    login.tsx          → Pantalla de login
    register.tsx       → Pantalla de registro (pide CUIL/CUIT)
  (app)/
    _layout.tsx        → Tab navigator (Portfolio, Mercado, Perfil)
    index.tsx          → Portfolio screen
    market.tsx         → Market screen (placeholder)
    profile.tsx        → Profile screen

lib/
  auth/
    context.tsx        → AuthProvider con React Context, SecureStore para tokens
    manteca.ts         → API client para Manteca (login, register, getMe). Tiene MOCK_MODE=true
  theme/
    index.ts           → Design tokens (colors) ⚠️ NECESITA ACTUALIZACIÓN a los colores de abajo
```

## Estado actual

- Auth flow completo (login/register) funcionando con mocks
- 3 tabs: Portfolio, Mercado, Perfil
- La API de Manteca está preparada pero en MOCK_MODE=true
- Sin NativeWind — usar StyleSheet.create() para estilos
- Tema centralizado en lib/theme/index.ts (colores actuales están desactualizados, usar los de abajo)

## API de Manteca

- Base URL: https://api.manteca.dev
- Endpoints: POST /auth/login, POST /auth/register, GET /auth/me
- Auth: Bearer token en header Authorization
- Actualmente mockeado (MOCK_MODE=true en lib/auth/manteca.ts)

## Branding y colores

Extraídos del logo oficial. El verde es neón/esmeralda, NO verde oscuro.

```typescript
// COLORES CORRECTOS DE MARCA — usar estos, no los que están en lib/theme/index.ts
brand:   { 500: "#00E676", 700: "#00C853" }  // Verde neón del logo
surface: { 0: "#0A0A0A", 50: "#121212", 100: "#191919", 200: "#242424" }  // Fondo oscuro del logo (#191919)
text:    { primary: "#FFFFFF", secondary: "#9E9E9E", muted: "#616161" }
accent:  { positive: "#00E676", negative: "#EF5350" }
```

Regla: el verde de marca es `#00E676`. Si algo necesita un verde, usar ese. No inventar otros verdes.

## Convenciones

- Estilos: usar `StyleSheet.create()`, importar colors desde `lib/theme`
- Archivos nuevos en español para UI text, código en inglés
- Commits en español: "agregué pantalla de mercado"
- NO usar NativeWind, NO usar className props
- Componentes compartidos van en `lib/components/`
- Servicios de API van en `lib/api/`

## Cómo correr

```bash
npm install --legacy-peer-deps
npx expo start
# Si no conecta el celular: npx expo start --tunnel
```

## Próximos pasos

- Actualizar lib/theme/index.ts con los colores de marca correctos
- Conectar Manteca API real (sacar MOCK_MODE)
- Pantalla de mercado con cotizaciones
- Portfolio con datos reales
- Detalle de activo + compra/venta
- Onboarding para usuarios nuevos
- Componentes reutilizables (Button, Card, Input)
