import assert from "node:assert/strict";
import test from "node:test";
import { haversineKm } from "@/lib/geo";
import { MOP_TRANSECTS, parseMopAscii, parseWaveTimeLength, pickMopSample, type MopSample } from "@/lib/mop";
import { SPOTS } from "@/lib/spots";

const ascii = `Dataset {
    Int32 waveTime[waveTime = 3];
} example;
---------------------------------------------
waveTime[3]
1791763200, 1791774000, 1791784800

waveFlagPrimary[3]
1, 4, 1

waveHs[3]
0.5, 0.2, 0.8

waveTp[3]
14, 8, 15

waveDp[3]
200, 10, 210
`;

test("MOP ascii and DDS parsers keep the published numbers", () => {
  assert.equal(parseWaveTimeLength("Int32 waveTime[waveTime = 13495];"), 13495);
  const arrays = parseMopAscii(ascii);
  assert.deepEqual(arrays.waveFlagPrimary, [1, 4, 1]);
  assert.equal(arrays.waveHs[0], 0.5);
  assert.equal(arrays.waveDp[2], 210);
});

test("a good nowcast beats a forecast at the same time", () => {
  const unix = 1_000_000;
  const samples: MopSample[] = [
    { unix, hs: 0.4, tp: 15, dp: 200, flag: 1, kind: "nowcast" },
    { unix, hs: 2.2, tp: 9, dp: 280, flag: 1, kind: "forecast" },
  ];
  const pick = pickMopSample(samples, unix);
  assert.equal(pick.reason, "ok");
  assert.equal(pick.sample?.hs, 0.4);
  assert.equal(pick.sample?.kind, "nowcast");
});

test("forecast hours between two good flags are interpolated", () => {
  const start = 1_000_000;
  const samples: MopSample[] = [
    { unix: start, hs: 1, tp: 10, dp: 350, flag: 1, kind: "forecast" },
    { unix: start + 3 * 3600, hs: 2, tp: 16, dp: 10, flag: 1, kind: "forecast" },
  ];
  const pick = pickMopSample(samples, start + 3600);
  assert.equal(pick.reason, "ok");
  assert.ok(Math.abs((pick.sample?.hs ?? 0) - 4 / 3) < 1e-9);
  assert.ok(Math.abs((pick.sample?.dp ?? 0) - 356.666) < 0.01 || Math.abs((pick.sample?.dp ?? 0) - (350 + 20 / 3)) < 0.01);
});

test("a flagged MOP sample with no good neighbor falls back", () => {
  const unix = 5_000_000;
  const samples: MopSample[] = [{ unix, hs: 1.2, tp: 12, dp: 200, flag: 4, kind: "nowcast" }];
  const pick = pickMopSample(samples, unix);
  assert.equal(pick.reason, "flagged");
  assert.equal(pick.sample, null);
  assert.equal(pick.flag, 4);
  assert.equal(pickMopSample([], unix).reason, "missing");
});

test("every channel break has a MOP transect within 2 km and no fixed buoy", () => {
  const channel = SPOTS.filter((spot) => spot.channel);
  assert.equal(channel.length, 13);
  for (const spot of channel) {
    assert.equal(spot.buoy, undefined);
    const transect = MOP_TRANSECTS[spot.id];
    assert.ok(transect, spot.id);
    const km = haversineKm(spot.lat, spot.lon, transect.lat, transect.lon);
    assert.ok(km < 2, `${spot.id} ${km}`);
  }
  assert.equal(MOP_TRANSECTS["campus-point"].id, "B0382");
  assert.equal(MOP_TRANSECTS.rincon.id, "VE678");
  assert.equal(MOP_TRANSECTS["c-street"].id, "VE465");
});
