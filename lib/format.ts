export type Units = "us" | "metric";

export function formatFaceRange(faceFt: number, units: Units): string {
  if (faceFt < 0.8) return units === "us" ? "Flat" : "Flat";
  if (units === "metric") {
    const meters = faceFt / 3.28084;
    const low = Math.max(0.2, Math.round(meters * 0.85 * 10) / 10);
    const high = Math.max(low + 0.1, Math.round(meters * 1.3 * 10) / 10);
    return `${low.toFixed(1)}–${high.toFixed(1)} m`;
  }
  if (faceFt < 1.5) return "1 ft";
  const low = Math.max(1, Math.round(faceFt));
  const high = Math.max(low + 1, Math.round(faceFt * 1.35));
  return `${low}–${high} ft`;
}

export function formatFacePrecise(faceFt: number, units: Units): string {
  if (units === "metric") return `${(faceFt / 3.28084).toFixed(1)} m`;
  return `${faceFt.toFixed(1)} ft`;
}

export function formatSwellHeight(meters: number | null, units: Units): string {
  if (meters == null) return "—";
  if (units === "metric") return `${meters.toFixed(1)} m`;
  return `${(meters * 3.28084).toFixed(1)} ft`;
}

export function formatDistance(km: number, units: Units): string {
  if (units === "metric") return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
  const miles = km * 0.621371;
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}

export function formatSpeed(metersPerSecond: number, units: Units): string {
  if (units === "metric") return `${Math.round(metersPerSecond * 3.6)} km/h`;
  return `${Math.round(metersPerSecond * 2.236936)} mph`;
}

export function speedNumber(metersPerSecond: number, units: Units): number {
  if (units === "metric") return metersPerSecond * 3.6;
  return metersPerSecond * 2.236936;
}

export function heightNumber(meters: number, units: Units): number {
  if (units === "metric") return meters;
  return meters * 3.28084;
}

export function formatTemp(celsius: number, units: Units): string {
  if (units === "metric") return `${Math.round(celsius)}°C`;
  return `${Math.round((celsius * 9) / 5 + 32)}°F`;
}

export function formatTide(meters: number, units: Units): string {
  if (units === "metric") return `${meters.toFixed(2)} m`;
  return `${(meters * 3.28084).toFixed(1)} ft`;
}

export function speedUnit(units: Units): string {
  return units === "metric" ? "km/h" : "mph";
}

export function heightUnit(units: Units): string {
  return units === "metric" ? "m" : "ft";
}
