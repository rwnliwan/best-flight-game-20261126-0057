# TIRTA API — Wildfire Air Tanker

[![make.fun bounty](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![make.fun rank](https://make.fun/badge/best-flight-game-20261126-0057/rwnliwan/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![make.fun reward](https://make.fun/badge/best-flight-game-20261126-0057/rwnliwan/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A flight game for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057):
three forest fires are burning in a mountain valley, and you are the air
tanker. Take off from the strip, skim the lake low and slow to fill the belly
tank, drop the water on the flames with the help of a ballistic drop reticle,
then bring her home and land — before the fuel runs out or the fires spread.

## How to play

Open `game/index.html` in desktop Chrome (or serve `game/` with any static
server). No network, no build step, no libraries: vanilla JavaScript and
Canvas 2D, with all art drawn in code and all sound synthesised live with
WebAudio.

| Control | Does |
| --- | --- |
| ↑ / W, ↓ / S | Climb / descend |
| ← → / A D | Bank and turn |
| Shift / E, Ctrl / Q | More / less throttle |
| Space | Drop water |
| Mouse hold | Steer toward the pointer |
| A | Autopilot assist (any stick input takes over) |
| P / M / R / Enter | Pause / mute / restart / start |

## The sortie

1. **Take off** — full throttle on the runway, pull up past 30 m/s.
2. **Scoop** — fly 2–9 m over the lake at 25–50 m/s. The tank fills and spray
   flies. Touch the water and you ditch.
3. **Drop** — the amber reticle ahead marks where the water will actually
   land. Open the doors over a fire and watch it shrink.
4. **Land** — all fires out, line up on the runway, gentle descent, roll to a
   stop. Stopped on the strip, fuel refills.

Below 24 m/s the wing stalls and she sinks. An empty tank means a glide —
pick the runway, not the trees. Fires spread while you watch them, so every
sortie is a trade between water, fuel and time.

## What is in this repo

- `game/` — the game: `index.html`, `style.css` and `src/` (one file per job:
  `config`, `random`, `world`, `render`, `hud`, `audio`, `input`, `scenes`,
  `game`).
- `screenshots/` — four real renders of the game in a browser: the cover
  (fire ahead over the lake), takeoff, the lake scoop, and the water drop.
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json` with the kit's `buildDossier`.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `trial-log.md` — design decisions, trials and the bundle/check results.

## The world

One seeded valley (seed `20261126`, so every run sees the same terrain): a
voxel-rendered heightfield with mountain ridges north and west, a lake with a
sandy shore, pine forest, a 860 m runway, and three fire fronts that spread
until you douse them. The renderer, the flight model and the collision checks
all read the same world, so what you see is what you hit.

Original game, art, sound and names — built for this bounty.
