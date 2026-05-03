/**
 * Procesa el WAV de confetti cannon de Epidemic Sound:
 *
 *   1. Splice: convierte [explosion][debris] en
 *      [explosion][explosion][debris]. Splicing a SPLIT_MS hace que
 *      la SEGUNDA explosion del file resultante coincida con cuando
 *      el burst visual dispara su encore (a +350ms del peak).
 *
 *   2. Fade-out: rampa lineal sobre los últimos FADE_OUT_MS para
 *      que el audio se silencie gradualmente cuando el visual del
 *      confetti termina, sin trim del file (trim rompe expo-audio).
 *
 *   3. Conversión de formato: source es 24-bit / 96kHz / stereo
 *      (calidad estudio Epidemic Sound). Convertimos a
 *      **16-bit / 48kHz / stereo** porque:
 *      - El speaker del iPhone tiene rate nativo de 48kHz; cuando
 *        se le manda 96kHz debe downsamplear on-the-fly y iOS
 *        FALLA SILENCIOSAMENTE esa conversión para 24-bit/96kHz
 *        en el speaker interno (verificado: el file 24/96 funciona
 *        en JBL pero NO en speaker del iPhone).
 *      - 16-bit es universalmente soportado.
 *      - Decimación 2:1 es exacta y limpia (no necesita anti-alias
 *        filter porque el source ya está band-limited de fábrica).
 *
 *   4. Filename versioning: el output es `confetti_pop_v3.wav` (no
 *      v1/v2). Cuando el WAV cambia bytes pero conserva el path,
 *      expo-audio mantiene cacheado el asset viejo en native — bumpear
 *      el sufijo fuerza un asset ID nuevo y un fresh load. Para
 *      futuras iteraciones: bumpear a v4, v5 etc.
 *
 * Cómo correrlo:
 *   node scripts/splice-confetti-sound.js [ruta-al-source.wav]
 *
 * El source NO se commitea al repo (asset licenciado).
 */

const fs = require("fs");
const path = require("path");

const SOURCE_DEFAULT =
  "C:/Users/Desktop/Desktop/ES_Explosions, Misc, Confetti Cannon, Medium, Small Explosion, Debris - Epidemic Sound - 6019-10170.wav";
const SPLIT_MS = 350;
const FADE_OUT_MS = 1500;

/* Output target: formato consumer-grade compatible con speaker iPhone. */
const OUT_BITS_PER_SAMPLE = 16;
const OUT_SAMPLE_RATE_DECIMATION = 2; // 96kHz → 48kHz exacto (2:1)

/* ─── WAV header parser ──────────────────────────────────────────── */

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

/* ─── Sample read/write helpers (16-bit y 24-bit signed LE) ─────── */

function readSample(buf, off, bps) {
  if (bps === 16) return buf.readInt16LE(off);
  if (bps === 24) {
    const v = buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16);
    return v >= 0x800000 ? v - 0x1000000 : v;
  }
  throw new Error(`Bit depth ${bps} no soportado`);
}

function writeSample(buf, off, val, bps) {
  if (bps === 16) {
    buf.writeInt16LE(Math.max(-0x8000, Math.min(0x7fff, val)), off);
    return;
  }
  if (bps === 24) {
    let v = Math.max(-0x800000, Math.min(0x7fffff, val));
    if (v < 0) v += 0x1000000; // unsigned representation
    buf[off] = v & 0xff;
    buf[off + 1] = (v >>> 8) & 0xff;
    buf[off + 2] = (v >>> 16) & 0xff;
    return;
  }
  throw new Error(`Bit depth ${bps} no soportado`);
}

/* ─── Operaciones de procesamiento ──────────────────────────────── */

/** Aplica fade-out lineal sobre los últimos `fadeOutMs` (in-place). */
function applyFadeOut(buf, meta, fadeOutMs) {
  const fadeFrames = Math.floor((meta.sampleRate * fadeOutMs) / 1000);
  const totalFrames = Math.floor(buf.length / meta.bytesPerFrame);
  const fadeStartFrame = Math.max(0, totalFrames - fadeFrames);

  for (let f = 0; f < fadeFrames; f++) {
    const gain = 1 - f / fadeFrames; // lineal 1.0 → 0.0
    const frameOffset = (fadeStartFrame + f) * meta.bytesPerFrame;
    for (let ch = 0; ch < meta.numChannels; ch++) {
      const off = frameOffset + ch * meta.bytesPerSample;
      const sample = readSample(buf, off, meta.bitsPerSample);
      writeSample(buf, off, Math.round(sample * gain), meta.bitsPerSample);
    }
  }
}

/**
 * Convierte el buffer source a formato target:
 *   - bit depth: srcBits → 16-bit (con redondeo)
 *   - sample rate: divide por `decimation` (decimación entera)
 * Devuelve un nuevo buffer en el formato target.
 */
function convertFormat(srcBuf, srcMeta, decimation) {
  const srcFrames = Math.floor(srcBuf.length / srcMeta.bytesPerFrame);
  const dstFrames = Math.floor(srcFrames / decimation);
  const dstBytesPerSample = OUT_BITS_PER_SAMPLE / 8;
  const dstBytesPerFrame = dstBytesPerSample * srcMeta.numChannels;
  const dstBuf = Buffer.alloc(dstFrames * dstBytesPerFrame);

  // Factor de conversión bit-depth: 24-bit → 16-bit es shift right 8
  // (= divide por 256). Para otros bits genérico.
  const srcMax = (1 << (srcMeta.bitsPerSample - 1)) - 1;
  const dstMax = (1 << (OUT_BITS_PER_SAMPLE - 1)) - 1;
  const scale = dstMax / srcMax;

  for (let f = 0; f < dstFrames; f++) {
    const srcFrameIdx = f * decimation;
    const srcFrameOffset = srcFrameIdx * srcMeta.bytesPerFrame;
    const dstFrameOffset = f * dstBytesPerFrame;
    for (let ch = 0; ch < srcMeta.numChannels; ch++) {
      const srcOff = srcFrameOffset + ch * srcMeta.bytesPerSample;
      const dstOff = dstFrameOffset + ch * dstBytesPerSample;
      const srcVal = readSample(srcBuf, srcOff, srcMeta.bitsPerSample);
      const dstVal = Math.round(srcVal * scale);
      writeSample(dstBuf, dstOff, dstVal, OUT_BITS_PER_SAMPLE);
    }
  }

  return {
    buf: dstBuf,
    sampleRate: srcMeta.sampleRate / decimation,
    numChannels: srcMeta.numChannels,
    bitsPerSample: OUT_BITS_PER_SAMPLE,
  };
}

/* ─── Build WAV ──────────────────────────────────────────────────── */

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

/* ─── Pipeline principal ────────────────────────────────────────── */

function processWav(source, splitMs, fadeOutMs) {
  const meta = parseWavHeader(source);

  // 1. Splice
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
  // Buffer.from para asegurar buffer mutable.
  const splicedAudio = Buffer.from(Buffer.concat([head, head, tail]));

  // 2. Fade-out (en formato source 24-bit, antes de conversión)
  applyFadeOut(splicedAudio, meta, fadeOutMs);

  // 3. Convert: 24→16 bit + decimation 96→48kHz
  const out = convertFormat(splicedAudio, meta, OUT_SAMPLE_RATE_DECIMATION);

  // 4. Build final WAV
  const wav = buildWav(
    out.buf,
    out.sampleRate,
    out.numChannels,
    out.bitsPerSample,
  );

  return { wav, srcMeta: meta, outFormat: out };
}

/* ─── CLI ──────────────────────────────────────────────────────── */

const sourcePath = process.argv[2] || SOURCE_DEFAULT;
if (!fs.existsSync(sourcePath)) {
  console.error(`Source no encontrado: ${sourcePath}`);
  process.exit(1);
}

const source = fs.readFileSync(sourcePath);
const { wav, srcMeta, outFormat } = processWav(
  source,
  SPLIT_MS,
  FADE_OUT_MS,
);

const outDir = path.join(__dirname, "..", "assets", "sounds");
const outPath = path.join(outDir, "confetti_pop_v3.wav");
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
console.log(`  Fade-out: ${FADE_OUT_MS}ms (silencio efectivo al final)`);
console.log(`  Format conversion: 24-bit/96kHz → 16-bit/48kHz`);
