/**
 * Generador de sonido placeholder para `order_success.wav`.
 *
 * Por qué existe este script:
 *   El sonido inicial es sintético (3 notas de triangle wave
 *   formando un acorde C mayor ascendente). Suena a "notificación
 *   de Windows 95" porque son ondas matemáticas puras sin texturas
 *   reales. Funciona para shippar y tener la integración del
 *   SoundManager probada, pero el archivo final debe reemplazarse
 *   por uno real (Mixkit / Pixabay / sound designer) en una
 *   iteración posterior. Ese reemplazo NO requiere correr este
 *   script — solo dropear el WAV/MP3 nuevo en assets/sounds/ con
 *   el mismo nombre.
 *
 * Cómo correrlo:
 *   node scripts/generate-success-sound.js
 *
 * Output:
 *   assets/sounds/order_success.wav (~24KB, 44100Hz mono 16-bit)
 *
 * Especificaciones (matchean el spec de la integración):
 *   - 3 notas: C5 (523Hz) → E5 (659Hz) → G5 (784Hz). Acorde mayor
 *     ascendente = "subió", lectura emocional positiva.
 *   - 90ms por nota (~270ms total).
 *   - Triangle wave: más cálida que sine pura (que se siente vacía),
 *     menos harsh que square (que se siente agresiva).
 *   - Envelope: 10ms attack ramp + decay exponencial. Sin attack
 *     suena clipping, sin decay suena cortado.
 *   - Volume normalizado a -6dB para evitar peaking y dejar
 *     headroom al haptic.
 */

const fs = require("fs");
const path = require("path");

const SAMPLE_RATE = 44100;
const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 1;
const NOTE_DURATION_MS = 90;
const ATTACK_MS = 10;
const NORMALIZE_DB = -6;

// C5, E5, G5 = acorde de Do mayor en ascenso.
const NOTES = [523.25, 659.25, 783.99];

function triangleWave(t, freq) {
  const phase = t * freq - Math.floor(t * freq + 0.5);
  return 2 * Math.abs(2 * phase) - 1;
}

function envelope(t, durationMs) {
  const tMs = t * 1000;
  if (tMs < ATTACK_MS) return tMs / ATTACK_MS;
  const decayMs = durationMs - ATTACK_MS;
  const decayProgress = (tMs - ATTACK_MS) / decayMs;
  // Exponential decay a ~1% al final del segmento (e^-4.6 ≈ 0.01).
  return Math.exp(-4.6 * decayProgress);
}

function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

function generateAudio() {
  const noteSamples = Math.floor((SAMPLE_RATE * NOTE_DURATION_MS) / 1000);
  const totalSamples = noteSamples * NOTES.length;
  const buffer = Buffer.alloc(totalSamples * 2); // 16-bit = 2 bytes/sample
  const gain = dbToLinear(NORMALIZE_DB);

  for (let n = 0; n < NOTES.length; n++) {
    const freq = NOTES[n];
    for (let i = 0; i < noteSamples; i++) {
      const t = i / SAMPLE_RATE;
      const env = envelope(t, NOTE_DURATION_MS);
      const sample = triangleWave(t, freq) * env * gain;
      const clamped = Math.max(-1, Math.min(1, sample));
      const int16 = Math.round(clamped * 32767);
      const offset = (n * noteSamples + i) * 2;
      buffer.writeInt16LE(int16, offset);
    }
  }

  return buffer;
}

function buildWav(audioBuffer) {
  const dataSize = audioBuffer.length;
  const fileSize = 36 + dataSize;
  const header = Buffer.alloc(44);

  // RIFF chunk descriptor
  header.write("RIFF", 0);
  header.writeUInt32LE(fileSize, 4);
  header.write("WAVE", 8);

  // fmt sub-chunk (PCM)
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // AudioFormat = 1 (PCM)
  header.writeUInt16LE(NUM_CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(
    (SAMPLE_RATE * NUM_CHANNELS * BITS_PER_SAMPLE) / 8,
    28,
  ); // ByteRate
  header.writeUInt16LE((NUM_CHANNELS * BITS_PER_SAMPLE) / 8, 32); // BlockAlign
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);

  // data sub-chunk
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
console.log(
  `  Duration: ${((NOTES.length * NOTE_DURATION_MS) / 1000).toFixed(3)}s`,
);
console.log(`  Sample rate: ${SAMPLE_RATE}Hz, ${BITS_PER_SAMPLE}-bit mono`);
console.log(`  Notes (Hz): ${NOTES.join(" → ")}`);
