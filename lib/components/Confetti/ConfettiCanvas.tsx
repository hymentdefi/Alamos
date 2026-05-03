import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import {
  Canvas,
  PaintStyle,
  Picture,
  Skia,
  createPicture,
} from "@shopify/react-native-skia";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  runOnUI,
  type SharedValue,
} from "react-native-reanimated";
import {
  isParticleDead,
  makeParticle,
  PALETTE_COLORS,
  SHAPE_CIRCLE,
  SHAPE_SQUARE,
  squareScaleY,
  updateParticle,
  type Particle,
  type SpawnOpts,
} from "./Particle";
import {
  ConfettiManager,
  type BurstConfig,
} from "./ConfettiManager";

interface Props {
  manager: ConfettiManager;
}

/**
 * Canvas que dibuja el sistema de partículas con Skia EN UI THREAD.
 *
 * Arquitectura — todo corre en UI thread, React es solo el host:
 *
 *   1. SharedValue<Particle[]> es el "pool" de partículas. Vive en
 *      memoria compartida entre JS y UI thread.
 *
 *   2. useFrameCallback (Reanimated 4) drivea la simulación. Se
 *      ejecuta como worklet en UI thread, ~60 veces por segundo,
 *      sin pasar por JS thread.
 *      → updateParticle() avanza física por dt.
 *      → sweep + write-index para limpiar muertas.
 *
 *   3. useDerivedValue + createPicture (Skia 2.x) construye un
 *      SkPicture inmutable cada vez que el pool cambia. También
 *      worklet, también UI thread.
 *      → Una sola pasada de draw commands batched en GPU.
 *
 *   4. <Picture picture={picture} /> es UN componente React que
 *      recibe el picture reactivo. Cero reconciliation por frame.
 *
 *   5. Spawning: cuando el JS llama manager.burst(), el canvas tiene
 *      registrada una spawnFn que hace runOnUI hacia un worklet que
 *      mutea el SharedValue. Sin pasar por React.
 *
 * Comparación con la versión anterior (Skia + React-per-frame):
 *   - Antes: tick() forzaba re-render React, que reconciliaba N
 *     children primitivos cada frame. Techo ~500 partículas a 60fps.
 *   - Ahora: cero re-renders, todo en UI thread. Techo medido en
 *     1500-2500 partículas según device. La GPU es el nuevo cuello,
 *     no React.
 */

/* ─── Recursos Skia precomputados (módulo, una vez) ───────────────── */

/**
 * Triángulo unitario centrado en (0,0). El draw worklet aplica
 * translate + rotate + scale por partícula. Reusar UN path evita
 * crear N paths por frame.
 */
const TRIANGLE_PATH = (() => {
  const p = Skia.Path.Make();
  p.moveTo(0, -0.5);
  p.lineTo(-0.5, 0.5);
  p.lineTo(0.5, 0.5);
  p.close();
  return p;
})();

/**
 * Paint compartido — mutado por partícula adentro del draw worklet
 * (setColor + setAlphaf). Como las draws son secuenciales en un
 * solo thread, mutarlo en bucle no causa race conditions.
 */
const PAINT = (() => {
  const p = Skia.Paint();
  p.setStyle(PaintStyle.Fill);
  p.setAntiAlias(true);
  return p;
})();

const RAD_TO_DEG = 180 / Math.PI;

/* ─── Spawn worklet (módulo, accesible vía runOnUI) ───────────────── */

/**
 * Worklet que spawnea N partículas dentro del SharedValue. Vive a
 * nivel módulo (no closure de componente) para que runOnUI lo pueda
 * invocar limpiamente, pasando las args por valor.
 */
function spawnWorklet(
  particles: SharedValue<Particle[]>,
  x: number,
  y: number,
  count: number,
  speedScale: number | undefined,
  sizeRange: [number, number] | undefined,
  ttlRange: [number, number] | undefined,
  speedRange: [number, number] | undefined,
) {
  "worklet";
  const opts: SpawnOpts = {
    speedScale,
    sizeRange,
    ttlRange,
    speedRange,
  };
  particles.modify((arr) => {
    "worklet";
    for (let i = 0; i < count; i++) {
      arr.push(makeParticle(x, y, opts));
    }
    return arr;
  });
}

/* ─── Componente ──────────────────────────────────────────────────── */

export function ConfettiCanvas({ manager }: Props) {
  // Tamaño de la canvas — necesario para isParticleDead (cuando se
  // sale del frame por abajo) y para el fade por yRatio. Se actualiza
  // desde JS en onLayout y se lee desde el frame callback worklet.
  const [size, setSize] = useState({ w: 0, h: 0 });
  const canvasSize = useSharedValue({ w: 0, h: 0 });

  // Pool de partículas — SharedValue compartido entre JS y UI thread.
  // El frame callback lo lee + mutea cada frame; el spawnWorklet
  // empuja nuevas partículas vía runOnUI; useDerivedValue lo lee
  // para construir el picture.
  const particles = useSharedValue<Particle[]>([]);

  /* ─── onLayout: sync state + sharedValue ─── */
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      setSize((prev) =>
        prev.w === width && prev.h === height
          ? prev
          : { w: width, h: height },
      );
      canvasSize.value = { w: width, h: height };
    },
    [canvasSize],
  );

  /* ─── Spawn fn registrado en el manager ─── */
  const spawn = useCallback(
    (cfg: BurstConfig) => {
      const {
        x,
        y,
        count = 1000,
        speedScale,
        sizeRange,
        ttlRange,
        speedRange,
      } = cfg;
      runOnUI(spawnWorklet)(
        particles,
        x,
        y,
        count,
        speedScale,
        sizeRange,
        ttlRange,
        speedRange,
      );
    },
    [particles],
  );

  useEffect(() => {
    manager.attachSpawn(spawn);
    return () => manager.detachSpawn();
  }, [manager, spawn]);

  /* ─── Frame callback: simulación en UI thread ─── */
  useFrameCallback((info) => {
    "worklet";
    const arr = particles.value;
    if (arr.length === 0) {
      // Idle — el worklet existe pero no hace nada. Microsegundos
      // por frame, batería impact negligible.
      return;
    }

    const dt = Math.min(50, info.timeSincePreviousFrame ?? 16);
    const sz = canvasSize.value;
    const w = sz.w;
    const h = sz.h;

    // Mutación in-place + sweep dead. modify() devuelve el mismo
    // array para señalar a Reanimated que hubo cambio (recomputa
    // useDerivedValue → rebuilds picture → re-render Skia).
    particles.modify((p) => {
      "worklet";
      let write = 0;
      for (let read = 0; read < p.length; read++) {
        const c = p[read];
        updateParticle(c, dt, h);
        if (!isParticleDead(c, w, h)) {
          if (write !== read) p[write] = c;
          write++;
        }
      }
      p.length = write;
      return p;
    });
  }, true);

  /* ─── Picture derivada: render en UI thread ─── */
  const picture = useDerivedValue(() => {
    return createPicture((canvas) => {
      "worklet";
      const arr = particles.value;
      if (arr.length === 0) return;

      const paint = PAINT;
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];
        paint.setColor(PALETTE_COLORS[p.colorIdx]);
        paint.setAlphaf(p.alpha);

        if (p.shape === SHAPE_CIRCLE) {
          canvas.drawCircle(p.x, p.y, p.size / 2, paint);
        } else if (p.shape === SHAPE_SQUARE) {
          // Skia's canvas.rotate firma: (degrees, px, py). Como ya
          // hicimos translate(p.x, p.y), rotamos alrededor de (0, 0).
          canvas.save();
          canvas.translate(p.x, p.y);
          canvas.rotate(p.rotation * RAD_TO_DEG, 0, 0);
          canvas.scale(1, squareScaleY(p.rotation));
          const half = p.size / 2;
          canvas.drawRect(
            { x: -half, y: -half, width: p.size, height: p.size },
            paint,
          );
          canvas.restore();
        } else {
          // Triangle — unit triangle escalado por size, rotado, en (x,y).
          canvas.save();
          canvas.translate(p.x, p.y);
          canvas.rotate(p.rotation * RAD_TO_DEG, 0, 0);
          canvas.scale(p.size, p.size);
          canvas.drawPath(TRIANGLE_PATH, paint);
          canvas.restore();
        }
      }
    });
  });

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={onLayout}
    >
      {size.w > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Picture picture={picture} />
        </Canvas>
      ) : null}
    </View>
  );
}
