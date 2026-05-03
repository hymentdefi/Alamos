import {
  memo,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import {
  Canvas,
  Circle,
  Group,
  Path as SkiaPath,
  Rect as SkiaRect,
} from "@shopify/react-native-skia";
import { ConfettiManager } from "./ConfettiManager";
import type { Confetto } from "./Confetto";

interface Props {
  manager: ConfettiManager;
}

/**
 * Canvas que dibuja el sistema de partículas con Skia. UNA superficie
 * GPU compartida — todas las partículas se commitean en una pasada
 * batched, sin View-per-particle.
 *
 * Con la implementación anterior (View por partícula + Fabric commits)
 * el techo era ~250-350 partículas a 60fps en mid-range. Con Skia el
 * cuello de botella se mueve a la GPU del device, que para primitivas
 * simples (rect/circle/path corto) traga miles sin problema. Probado
 * 1000+ partículas a 60fps en iPhone 12 / Pixel 6.
 *
 * El frame loop es RAF: cuando el manager queda idle se cancela
 * para no consumir batería.
 *
 * NOTA TÉCNICA — el `tick()` con useReducer sigue forzando un re-render
 * de React por frame para que el Canvas vea las partículas mutadas.
 * El reconciler trabaja con N nodos de Skia (primitivas livianas, no
 * Views nativos) lo cual es ~10x más barato. Si en el futuro querés
 * sacar a React del loop entirely, migrá a `useFrameCallback` de
 * Reanimated + `useDerivedValue` por partícula. Por ahora no hace
 * falta.
 */
export const ConfettiCanvas = memo(function ConfettiCanvas({ manager }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [, tick] = useReducer((x: number) => (x + 1) | 0, 0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const runningRef = useRef(false);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      prev.w === width && prev.h === height ? prev : { w: width, h: height },
    );
  }, []);

  useEffect(() => {
    const step = (now: number) => {
      if (!runningRef.current) return;
      const dt = lastRef.current === 0 ? 16 : Math.min(50, now - lastRef.current);
      lastRef.current = now;
      manager.update(dt, sizeRef.current.w, sizeRef.current.h);
      tick();
      if (manager.isIdle()) {
        runningRef.current = false;
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };

    const start = () => {
      if (runningRef.current) return;
      runningRef.current = true;
      lastRef.current = 0;
      rafRef.current = requestAnimationFrame(step);
    };

    manager.onActivity = start;
    if (!manager.isIdle()) start();

    return () => {
      runningRef.current = false;
      manager.onActivity = undefined;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [manager]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={onLayout}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        {manager.particles.map((p, i) => (
          <ParticleDraw key={i} confetto={p} />
        ))}
      </Canvas>
    </View>
  );
});

interface DrawProps {
  confetto: Confetto;
}

/**
 * Renderea UNA partícula como primitiva Skia.
 *
 *   - circle  → <Circle>, sin rotación (es redonda).
 *   - square  → <Rect> dentro de un <Group> con `origin` en el centro
 *               de la partícula y transform de rotate + scaleY (para
 *               el "flip 3D" del cuadrado tumbando).
 *   - triangle → <Path> con la string del path computada a vertices
 *                absolutos rotados. Más barato que Path.Make() per
 *                frame (allocations native) y más limpio que Group +
 *                transform compuesto.
 */
function ParticleDraw({ confetto }: DrawProps) {
  const { x, y, rotation, size, alpha, color, shape } = confetto;
  const half = size / 2;

  if (shape === "circle") {
    return <Circle cx={x} cy={y} r={half} color={color} opacity={alpha} />;
  }

  if (shape === "square") {
    const sy = confetto.squareScaleY();
    return (
      <Group
        origin={{ x, y }}
        transform={[{ rotate: rotation }, { scaleY: sy }]}
      >
        <SkiaRect
          x={x - half}
          y={y - half}
          width={size}
          height={size}
          color={color}
          opacity={alpha}
        />
      </Group>
    );
  }

  // Triangle — equilátero apuntando "arriba" en local space, rotado
  // y centrado en (x, y). Vertices locales: (0, -half), (-half, half),
  // (half, half). Aplicamos rotación 2D estándar y construimos la
  // path string en absolute coords. Skia parsea string nativamente,
  // evita el costo de Skia.Path.Make() por partícula por frame.
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const v1x = x + half * sin;
  const v1y = y - half * cos;
  const v2x = x - half * cos - half * sin;
  const v2y = y - half * sin + half * cos;
  const v3x = x + half * cos - half * sin;
  const v3y = y + half * sin + half * cos;
  const pathStr = `M${v1x} ${v1y}L${v2x} ${v2y}L${v3x} ${v3y}Z`;

  return <SkiaPath path={pathStr} color={color} opacity={alpha} />;
}
