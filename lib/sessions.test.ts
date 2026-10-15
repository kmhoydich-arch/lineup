import assert from "node:assert/strict";
import test from "node:test";
import { matchSessionHour, parseSessionEntries, sessionsToCsv, type SessionEntry } from "@/lib/sessions";
import type { DerivedHour } from "@/lib/types";

test("session csv quotes names and lines a log up with the model hour", () => {
  const entry: SessionEntry = {
    id: "a",
    time: "2026-10-15T08:30:00.000Z",
    spotId: "campus-point",
    height: "chest",
    windFeel: "offshore",
    worthIt: true,
  };
  const junk = parseSessionEntries([entry, { id: "bad" }, null]);
  assert.equal(junk.length, 1);
  const hour = {
    time: "2026-10-15T01:00",
    faceFt: 2.4,
    score: 58,
    swellHeightM: 0.5,
    swellPeriodS: 14.2,
    swellDir: 205,
    windSpeedMs: 1.2,
    waveSource: "mop",
  } as DerivedHour;
  const match = matchSessionHour(entry, [hour], "America/Los_Angeles");
  assert.equal(match?.time, hour.time);
  const csv = sessionsToCsv([
    {
      entry,
      spotName: 'Campus "Point"',
      model: {
        timeLocal: hour.time,
        faceFt: hour.faceFt,
        score: hour.score,
        swellM: hour.swellHeightM,
        periodS: hour.swellPeriodS,
        dirDeg: hour.swellDir,
        windMs: hour.windSpeedMs,
        waveSource: hour.waveSource,
      },
    },
  ]);
  assert.match(csv, /"Campus ""Point"""/);
  assert.match(csv, /chest,offshore,yes,2026-10-15T01:00,2.40,58,0.50,14.2,205,1.20,mop/);
});
