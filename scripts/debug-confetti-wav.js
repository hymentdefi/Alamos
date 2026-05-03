/**
 * Diagnóstico forense del WAV de confetti_pop.wav.
 *
 * Compara bytes contra una versión de referencia (regenerada in-memory
 * sin fade) para encontrar EXACTAMENTE dónde divergen y verificar que
 * los samples modificados sean PCM válido.
 *
 * Salidas:
 *  - Header check (formato, sample rate, etc)
 *  - Primer byte diferente vs referencia "raw splice"
 *  - 10 samples antes/después del fade start (verificando rango válido)
 *  - Estadísticas de los samples del fade (min, max, rango)
 */

const fs = require("fs");
const path = require("path");

const SOURCE = "C:/Users/Desktop/Desktop/ES_Explosions, Misc, Confetti Cannon, Medium, Small Explosion, Debris - Epidemic Sound - 6019-10170.wav";
const TARGET = path.join(__dirname, "..", "assets", "sounds", "confetti_pop_v3.wav");
const SPLIT_MS = 350;
const FADE_OUT_MS = 1500;

function parseWav(buf) {
  const fmtChunkSize = buf.readUInt32LE(16);
  const audioFormat = buf.readUInt16LE(20);
  const numChannels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);
  const bitsPerSample = buf.readUInt16LE(34);
  const bytesPerSample = bitsPerSample / 8;
  const bytesPerFrame = bytesPerSample * numChannels;
  let offset = 20 + fmtChunkSize;
  let dataStart = -1, dataSize = 0;
  while (offset < buf.length - 8) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "data") { dataStart = offset + 8; dataSize = size; break; }
    offset += 8 + size + (size % 2);
  }
  return { audioFormat, numChannels, sampleRate, bitsPerSample, bytesPerSample, bytesPerFrame, dataStart, dataSize };
}

function readSample(buf, off, bps) {
  if (bps === 16) return buf.readInt16LE(off);
  const v = buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16);
  return v >= 0x800000 ? v - 0x1000000 : v;
}
function maxAbsForBits(bps) {
  return (1 << (bps - 1)) - 1;
}

const source = fs.readFileSync(SOURCE);
const srcMeta = parseWav(source);
console.log("─── SOURCE (Epidemic Sound) ───");
console.log(`  ${srcMeta.numChannels}ch ${srcMeta.sampleRate}Hz ${srcMeta.bitsPerSample}-bit, ${srcMeta.dataSize} audio bytes`);

// Build reference: just splice, no modification
const splitFrames = Math.floor((srcMeta.sampleRate * SPLIT_MS) / 1000);
const splitBytes = splitFrames * srcMeta.bytesPerFrame;
const audio = source.slice(srcMeta.dataStart, srcMeta.dataStart + srcMeta.dataSize);
const head = audio.slice(0, splitBytes);
const tail = audio.slice(splitBytes);
const refAudio = Buffer.concat([head, head, tail]);
console.log(`\n─── REFERENCE (splice only, no fade) ───`);
console.log(`  ${refAudio.length} audio bytes`);

// Read target file
const target = fs.readFileSync(TARGET);
const tgtMeta = parseWav(target);
const tgtAudio = target.slice(tgtMeta.dataStart, tgtMeta.dataStart + tgtMeta.dataSize);
console.log(`\n─── TARGET (confetti_pop.wav on disk) ───`);
console.log(`  Total file: ${target.length} bytes`);
console.log(`  ${tgtMeta.numChannels}ch ${tgtMeta.sampleRate}Hz ${tgtMeta.bitsPerSample}-bit`);
console.log(`  Audio bytes: ${tgtAudio.length}`);
console.log(`  Same size as reference: ${tgtAudio.length === refAudio.length ? "YES" : "NO (diff " + (tgtAudio.length - refAudio.length) + ")"}`);

// Find first byte that differs
let firstDiff = -1;
const minLen = Math.min(refAudio.length, tgtAudio.length);
for (let i = 0; i < minLen; i++) {
  if (refAudio[i] !== tgtAudio[i]) { firstDiff = i; break; }
}
console.log(`\n─── DIFF ANALYSIS ───`);
if (firstDiff === -1) {
  console.log("  Files are IDENTICAL — no fade was applied!");
} else {
  const diffMs = (firstDiff / srcMeta.bytesPerFrame / srcMeta.sampleRate) * 1000;
  const expectedFadeStart = (refAudio.length / srcMeta.bytesPerFrame / srcMeta.sampleRate) * 1000 - FADE_OUT_MS;
  console.log(`  First diff at byte ${firstDiff} (= ${diffMs.toFixed(1)}ms into audio)`);
  console.log(`  Expected fade to start at ~${expectedFadeStart.toFixed(1)}ms (file end - ${FADE_OUT_MS}ms)`);
}

// Verify last 10 samples are silent — usa el bits/channel del TARGET
// (no del source, porque pueden ser distintos tras conversión)
console.log(`\n─── LAST 10 SAMPLES OF TARGET (should be 0 / silent) ───`);
const tgtBPS = tgtMeta.bitsPerSample;
const tgtBytesPerSample = tgtMeta.bytesPerSample;
const tgtBytesPerFrame = tgtMeta.bytesPerFrame;
const tgtMaxAbs = maxAbsForBits(tgtBPS);
const last10Start = tgtAudio.length - 10 * tgtBytesPerFrame;
for (let i = 0; i < 10; i++) {
  const off = last10Start + i * tgtBytesPerFrame;
  const left = readSample(tgtAudio, off, tgtBPS);
  const right = readSample(tgtAudio, off + tgtBytesPerSample, tgtBPS);
  console.log(`  Frame ${i}: L=${left.toString().padStart(8)} R=${right.toString().padStart(8)}`);
}

// Sample max amplitude across the TARGET file
console.log(`\n─── TARGET AMPLITUDE STATS ───`);
let maxAbs = 0, sumAbs = 0;
const totalFrames = Math.floor(tgtAudio.length / tgtBytesPerFrame);
for (let f = 0; f < totalFrames; f++) {
  const off = f * tgtBytesPerFrame;
  for (let ch = 0; ch < tgtMeta.numChannels; ch++) {
    const v = readSample(tgtAudio, off + ch * tgtBytesPerSample, tgtBPS);
    const abs = Math.abs(v);
    if (abs > maxAbs) maxAbs = abs;
    sumAbs += abs;
  }
}
const avgAbs = sumAbs / (totalFrames * tgtMeta.numChannels);
console.log(`  Max amplitude: ${maxAbs} (= ${(maxAbs / tgtMaxAbs * 100).toFixed(1)}% of full scale)`);
console.log(`  Avg amplitude: ${avgAbs.toFixed(0)}`);

// Header byte-level check
console.log(`\n─── HEADER BYTE COMPARISON ───`);
const headerHex = (b) => b.slice(0, 44).toString("hex").match(/.{2}/g).join(" ");
console.log(`  Target header (first 44 bytes):`);
console.log(`  ${headerHex(target)}`);
