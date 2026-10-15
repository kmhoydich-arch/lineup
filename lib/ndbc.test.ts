import assert from "node:assert/strict";
import test from "node:test";
import { classifyReading, nearestBuoys, parseActiveStations, parseBuoy, selectBuoy, type BuoyCandidate } from "@/lib/ndbc";

const xml = `<?xml version="1.0"?>
<stations>
  <station id="46053" lat="34.246" lon="-119.842" name="EAST SANTA BARBARA" type="buoy"/>
  <station id="46054" lat="34.274" lon="-120.468" name="WEST SANTA BARBARA" type="buoy"/>
  <station id="46218" lat="34.452" lon="-120.780" name="Harvest, CA" type="buoy"/>
  <station id="NTBC1" lat="34.4" lon="-119.7" name="tide station" type="fixed"/>
</stations>`;

test("nearest buoys skip fixed stations and stay in distance order", () => {
  const stations = parseActiveStations(xml);
  const ordered = nearestBuoys(stations, 34.4058, -119.8438, 180, 8);
  assert.deepEqual(
    ordered.map((station) => station.id),
    ["46053", "46054", "46218"],
  );
});

test("the nearest buoy with a fresh wave report wins", () => {
  const ordered = nearestBuoys(parseActiveStations(xml), 34.4058, -119.8438) as BuoyCandidate[];
  const waiting = selectBuoy(ordered, {});
  assert.equal(waiting.needsMore, true);
  assert.equal(waiting.nextId, "46053");
  const choice = selectBuoy(ordered, { "46053": "no-waves", "46054": "ok" });
  assert.equal(choice.chosen?.id, "46054");
  assert.equal(choice.skipped[0]?.id, "46053");
  assert.equal(choice.needsMore, false);
});

test("a wind-only buoy row is not a live wave report", () => {
  const text = `#YY  MM DD hh mm WVHT
#yr  mo dy hr mn m
2026 10 15 07 00 MM
2026 10 06 05 50 0.8
`;
  const parsed = parseBuoy(text);
  assert.equal(classifyReading(parsed), "no-waves");
  const now = new Date();
  const live = parseBuoy(`#YY  MM DD hh mm WVHT DPD MWD
${now.getUTCFullYear()} ${now.getUTCMonth() + 1} ${now.getUTCDate()} ${now.getUTCHours()} ${now.getUTCMinutes()} 1.5 16 259
`);
  assert.equal(live?.waveHeightM, 1.5);
  assert.equal(classifyReading(live), "ok");
});
