import { angleDiff, normalizeDeg } from "@/lib/geo";
import type { ChannelKind, ChannelWindow } from "@/lib/types";

/** Point Conception, where the coast turns from west-facing to south-facing. */
export const CONCEPTION_LON = -120.47;
/** Ventura, deep in the eastern channel. */
export const CHANNEL_EAST_LON = -119.25;

/** Deep-water directions, where the swell comes from. */
export const CHANNEL_SOUTH = { min: 145, max: 205 } as const;
export const CHANNEL_MIXED = { min: 205, max: 255 } as const;
export const CHANNEL_WRAP = { min: 255, max: 325 } as const;
/** Classic winter wrap for this coast. */
export const CHANNEL_WRAP_PEAK = 290;
export const WRAP_PERIOD_START_S = 8;
export const WRAP_PERIOD_FULL_S = 16;

export type ChannelArrival = {
  transmission: number;
  localDir: number;
  offshoreDir: number;
  kind: ChannelKind;
  depth: number;
};

export function channelDepth(lon: number): number {
  const span = CHANNEL_EAST_LON - CONCEPTION_LON;
  const depth = (lon - CONCEPTION_LON) / span;
  return clamp(depth, 0, 1);
}

/**
 * Turn an offshore swell into the height fraction and local direction that
 * actually arrive inside the Santa Barbara Channel.
 *
 * West and northwest swell is blocked by the Channel Islands and has to
 * refract around Point Conception. Longer period bends more, and breaks
 * farther east keep less of it. South swell runs up the channel between the
 * islands and the mainland, so it is not shadowed the same way.
 */
export function channelArrival(
  lon: number,
  beachFacing: number,
  swellDir: number,
  periodS: number,
  window: ChannelWindow,
): ChannelArrival {
  const dir = normalizeDeg(swellDir);
  const depth = channelDepth(lon);
  const southT = 0.4 + 0.6 * clamp(window.south, 0, 1);
  const wrapT = wrapTransmission(dir, periodS, depth, window.westWrap);
  const wrapBend = wrapBendAmount(dir, periodS);

  if (dir >= CHANNEL_SOUTH.min && dir < CHANNEL_SOUTH.max) {
    return arrival("south", southT, dir, dir, depth);
  }

  if (dir >= CHANNEL_MIXED.min && dir < CHANNEL_MIXED.max) {
    const towardWrap = (dir - CHANNEL_MIXED.min) / (CHANNEL_MIXED.max - CHANNEL_MIXED.min);
    const transmission = (1 - towardWrap) * southT + towardWrap * wrapT;
    const localDir = lerpAngle(dir, beachFacing, 0.35 * towardWrap * wrapBend);
    return arrival("mixed", transmission, dir, localDir, depth);
  }

  if (dir >= CHANNEL_WRAP.min && dir <= CHANNEL_WRAP.max) {
    const localDir = lerpAngle(dir, beachFacing, 0.72 * wrapBend);
    return arrival("wrap", wrapT, dir, localDir, depth);
  }

  return arrival("blocked", 0.08, dir, dir, depth);
}

export function wrapPeriodFactor(periodS: number): number {
  return clamp((periodS - WRAP_PERIOD_START_S) / (WRAP_PERIOD_FULL_S - WRAP_PERIOD_START_S), 0, 1);
}

function wrapTransmission(dir: number, periodS: number, depth: number, westWrap: number): number {
  const quality = clamp(1 - angleDiff(dir, CHANNEL_WRAP_PEAK) / 45, 0, 1);
  const period = 0.32 + 0.68 * wrapPeriodFactor(periodS);
  const keep = 0.9 - 0.45 * depth;
  return clamp(westWrap, 0, 1) * period * Math.max(quality, 0.12) * keep;
}

function wrapBendAmount(dir: number, periodS: number): number {
  const quality = clamp(1 - angleDiff(dir, CHANNEL_WRAP_PEAK) / 45, 0, 1);
  return wrapPeriodFactor(periodS) * Math.max(quality, 0.35);
}

function arrival(
  kind: ChannelKind,
  transmission: number,
  offshoreDir: number,
  localDir: number,
  depth: number,
): ChannelArrival {
  return {
    kind,
    transmission: clamp(transmission, 0.05, 1),
    offshoreDir,
    localDir: normalizeDeg(localDir),
    depth,
  };
}

function lerpAngle(from: number, to: number, t: number): number {
  const amount = clamp(t, 0, 1);
  const delta = ((normalizeDeg(to) - normalizeDeg(from) + 540) % 360) - 180;
  return normalizeDeg(from + delta * amount);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
