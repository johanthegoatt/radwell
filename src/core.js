// Radwell core: work out how much heat a room needs and how big a radiator to
// buy for it. Give it the room size and a few things about the room, and it
// gives the heat the room needs in watts and in BTU per hour (how UK radiators
// are sold), then works out the radiator you actually have to buy once your
// boiler or heat pump runs cooler than the test bench does. No DOM in here, so
// the same file runs in the page and under `node --test`.
//
// How the room heat is worked out
// --------------------------------
// Start from the room's volume (length x width x height) and a watts-per-cubic-
// metre figure for the kind of room, since a lounge is kept warmer than a
// bedroom. Then nudge it up or down for the things that change how fast a room
// loses heat: how well it is insulated, how many walls face outside, the
// windows, which way it faces, and whether there is an unheated space above or
// below. These are the same adjustments the usual consumer BTU calculators use.
// It is a guide to get you to the right size of radiator; a full heat-loss
// survey (the method in BS EN 12831) is the accurate route if you want one.
//
// The part most calculators skip: delta-T
// ---------------------------------------
// A radiator's BTU number on the box is measured on a test bench with the water
// averaging 70C in a 20C room, a difference of 50C. That is "delta-T 50" (the
// EN 442 standard). A modern condensing boiler, and especially a heat pump,
// runs the water much cooler, so the real difference is smaller and the same
// radiator gives out far less heat. Output falls with delta-T by a power of
// about 1.3 for a normal panel radiator (the radiator exponent 'n' in EN 442).
// So Radwell takes the heat your room needs, looks at the water temperature
// your system runs at, and tells you the delta-T-50 rated radiator you must buy
// for it to actually deliver that heat. On a heat pump that is often roughly
// double the rated size, which is why swapping the boiler for a heat pump
// usually means bigger radiators.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Radwell = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var W_PER_BTU = 0.29307107;      // 1 BTU/hr = 0.29307107 W
  var BTU_PER_W = 3.412141633;     // 1 W = 3.412141633 BTU/hr
  var FT_PER_M = 3.280839895;
  var RADIATOR_EXPONENT = 1.3;     // EN 442 'n' for a typical steel panel radiator
  var RATED_DELTA_T = 50;          // radiators are quoted at delta-T 50C

  // Watts per cubic metre for an average-insulated room, by what the room is
  // for. Warmer rooms (lounge, bathroom) sit higher; cooler rooms (bedroom)
  // lower, because they are heated to a lower target temperature.
  var ROOM_BASE = {
    living: 50,
    dining: 50,
    bedroom: 40,
    kitchen: 40,
    bathroom: 55,
    hall: 40,
    office: 45
  };

  // Insulation: a newer or well-insulated room loses less; an older or poorly
  // insulated one (solid walls, draughts) loses more.
  var INSULATION = { good: 0.9, average: 1.0, poor: 1.25 };

  function round(n, dp) {
    var f = Math.pow(10, dp || 0);
    return Math.round(n * f) / f;
  }
  function clampNum(v, min) {
    var n = Number(v);
    if (!isFinite(n)) return min || 0;
    return n < (min || 0) ? (min || 0) : n;
  }
  function toMetres(value, unit) {
    return unit === "ft" ? value / FT_PER_M : value;
  }

  function wToBtu(w) { return w * BTU_PER_W; }
  function btuToW(btu) { return btu * W_PER_BTU; }

  // The heat a room needs, in watts and BTU/hr. Returns the base figure, every
  // adjustment that was applied, and the final number, so the page can show the
  // working rather than a single mystery total.
  function roomHeat(opts) {
    opts = opts || {};
    var unit = opts.unit === "ft" ? "ft" : "m";
    var length = toMetres(clampNum(opts.length), unit);
    var width = toMetres(clampNum(opts.width), unit);
    var height = toMetres(clampNum(opts.height), unit);
    var volume = length * width * height;

    var roomType = ROOM_BASE[opts.roomType] ? opts.roomType : "living";
    var base = ROOM_BASE[roomType];

    var factors = [];
    var mult = 1;
    function apply(label, value) {
      if (value !== 1) factors.push({ label: label, factor: round(value, 3) });
      mult *= value;
    }

    var insul = INSULATION[opts.insulation] ? opts.insulation : "average";
    apply("Insulation (" + insul + ")", INSULATION[insul]);

    // One outside wall is the baseline; each extra exposed wall loses more.
    var externalWalls = Math.round(clampNum(opts.externalWalls, 0));
    if (externalWalls > 1) apply(externalWalls + " outside walls", 1 + 0.08 * (externalWalls - 1));

    // Glazing: double glazing is the baseline. Single glazing loses more;
    // triple a little less.
    if (opts.glazing === "single") apply("Single glazing", 1.1);
    else if (opts.glazing === "triple") apply("Triple glazing", 0.95);

    // A big window area, a north-facing room, patio/French doors, and an
    // unheated space above (top floor under the roof) or below (over a garage)
    // all add to the loss.
    if (opts.largeWindows) apply("Large window area", 1.1);
    if (opts.northFacing) apply("Faces north", 1.05);
    if (opts.frenchDoors) apply("French / patio doors", 1.1);
    if (opts.unheatedAbove) apply("Unheated space above", 1.1);
    if (opts.unheatedBelow) apply("Unheated space below", 1.1);

    var watts = volume * base * mult;
    return {
      volume: round(volume, 2),
      base: base,
      roomType: roomType,
      factors: factors,
      watts: round(watts, 0),
      btu: round(wToBtu(watts), 0)
    };
  }

  // How much of its rated (delta-T 50) output a radiator gives at a smaller
  // delta-T. meanWater is the average of the flow and return temperatures.
  function outputFraction(flowTemp, returnTemp, roomTemp) {
    var meanWater = (Number(flowTemp) + Number(returnTemp)) / 2;
    var dt = meanWater - Number(roomTemp);
    if (!(dt > 0)) return { deltaT: round(Math.max(0, dt), 1), fraction: 0, meanWater: round(meanWater, 1) };
    var fraction = Math.pow(dt / RATED_DELTA_T, RADIATOR_EXPONENT);
    return { deltaT: round(dt, 1), fraction: round(fraction, 3), meanWater: round(meanWater, 1) };
  }

  // Given the heat a room needs and the water temperatures your system runs at,
  // the delta-T-50 rated radiator you must buy so it actually delivers that
  // heat. Rated output = needed / fraction. If the system runs cooler than the
  // bench, the fraction is below 1 and the rated size you need is bigger.
  function ratedSize(opts) {
    opts = opts || {};
    var neededW = clampNum(opts.neededWatts);
    if (!neededW && opts.neededBtu) neededW = btuToW(clampNum(opts.neededBtu));

    var flow = isFinite(Number(opts.flowTemp)) ? Number(opts.flowTemp) : 70;
    var ret = isFinite(Number(opts.returnTemp)) ? Number(opts.returnTemp) : 50;
    var room = isFinite(Number(opts.roomTemp)) ? Number(opts.roomTemp) : 20;

    var of = outputFraction(flow, ret, room);
    var ratedW = of.fraction > 0 ? neededW / of.fraction : Infinity;
    var multiplier = of.fraction > 0 ? 1 / of.fraction : Infinity;

    return {
      neededWatts: round(neededW, 0),
      neededBtu: round(wToBtu(neededW), 0),
      flowTemp: flow,
      returnTemp: ret,
      roomTemp: room,
      meanWater: of.meanWater,
      deltaT: of.deltaT,
      fraction: of.fraction,
      ratedWatts: isFinite(ratedW) ? round(ratedW, 0) : null,
      ratedBtu: isFinite(ratedW) ? round(wToBtu(ratedW), 0) : null,
      multiplier: isFinite(multiplier) ? round(multiplier, 2) : null
    };
  }

  // The retrofit question, the other way round. You already have a radiator on
  // the wall (its box figure is its delta-T-50 rated output) and you want to
  // know what flow temperature your system has to run at for that radiator to
  // meet the room. This matters most for a heat pump: a heat pump is cheaper to
  // run the cooler it flows, so the question is often "will my existing
  // radiators cope at 45C, or do I have to run hotter (or change them)?".
  //
  // The fraction of its rated output the radiator must give is need / rated. If
  // that is 1 or more, the radiator can't do it even on the test bench, so it's
  // undersized and no flow temperature will fix it. Otherwise invert the EN 442
  // curve to get the delta-T, add it to the room temperature for the mean water
  // temperature, then split that into flow and return around the drop the
  // system runs (flow minus return).
  function requiredFlow(opts) {
    opts = opts || {};
    var neededW = clampNum(opts.neededWatts);
    if (!neededW && opts.neededBtu) neededW = btuToW(clampNum(opts.neededBtu));
    var ratedW = clampNum(opts.ratedWatts);
    if (!ratedW && opts.ratedBtu) ratedW = btuToW(clampNum(opts.ratedBtu));
    var room = isFinite(Number(opts.roomTemp)) ? Number(opts.roomTemp) : 20;
    // The flow-to-return drop. A heat pump usually runs a tight 5C drop, a
    // boiler a wider one; 10C is a fair default when it isn't given.
    var split = isFinite(Number(opts.split)) ? Math.abs(Number(opts.split)) : 10;

    if (!(neededW > 0) || !(ratedW > 0)) {
      return { neededWatts: round(neededW, 0), ratedWatts: round(ratedW, 0), ok: false, cannotMeet: false, meanWater: null, flowTemp: null, returnTemp: null };
    }

    var fraction = neededW / ratedW;
    // At or over 1 the radiator is too small even at the rated delta-T 50.
    if (fraction >= 1) {
      return {
        neededWatts: round(neededW, 0),
        ratedWatts: round(ratedW, 0),
        roomTemp: room,
        fraction: round(fraction, 3),
        cannotMeet: true,
        ok: false,
        meanWater: null,
        flowTemp: null,
        returnTemp: null
      };
    }

    var dt = RATED_DELTA_T * Math.pow(fraction, 1 / RADIATOR_EXPONENT);
    var meanWater = room + dt;
    var flow = meanWater + split / 2;
    var ret = meanWater - split / 2;
    return {
      neededWatts: round(neededW, 0),
      ratedWatts: round(ratedW, 0),
      roomTemp: room,
      split: split,
      fraction: round(fraction, 3),
      deltaT: round(dt, 1),
      meanWater: round(meanWater, 1),
      flowTemp: round(flow, 1),
      returnTemp: round(ret, 1),
      cannotMeet: false,
      ok: true
    };
  }

  // A full answer: the room's heat plus the rated radiator to buy for it.
  function sizeRadiator(opts) {
    var heat = roomHeat(opts);
    var rated = ratedSize({
      neededWatts: heat.watts,
      flowTemp: opts.flowTemp,
      returnTemp: opts.returnTemp,
      roomTemp: opts.roomTemp
    });
    return { heat: heat, rated: rated };
  }

  return {
    W_PER_BTU: W_PER_BTU,
    BTU_PER_W: BTU_PER_W,
    RADIATOR_EXPONENT: RADIATOR_EXPONENT,
    RATED_DELTA_T: RATED_DELTA_T,
    ROOM_BASE: ROOM_BASE,
    INSULATION: INSULATION,
    round: round,
    wToBtu: wToBtu,
    btuToW: btuToW,
    roomHeat: roomHeat,
    outputFraction: outputFraction,
    ratedSize: ratedSize,
    requiredFlow: requiredFlow,
    sizeRadiator: sizeRadiator
  };
});
