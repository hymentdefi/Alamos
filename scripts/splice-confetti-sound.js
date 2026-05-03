/**
 * Procesa el WAV de confetti cannon de Epidemic Sound:
 *
 *   1. Splice: convierte [explosion][debris] en
 *      [explosion][explosion][debris]. La SEGUNDA explosion del
 *      file resultante cae a SPLIT_MS desde el inicio, que coincide
 *      con cuando el burst visual dispara su encore (a +350ms del
 *      peak).
 *
 *   2. Trim: corta a MAX_DURATION_MS para que el audio termine
 *      cuando muere el último sparkle visual (~+4100ms desde el
 *      inicio del burst).
 *
 *   3. Fade-out: rampa lineal de FADE_OUT_MS sobre el final para
 *      evitar el "click" que deja un corte raw del PCM.
 *
 *   4. Conversión de formato: el source es 24-bit / 96kHz / stereo
 *      (calidad estudio Epidemic Sound). expo-audio en iOS/Android
 *      no soporta 24-bit / 96kHz confiablemente — convertimos a
 *      **16-bit / 48kHz / stereo** que es universalmente soportado.
 *      48kHz por decimación 2:1 (ratio entero, sin alias filter
 *      necesario porque el source ya está band-limited).
 *
 * Cómo correrlo:
 *   node scripts/splice-confetti-sound.js [ruta-al-source.wav]
 *
 * El source NO se commitea al repo (asset licenciado). Solo el
 * output procesado (confetti_pop.wav) va al repo.
 */

const fs = require("fs");
const path = require("path");

const SOURCE_DEFAULT =
  "C:/Users/Desktop/Desktop/ES_Explosions, Misc, Confetti Cannon, Medium, Small Explosion, Debris - Epidemic Sound - 6019-10170.wav";
const SPLIT_MS = 350;
const MAX_DURATION_MS = 4000;
const FADE_OUT_MS = 120;

/* ─── Output format target ──────────────────────────────────────── */

const OUT_BITS_PER_SAMPLE = 16;
/** Decimación 2:1 desde 96kHz → 48kHz (ratio entero, sin filter
 *  porque el source ya está band-limited de fábrica). */
const SAMPLE_RATE_DECIMATION = 2;

/* ─── WAV header parser (handle 16-bit y 24-bit, multi-channel) ─── */

function parseWavHeader(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF") {
    throw new Error("Not a RIFF file");
  }
  if (buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Not a WAVE file");
  }

  const fmtChunkSize = buf.readUInt32LE(16);
  const audioFormat = buf.readUInt16LE(20);
  const numChannels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);
  const bitsPerSample = buf.readUInt16LE(34);
  const bytesPerSample = bitsPerSample / 8;
  const bytesPerFrame = bytesPerSample * numChannels;

  // Buscar el "data" chunk — algunos WAVs tienen LIST/INFO entre fmt
  // y data (ej. Epidemic Sound), no asumir offset 36.
  let offset = 20 + fmtChunkSize;
  let dataStart = -1;
  let dataSize = 0;
  while (offset < buf.length - 8) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    if (chunkId === "data") {
      dataStart = offset + 8;
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize;
    if (chunkSize % 2 === 1) offset += 1;
  }
  if (dataStart === -1) {
    throw new Error("data chunk not found");
  }

  return {
    audioFormat,
    numChannels,
    sampleRate,
    bitsPerSample,
    bytesPerSample,
    bytesPerFrame,
    dataStart,
    dataSize,
  };
}

/* ─── Helpers de samples (lectura/escritura 16/24-bit signed LE) ── */

function readSample(buf, offset, bitsPerSample) {
  if (bitsPerSample === 16) {
    return buf.readInt16LE(offset);
  }
  if (bitsPerSample === 24) {
    const b0 = buf[offset];
    const b1 = buf[offset + 1];
    const b2 = buf[offset + 2];
    let val = b0 | (b1 << 8) | (b2 << 16);
    if (val & 0x800000) val |= 0xff000000; // sign-extend a 32-bit
    return val;
  }
  throw new Error(`bitsPerSample ${bitsPerSample} no soportado`);
}

function writeSample(buf, offset, val, bitsPerSample) {
  if (bitsPerSample === 16) {
    const clamped = Math.max(-0x8000, Math.min(0x7fff, val));
    buf.writeInt16LE(clamped, offset);
    return;
  }
  if (bitsPerSample === 24) {
    const clamped = Math.max(-0x800000, Math.min(0x7fffff, val));
    buf[offset] = clamped & 0xff;
    buf[offset + 1] = (clamped >> 8) & 0xff;
    buf[offset + 2] = (clamped >> 16) & 0xff;
    return;
  }
  throw new Error(`bitsPerSample ${bitsPerSample} no soportado`);
}

/** Escala un sample de srcBits a 16-bit. Para 24→16 bit, dividimos
 *  por 256 (= shift right 8) con redondeo. Para 16→16 es identity. */
function sampleToInt16(val, srcBits) {
  if (srcBits === 16) return val;
  if (srcBits === 24) {
    return Math.max(-0x8000, Math.min(0x7fff, Math.round(val / 256)));
  }
  throw new Error(`srcBits ${srcBits} no soportado`);
}

/* ─── Procesamiento ──────────────────────────────────────────────── */

function applyFadeOut(buf, meta, fadeOutMs) {
  const fadeFrames = Math.floor((meta.sampleRate * fadeOutMs) / 1000);
  const totalFrames = Math.floor(buf.length / meta.bytesPerFrame);
  const fadeStartFrame = Math.max(0, totalFrames - fadeFrames);

  for (let f = 0; f < fadeFrames; f++) {
    const gain = 1 - f / fadeFrames; // lineal 1.0 → 0.0
    const frameOffset = (fadeStartFrame + f) * meta.bytesPerFrame;
    for (let ch = 0; ch < meta.numChannels; ch++) {
      const sampleOffset = frameOffset + ch * meta.bytesPerSample;
      const sample = readSample(buf, sampleOffset, meta.bitsPerSample);
      writeSample(
        buf,
        sampleOffset,
        Math.round(sample * gain),
        meta.bitsPerSample,
      );
    }
  }
}

/**
 * Convierte el buffer source a 16-bit + decimación opcional. Devuelve
 * un nuevo buffer con el formato target.
 */
function convertFormat(srcBuf, srcMeta, decimation) {
  const srcFrames = Math.floor(srcBuf.length / srcMeta.bytesPerFrame);
  const dstFrames = Math.floor(srcFrames / decimation);
  const dstBytesPerSample = OUT_BITS_PER_SAMPLE / 8;
  const dstBytesPerFrame = dstBytesPerSample * srcMeta.numChannels;
  const dstBuf = Buffer.alloc(dstFrames * dstBytesPerFrame);

  for (let f = 0; f < dstFrames; f++) {
    const srcFrameIdx = f * decimation;
    const srcFrameOffset = srcFrameIdx * srcMeta.bytesPerFrame;
    const dstFrameOffset = f * dstBytesPerFrame;
    for (let ch = 0; ch < srcMeta.numChannels; ch++) {
      const srcSampleOffset =
        srcFrameOffset + ch * srcMeta.bytesPerSample;
      const dstSampleOffset = dstFrameOffset + ch * dstBytesPerSample;
      const srcVal = readSample(
        srcBuf,
        srcSampleOffset,
        srcMeta.bitsPerSample,
      );
      const dstVal = sampleToInt16(srcVal, srcMeta.bitsPerSample);
      dstBuf.writeInt16LE(dstVal, dstSampleOffset);
    }
  }

  return {
    buf: dstBuf,
    sampleRate: srcMeta.sampleRate / decimation,
    numChannels: srcMeta.numChannels,
    bitsPerSample: OUT_BITS_PER_SAMPLE,
  };
}

function buildWav(audioBuf, sampleRate, numChannels, bitsPerSample) {
  const bytesPerFrame = (bitsPerSample / 8) * numChannels;
  const dataSize = audioBuf.length;
  const fileSize = 36 + dataSize;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(fileSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * bytesPerFrame, 28);
  header.writeUInt16LE(bytesPerFrame, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, audioBuf]);
}

function processWav(source, splitMs, maxDurationMs, fadeOutMs) {
  const meta = parseWavHeader(source);

  // Step 1: splice [head][head][tail]
  const splitFrames = Math.floor((meta.sampleRate * splitMs) / 1000);
  const splitBytes = Math.min(
    splitFrames * meta.bytesPerFrame,
    meta.dataSize,
  );
  const audioData = source.slice(
    meta.dataStart,
    meta.dataStart + meta.dataSize,
  );
  const head = audioData.slice(0, splitBytes);
  const tail = audioData.slice(splitBytes);
  let processedAudio = Buffer.concat([head, head, tail]);

  // Step 2: trim to maxDurationMs
  const targetFrames = Math.floor((meta.sampleRate * maxDurationMs) / 1000);
  const targetBytes = targetFrames * meta.bytesPerFrame;
  if (processedAudio.length > targetBytes) {
    processedAudio = Buffer.from(processedAudio.slice(0, targetBytes));
  } else {
    processedAudio = Buffer.from(processedAudio); // copia mutable
  }

  // Step 3: fade-out tail
  applyFadeOut(processedAudio, meta, fadeOutMs);

  // Step 4: convert format (24→16 bit + decimation 96→48kHz)
  const out = convertFormat(processedAudio, meta, SAMPLE_RATE_DECIMATION);

  const wav = buildWav(
    out.buf,
    out.sampleRate,
    out.numChannels,
    out.bitsPerSample,
  );

  return { wav, srcMeta: meta, outFormat: out };
}

const sourcePath = process.argv[2] || SOURCE_DEFAULT;
if (!fs.existsSync(sourcePath)) {
  console.error(`Source no encontrado: ${sourcePath}`);
  process.exit(1);
}

const source = fs.readFileSync(sourcePath);
const { wav, srcMeta, outFormat } = processWav(
  source,
  SPLIT_MS,
  MAX_DURATION_MS,
  FADE_OUT_MS,
);

const outDir = path.join(__dirname, "..", "assets", "sounds");
const outPath = path.join(outDir, "confetti_pop.wav");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, wav);

const srcDurationS =
  srcMeta.dataSize / (srcMeta.sampleRate * srcMeta.bytesPerFrame);
const outBytesPerFrame =
  (outFormat.bitsPerSample / 8) * outFormat.numChannels;
const outDurationS =
  (wav.length - 44) / (outFormat.sampleRate * outBytesPerFrame);

console.log(`Source: ${sourcePath}`);
console.log(
  `  ${source.length} bytes, ${srcMeta.numChannels}ch, ${srcMeta.sampleRate}Hz, ${srcMeta.bitsPerSample}-bit`,
);
console.log(`  Duration: ${srcDurationS.toFixed(3)}s`);
console.log(`Output: ${outPath}`);
console.log(
  `  ${wav.length} bytes, ${outFormat.numChannels}ch, ${outFormat.sampleRate}Hz, ${outFormat.bitsPerSample}-bit`,
);
console.log(`  Duration: ${outDurationS.toFixed(3)}s`);
console.log(`  Splice: ${SPLIT_MS}ms (primera explosion duplicada)`);
console.log(`  Trim: ${MAX_DURATION_MS}ms`);
console.log(`  Fade-out: ${FADE_OUT_MS}ms`);
