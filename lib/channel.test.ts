import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { channelArrival, channelDepth } from "./channel";
import { chooseSwell, evaluateConditions } from "./rating";

const campus = { lon: -119.8438, window: { westWrap: 0.72, south: 0.7 } };
const goleta = { lon: -119.8326, window: { westWrap: 0.22, south: 0.4 } };
const rincon = { lon: -119.47664, window: { westWrap: 0.98, south: 0.58 } };

describe("channel depth", () => {
  it("is shallow at Refugio and deep at Ventura", () => {
    assert.ok(channelDepth(-120.07) < 0.4);
    assert.ok(channelDepth(-119.3) > 0.85);
  });
});

describe("channel shadow", () => {
  it("counts a long-period wrap and throws away a short-period one", () => {
    const long = evaluateConditions({
      beachFacing: 200,
      breakType: "point",
      swellHeightM: 2,
      swellPeriodS: 16,
      swellDir: 290,
      windSpeedMs: 3,
      windDir: 10,
      tidePosition: 0.55,
      channel: campus,
    });
    const short = evaluateConditions({
      beachFacing: 200,
      breakType: "point",
      swellHeightM: 2,
      swellPeriodS: 9,
      swellDir: 280,
      windSpeedMs: 3,
      windDir: 10,
      tidePosition: 0.55,
      channel: campus,
    });
    assert.equal(long.channelKind, "wrap");
    assert.ok((long.channelTransmission ?? 0) > 0.35);
    assert.ok(long.faceFt > short.faceFt * 2);
    assert.ok((short.channelTransmission ?? 1) < 0.22);
    assert.ok(short.caps.some((cap) => cap.includes("Channel Islands")));
  });

  it("lets south swell through and prefers it over a taller shadowed west", () => {
    const south = channelArrival(campus.lon, 200, 180, 14, campus.window);
    assert.equal(south.kind, "south");
    assert.ok(south.transmission > 0.75);

    const choice = chooseSwell(
      200,
      { heightM: 2.2, periodS: 9, dir: 285, source: "primary" },
      { heightM: 1.2, periodS: 14, dir: 180, source: "secondary" },
      null,
      campus,
    );
    assert.equal(choice?.swell.source, "secondary");
    assert.equal(choice?.channelKind, "south");
  });

  it("gives Rincon more wrapped west than Goleta Beach", () => {
    const shared = {
      beachFacing: 200,
      breakType: "point" as const,
      swellHeightM: 2.4,
      swellPeriodS: 16,
      swellDir: 290,
      windSpeedMs: 3,
      windDir: 10,
      tidePosition: 0.55,
    };
    const atRincon = evaluateConditions({ ...shared, channel: rincon });
    const atGoleta = evaluateConditions({ ...shared, beachFacing: 160, breakType: "beach", channel: goleta });
    assert.ok(atRincon.faceFt > atGoleta.faceFt * 1.8);
  });

  it("leaves an open-coast beach unchanged", () => {
    const open = evaluateConditions({
      beachFacing: 270,
      breakType: "beach",
      swellHeightM: 2,
      swellPeriodS: 14,
      swellDir: 270,
      windSpeedMs: 4,
      windDir: 90,
      tidePosition: 0.5,
    });
    assert.equal(open.channelKind, null);
    assert.equal(open.channelTransmission, null);
    assert.equal(open.rating, "epic");
  });
});
