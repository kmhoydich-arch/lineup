import type { Units } from "@/lib/format";
import { formatFacePrecise, formatSpeed, formatTide } from "@/lib/format";
import { compassWord } from "@/lib/geo";
import type { DerivedHour, Rating, Spot, WindKind } from "@/lib/types";

export function sizeWords(faceFt: number): string {
  if (faceFt < 1) return "flat";
  if (faceFt < 2) return "ankle to knee high";
  if (faceFt < 3) return "knee to thigh high";
  if (faceFt < 4) return "waist high";
  if (faceFt < 5) return "chest high";
  if (faceFt < 6) return "shoulder high";
  if (faceFt < 8) return "head high";
  if (faceFt < 10) return "overhead";
  if (faceFt < 15) return "well overhead";
  return "double overhead or bigger";
}

export function breakLabel(type: Spot["breakType"]): string {
  if (type === "beach") return "Beach break";
  if (type === "point") return "Point break";
  return "Reef break";
}

export function windLabel(kind: WindKind): string {
  if (kind === "glassy") return "Light wind";
  if (kind === "cross-offshore") return "Cross-offshore";
  if (kind === "cross-onshore") return "Cross-onshore";
  if (kind === "sideshore") return "Sideshore";
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function skyLabel(code: number | null): string | null {
  if (code == null) return null;
  if (code >= 95) return "Thunder";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 || (code >= 51 && code <= 67)) return "Rain";
  if (code === 45 || code === 48) return "Fog";
  if (code === 0) return "Clear";
  if (code <= 3) return "Cloudy";
  return null;
}

function skySentence(code: number | null, precip: number | null): string | null {
  if (code != null && code >= 95) return "Thunderstorms are in the forecast.";
  if (code != null && code >= 71 && code <= 77) return "Snow is in the forecast.";
  if (code != null && (code >= 80 || (code >= 51 && code <= 67))) return "Rain is in the forecast.";
  if (code === 45 || code === 48) return "Fog is in the forecast.";
  if (precip != null && precip >= 70) return "Rain is likely.";
  return null;
}

function windSentence(hour: DerivedHour, units: Units): string {
  const speed = formatSpeed(hour.windSpeedMs, units);
  const from = compassWord(hour.windDir);
  const gusty =
    hour.windGustMs != null &&
    hour.windSpeedMs > 3 &&
    hour.windGustMs > hour.windSpeedMs * 1.45;
  const gust = gusty ? " Gusts run well above the steady wind." : "";
  switch (hour.windType) {
    case "glassy":
      return `Wind is light at ${speed}, so the surface should stay glassy.${gust}`;
    case "offshore":
      return `Wind is offshore from the ${from} at ${speed}, which should groom the faces.${gust}`;
    case "cross-offshore":
      return `Wind is cross-offshore from the ${from} at ${speed}, mostly clean with a little texture.${gust}`;
    case "sideshore":
      return `Wind is sideshore from the ${from} at ${speed}, so expect some bump.${gust}`;
    case "cross-onshore":
      return `Wind is cross-onshore from the ${from} at ${speed}, which will crumple the faces.${gust}`;
    case "onshore":
      return `Wind is onshore from the ${from} at ${speed}, so it will be bumpy.${gust}`;
  }
}

function tideSentence(hour: DerivedHour, units: Units, hasTideStation: boolean): string {
  if (hour.tideM == null || hour.tideStage == null || hour.tideTrend == null) {
    return hasTideStation
      ? "The tide prediction didn't load, so tide is left out of this read."
      : "No NOAA tide station covers this coast, so tide stays a neutral slice of the score.";
  }
  return `Tide is ${hour.tideStage} and ${hour.tideTrend}, about ${formatTide(hour.tideM, units)} above MLLW.`;
}

function verdict(rating: Rating, faceFt: number): string {
  if (faceFt >= 12 && (rating === "good" || rating === "epic")) {
    return `The score says ${rating}, and the size is serious. This is an expert paddle.`;
  }
  if (rating === "epic") {
    return "The score says epic: the swell has period, the wind is cooperating, and the tide isn't fighting it.";
  }
  if (rating === "good") return "The score says good.";
  if (rating === "fair") {
    return "The score says fair. Rideable, with a real compromise in the wind, the angle, or the period.";
  }
  return "The score says poor.";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function buildSummary(spot: Spot, hour: DerivedHour, units: Units): string {
  const dir = compassWord(hour.swellDir);
  const period = Math.round(hour.swellPeriodS);
  const wind = windSentence(hour, units);
  const tide = tideSentence(hour, units, Boolean(spot.tide));
  const sky = skySentence(hour.weatherCode, hour.precipProb);

  if (hour.faceFt < 1 || hour.swellSource === "flat") {
    return [
      `${spot.name} is too small to surf right now.`,
      `The best energy is about ${formatFacePrecise(hour.faceFt, units)} from the ${dir} at ${period}s.`,
      channelSentence(hour),
      wind,
      tide,
      sky,
    ]
      .filter(Boolean)
      .join(" ");
  }

  let lead: string;
  const shadowed = hour.channelKind === "wrap" || hour.channelKind === "mixed" || hour.channelKind === "blocked";
  if (hour.swellSource === "windsea") {
    lead = `It's mostly local windsea, ${sizeWords(hour.faceFt)}, around ${period} seconds out of the ${dir}. That kind of chop rarely lines up.`;
  } else if (hour.swellSource === "secondary") {
    lead = `${capitalize(sizeWords(hour.faceFt))} secondary swell from the ${dir} at ${period} seconds is the one that arrives best on this beach. The other swell is aimed worse, so the rating uses this one.`;
  } else if (shadowed) {
    lead = `${capitalize(sizeWords(hour.faceFt))} ${dir} swell at ${period} seconds, measured offshore.`;
  } else if (hour.swellAngle <= 20) {
    lead = `${capitalize(sizeWords(hour.faceFt))} ${dir} swell at ${period} seconds, aimed nearly straight in.`;
  } else {
    const side = hour.swellSigned >= 0 ? "the right" : "the left";
    lead = `${capitalize(sizeWords(hour.faceFt))} ${dir} swell at ${period} seconds, about ${Math.round(hour.swellAngle)}° off straight in from ${side} as you look out to sea.`;
  }

  return [lead, channelSentence(hour), wind, tide, verdict(hour.rating, hour.faceFt), sky].filter(Boolean).join(" ");
}

function channelSentence(hour: DerivedHour): string | null {
  if (!hour.channelKind || hour.channelTransmission == null) return null;
  const pct = Math.max(1, Math.round(hour.channelTransmission * 100));
  if (hour.channelKind === "south") {
    return "South swell runs up the Santa Barbara Channel between the islands and the mainland, so this direction is not shadowed the way a west swell is.";
  }
  if (hour.channelKind === "wrap") {
    return `West-northwest swell has to wrap around Point Conception. About ${pct}% of the offshore height is counted, and a longer period bends it toward the beach.`;
  }
  if (hour.channelKind === "mixed") {
    return `Southwest swell only partly clears the Channel Islands. About ${pct}% of the offshore height is counted.`;
  }
  return `This direction is blocked by the Channel Islands and the bend at Point Conception. About ${pct}% of the offshore height is counted.`;
}

export function windowBlurb(hour: DerivedHour): string {
  const wind =
    hour.windType === "glassy" ? "the wind is light" : `the wind is ${hour.windType}`;
  const tide = hour.tideStage ? ` and the tide is ${hour.tideStage}` : "";
  if (hour.rating === "poor") {
    return `Least-bad stretch: ${wind}${tide}, and it still rates poor.`;
  }
  return `Best overlap of the day, when ${wind}${tide}.`;
}

export function buoyComparison(
  buoyHeightM: number | null,
  modelHeightM: number | null,
  units: Units,
): string | null {
  if (buoyHeightM == null || modelHeightM == null) return null;
  const diffM = buoyHeightM - modelHeightM;
  const diff =
    units === "metric"
      ? `${Math.abs(diffM).toFixed(1)} m`
      : `${Math.abs(diffM * 3.28084).toFixed(1)} ft`;
  if (Math.abs(diffM) < 0.35) {
    return "The buoy's wave height is within about a foot of the model. Buoy height is offshore water, not the face height on the beach.";
  }
  if (diffM > 0) {
    return `The buoy is reading about ${diff} higher than the model. The surf may be bigger than the chart. Buoy height is offshore water, not face height.`;
  }
  return `The buoy is reading about ${diff} lower than the model. The surf may be smaller than the chart. Buoy height is offshore water, not face height.`;
}
