#!/bin/bash
# Post-edit hook: checks for common Álamos design rule violations.
# Exit 0 = pass (with optional warnings), exit 1 = fail with message.
# This runs after every Edit/Write tool use.

FILE="$TOOL_INPUT_PATH"

# Only check .tsx and .ts files
if [[ ! "$FILE" =~ \.(tsx?|jsx?)$ ]]; then
  exit 0
fi

# Skip non-UI files
if [[ "$FILE" =~ (node_modules|\.claude|context/|thoughts/|assets/) ]]; then
  exit 0
fi

WARNINGS=""

# Check 1: borderRadius without borderCurve
if grep -n 'borderRadius' "$FILE" | grep -v 'borderCurve' | grep -v '//' | head -5 | grep -q .; then
  WARNINGS="$WARNINGS\n⚠️  SQUIRCLE: Found borderRadius without borderCurve: 'continuous' in $FILE. Every borderRadius MUST have borderCurve: 'continuous'."
fi

# Check 2: Hardcoded colors (hex codes not in theme)
if grep -nE "color:\s*['\"]#" "$FILE" | grep -v 'theme' | grep -v '//' | head -3 | grep -q .; then
  WARNINGS="$WARNINGS\n⚠️  COLORS: Found hardcoded hex color in $FILE. Use tokens from useTheme() instead."
fi
if grep -nE "backgroundColor:\s*['\"]#" "$FILE" | grep -v 'theme' | grep -v '//' | head -3 | grep -q .; then
  WARNINGS="$WARNINGS\n⚠️  COLORS: Found hardcoded backgroundColor in $FILE. Use tokens from useTheme() instead."
fi

# Check 3: NativeWind / Tailwind usage
if grep -n 'className=' "$FILE" | head -3 | grep -q .; then
  WARNINGS="$WARNINGS\n⚠️  NATIVEWIND: Found className prop in $FILE. Álamos uses StyleSheet.create(), not NativeWind."
fi
if grep -n 'nativewind\|tailwind' "$FILE" | head -3 | grep -q .; then
  WARNINGS="$WARNINGS\n⚠️  NATIVEWIND: Found NativeWind/Tailwind reference in $FILE. Not used in this project."
fi

# Check 4: Pure white background
if grep -nE "backgroundColor:\s*['\"]#(FFFFFF|ffffff|FFF|fff)['\"]" "$FILE" | grep -v 'surface' | grep -v '//' | head -3 | grep -q .; then
  WARNINGS="$WARNINGS\n⚠️  WHITE: Found pure white (#FFFFFF) as background in $FILE. Use c.bg (#FAFAF7) for main background, c.surface for cards."
fi

# Check 5: Pure black text
if grep -nE "color:\s*['\"]#(000000|000)['\"]" "$FILE" | grep -v '//' | head -3 | grep -q .; then
  WARNINGS="$WARNINGS\n⚠️  BLACK: Found pure black (#000000) as text color in $FILE. Use c.text (#0E0F0C) instead."
fi

if [ -n "$WARNINGS" ]; then
  echo -e "$WARNINGS"
  echo ""
  echo "Fix these before continuing. See .claude/skills/alamos-design/SKILL.md for rules."
  # Exit 0 with warnings (non-blocking but visible). Change to exit 2 to hard-block.
  exit 0
fi

exit 0
