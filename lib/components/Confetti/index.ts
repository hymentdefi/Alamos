export {
  type Particle,
  type ShapeId,
  type SpawnOpts,
  SHAPE_SQUARE,
  SHAPE_CIRCLE,
  SHAPE_TRIANGLE,
  PALETTE_COLORS,
  makeParticle,
  updateParticle,
  isParticleDead,
  squareScaleY,
} from "./Particle";
export { ConfettiManager, type BurstConfig, type SpawnFn } from "./ConfettiManager";
export { ConfettiCanvas } from "./ConfettiCanvas";
export { pickColor, PALETTE } from "./colors";
