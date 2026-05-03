/**
 * Splice del WAV de confetti cannon: convierte
 *   [explosion][debris falling]
 * en
 *   [explosion][explosion][debris falling]
 *
 * El primer segmento (`SPLIT_MS` ms) se duplica al inicio. La cola
 * (que tiene el "shhhhh" del papel cayendo) queda intacta.
 *
 * Por qué: el burst del confetti tiene 2 explosiones visuales (peak
 * a t=+100ms y encore a t=+450ms). Splicing a 350ms hace que la
 * SEGUNDA explosión del file coincida exactamente con el encore
 * visual. El debris natural del file acompaña el sparkle tail.
 *
 * Cómo correrlo:
 *   node scripts/splice-confetti-sound.js [ruta-al-source.wav]
 *
 * Si no se pasa argumento, usa SOURCE_DEFAULT (la ruta donde el
 * usuario dropeó el archivo de Epidemic Sound).
 *
 * El source NO se commitea al repo (asset licenciado de Epidemic
 * Sound). Solo el output spliced (confetti_pop.wav) va al repo
 * porque es lo que la app necesita.
 */

const fs = require("fs");
const path = require("path");

const SOURCE_DEFAULT =
  "C:/Users/Desktop/Desktop/ES_Explosions, Misc, Confetti Cannon, Medium, Small Explosion, Debris - Epidemic Sound - 6019-10170.wav";
const SPLIT_MS = 350;
/**
 * Fade-out lineal sobre los últimos N ms del WAV. Truco para
 * "trimear sin trimear": el file queda en su duración original
 * (4.5s) — expo-audio no se queja porque no se cambia la longitud
 * de los datos — pero los últimos N ms son ramped a silencio. UX
 * efectiva = audio se "termina" cuando los papelitos visuales
 * desaparecen (~+4100ms desde burst start).
 *
 * 1500ms es bastante largo: el ramp arranca a t≈3000ms (cuando
 * todavía hay debris activo en el visual) y llega a silencio a
 * t≈4500ms. La pendiente acompaña la decay natural del visual.
 */
const FADE_OUT_MS = 1500;

function parseWavHeader(buf) {
  if (buf.toString("ascii", 0, 4) !== "RIFF") {
    throw new Error("Not a RIFF file");
  }
  if (buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Not a WAVE file");
  }

  // fmt chunk vive en offset 12; chunkSize en offset 16.
  const fmtChunkSize = buf.readUInt32LE(16);
  const audioFormat = buf.readUInt16LE(20);
  const numChannels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);
  const bitsPerSample = buf.readUInt16LE(34);
  const bytesPerSample = bitsPerSample / 8;
  const bytesPerFrame = bytesPerSample * numChannels;

  // Buscar el "data" chunk — algunos WAVs tienen LIST/INFO entre fmt
  // y data (ej. los de Epidemic Sound), no asumir offset 36.
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
    // Padding a múltiplo de 2 si chunkSize es impar.
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
    bytesPerFrame,
    dataStart,
    dataSize,
  };
}

/**
 * Aplica un fade-out lineal sobre los últimos `fadeOutMs` del buffer.
 * Maneja 16-bit y 24-bit signed LE. Mutea in-place.
 */
function applyFadeOut(buf, meta, fadeOutMs) {
  const fadeFrames = Math.floor((meta.sampleRate * fadeOutMs) / 1000);
  const totalFrames = Math.floor(buf.length / meta.bytesPerFrame);
  const fadeStartFrame = Math.max(0, totalFrames - fadeFrames);
  const bytesPerSample = meta.bitsPerSample / 8;

  for (let f = 0; f < fadeFrames; f++) {
    const gain = 1 - f / fadeFrames; // lineal 1.0 → 0.0
    const frameOffset = (fadeStartFrame + f) * meta.bytesPerFrame;
    for (let ch = 0; ch < meta.numChannels; ch++) {
      const sampleOffset = frameOffset + ch * bytesPerSample;
      if (meta.bitsPerSample === 16) {
        const sample = buf.readInt16LE(sampleOffset);
        buf.writeInt16LE(Math.round(sample * gain), sampleOffset);
      } else if (meta.bitsPerSample === 24) {
        const b0 = buf[sampleOffset];
        const b1 = buf[sampleOffset + 1];
        const b2 = buf[sampleOffset + 2];
        let val = b0 | (b1 << 8) | (b2 << 16);
        if (val & 0x800000) val |= 0xff000000; // sign-extend a 32-bit
        val = Math.round(val * gain);
        val = Math.max(-0x800000, Math.min(0x7fffff, val));
        buf[sampleOffset] = val & 0xff;
        buf[sampleOffset + 1] = (val >> 8) & 0xff;
        buf[sampleOffset + 2] = (val >> 16) & 0xff;
      }
    }
  }
}

function buildSpliced(source, splitMs) {
  const meta = parseWavHeader(source);
  const splitFrames = Math.floor((meta.sampleRate * splitMs) / 1000);
  const splitBytes = splitFrames * meta.bytesPerFrame;

  // Asegurar que no nos pasamos del total de audio.
  const safeSplitBytes = Math.min(splitBytes, meta.dataSize);

  const audioData = source.slice(
    meta.dataStart,
    meta.dataStart + meta.dataSize,
  );
  const head = audioData.slice(0, safeSplitBytes);
  const tail = audioData.slice(safeSplitBytes);

  // [explosion][explosion][debris]
  const newAudioData = Buffer.from(Buffer.concat([head, head, tail]));

  // Long fade-out — atenuamos los últimos FADE_OUT_MS para que el
  // audio se silencie cuando el visual termina, sin trimear el file.
  // Lineal 1.0 → 0.0. Maneja 24-bit signed LE (formato del source).
  applyFadeOut(newAudioData, meta, FADE_OUT_MS);

  // Header limpio (44 bytes, sin chunks extras tipo LIST que el
  // source pudiera tener — la app no los necesita).
  const newDataSize = newAudioData.length;
  const newFileSize = 36 + newDataSize;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(newFileSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(meta.audioFormat, 20);
  header.writeUInt16LE(meta.numChannels, 22);
  header.writeUInt32LE(meta.sampleRate, 24);
  header.writeUInt32LE(meta.sampleRate * meta.bytesPerFrame, 28);
  header.writeUInt16LE(meta.bytesPerFrame, 32);
  header.writeUInt16LE(meta.bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(newDataSize, 40);

  return { wav: Buffer.concat([header, newAudioData]), meta };
}

const sourcePath = process.argv[2] || SOURCE_DEFAULT;
if (!fs.existsSync(sourcePath)) {
  console.error(`Source no encontrado: ${sourcePath}`);
  console.error(
    "Pasalo como argumento: node scripts/splice-confetti-sound.js /ruta/al/source.wav",
  );
  process.exit(1);
}

const source = fs.readFileSync(sourcePath);
const { wav, meta } = buildSpliced(source, SPLIT_MS);

const outDir = path.join(__dirname, "..", "assets", "sounds");
const outPath = path.join(outDir, "confetti_pop.wav");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(outPath, wav);

console.log(`Source: ${sourcePath}`);
console.log(
  `  ${source.length} bytes, ${meta.numChannels}ch, ${meta.sampleRate}Hz, ${meta.bitsPerSample}-bit`,
);
console.log(`  Total duration: ${(meta.dataSize / (meta.sampleRate * meta.bytesPerFrame)).toFixed(3)}s`);
console.log(`Spliced output: ${outPath}`);
console.log(`  ${wav.length} bytes`);
console.log(`  Split at: ${SPLIT_MS}ms (primera explosion duplicada)`);
console.log(`  Fade-out tail: ${FADE_OUT_MS}ms (silencio efectivo al final)`);
