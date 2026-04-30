import { Ionicons } from "@expo/vector-icons";

interface Props {
  size?: number;
  color: string;
  /** Mantenido por compatibilidad con call-sites previos — Ionicons
   *  ya maneja el agujero internamente, no se usa. */
  holeColor?: string;
}

/**
 * Gear icon — usa Ionicons `settings-sharp`, el clásico de iOS
 * settings. Lo wrappeamos en este componente para mantener un
 * único punto de entrada en la app y poder cambiar la implementación
 * más tarde si hace falta.
 *
 * Antes intenté un SVG custom (Path con fillRule, después con
 * primitivas Circle+Rect) pero ningún approach replicaba el gear
 * iOS canónico de manera consistente entre iOS y Android. Ionicons
 * lo tiene resuelto, sin necesidad de reinventarlo.
 */
export function GearIcon({ size = 18, color }: Props) {
  return <Ionicons name="settings-sharp" size={size} color={color} />;
}
