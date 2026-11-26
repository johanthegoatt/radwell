// Radwell page glue: read the form, ask the core for the room's heat and the
// radiator to buy, and show it. Keeps no state of its own beyond the form; the
// maths all lives in core.js. Updates live as you type.
(function () {
  "use strict";
  var R = window.Radwell;

  // Flow / return temperatures for the common heating types. Room temperature
  // is left to the user. These are typical running points, not fixed rules.
  var SYSTEMS = {
    hot: { flow: 70, return: 50 },
    condensing: { flow: 55, return: 45 },
    heatpump: { flow: 45, return: 40 }
  };

  function $(id) { return document.getElementById(id); }
  function num(id) { var v = parseFloat($(id).value); return isFinite(v) ? v : 0; }
  function checked(id) { return $(id).checked; }
  function radio(name) {
    var el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : null;
  }

  function fmt(n) {
    if (n === null || n === undefined || !isFinite(n)) return "—";
    return Math.round(n).toLocaleString();
  }

  function readForm() {
    return {
      unit: radio("unit") || "m",
      length: num("length"),
      width: num("width"),
      height: num("height"),
      roomType: $("roomType").value,
      insulation: $("insulation").value,
      externalWalls: parseInt($("externalWalls").value, 10) || 1,
      glazing: $("glazing").value,
      largeWindows: checked("largeWindows"),
      northFacing: checked("northFacing"),
      frenchDoors: checked("frenchDoors"),
      unheatedAbove: checked("unheatedAbove"),
      unheatedBelow: checked("unheatedBelow"),
      flowTemp: num("flowTemp"),
      returnTemp: num("returnTemp"),
      roomTemp: num("roomTemp")
    };
  }

  function render() {
    var f = readForm();
    var out = R.sizeRadiator(f);
    var heat = out.heat, rated = out.rated;
    var hasRoom = heat.volume > 0;

    $("btuOut").textContent = hasRoom ? fmt(heat.btu) : "—";
    $("wattOut").textContent = hasRoom ? fmt(heat.watts) : "—";

    // Working: base line then each adjustment.
    var work = $("workList");
    work.innerHTML = "";
    if (hasRoom) {
      addItem(work, "Room volume", heat.volume + " m³");
      addItem(work, "Base for a " + roomName(heat.roomType), heat.base + " W/m³");
      heat.factors.forEach(function (x) {
        addItem(work, x.label, "× " + x.factor);
      });
      addItem(work, "Heat needed", fmt(heat.watts) + " W (" + fmt(heat.btu) + " BTU/hr)");
    }

    var noWater = hasRoom && rated.ratedWatts === null;
    var coolSystem = hasRoom && rated.fraction > 0 && rated.fraction < 0.98;
    var heatPump = hasRoom && rated.multiplier && rated.multiplier >= 2;

    if (!hasRoom) {
      $("buyLine").textContent = "Fill in the room and your heating and I'll size it.";
      setFigs(null, null, null);
      $("dtLine").textContent = "";
    } else if (noWater) {
      $("buyLine").textContent = "The water isn't hotter than the room, so a radiator can't give out heat here. Check your flow and return temperatures.";
      setFigs(null, null, null);
      $("dtLine").textContent = "";
    } else {
      var times = rated.multiplier;
      var extra = times > 1.02
        ? "That's " + times + "× the room's heat, because your water runs cooler than the box assumes."
        : "Your water runs about as hot as the box assumes, so the rated figure matches the room's heat.";
      $("buyLine").textContent = "Buy a radiator rated at least " + fmt(rated.ratedBtu) + " BTU/hr (at ΔT 50). " + extra;
      setFigs(rated.ratedBtu, rated.ratedWatts, times > 1.02 ? times + "×" : "1×");
      $("dtLine").textContent = "Your system: mean water " + rated.meanWater + "°C, room " + rated.roomTemp +
        "°C, so ΔT " + rated.deltaT + "°C — a radiator gives " + Math.round(rated.fraction * 100) +
        "% of its rated output at that ΔT.";
    }

    renderHave(f, heat, hasRoom);

    if (window.Rad) {
      window.Rad.context({ hasRoom: hasRoom, noWater: noWater, coolSystem: coolSystem, heatPump: heatPump });
    }
  }

  // The "already have a radiator" answer: what flow temperature that radiator
  // needs for this room, or whether it's simply undersized.
  function renderHave(f, heat, hasRoom) {
    var block = $("haveBlock");
    var haveBtu = num("haveBtu");
    if (!hasRoom || !(haveBtu > 0)) { block.hidden = true; return; }
    block.hidden = false;

    var split = num("haveSplit");
    var rf = R.requiredFlow({
      neededWatts: heat.watts,
      ratedBtu: haveBtu,
      roomTemp: f.roomTemp,
      split: split > 0 ? split : undefined
    });

    if (rf.cannotMeet) {
      $("haveLine").textContent = "A " + fmt(rf.ratedWatts) + " W radiator is too small for this room even at the hottest bench temperature (ΔT 50). It can't meet the " +
        fmt(heat.watts) + " W the room needs at any flow temperature — you'd need a bigger radiator or a second one.";
    } else if (rf.ok) {
      $("haveLine").textContent = "To get " + fmt(heat.watts) + " W out of this radiator you'd run the water at about " +
        rf.flowTemp + "°C flow / " + rf.returnTemp + "°C return (mean " + rf.meanWater + "°C, ΔT " + rf.deltaT +
        "°C). " + (rf.flowTemp <= 50
          ? "That's within reach for a heat pump."
          : rf.flowTemp <= 60
            ? "A condensing boiler manages that comfortably; a heat pump would have to work harder."
            : "That's a hot flow — fine for an older boiler, too hot for an efficient heat pump, so a bigger radiator would let it run cooler.");
    } else {
      $("haveLine").textContent = "Put in the radiator's rated output to see the flow temperature it needs.";
    }
  }

  function setFigs(btu, watt, mult) {
    $("ratedBtu").textContent = fmt(btu);
    $("ratedWatt").textContent = fmt(watt);
    $("multiplier").textContent = mult || "—";
  }

  function addItem(ul, label, value) {
    var li = document.createElement("li");
    var a = document.createElement("span"); a.className = "wk-label"; a.textContent = label;
    var b = document.createElement("span"); b.className = "wk-val"; b.textContent = value;
    li.appendChild(a); li.appendChild(b); ul.appendChild(li);
  }

  function roomName(t) {
    return { living: "living room", dining: "dining room", bedroom: "bedroom",
      kitchen: "kitchen", bathroom: "bathroom", hall: "hall", office: "home office" }[t] || "room";
  }

  // Picking a heating type fills in the flow and return temperatures. Typing a
  // temperature yourself switches the choice to "Set my own" so nothing fights.
  function applySystem(value) {
    var s = SYSTEMS[value];
    if (s) { $("flowTemp").value = s.flow; $("returnTemp").value = s.return; }
    render();
  }

  function setUnitLabels() {
    var u = radio("unit") === "ft" ? "ft" : "m";
    Array.prototype.forEach.call(document.querySelectorAll("[data-unit]"), function (el) {
      el.textContent = u;
    });
  }

  // Wire up: any change re-renders.
  var form = $("form");
  form.addEventListener("input", function (e) {
    if (e.target && (e.target.id === "flowTemp" || e.target.id === "returnTemp")) {
      var custom = document.querySelector('input[name="system"][value="custom"]');
      if (custom) custom.checked = true;
    }
    render();
  });
  form.addEventListener("change", function (e) {
    if (e.target && e.target.name === "unit") setUnitLabels();
    if (e.target && e.target.name === "system" && e.target.value !== "custom") applySystem(e.target.value);
  });

  setUnitLabels();
  render();
})();
