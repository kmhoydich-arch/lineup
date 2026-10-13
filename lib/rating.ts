import { angleDiff, signedFromFacing } from "@/lib/geo";
import type { BreakType, Rating, ScorePoints, WindKind } from "@/lib/types";

export const METERS_TO_FEET = 3.28084;
export const MS_TO_MPH = 2.236936;
export const GLASSY_MAX_MPH = 4;
export const WINDSEA_FACE_DISCOUNT = 0.75;
export const TIDE_NEUTRAL_POINTS = 6;
export const RATING_THRESHOLDS = { epic: 82, good: 64, fair: 44 } as const;

export const PERIOD_FACTORS = [
  { maxExclusive: 6, factor: 0.55 },
  { maxExclusive: 8, factor: 0.7 },
  { maxExclusive: 10, factor: 0.9 },
  { maxExclusive: 12, factor: 1.05 },
  { maxExclusive: 14, factor: 1.2 },
  { maxExclusive: 16, factor: 1.35 },
  { maxExclusive: 18, factor: 1.5 },
  { maxExclusive: Number.POSITIVE_INFINITY, factor: 1.6 },
] as const;

export const EXPOSURE_FACTORS = [
  { maxAngle: 25, factor: 1 },
  { maxAngle: 45, factor: 0.9 },
  { maxAngle: 70, factor: 0.7 },
  { maxAngle: 100, factor: 0.4 },
  { maxAngle: 180, factor: 0.15 },
] as const;

export const DIRECTION_POINTS = [
  { maxAngle: 20, points: 35 },
  { maxAngle: 40, points: 28 },
  { maxAngle: 60, points: 18 },
  { maxAngle: 80, points: 8 },
  { maxAngle: 180, points: 2 },
] as const;

export const PERIOD_POINTS = [
  { min: 16, points: 20 },
  { min: 14, points: 17 },
  { min: 12, points: 14 },
  { min: 10, points: 10 },
  { min: 8, points: 6 },
  { min: 6, points: 3 },
  { min: 0, points: 0 },
] as const;

export const WIND_SECTORS = [
  { maxAngle: 35, kind: "offshore" },
  { maxAngle: 70, kind: "cross-offshore" },
  { maxAngle: 110, kind: "sideshore" },
  { maxAngle: 145, kind: "cross-onshore" },
  { maxAngle: 180, kind: "onshore" },
] as const;

export const WIND_POINTS: { kind: WindKind; maxMph: number; points: number }[] = [
  { kind: "glassy", maxMph: 1000, points: 32 },
  { kind: "offshore", maxMph: 15, points: 35 },
  { kind: "offshore", maxMph: 25, points: 26 },
  { kind: "offshore", maxMph: 1000, points: 16 },
  { kind: "cross-offshore", maxMph: 12, points: 28 },
  { kind: "cross-offshore", maxMph: 20, points: 22 },
  { kind: "cross-offshore", maxMph: 1000, points: 14 },
  { kind: "sideshore", maxMph: 10, points: 20 },
  { kind: "sideshore", maxMph: 18, points: 12 },
  { kind: "sideshore", maxMph: 1000, points: 6 },
  { kind: "cross-onshore", maxMph: 8, points: 12 },
  { kind: "cross-onshore", maxMph: 1000, points: 5 },
  { kind: "onshore", maxMph: 6, points: 10 },
  { kind: "onshore", maxMph: 12, points: 5 },
  { kind: "onshore", maxMph: 1000, points: 0 },
];

export type SwellCandidate = {
  heightM: number;
  periodS: number;
  dir: number;
  source: "primary" | "secondary" | "windsea";
};

export type Evaluation = {
  faceFt: number;
  angle: number;
  signedAngle: number;
  windType: WindKind;
  windMph: number;
  points: ScorePoints;
  rawScore: number;
  score: number;
  caps: string[];
  rating: Rating;
};

export function periodFactor(periodS: number): number {
  const row = PERIOD_FACTORS.find((item) => periodS < item.maxExclusive);
  return row?.factor ?? 1;
}

export function exposureFactor(angle: number): number {
  const row = EXPOSURE_FACTORS.find((item) => angle <= item.maxAngle);
  return row?.factor ?? 0.15;
}

export function directionPoints(angle: number): number {
  const row = DIRECTION_POINTS.find((item) => angle <= item.maxAngle);
  return row?.points ?? 2;
}

export function periodPoints(periodS: number): number {
  const row = PERIOD_POINTS.find((item) => periodS >= item.min);
  return row?.points ?? 0;
}

export function faceFeet(
  heightM: number,
  periodS: number,
  angle: number,
  discount = 1,
): number {
  if (heightM <= 0 || periodS <= 0) return 0;
  return heightM * METERS_TO_FEET * periodFactor(periodS) * exposureFactor(angle) * discount;
}

export function classifyWind(
  windFromDeg: number,
  beachFacing: number,
  speedMph: number,
): WindKind {
  if (speedMph < GLASSY_MAX_MPH) return "glassy";
  const offshoreFrom = (beachFacing + 180) % 360;
  const angle = angleDiff(windFromDeg, offshoreFrom);
  const sector = WIND_SECTORS.find((item) => angle <= item.maxAngle);
  return sector?.kind ?? "onshore";
}

export function windPoints(kind: WindKind, speedMph: number): number {
  const row = WIND_POINTS.find((item) => item.kind === kind && speedMph <= item.maxMph);
  return row?.points ?? 0;
}

export function tidePoints(breakType: BreakType, position: number | null): number {
  if (position == null || Number.isNaN(position)) return TIDE_NEUTRAL_POINTS;
  const p = Math.min(1, Math.max(0, position));
  if (breakType === "point") {
    if (p >= 0.4 && p <= 0.75) return 10;
    if ((p >= 0.25 && p < 0.4) || (p > 0.75 && p <= 0.85)) return 6;
    return 3;
  }
  if (breakType === "reef") {
    if (p >= 0.45 && p <= 0.8) return 10;
    if (p >= 0.3 && p < 0.45) return 6;
    if (p < 0.25) return 2;
    return 5;
  }
  if (p >= 0.35 && p <= 0.65) return 10;
  if ((p >= 0.2 && p < 0.35) || (p > 0.65 && p <= 0.8)) return 6;
  return 3;
}

export function ratingFor(score: number, faceFt: number): Rating {
  if (faceFt < 1) return "poor";
  if (score >= RATING_THRESHOLDS.epic) return "epic";
  if (score >= RATING_THRESHOLDS.good) return "good";
  if (score >= RATING_THRESHOLDS.fair) return "fair";
  return "poor";
}

export function chooseSwell(
  beachFacing: number,
  primary: SwellCandidate | null,
  secondary: SwellCandidate | null,
  windsea: SwellCandidate | null,
): {
  swell: SwellCandidate;
  faceFt: number;
  angle: number;
  source: SwellCandidate["source"] | "flat";
} | null {
  const usable: { swell: SwellCandidate; discount: number }[] = [];
  for (const swell of [primary, secondary]) {
    if (swell && swell.heightM >= 0.25 && swell.periodS > 0) {
      usable.push({ swell, discount: 1 });
    }
  }
  if (!usable.length && windsea && windsea.heightM >= 0.3 && windsea.periodS > 0) {
    usable.push({ swell: windsea, discount: WINDSEA_FACE_DISCOUNT });
  }

  if (!usable.length) {
    const fallback = [primary, secondary, windsea]
      .filter((item): item is SwellCandidate => item != null && item.heightM > 0 && item.periodS > 0)
      .sort((a, b) => b.heightM - a.heightM)[0];
    if (!fallback) return null;
    usable.push({
      swell: fallback,
      discount: fallback.source === "windsea" ? WINDSEA_FACE_DISCOUNT : 1,
    });
  }

  let best = usable[0];
  let bestFace = -1;
  let bestAngle = 0;
  for (const option of usable) {
    const angle = angleDiff(option.swell.dir, beachFacing);
    const face = faceFeet(option.swell.heightM, option.swell.periodS, angle, option.discount);
    if (face > bestFace) {
      best = option;
      bestFace = face;
      bestAngle = angle;
    }
  }

  return {
    swell: best.swell,
    faceFt: Math.max(0, bestFace),
    angle: bestAngle,
    source: bestFace < 1 ? "flat" : best.swell.source,
  };
}

export function evaluateConditions(input: {
  beachFacing: number;
  breakType: BreakType;
  swellHeightM: number;
  swellPeriodS: number;
  swellDir: number;
  windSpeedMs: number;
  windDir: number;
  tidePosition: number | null;
  discount?: number;
}): Evaluation {
  const angle = angleDiff(input.swellDir, input.beachFacing);
  const signedAngle = signedFromFacing(input.swellDir, input.beachFacing);
  const windMph = Math.max(0, input.windSpeedMs * MS_TO_MPH);
  const windType = classifyWind(input.windDir, input.beachFacing, windMph);
  const points: ScorePoints = {
    direction: directionPoints(angle),
    wind: windPoints(windType, windMph),
    period: periodPoints(input.swellPeriodS),
    tide: tidePoints(input.breakType, input.tidePosition),
  };
  const rawScore = points.direction + points.wind + points.period + points.tide;
  const caps: string[] = [];
  let score = rawScore;

  const applyCap = (maxScore: number, message: string) => {
    if (score > maxScore) {
      score = maxScore;
      caps.push(message);
    }
  };

  if (angle > 110) {
    applyCap(41, "The swell is aimed away from this beach, so the score is capped at Poor.");
  } else if (angle > 80) {
    applyCap(55, "The swell is more than 80° off the beach, so the score is capped at Fair.");
  }

  if (input.swellPeriodS < 7) {
    applyCap(61, "Period under 7 seconds is windswell, so the score is capped at Fair.");
  }

  if ((windType === "onshore" || windType === "cross-onshore") && windMph > 18) {
    applyCap(41, "Strong onshore wind caps the score at Poor.");
  }

  const faceFt = faceFeet(
    input.swellHeightM,
    input.swellPeriodS,
    angle,
    input.discount ?? 1,
  );

  if (faceFt < 3 && input.swellPeriodS < 10) {
    applyCap(61, "Small, short-period surf is capped at Fair. There is not enough size and period to call it good.");
  }

  if (faceFt < 1) {
    caps.push("Under 1 ft of surfable face, so the rating stays Poor even when the wind is clean.");
  }

  return {
    faceFt,
    angle,
    signedAngle,
    windType,
    windMph,
    points,
    rawScore,
    score,
    caps,
    rating: ratingFor(score, faceFt),
  };
}
