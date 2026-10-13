import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { angleDiff } from "./geo";
import {
  chooseSwell,
  classifyWind,
  evaluateConditions,
  faceFeet,
} from "./rating";

describe("angles", () => {
  it("wraps across north", () => {
    assert.equal(angleDiff(10, 350), 20);
    assert.equal(angleDiff(270, 90), 180);
    assert.equal(angleDiff(0, 0), 0);
  });
});

describe("wind relative to a west-facing beach", () => {
  it("calls an east wind offshore", () => {
    assert.equal(classifyWind(90, 270, 10), "offshore");
  });

  it("calls a west wind onshore", () => {
    assert.equal(classifyWind(270, 270, 10), "onshore");
  });

  it("calls a north wind sideshore", () => {
    assert.equal(classifyWind(0, 270, 10), "sideshore");
  });

  it("calls a light wind glassy from any direction", () => {
    assert.equal(classifyWind(270, 270, 2), "glassy");
  });
});

describe("face height", () => {
  it("grows with period and shrinks when the swell is sideways", () => {
    const straight = faceFeet(1.5, 14, 0);
    const angled = faceFeet(1.5, 14, 90);
    const short = faceFeet(1.5, 6, 0);
    assert.ok(straight > short);
    assert.ok(straight > angled);
  });
});

describe("ratings", () => {
  it("scores a straight long-period swell with offshore wind as epic", () => {
    const result = evaluateConditions({
      beachFacing: 270,
      breakType: "beach",
      swellHeightM: 2,
      swellPeriodS: 14,
      swellDir: 270,
      windSpeedMs: 4,
      windDir: 90,
      tidePosition: 0.5,
    });
    assert.equal(result.points.direction, 35);
    assert.equal(result.points.wind, 35);
    assert.equal(result.points.tide, 10);
    assert.equal(result.rating, "epic");
    assert.ok(result.faceFt > 8);
  });

  it("caps strong onshore wind at poor", () => {
    const result = evaluateConditions({
      beachFacing: 270,
      breakType: "beach",
      swellHeightM: 2,
      swellPeriodS: 14,
      swellDir: 270,
      windSpeedMs: 10,
      windDir: 270,
      tidePosition: 0.5,
    });
    assert.equal(result.windType, "onshore");
    assert.ok(result.score <= 41);
    assert.equal(result.rating, "poor");
    assert.ok(result.caps.some((cap) => cap.includes("onshore")));
  });

  it("does not call a swell from the wrong direction good", () => {
    const result = evaluateConditions({
      beachFacing: 270,
      breakType: "beach",
      swellHeightM: 2,
      swellPeriodS: 14,
      swellDir: 90,
      windSpeedMs: 4,
      windDir: 90,
      tidePosition: 0.5,
    });
    assert.ok(result.angle > 110);
    assert.equal(result.rating, "poor");
  });

  it("keeps a clean knee-high windswell at fair", () => {
    const result = evaluateConditions({
      beachFacing: 270,
      breakType: "beach",
      swellHeightM: 0.8,
      swellPeriodS: 8,
      swellDir: 270,
      windSpeedMs: 1,
      windDir: 90,
      tidePosition: 0.5,
    });
    assert.ok(result.faceFt < 3);
    assert.ok(result.score <= 61);
    assert.equal(result.rating, "fair");
  });

  it("keeps a clean but tiny swell at poor", () => {
    const result = evaluateConditions({
      beachFacing: 270,
      breakType: "beach",
      swellHeightM: 0.1,
      swellPeriodS: 14,
      swellDir: 270,
      windSpeedMs: 3,
      windDir: 90,
      tidePosition: 0.5,
    });
    assert.ok(result.faceFt < 1);
    assert.equal(result.rating, "poor");
  });
});

describe("swell choice", () => {
  it("prefers the swell that actually hits the beach", () => {
    const choice = chooseSwell(
      270,
      { heightM: 2, periodS: 12, dir: 90, source: "primary" },
      { heightM: 1.2, periodS: 12, dir: 270, source: "secondary" },
      null,
    );
    assert.ok(choice);
    assert.equal(choice?.source, "secondary");
    assert.ok((choice?.faceFt ?? 0) > 4);
  });
});
