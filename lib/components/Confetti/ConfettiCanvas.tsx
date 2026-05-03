import { memo, useCallback, useEffect, useReducer, useRef, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { ConfettiManager } from "./ConfettiManager";
import type { Confetto } from "./Confetto";

interface Props {
  manager: ConfettiManager;
}

/**
 * Canvas que dibuja el sistema de partículas con `<View>` nativos —
 * NO svg, NO skia. Cada partícula es un View absoluto con transform
 * + opacity + backgroundColor. Esto va directo por el path nativo
 * de RN (Fabric en new arch), sin bridge cost por nodo, y rinde
 * 60fps con ~150-200 partículas.
 *
 * El frame loop es RAF: cuando el manager queda idle se cancela
 * para no consumir batería.
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
      {manager.particles.map((p, i) => (
        <ParticleSprite key={i} confetto={p} />
      ))}
    </View>
  );
});

interface SpriteProps {
  confetto: Confetto;
}

/**
 * Una partícula = un `<View>` posicionado absoluto. NO memoizado:
 * el Confetto muta in-place y necesitamos que cada re-render del
 * padre lea los valores actuales.
 *
 * Trick para los triángulos: el "CSS border triangle" — un View con
 * width/height = 0 y bordes laterales transparentes deja un
 * triángulo apuntando arriba relleno con borderBottomColor. No
 * existe `<Triangle>` nativo en RN pero esto rinde igual de bien
 * que un Rect.
 */
function ParticleSprite({ confetto }: SpriteProps) {
  const { x, y, rotation, size, alpha, color, shape } = confetto;
  const half = size / 2;
  const rotDeg = (rotation * 180) / Math.PI;

  if (shape === "square") {
    const sy = confetto.squareScaleY();
    return (
      <View
        style={{
          position: "absolute",
          left: x - half,
          top: y - half,
          width: size,
          height: size,
          backgroundColor: color,
          opacity: alpha,
          transform: [{ rotate: `${rotDeg}deg` }, { scaleY: sy }],
        }}
      />
    );
  }

  if (shape === "circle") {
    return (
      <View
        style={{
          position: "absolute",
          left: x - half,
          top: y - half,
          width: size,
          height: size,
          borderRadius: half,
          backgroundColor: color,
          opacity: alpha,
        }}
      />
    );
  }

  // Triangle equilátero — CSS-border trick. La altura natural del
  // borderBottomWidth ya da el triángulo; centramos el bounding box
  // en (x, y) restando half al top y dejando width 0.
  return (
    <View
      style={{
        position: "absolute",
        left: x - half,
        top: y - half,
        width: 0,
        height: 0,
        borderLeftWidth: half,
        borderRightWidth: half,
        borderBottomWidth: size,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderBottomColor: color,
        opacity: alpha,
        transform: [{ rotate: `${rotDeg}deg` }],
      }}
    />
  );
}
