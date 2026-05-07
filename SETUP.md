# Sistema de Contexto v3 — Setup

## Qué incluye

1. **CLAUDE.md** (≤60 líneas) — constitución del proyecto. Reemplaza el actual.
2. **`.claude/skills/`** — 4 skills de progressive disclosure:
   - `alamos-design`: design system completo. Se auto-carga en cualquier tarea de UI.
   - `alamos-components`: catálogo de componentes existentes. Previene duplicación.
   - `regulatory-research`: metodología para investigación regulatoria.
   - `decision-writer`: formato y reglas para el decision log.
3. **`.claude/agents/`** — 1 subagent:
   - `design-reviewer`: revisa compliance de UI con el design system.
4. **`.claude/settings.json`** — permisos + hook post-edit que detecta violaciones de diseño.
5. **`.claude/hooks/`** — script que chequea colores hardcodeados, squircle, NativeWind, etc.
6. **`context/`** — strategy + domains con status REALES (nada asumido como decidido).
7. **`thoughts/`** — directorio para persistir research y planes entre sesiones.
8. **`.mcp.json` + `.mcp-servers/`** — MCP server local para decision log.

## Instalación

### 1. Copiar al monorepo

```bash
# REEMPLAZAR el CLAUDE.md actual:
cp CLAUDE.md /path/to/repo/

# Copiar todo lo nuevo:
cp -r .claude/ /path/to/repo/
cp -r context/ /path/to/repo/
cp -r thoughts/ /path/to/repo/
cp .mcp.json /path/to/repo/
cp -r .mcp-servers/ /path/to/repo/
```

### 2. Hacer el hook ejecutable

```bash
chmod +x /path/to/repo/.claude/hooks/check-design-rules.sh
```

### 3. Instalar MCP server

```bash
cd /path/to/repo/.mcp-servers/decisions-log
npm install
```

### 4. Agregar a .gitignore

```
# Claude Code local
CLAUDE.local.md
.claude/settings.local.json
thoughts/personal/
```

### 5. Verificar

En Claude Code:
- "¿Qué es Álamos?" → debe responder con contexto completo
- "Haceme un card de activo" → debe usar tokens de Álamos, borderCurve continuous, off-white bg
- "¿Qué decisiones están tomadas?" → debe listar solo las realmente decididas
- "¿Cuál es nuestro ALyC partner?" → debe decir "en evaluación, no definido"

## Uso diario

### Desarrollo de UI
Claude Code auto-carga el skill `alamos-design` cuando detecta trabajo de UI.
El hook post-edit chequea violaciones automáticamente.
Podés invocar el design-reviewer subagent con: "Revisá estos cambios de UI"

### Registrar decisiones
"Registrá que decidimos usar Supabase para la DB" → usa el skill decision-writer

### Research
"Investigá opciones de ALyC" → carga el skill regulatory-research + contexto de domains/

### Persistir entre sesiones
"Guardá este research en thoughts/shared/research/" → sobrevive /clear y sesiones nuevas

### Limpiar contexto
Usar `/clear` entre tareas distintas. Mantener uso bajo 60% del context window.
Usar `/compact` si la sesión se alarga.
