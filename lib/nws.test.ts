import assert from "node:assert/strict";
import test from "node:test";
import { IV_GOLETA_SPOTS, parseAirport, parseValidInterval, toMetersPerSecond, valueAt, windAt, type GridWind } from "@/lib/nws";
import { zonedStampToUtc } from "@/lib/time";

test("NWS intervals and kilometer wind convert onto an hour", () => {
  const interval = parseValidInterval("2026-10-15T00:00:00+00:00/PT3H");
  assert.ok(interval);
  assert.equal(interval.end - interval.start, 3 * 3600 * 1000);
  const instant = Date.parse("2026-10-15T02:00:00+00:00");
  assert.equal(
    valueAt(
      [
        { validTime: "2026-10-15T00:00:00+00:00/PT3H", value: 18 },
        { validTime: "2026-10-15T01:00:00+00:00/PT3H", value: 9 },
      ],
      instant,
    ),
    9,
  );
  assert.equal(toMetersPerSecond(18, "kmh"), 5);
});

test("grid wind at a Pacific hour uses the covering NWS interval", () => {
  const grid: GridWind = {
    office: "LOX",
    gridId: "LOX",
    gridX: 100,
    gridY: 71,
    speedUnit: "kmh",
    gustUnit: "kmh",
    speed: [{ validTime: "2026-10-15T07:00:00+00:00/PT3H", value: 14.4 }],
    direction: [{ validTime: "2026-10-15T07:00:00+00:00/PT3H", value: 270 }],
    gust: [{ validTime: "2026-10-15T07:00:00+00:00/PT3H", value: null }],
  };
  const instant = zonedStampToUtc("2026-10-15T01:00", "America/Los_Angeles");
  assert.equal(instant?.toISOString(), "2026-10-15T08:00:00.000Z");
  const sample = windAt(grid, instant?.getTime() ?? 0);
  assert.equal(sample?.dir, 270);
  assert.equal(sample?.speedMs, 4);
  assert.equal(sample?.gustMs, null);
});

test("KSBA calm is a real observation and a missing speed is not", () => {
  const calm = parseAirport({
    timestamp: "2026-10-15T07:15:00+00:00",
    windSpeed: { unitCode: "wmoUnit:km_h-1", value: 0 },
    windDirection: { unitCode: "wmoUnit:degree_(angle)", value: 0 },
    windGust: { unitCode: "wmoUnit:km_h-1", value: null },
  });
  assert.equal(calm?.speedMs, 0);
  assert.equal(calm?.gustMs, null);
  assert.equal(parseAirport({ timestamp: "2026-10-15T07:15:00+00:00", windSpeed: { value: null } }), null);
  for (const id of ["sands", "campus-point", "depressions", "coal-oil-point", "goleta-beach", "haskells"]) {
    assert.equal(IV_GOLETA_SPOTS.has(id), true);
  }
  assert.equal(IV_GOLETA_SPOTS.has("rincon"), false);
});
