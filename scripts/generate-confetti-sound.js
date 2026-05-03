/**
 * Generador de sonido placeholder para `confetti_pop.wav`.
 *
 * Sonido: "POP" inicial (transient de baja frecuencia, 30ms) seguido
 * de un decay de white noise (la dispersión "shhhh" del papel).
 * Suena como un party popper / champagne cork sintético.
 *
 * Cómo correrlo:
 *   node scripts/generate-confetti-sound.js
 *
 * Output:
 *   assets/sounds/confetti_pop.wav (~30KB, 44100Hz mono 16-bit)
 *
 * Diseño:
 *   - Pop inicial: sine 220Hz fadeando los primeros 30ms — el "thump"
 *     percusivo que el cerebro asocia con "algo se reventó".
 *   - White noise full-spectrum durante todo el sample — el "shhh"
 *     de papel cayendo / dispersándose.
 *   - Envelope: 3ms attack ramp + decay exponencial sobre 350ms total.
 *   - Normalizado a peak -3dB (un poco más alto que el order_success
 *     porque viene mezclado con el bell ding del confirm).
 *
 * REEMPLAZAR POR UNO REAL:
 *   Sonido real va a sonar 10x mejor que esta síntesis. Recomendados:
 *     - mixkit.co/free-sound-effects/win/  → "celebration", "party popper"
 *     - pixabay.com/sound-effects/search/confetti/
 *     - freesound.org → "party popper", "confetti pop"
 *   Drop el archivo en `assets/sounds/confetti_pop.wav` (mismo nombre)
 *   y reload. Cero código a tocar.
 */

const fs = require("fs");
const path = require("path");

const SAMPLE_RATE = 44100;
const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 1;
const DURATION_MS = 350;
const ATTACK_MS = 3;
const POP_DURATION_MS = 30;
const POP_FREQ = 220;
const NORMALIZE_DB = -3;

function envelope(tMs) {
  if (tMs < ATTACK_MS) return tMs / ATTACK_MS;
  const decayProgress = (tMs - ATTACK_MS) / (DURATION_MS - ATTACK_MS);
  // Decay rápido inicial + cola larga: e^-3 ≈ 0.05 al final.
  return Math.exp(-3.0 * decayProgress);
}

function popPulse(t, tMs) {
  // Sine de baja frecuencia que fade los primeros 30ms — da el
  // "POP" percusivo del transient.
  if (tMs > POP_DURATION_MS) return 0;
  const fadeOut = 1 - tMs / POP_DURATION_MS;
  return Math.sin(2 * Math.PI * POP_FREQ * t) * fadeOut * 0.5;
}

function generateSample(t) {
  const tMs = t * 1000;
  const env = envelope(tMs);
  const noise = (Math.random() * 2 - 1) * 0.7;
  const pop = popPulse(t, tMs);
  return (noise + pop) * env;
}

function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

function generateAudio() {
  const totalSamples = Math.floor((SAMPLE_RATE * DURATION_MS) / 1000);
  const raw = new Float32Array(totalSamples);

  // Pasada 1: generar + encontrar peak.
  let peak = 0;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    raw[i] = generateSample(t);
    const abs = Math.abs(raw[i]);
    if (abs > peak) peak = abs;
  }

  // Pasada 2: normalizar.
  const targetPeak = dbToLinear(NORMALIZE_DB);
  const gain = peak > 0 ? targetPeak / peak : 1;

  const buffer = Buffer.alloc(totalSamples * 2);
  for (let i = 0; i < totalSamples; i++) {
    const normalized = raw[i] * gain;
    const clamped = Math.max(-1, Math.min(1, normalized));
    const int16 = Math.round(clamped * 32767);
    buffer.writeInt16LE(int16, i * 2);
  }

  return buffer;
}

function buildWav(audioBuffer) {
  const dataSize = audioBuffer.length;
  const fileSize = 36 + dataSize;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(fileSize, 4);
  header.write("WAVE", 8);

  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(NUM_CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(
    (SAMPLE_RATE * NUM_CHANNELS * BITS_PER_SAMPLE) / 8,
    28,
  );
  header.writeUInt16LE((NUM_CHANNELS * BITS_PER_SAMPLE) / 8, 32);
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);

  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, audioBuffer]);
}

const audio = generateAudio();
const wav = buildWav(audio);

const outDir = path.join(__dirname, "..", "assets", "sounds");
const outPath = path.join(outDir, "confetti_pop.wav");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(outPath, wav);
console.log(`Generated ${wav.length} bytes → ${outPath}`);
console.log(`  Duration: ${(DURATION_MS / 1000).toFixed(3)}s`);
console.log(`  Sample rate: ${SAMPLE_RATE}Hz, ${BITS_PER_SAMPLE}-bit mono`);
console.log(`  Components: pop pulse 220Hz/30ms + white noise decay`);
