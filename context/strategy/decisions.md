# Decision Log — Álamos Capital

Append-only. No editar entradas existentes. Si se revierte, nueva entrada.
Antes de proponer algo, buscar acá si ya fue evaluado.

---

## [2026-XX-XX] yc-descartado

**Categoría:** Strategy / Fundraising
**Decisión:** No aplicar a Y Combinator.
**Alternativas descartadas:**
  - Aplicar a YC: descartado por decisión unánime de founders
**Rationale:** [rationale del equipo]
**Status:** DECIDIDO

---

## [2026-XX-XX] stack-react-native-expo

**Categoría:** Technical
**Decisión:** React Native 0.81 + Expo SDK 54 + Expo Router 6 para la app mobile.
**Alternativas descartadas:**
  - Flutter: ecosistema más chico en fintech
  - Native iOS + Android: doble esfuerzo, equipo de 3
**Rationale:** Cross-platform, ecosystem maduro, file-based routing, un solo codebase.
**Status:** EJECUTANDO

---

## [2026-XX-XX] no-nativewind

**Categoría:** Technical / Design
**Decisión:** StyleSheet nativo, NO NativeWind/Tailwind.
**Rationale:** Más predecible, sin dependencias extra, control total del design system.
**Status:** DECIDIDO

---

## [2026-XX-XX] design-system-landing-tokens

**Categoría:** Technical / Design
**Decisión:** Design tokens copiados exactos del landing. Plus Jakarta Sans. Off-white cálido (#FAFAF7). Verde marca #00C805.
**Rationale:** Consistencia entre landing y app. Identidad visual unificada.
**Status:** EJECUTANDO

---

## [2026-XX-XX] target-vcs-latam

**Categoría:** Strategy / Fundraising
**Decisión:** Target VCs: Latitud, NXTP, Newtopia, Draper Cygnus, Kaszek.
**Rationale:** Foco en VCs LATAM con thesis en fintech early-stage.
**Status:** DECIDIDO

---

## [2026-05-XX] ai-context-system

**Categoría:** Technical / AI
**Decisión:** Sistema de contexto multi-capa para Claude Code. CLAUDE.md + skills + hooks + context/ + thoughts/. Zero costo adicional.
**Rationale:** Maximizar calidad de outputs de Claude Code sin pagar infra extra.
**Status:** EJECUTANDO

---

---

## [2026-05-XX] alamos-pro-descartado

**Categoría:** Product
**Decisión:** Alamos Pro (terminal densa tipo Binance) descartado. No va a existir.
**Rationale:** Decisión de founders. El foco es una sola experiencia simple, no dos productos.
**Status:** DECIDIDO

---

## [2026-05-XX] dark-mode

**Categoría:** Product / Design
**Decisión:** La app va a tener dark mode como preferencia de usuario. No es un producto separado.
**Alternativas descartadas:**
  - Solo light mode: descartado, los usuarios lo esperan
  - Dark mode como "Alamos Pro": descartado, es simplemente un theme preference
**Rationale:** Es una feature de UX estándar, no un producto diferente.
**Status:** DECIDIDO

---

<!-- ABIERTAS — decisiones que NO están tomadas -->

<!-- ALyC PARTNER: en evaluación. Manteca es candidato pero NO decidido. -->
<!-- ESTRUCTURA CORPORATIVA: 2-3 opciones en evaluación activa. BVI no confirmada. -->
<!-- BACKEND STACK: TypeScript es candidato pero en evaluación. -->
<!-- OPERATORIA CRYPTO: no definida. -->
<!-- OPERATORIA MERCADO US: no definida (CEDEARs vs direct access). -->
<!-- MODELO DE REVENUE: no definido (comisiones, spread, subscription). -->

---

<!-- TEMPLATE:

## [YYYY-MM-DD] slug-descriptivo

**Categoría:** Strategy | Legal | Technical | Product | Fiscal
**Decisión:** [qué se decidió]
**Alternativas descartadas:**
  - [opción A]: [por qué]
  - [opción B]: [por qué]
**Rationale:** [por qué se eligió esta]
**Dependencias:** [qué depende de esta]
**Revierte:** [ID de decisión anterior, si aplica]
**Status:** PROPUESTA | DECIDIDO | EJECUTANDO | COMPLETADO | REVERTIDO

-->
