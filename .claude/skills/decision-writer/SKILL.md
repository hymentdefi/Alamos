---
name: decision-writer
description: Use when a decision has been made or needs to be recorded. Ensures consistent format in the decision log and prevents recording undecided items as decided.
---

# Registrar Decisiones

## Reglas

1. SOLO registrar decisiones que el equipo CONFIRMÓ. No asumir.
2. Si algo está "casi seguro" pero no confirmado → status: PROPUESTA, no DECIDIDO.
3. Incluir SIEMPRE las alternativas descartadas y por qué.
4. Append-only. No editar entradas anteriores. Si se revierte, nueva entrada.

## Template

```markdown
---

## [YYYY-MM-DD] slug-descriptivo

**Categoría:** Strategy | Legal | Technical | Product | Fiscal
**Decisión:** [qué se decidió]
**Alternativas descartadas:**
  - [opción A]: [por qué se descartó]
  - [opción B]: [por qué se descartó]
**Rationale:** [por qué se eligió esta opción]
**Dependencias:** [qué depende de esta decisión]
**Revierte:** [ID de decisión anterior, si aplica]
**Status:** PROPUESTA | DECIDIDO | EJECUTANDO | COMPLETADO | REVERTIDO
```

## Status válidos

- **PROPUESTA**: planteada pero no confirmada por el equipo
- **DECIDIDO**: confirmada, todavía no se empezó a ejecutar
- **EJECUTANDO**: en proceso de implementación
- **COMPLETADO**: implementada y funcionando
- **REVERTIDO**: se decidió deshacer (debe referenciar la decisión original)

## Archivo destino

`context/strategy/decisions.md`
