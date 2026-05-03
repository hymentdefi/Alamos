/**
 * Generador de sonido `confetti_windup.wav` — el "fffsssss..." que
 * antecede al PUM del confetti pop. Le da al cerebro 280ms de
 * anticipación auditiva en lugar de que las explosiones aparezcan
 * "de la nada".
 *
 * Diseño:
 *   - Pitch sweep ease-in: 250Hz → 1550Hz (lento al inicio, rápido
 *     al final). Imita el "weeoo" de un cohete que sube.
 *   - Noise underlay con gain creciente — empieza a 0.2, termina
 *     a 0.5. El "shhhh" se hace más fuerte mientras el pitch sube.
 *   - Envelope: 30ms attack ramp + sustain + 20ms release. El
 *     release rápido hace que el sonido termine LIMPIO antes de
 *     que arranque el pop, sin tail molesta.
 *   - 280ms total, normalizado a -6dB (más bajo que el pop así no
 *     compite por atención).
 *
 * Cómo correrlo:
 *   node scripts/generate-windup-sound.js
 *
 * Output:
 *   assets/sounds/confetti_windup.wav (~25KB, 44100Hz mono 16-bit)
 *
 * REEMPLAZAR POR UNO REAL:
 *   Sonido sintético — funciona de placeholder. Para algo más
 *   producido buscar en Mixkit "whoosh", "wind up", "rocket fuse",
 *   "rising swoosh". Drop en assets/sounds/confetti_windup.wav.
 */

const fs = require("fs");
const path = require("path");

const SAMPLE_RATE = 44100;
const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 1;
const DURATION_MS = 280;
const ATTACK_MS = 30;
const RELEASE_MS = 20;
const NORMALIZE_DB = -6;

const FREQ_START = 250;
const FREQ_END = 1550;

function envelope(tMs) {
  if (tMs < ATTACK_MS) return tMs / ATTACK_MS;
  const releaseStart = DURATION_MS - RELEASE_MS;
  if (tMs > releaseStart) {
    return Math.max(0, 1 - (tMs - releaseStart) / RELEASE_MS);
  }
  return 1;
}

function generateSample(t) {
  const tMs = t * 1000;
  const env = envelope(tMs);
  const progress = Math.min(1, tMs / DURATION_MS);

  // Pitch sweep ease-in: progress² → cuadráticamente más rápido al final.
  const easeInProgress = progress * progress;
  const freq = FREQ_START + (FREQ_END - FREQ_START) * easeInProgress;

  // Sine sweep + noise creciente.
  const sine = Math.sin(2 * Math.PI * freq * t) * 0.4;
  const noiseGain = 0.2 + progress * 0.3;
  const noise = (Math.random() * 2 - 1) * noiseGain;

  return (sine + noise) * env;
}

function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

function generateAudio() {
  const totalSamples = Math.floor((SAMPLE_RATE * DURATION_MS) / 1000);
  const raw = new Float32Array(totalSamples);

  let peak = 0;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    raw[i] = generateSample(t);
    const abs = Math.abs(raw[i]);
    if (abs > peak) peak = abs;
  }

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
  header.writeUInt32LE((SAMPLE_RATE * NUM_CHANNELS * BITS_PER_SAMPLE) / 8, 28);
  header.writeUInt16LE((NUM_CHANNELS * BITS_PER_SAMPLE) / 8, 32);
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);

  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, audioBuffer]);
}

const audio = generateAudio();
const wav = buildWav(audio);

const outDir = path.join(__dirname, "..", "assets", "sounds");
const outPath = path.join(outDir, "confetti_windup.wav");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(outPath, wav);
console.log(`Generated ${wav.length} bytes → ${outPath}`);
console.log(`  Duration: ${(DURATION_MS / 1000).toFixed(3)}s`);
console.log(`  Sweep: ${FREQ_START}Hz → ${FREQ_END}Hz (ease-in)`);
