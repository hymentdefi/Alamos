/**
 * Generador de sonido placeholder para `order_success.wav`.
 *
 * Versión 2 — bell-style ding-dong con harmonics, suena bastante
 * más premium que la versión 1 (que era 3 notas de triangle wave
 * tipo Windows 95).
 *
 * Cómo correrlo:
 *   node scripts/generate-success-sound.js
 *
 * Output:
 *   assets/sounds/order_success.wav (~44KB, 44100Hz mono 16-bit)
 *
 * Diseño:
 *   - "Sparkle" inicial: tono alto cortito (1568Hz, 80ms) — es la
 *     percusión transient, lo que vos en un sonido real escuchás
 *     como "tink" antes de la nota. Sin esto el sonido se siente
 *     "hueco" porque carece del attack natural de un campanilleo
 *     real.
 *   - Voz 1 (C5, 523Hz): la nota fundamental, arranca a t=10ms
 *     (justo después del sparkle). 480ms de duración con decay
 *     exponencial.
 *   - Voz 2 (G5, 784Hz, perfect fifth arriba): segunda voz que
 *     entra a t=110ms — crea el efecto "ding-dong" musical.
 *     380ms con el mismo decay.
 *   - Cada voz tiene 3 harmonics sumadas (fundamental + 2do + 3ro)
 *     ponderadas como 1, 0.5, 0.33 (serie armónica natural). Esto
 *     da la "calidez" tipo campana en vez del "beep" de sine pura.
 *   - Envelope: 5ms attack ramp + decay exponencial. Sin attack
 *     suena clipping, sin decay suena cortado.
 *   - Normalizado al final a peak de -3dB para dejar headroom y
 *     evitar clipping al sumar las voces.
 *
 * Reemplazo por sonido real:
 *   Cuando el cliente / sound designer entregue el archivo final,
 *   simplemente dropealo en `assets/sounds/order_success.wav`. NO
 *   hace falta correr este script — es solo el placeholder.
 *   Recomendaciones para download gratis:
 *     - mixkit.co/free-sound-effects/notification/
 *     - pixabay.com/sound-effects/search/success/
 *     - freesound.org (CC license, attribution requerida)
 */

const fs = require("fs");
const path = require("path");

const SAMPLE_RATE = 44100;
const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 1;
const TOTAL_DURATION_MS = 500;
const PEAK_NORMALIZE_DB = -3;
const ATTACK_MS = 5;

// startMs, durationMs, freq (Hz), amp (relative), harmonics (cuántas
// armónicas sumar — 1 = solo sine pura, 2 = + octava, 3 = + tercera).
const VOICES = [
  // Sparkle "tink" inicial — corto, alto, da la transient percusiva.
  { startMs: 0, durationMs: 80, freq: 1568.0, amp: 0.35, harmonics: 1 },
  // Bell ding 1 — C5 fundamental.
  { startMs: 10, durationMs: 480, freq: 523.25, amp: 0.55, harmonics: 3 },
  // Bell ding 2 — G5 (perfect fifth arriba), ligeramente delayed
  // para "ding-dong".
  { startMs: 110, durationMs: 380, freq: 783.99, amp: 0.45, harmonics: 3 },
];

function envelope(tMs, durationMs) {
  if (tMs < ATTACK_MS) return tMs / ATTACK_MS;
  const decayProgress = (tMs - ATTACK_MS) / (durationMs - ATTACK_MS);
  // Decay exponencial: e^-3 ≈ 0.05 al final del segmento.
  return Math.exp(-3.0 * decayProgress);
}

function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

function sampleVoice(voice, tMs) {
  if (tMs < voice.startMs || tMs > voice.startMs + voice.durationMs) {
    return 0;
  }
  const localTMs = tMs - voice.startMs;
  const localT = localTMs / 1000;
  const env = envelope(localTMs, voice.durationMs);

  // Sumar harmonics con amplitudes 1/n (serie armónica natural).
  let sum = 0;
  let totalWeight = 0;
  for (let h = 1; h <= voice.harmonics; h++) {
    const w = 1 / h;
    sum += Math.sin(2 * Math.PI * voice.freq * h * localT) * w;
    totalWeight += w;
  }
  const normalized = sum / totalWeight;
  return normalized * voice.amp * env;
}

function generateAudio() {
  const totalSamples = Math.floor((SAMPLE_RATE * TOTAL_DURATION_MS) / 1000);
  const raw = new Float32Array(totalSamples);

  // Pasada 1: sumar todas las voces, encontrar peak.
  let peak = 0;
  for (let i = 0; i < totalSamples; i++) {
    const tMs = (i / SAMPLE_RATE) * 1000;
    let sample = 0;
    for (const v of VOICES) sample += sampleVoice(v, tMs);
    raw[i] = sample;
    const abs = Math.abs(sample);
    if (abs > peak) peak = abs;
  }

  // Pasada 2: normalizar al target peak.
  const targetPeak = dbToLinear(PEAK_NORMALIZE_DB);
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
const outPath = path.join(outDir, "order_success.wav");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(outPath, wav);
console.log(`Generated ${wav.length} bytes → ${outPath}`);
console.log(`  Duration: ${(TOTAL_DURATION_MS / 1000).toFixed(3)}s`);
console.log(`  Sample rate: ${SAMPLE_RATE}Hz, ${BITS_PER_SAMPLE}-bit mono`);
console.log(`  Voices: sparkle 1568Hz + bell C5 + bell G5 (perfect fifth)`);
