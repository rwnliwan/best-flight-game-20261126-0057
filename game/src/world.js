// TIRTA API — the valley: a seeded heightfield grid, the lake, the runway
// corridor, the forest mask and the three fire fronts. The renderer and the
// flight model both read this one world, so what you see is what you hit.

import { CONFIG } from './config.js';
import { fbm, hash2, clamp, smoothstep } from './random.js';

const N = CONFIG.gridCells;
const CELL = CONFIG.worldSize / N; // 8 m
const HALF = CONFIG.worldHalf;

function gridIndex(gx, gz) {
  return gz * N + gx;
}

// Raw terrain height before the lake and runway are carved in.
function baseHeight(x, z) {
  const rolling = fbm(x * 0.0006 + 11.7, z * 0.0006 + 3.1, 4);
  let h = (rolling - 0.5) * 2 * 42;
  // Mountain walls: a high ridge to the north and another to the west.
  const northRidge = smoothstep(1150, 1900, z);
  const westRidge = smoothstep(-1050, -1850, x);
  const ridgeNoise = fbm(x * 0.0012 + 5.5, z * 0.0012 + 9.2, 3);
  const ridgeMask = Math.max(northRidge, westRidge);
  h += ridgeMask * (58 + ridgeNoise * 118);
  // Gentle rise toward the south-east so the horizon is never flat.
  h += smoothstep(900, 2048, x) * 14 + smoothstep(1200, 2048, -z) * 10;
  return h;
}

function inLakeEllipse(x, z) {
  const dx = (x - CONFIG.lake.x) / CONFIG.lake.rx;
  const dz = (z - CONFIG.lake.z) / CONFIG.lake.rz;
  return dx * dx + dz * dz;
}

function nearRunway(x, z) {
  const r = CONFIG.runway;
  if (z < r.zMin - 60 || z > r.zMax + 60) return 0;
  const edge = smoothstep(r.corridor, r.corridor - 26, Math.abs(x - r.x));
  const endFade = smoothstep(60, 0, Math.max(r.zMin - z, z - r.zMax, 0));
  return edge * endFade;
}

export class World {
  constructor(seed) {
    this.seed = seed;
    this.height = new Float32Array(N * N);
    this.forest = new Uint8Array(N * N);
    this.buildGrid();
    this.fires = this.placeFires();
  }

  buildGrid() {
    for (let gz = 0; gz < N; gz++) {
      const z = gz * CELL - HALF;
      for (let gx = 0; gx < N; gx++) {
        const x = gx * CELL - HALF;
        let h = baseHeight(x, z);
        // Carve the lake bowl.
        const lakeD = inLakeEllipse(x, z);
        if (lakeD < 1.35) {
          const blend = smoothstep(1.35, 0.85, lakeD);
          h = h * (1 - blend) + -7 * blend;
        }
        // Flatten the runway corridor to the runway elevation.
        const rw = nearRunway(x, z);
        if (rw > 0) h = h * (1 - rw) + CONFIG.runwayElevation * rw;
        this.height[gridIndex(gx, gz)] = h;
        // Forest where the moisture noise says so, on gentle land only.
        const moist = fbm(x * 0.001 + 7.3, z * 0.001 + 2.9, 3);
        const isForest = moist > 0.575 && h > 3.5 && h < 72 && lakeD > 1.05 && rw < 0.4;
        this.forest[gridIndex(gx, gz)] = isForest ? 1 : 0;
      }
    }
  }

  // Bilinear sample of the height grid; outside the map, rise into mountains.
  terrainHeight(x, z) {
    const fx = (x + HALF) / CELL - 0.5;
    const fz = (z + HALF) / CELL - 0.5;
    const gx = Math.floor(fx);
    const gz = Math.floor(fz);
    if (gx < 0 || gz < 0 || gx >= N - 1 || gz >= N - 1) {
      const edge = Math.max(Math.abs(x), Math.abs(z)) - HALF;
      return 120 + Math.max(0, edge) * 0.35;
    }
    const tx = fx - gx;
    const tz = fz - gz;
    const i = gridIndex(gx, gz);
    const h00 = this.height[i];
    const h10 = this.height[i + 1];
    const h01 = this.height[i + N];
    const h11 = this.height[i + N + 1];
    return h00 + (h10 - h00) * tx + (h01 - h00) * tz + (h00 - h10 - h01 + h11) * tx * tz;
  }

  isForestAt(x, z) {
    const gx = Math.floor((x + HALF) / CELL);
    const gz = Math.floor((z + HALF) / CELL);
    if (gx < 0 || gz < 0 || gx >= N || gz >= N) return false;
    return this.forest[gridIndex(gx, gz)] === 1;
  }

  // Deterministic per-cell tree coin flip, so trees never shimmer between frames.
  treeAt(x, z) {
    const gx = Math.floor((x + HALF) / CELL);
    const gz = Math.floor((z + HALF) / CELL);
    return hash2(gx * 3 + 17, gz * 5 + 29);
  }

  inLake(x, z) {
    return inLakeEllipse(x, z) < 1;
  }

  onRunway(x, z) {
    const r = CONFIG.runway;
    return Math.abs(x - r.x) <= r.halfWidth && z >= r.zMin && z <= r.zMax;
  }

  nearRunwayStrip(x, z) {
    const r = CONFIG.runway;
    return Math.abs(x - r.x) <= r.halfWidth + 4 && z >= r.zMin - 4 && z <= r.zMax + 4;
  }

  // Find a forested cell near a suggested spot (spiral search, deterministic).
  findFireSpot(sx, sz) {
    for (let radius = 0; radius <= 320; radius += 16) {
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2 + radius * 0.37;
        const x = sx + Math.cos(ang) * radius;
        const z = sz + Math.sin(ang) * radius;
        if (this.isForestAt(x, z)) return { x, z };
      }
    }
    return { x: sx, z: sz };
  }

  placeFires() {
    const spots = [
      this.findFireSpot(-980, 880),
      this.findFireSpot(760, 1560),
      this.findFireSpot(320, 1180),
    ];
    return spots.map((s, i) => ({
      id: i + 1,
      x: s.x,
      z: s.z,
      ground: this.terrainHeight(s.x, s.z),
      radius: CONFIG.fireRadius,
      intensity: 1.0,
      alive: true,
      phase: i * 2.1, // flame flicker offset
    }));
  }

  firesAlive() {
    return this.fires.filter((f) => f.alive).length;
  }

  // A point on the ground, coloured for the voxel renderer.
  groundColor(x, z, h) {
    if (this.nearRunwayStrip(x, z) && Math.abs(h - CONFIG.runwayElevation) < 2.5) {
      return this.runwayColor(x, z);
    }
    if (h <= CONFIG.waterLevel + 0.4) return this.waterColor(x, z);
    const n = hash2(Math.floor(x / 8), Math.floor(z / 8));
    if (h > 165) return '#e9eff3'; // snow caps
    if (h > 95) return n > 0.5 ? '#7d7468' : '#6e6558'; // bare rock
    if (this.isForestAt(x, z)) return n > 0.6 ? '#2c5426' : '#33592b'; // forest floor
    if (h < 3.5) return n > 0.5 ? '#a89468' : '#9c8a5e'; // lake shore sand
    if (n > 0.72) return '#7d8f43'; // dry grass patches
    return n > 0.4 ? '#5d8a3c' : '#527f36'; // meadow
  }

  runwayColor(x, z) {
    const r = CONFIG.runway;
    const centre = Math.abs(x - r.x) < 1.6;
    const dash = Math.floor(z / 26) % 2 === 0;
    if (centre && dash) return '#dfe3e6'; // centreline dashes
    // Threshold bars near each end.
    if ((z - r.zMin < 26 || r.zMax - z < 26) && Math.abs(x - r.x) > 4 && Math.abs(x - r.x) < 12) {
      return '#dfe3e6';
    }
    const n = hash2(Math.floor(x / 4), Math.floor(z / 4));
    return n > 0.5 ? '#3a3d43' : '#34373d'; // asphalt
  }

  waterColor(x, z) {
    const shimmer = Math.sin(x * 0.05 + z * 0.043) * 0.5 + 0.5;
    const n = hash2(Math.floor(x / 16), Math.floor(z / 16));
    if (shimmer > 0.93 && n > 0.4) return '#7fb2dd'; // sun glints
    return shimmer > 0.55 ? '#2f6fb2' : '#2a64a5';
  }

  // Scorch darkening inside a live fire's ring.
  scorchAt(x, z) {
    for (const f of this.fires) {
      if (!f.alive) continue;
      const dx = x - f.x;
      const dz = z - f.z;
      if (dx * dx + dz * dz < f.radius * f.radius) return true;
    }
    return false;
  }
}
