// Rad, the radiator in the corner. Rad gives a tip when tapped and changes face
// to match the job: happy when the size is worked out, thinking when there's
// something to watch (a cool system that needs a much bigger radiator), a
// little worried when the room size is missing or the water isn't hot enough to
// give out heat. The app tells Rad the mood; Rad never changes it on a timer of
// its own. Everything Rad says goes through the bubble's live region so a screen
// reader hears it, and Rad holds still if you've asked for reduced motion.
(function () {
  "use strict";
  var btn = document.getElementById("rad");
  var bubble = document.getElementById("rad-bubble");
  if (!btn) { window.Rad = { react: function () {}, context: function () {}, say: function () {} }; return; }

  var still = matchMedia("(prefers-reduced-motion: reduce)");
  var tipKey = "start";
  var bubbleTimer = null, taps = [];

  var TIPS = {
    start: [
      "Hi, I'm Rad. Put in your room size and I'll work out the heat it needs and the radiator to buy for it.",
      "Radiators are sold in BTU per hour. I give you watts too, and turn one into the other.",
      "The number on a radiator box is measured with hot water and a cool room. If your heating runs cooler, you need a bigger one. I'll show you by how much."
    ],
    ready: [
      "That's the heat your room needs. Mark each radiator against this figure when you shop.",
      "A radiator a little over this is fine, it just warms the room a touch faster. Well under and it'll struggle on a cold day.",
      "This is a sizing guide. If you want it exact, a heat-loss survey measures every wall and window."
    ],
    coolsystem: [
      "Your system runs cooler than the test bench, so a radiator gives out less than its box says. I've bumped the size you need up to match.",
      "Buy the rated figure I show, not the room's heat figure, or the radiator will come up short on a cold day."
    ],
    heatpump: [
      "On a heat pump the water is much cooler, so you often need a radiator about twice the rated size. That's normal, not a mistake.",
      "Heat pumps like big radiators and low, steady flow. The bigger rated size I show is what makes the room warm."
    ],
    nowater: [
      "The water isn't hotter than the room, so the radiator can't give out heat. Check your flow and return temperatures.",
      "Flow and return are the water going out to the radiators and coming back. Both need to be above room temperature."
    ],
    needroom: [
      "Pop in the room's length, width and height and I'll size it.",
      "I need the room size first. Measure the floor and the ceiling height."
    ]
  };

  function pick(key) {
    var list = TIPS[key] || TIPS.start;
    return list[Math.floor(Math.random() * list.length)];
  }

  var FACES = {
    happy: "M 25 40 Q 32 46 39 40",
    think: "M 25 42 Q 32 39 39 42",
    worry: "M 25 43 Q 32 38 39 43"
  };

  function setMood(m) {
    var mouth = document.getElementById("rad-mouth");
    if (mouth) mouth.setAttribute("d", FACES[m] || FACES.happy);
    btn.classList.toggle("is-worry", m === "worry");
    btn.classList.toggle("is-warm", m === "happy");
  }

  function say(text) {
    if (!bubble) return;
    bubble.textContent = text;
    bubble.classList.add("show");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubble.classList.remove("show"); }, 7000);
  }

  // The app calls this with the latest result so Rad's face and tip match what's
  // on screen.
  function context(info) {
    info = info || {};
    if (!info.hasRoom) { tipKey = "needroom"; setMood("happy"); return; }
    if (info.noWater) { tipKey = "nowater"; setMood("worry"); return; }
    if (info.heatPump) { tipKey = "heatpump"; setMood("think"); return; }
    if (info.coolSystem) { tipKey = "coolsystem"; setMood("think"); return; }
    tipKey = "ready";
    setMood("happy");
  }

  function react() {
    say(pick(tipKey));
    taps.push(Date.now());
    taps = taps.filter(function (t) { return Date.now() - t < 1500; });
    if (taps.length >= 5 && !still.matches) {
      btn.classList.add("glow");
      setTimeout(function () { btn.classList.remove("glow"); }, 800);
      taps = [];
    }
  }

  btn.addEventListener("click", react);
  btn.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); react(); }
  });

  setMood("happy");
  window.Rad = { react: react, context: context, say: say };
})();
