"use strict";
const test = require("node:test");
const assert = require("node:assert");
const R = require("../src/core.js");

test("room heat is volume times the room-type base for average insulation", () => {
  const r = R.roomHeat({ length: 5, width: 4, height: 2.4, roomType: "living", insulation: "average" });
  assert.strictEqual(r.volume, 48);
  assert.strictEqual(r.base, 50);
  assert.strictEqual(r.watts, 2400);        // 48 * 50 * 1
  assert.strictEqual(r.btu, 8189);          // 2400 * 3.412141633 -> 8189
});

test("watt to BTU conversion matches the standard factor", () => {
  assert.strictEqual(R.round(R.wToBtu(1000), 1), 3412.1);
  assert.strictEqual(R.round(R.btuToW(3412.141633), 0), 1000);
});

test("a bedroom needs less than a living room of the same size", () => {
  const dims = { length: 4, width: 3, height: 2.4 };
  const living = R.roomHeat(Object.assign({ roomType: "living" }, dims));
  const bedroom = R.roomHeat(Object.assign({ roomType: "bedroom" }, dims));
  assert.ok(bedroom.watts < living.watts);
});

test("poor insulation needs more heat than good insulation", () => {
  const dims = { length: 4, width: 3, height: 2.4, roomType: "living" };
  const good = R.roomHeat(Object.assign({ insulation: "good" }, dims));
  const poor = R.roomHeat(Object.assign({ insulation: "poor" }, dims));
  assert.ok(poor.watts > good.watts);
  assert.strictEqual(poor.watts, R.round(good.watts / 0.9 * 1.25, 0));
});

test("each exposure adjustment only ever adds heat", () => {
  const base = { length: 4, width: 3, height: 2.4, roomType: "living" };
  const plain = R.roomHeat(base).watts;
  for (const extra of [
    { largeWindows: true }, { northFacing: true }, { frenchDoors: true },
    { unheatedAbove: true }, { unheatedBelow: true }, { glazing: "single" }
  ]) {
    assert.ok(R.roomHeat(Object.assign({}, base, extra)).watts > plain);
  }
  // Triple glazing is the one that reduces it.
  assert.ok(R.roomHeat(Object.assign({}, base, { glazing: "triple" })).watts < plain);
});

test("extra outside walls add 8% each beyond the first", () => {
  const base = { length: 4, width: 3, height: 2.4, roomType: "living" };
  const one = R.roomHeat(Object.assign({ externalWalls: 1 }, base)).watts;
  const three = R.roomHeat(Object.assign({ externalWalls: 3 }, base)).watts;
  assert.strictEqual(three, R.round(one * (1 + 0.08 * 2), 0));
});

test("feet are converted to metres before the volume", () => {
  const m = R.roomHeat({ length: 3.048, width: 3.048, height: 3.048, unit: "m" });
  const ft = R.roomHeat({ length: 10, width: 10, height: 10, unit: "ft" });
  assert.strictEqual(ft.volume, m.volume);
});

test("at delta-T 50 the radiator delivers its full rated output", () => {
  // flow 75, return 65 -> mean 70; room 20 -> delta-T 50.
  const of = R.outputFraction(75, 65, 20);
  assert.strictEqual(of.deltaT, 50);
  assert.strictEqual(of.fraction, 1);
});

test("a cooler system drops output, so you need a bigger rated radiator", () => {
  const boiler = R.ratedSize({ neededWatts: 2400, flowTemp: 70, returnTemp: 50, roomTemp: 20 });
  assert.strictEqual(boiler.deltaT, 40);              // mean 60 - room 20
  assert.ok(boiler.fraction < 1);
  assert.ok(boiler.ratedWatts > 2400);
  assert.strictEqual(boiler.ratedWatts, R.round(2400 / boiler.fraction, 0));
});

test("a heat pump needs a much bigger radiator than a hot boiler", () => {
  const boiler = R.ratedSize({ neededWatts: 2400, flowTemp: 70, returnTemp: 50, roomTemp: 20 });
  const heatPump = R.ratedSize({ neededWatts: 2400, flowTemp: 45, returnTemp: 40, roomTemp: 20 });
  assert.ok(heatPump.ratedWatts > boiler.ratedWatts);
  assert.ok(heatPump.multiplier > 2);                // low-temperature heat pump ~ 2.5-3x
});

test("the rated fraction follows the EN 442 exponent", () => {
  const of = R.outputFraction(65, 55, 20);           // mean 60 - 20 = 40
  assert.strictEqual(of.fraction, R.round(Math.pow(40 / 50, R.RADIATOR_EXPONENT), 3));
});

test("no output when the water is not hotter than the room", () => {
  const of = R.outputFraction(20, 20, 20);
  assert.strictEqual(of.fraction, 0);
  const rated = R.ratedSize({ neededWatts: 2000, flowTemp: 18, returnTemp: 16, roomTemp: 20 });
  assert.strictEqual(rated.ratedWatts, null);
});

test("sizeRadiator joins the room heat and the rated size", () => {
  const out = R.sizeRadiator({
    length: 5, width: 4, height: 2.4, roomType: "living",
    flowTemp: 45, returnTemp: 40, roomTemp: 21
  });
  assert.strictEqual(out.heat.watts, 2400);
  assert.strictEqual(out.rated.neededWatts, 2400);
  assert.ok(out.rated.ratedWatts > out.heat.watts);
});

test("requiredFlow inverts ratedSize: feed the rated size back and recover the flow", () => {
  // Size a radiator for a heat pump, then ask what flow temp that exact
  // radiator needs for the same room. It should hand back the temperatures we
  // started from.
  const rated = R.ratedSize({ neededWatts: 2400, flowTemp: 45, returnTemp: 40, roomTemp: 20 });
  const rf = R.requiredFlow({ neededWatts: 2400, ratedWatts: rated.ratedWatts, roomTemp: 20, split: 5 });
  assert.ok(rf.ok);
  assert.ok(Math.abs(rf.flowTemp - 45) < 0.2, "recovers ~45C flow");
  assert.ok(Math.abs(rf.returnTemp - 40) < 0.2, "recovers ~40C return");
  assert.ok(Math.abs(rf.meanWater - 42.5) < 0.2);
});

test("requiredFlow: a bigger radiator can run at a cooler flow temperature", () => {
  const small = R.requiredFlow({ neededWatts: 1500, ratedWatts: 2000, roomTemp: 20, split: 5 });
  const big = R.requiredFlow({ neededWatts: 1500, ratedWatts: 3500, roomTemp: 20, split: 5 });
  assert.ok(small.ok && big.ok);
  assert.ok(big.flowTemp < small.flowTemp, "the bigger radiator meets the room cooler");
});

test("requiredFlow flags a radiator too small even at the rated delta-T 50", () => {
  const rf = R.requiredFlow({ neededWatts: 2500, ratedWatts: 2000, roomTemp: 20 });
  assert.strictEqual(rf.cannotMeet, true);
  assert.strictEqual(rf.ok, false);
  assert.strictEqual(rf.flowTemp, null);
});

test("requiredFlow takes BTU figures too and defaults the drop to 10C", () => {
  const rf = R.requiredFlow({ neededBtu: 5000, ratedBtu: 9000, roomTemp: 21 });
  assert.ok(rf.ok);
  assert.strictEqual(rf.split, 10);
  assert.strictEqual(rf.flowTemp, R.round(rf.meanWater + 5, 1));
});

test("requiredFlow returns a safe empty answer on missing numbers", () => {
  const rf = R.requiredFlow({});
  assert.strictEqual(rf.ok, false);
  assert.strictEqual(rf.flowTemp, null);
  assert.doesNotThrow(() => R.requiredFlow({ neededWatts: 2000 }));
});

test("bad or missing numbers clamp instead of throwing", () => {
  const r = R.roomHeat({ length: -5, width: "x", height: 2.4 });
  assert.strictEqual(r.volume, 0);
  assert.strictEqual(r.watts, 0);
  assert.doesNotThrow(() => R.ratedSize({}));
});
