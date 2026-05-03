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
  const newAudioData = Buffer.concat([head, head, tail]);

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
