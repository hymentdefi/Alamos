import { memo, useCallback, useEffect, useReducer, useRef, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, G, Polygon, Rect } from "react-native-svg";
import { ConfettiManager } from "./ConfettiManager";
import type { Confetto } from "./Confetto";

interface Props {
  manager: ConfettiManager;
}

/**
 * Canvas que dibuja el sistema de partículas. Usa `react-native-svg`
 * para no requerir un módulo nativo extra (Skia exige rebuild del
 * dev client). El frame loop es un requestAnimationFrame estándar
 * driveado por JS — cuando el manager queda idle se cancela para no
 * consumir batería.
 *
 * Las partículas viven en JS (manager.particles) y mutan in-place.
 * Cada frame disparamos un setTick() para que React re-render el SVG
 * con las posiciones nuevas. Con ~230 partículas por 3s, el costo de
 * re-render es aceptable.
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

  // Loop de animación. RAF cuando hay actividad, idle cuando no.
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

  if (size.w === 0 || size.h === 0) {
    // Sin layout no podemos dibujar nada útil — solo registramos
    // para que el primer onLayout dispare el seteo y arranque.
    return (
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        onLayout={onLayout}
      />
    );
  }

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={onLayout}
    >
      <Svg width={size.w} height={size.h}>
        {manager.particles.map((p, i) => (
          <ParticleSprite key={i} confetto={p} />
        ))}
      </Svg>
    </View>
  );
});

interface SpriteProps {
  confetto: Confetto;
}

/**
 * Render de una partícula. NO está memoizado — el Confetto muta
 * in-place y necesitamos que cada re-render del padre lea los
 * valores actuales.
 */
function ParticleSprite({ confetto }: SpriteProps) {
  const { x, y, rotation, size, alpha, color, shape } = confetto;
  const half = size / 2;
  const rotDeg = (rotation * 180) / Math.PI;

  if (shape === "square") {
    const sy = confetto.squareScaleY();
    return (
      <G
        opacity={alpha}
        transform={`translate(${x} ${y}) rotate(${rotDeg}) scale(1 ${sy})`}
      >
        <Rect
          x={-half}
          y={-half}
          width={size}
          height={size}
          fill={color}
        />
      </G>
    );
  }

  if (shape === "circle") {
    return (
      <Circle cx={x} cy={y} r={half} fill={color} opacity={alpha} />
    );
  }

  // triangle equilátero centrado en (0,0), apuntando arriba.
  const t = half;
  const points = `0,${-t} ${t * 0.866},${t * 0.5} ${-t * 0.866},${t * 0.5}`;
  return (
    <G
      opacity={alpha}
      transform={`translate(${x} ${y}) rotate(${rotDeg})`}
    >
      <Polygon points={points} fill={color} />
    </G>
  );
}
