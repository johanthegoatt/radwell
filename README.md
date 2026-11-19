# Radwell

**What size radiator does my room need?** Put in your room and your heating, and Radwell works out two things:

1. **The heat the room needs** — in watts and in BTU per hour (how UK radiators are sold).
2. **The radiator you actually have to buy** — once your boiler or heat pump runs the water cooler than the test bench the radiator was rated on.

Runs entirely in your browser. Nothing you type leaves the page.

## The part most calculators skip

The BTU number on a radiator box is measured on a test bench with the water averaging 70 °C in a 20 °C room — a difference of 50 °C, written **ΔT 50** (the EN 442 standard). A modern condensing boiler, and especially a heat pump, runs the water much cooler, so the real temperature difference is smaller and the same radiator gives out **far less** heat.

Output falls with ΔT by a power of about **1.3** for a normal panel radiator (the radiator exponent *n* in EN 442):

```
output = rated × (ΔT_actual / 50) ^ 1.3
```

So Radwell takes the heat your room needs, looks at the flow and return temperatures your system runs at, and tells you the **ΔT 50 rated** radiator to buy so it actually delivers that heat. On a heat pump that is often roughly double the rated size — which is why swapping a boiler for a heat pump usually means bigger radiators.

## How the room heat is worked out

Start from the room's volume (length × width × height) and a watts-per-cubic-metre figure for the kind of room (a lounge is kept warmer than a bedroom). Then adjust for how fast the room loses heat: insulation, how many walls face outside, the windows, which way it faces, and whether there's an unheated space above or below. These are the usual consumer-calculator adjustments.

It's a guide to get you to the right size. For an exact figure, a heat-loss survey (the method in **BS EN 12831**) measures each wall and window.

## Meet Rad

Rad the radiator sits in the corner, gives a tip when tapped, and changes face to match the job — happy when the size is sorted, thinking when a cool system needs a much bigger radiator, worried when the water isn't hot enough to give out heat. Rad holds still if you've asked for reduced motion, and everything Rad says is announced to screen readers.

## Run it

Open `index.html` in a browser, or serve the folder. No build step.

## Tests

```
npm test
```

Pure engine in `src/core.js`, no DOM, so the same file runs in the page and under `node --test`.

## Sources

- EN 442 radiator output standard and the ΔT output correction (radiator exponent *n* ≈ 1.3).
- BS EN 12831 — the heat-loss method for an exact room figure.
- Typical flow/return running points: older boiler ~70/50 °C, modern condensing ~55/45 °C, heat pump ~45/40 °C.

## Licence

MIT.
