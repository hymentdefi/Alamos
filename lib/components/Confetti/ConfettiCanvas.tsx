import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import {
  Canvas,
  Circle,
  Group,
  Path,
  Rect,
  Skia,
} from "@shopify/react-native-skia";
import { runOnJS } from "react-native-reanimated";
import { useFrameCallback } from "react-native-reanimated";
import { ConfettiManager } from "./ConfettiManager";
import type { Confetto } from "./Confetto";

interface Props {
  manager: ConfettiManager;
}

/**
 * Canvas que dibuja el sistema de partículas del manager. El frame
 * loop lo maneja Reanimated `useFrameCallback`: al disparar burst(),
 * el manager invoca onActivity() y nosotros activamos el callback;
 * cuando el manager queda idle, lo desactivamos para que el loop no
 * consuma batería.
 *
 * El estado de las partículas vive en JS (manager.particles), y
 * cada frame disparamos un setTick() para que React re-render el
 * Canvas con las posiciones nuevas. Skia hace diff propio sobre el
 * tree de drawing — es eficiente para nuestro tamaño (~230 sprites
 * solid color por unos 3 segundos).
 */
export const ConfettiCanvas = memo(function ConfettiCanvas({ manager }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [, tick] = useReducer((x: number) => (x + 1) | 0, 0);
  // Triángulo unitario centrado en (0,0), apuntando arriba. Lo
  // creamos UNA vez con useMemo y escalamos por partícula vía
  // transform — evita allocate de Path cada frame.
  const trianglePath = useMemo(() => {
    const p = Skia.Path.Make();
    // Vértices de un triángulo equilátero inscrito en círculo r=1.
    p.moveTo(0, -1);
    p.lineTo(0.866, 0.5);
    p.lineTo(-0.866, 0.5);
    p.close();
    return p;
  }, []);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      prev.w === width && prev.h === height ? prev : { w: width, h: height },
    );
  }, []);

  // El step se ejecuta en JS thread (manager.particles vive en JS).
  // El frame callback de Reanimated corre en UI thread y nos da el
  // delta exacto entre frames; usamos runOnJS para llamar al step.
  const stepRef = useRef<(dt: number) => void>(() => {});
  stepRef.current = (dt) => {
    manager.update(dt, size.w, size.h);
    tick();
    if (manager.isIdle()) {
      frameCb.setActive(false);
    }
  };

  const frameCb = useFrameCallback((info) => {
    "worklet";
    const dt = info.timeSincePreviousFrame ?? 16;
    runOnJS(callStep)(dt);
  }, false);

  // Wrapper para poder pasar a runOnJS sin que cambie de identidad.
  const callStep = useCallback((dt: number) => {
    stepRef.current(dt);
  }, []);

  // Cuando el manager tiene actividad nueva, activamos el frame
  // callback. Si ya está activo no pasa nada (setActive es idempotente).
  useEffect(() => {
    manager.onActivity = () => frameCb.setActive(true);
    if (!manager.isIdle()) frameCb.setActive(true);
    return () => {
      manager.onActivity = undefined;
      frameCb.setActive(false);
    };
  }, [manager, frameCb]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={onLayout}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        {manager.particles.map((p, i) => (
          <ParticleSprite key={i} confetto={p} trianglePath={trianglePath} />
        ))}
      </Canvas>
    </View>
  );
});

interface SpriteProps {
  confetto: Confetto;
  trianglePath: ReturnType<typeof Skia.Path.Make>;
}

/**
 * Render de una partícula. NO es memo — la mutación in-place del
 * Confetto haría que React no detecte cambios. Cada frame el padre
 * fuerza re-render y este componente lee los valores actuales.
 */
function ParticleSprite({ confetto, trianglePath }: SpriteProps) {
  const { x, y, rotation, size, alpha, color, shape } = confetto;
  const half = size / 2;

  if (shape === "square") {
    const sy = confetto.squareScaleY();
    return (
      <Group
        transform={[
          { translateX: x },
          { translateY: y },
          { rotate: rotation },
          { scaleY: sy },
        ]}
        opacity={alpha}
      >
        <Rect x={-half} y={-half} width={size} height={size} color={color} />
      </Group>
    );
  }

  if (shape === "circle") {
    return (
      <Group
        transform={[{ translateX: x }, { translateY: y }]}
        opacity={alpha}
      >
        <Circle cx={0} cy={0} r={half} color={color} />
      </Group>
    );
  }

  // triangle
  return (
    <Group
      transform={[
        { translateX: x },
        { translateY: y },
        { rotate: rotation },
        { scale: half },
      ]}
      opacity={alpha}
    >
      <Path path={trianglePath} color={color} />
    </Group>
  );
}
