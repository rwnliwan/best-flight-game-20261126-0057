# Trial log — TIRTA API (best-flight-game-20261126-0057)

## Concept (chosen 26 Nov 2026, after reading the field)

Field: 1,125 submissions, 835 unique titles. Saturated: courier/mail delivery
(courier 385, mail 73), island (176), ring-flying (ring 127 + rings 58),
ridge (134), skyline (102). Chosen instead: a **wildfire air tanker** —
scoop water from a lake, drop it on forest fires, land back on the runway.
Only ~3 titles in the field do water-bombing at all (and none as a
scoop–drop–land loop with fuel management), and the target is a fire, not a
ring. Original name, art, sound and world; no commercial game is copied.

Game: `TIRTA API — Wildfire Air Tanker`. Vanilla JS + Canvas 2D, no libraries.
A voxel-space chase camera over one seeded valley (seed 20261126): mountain
ridges, a lake, pine forest, an 860 m runway, three spreading fire fronts.
Loop: takeoff → scoop (2–9 m over the lake at 25–50 m/s) → drop (ballistic
reticle shows where the water will actually land) → land, refuel, repeat.
Stall below 24 m/s, fuel burn, fire spread, wind gusts, hard-landing damage.
HUD: altitude, speed, heading tape, throttle/fuel/water gauges, artificial
horizon, mission line. Sound is synthesised WebAudio (engine, wind, crackle,
drop whoosh, chime) — no audio assets.

## Trials (headless Chromium via CDP, game served on localhost:8123)

1. **Play test, real keys** — menu → Enter starts the mission; 6 s of full
   throttle + climb: speed 45 m/s, AGL 29 m, airborne, fuel 234 L; left turn
   then changed heading (turn rate fixed first — see 3). Zero console errors
   after the favicon fix.
2. **Projection sign bug** — first render showed sky where the ground belonged:
   the voxel formula had the sign inverted (`horizon - (camY-h)/d` instead of
   `horizon + (camY-h)/d`) and the colour-run coalescing flushed zero-height
   runs. Fixed both; terrain, runway and forest then rendered correctly.
3. **Turn rate bug** — bank in radians fed a per-degree constant made the
   turn ~0.2°/s. Fixed to `bankRad * 0.22 * (speed/45)` ≈ 10°/s at full bank.
4. **Autopilot heading bug** — `applyScene` set `autopilot = true` but never
   set `autoHeading`, so every scene drifted to heading 0 (north): the cover
   missed its fire, the drop flew into the north ridge, the land scene banked
   hard trying to turn south→north. Fixed: scenes set `autoHeading` and a
   per-scene `autoAgl`; autopilot bank gain retuned to `headingErrorDeg * 0.9`.
5. **Fire 3 placement** — first spot (180, 2320) sat at 215 m in the north
   ridge. Moved to (320, 1180), valley floor.
6. **Drop ballistics** — droplets keep forward speed and fall ~2 s, so they
   land ~85 m ahead of release; the fixed 150 m reticle lied. Reticle now
   computes the real impact point; the scene demo drops within 220 m.
7. **Screenshot framing** — cover took four rounds: 150 m AGL hid the fire
   below the frame; 50 m put the glow over the plane's belly; 120 m pushed
   the flames behind the mission bar; 80 m AGL, 380 m out, captured at ~2.5 s
   puts the flames + smoke column ahead of the plane, lake and sun in frame.
   Drop captured mid-drop (water 2,655 L, `dropping: true`); the demo drop
   doused fire 2 outright (fires 3 → 2, score +600) in a later run.
8. **Screenshots** — 4 JPEGs, 1280×720, 80–98 KiB each, all real renders of
   the game's own code via headless Chromium (CDP, `?scene=` presets that
   only choose the starting state and switch on the autopilot assist):
   `1-cover.jpg` (fire ahead over the lake), `2-takeoff.jpg` (runway +
   centreline), `3-lake-scoop.jpg` (skimming at 5 m, tank full 3,000 L),
   `4-fire-drop.jpg` (water falling on fire 2, score 600). A fifth landing
   shot was taken and kept out of the set (4-file cap).

## Bundle / check

(TODO — filled in after the first bundle + check run; this file is revised
with the real numbers, then re-committed, re-bundled and re-checked.)
