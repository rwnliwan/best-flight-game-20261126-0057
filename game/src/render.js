// TIRTA API — the view: a voxel-space chase camera over the valley, the
// air tanker drawn in the frame, fires, smoke and spray as projected sprites.
// No images anywhere: sky, terrain, trees, runway and aircraft are all code.

import { CONFIG } from './config.js';
import { clamp } from './random.js';

const W = CONFIG.canvasWidth;
const H = CONFIG.canvasHeight;
const FOCAL = (H / 2) / Math.tan((25 * Math.PI) / 180); // vertical fov ~50 deg
const FOV_H = 1.38; // ~79 deg horizontal
const COLS = CONFIG.columns;
const COL_W = W / COLS;

// Project a world point into screen space. Returns null when behind the camera.
export function projectPoint(cam, x, y, z) {
  const dx = x - cam.x;
  const dz = z - cam.z;
  const forward = dx * Math.sin(cam.heading) + dz * Math.cos(cam.heading);
  if (forward < 4) return null;
  const right = dx * Math.cos(cam.heading) - dz * Math.sin(cam.heading);
  const sx = W / 2 + (right / forward) * FOCAL;
  const sy = cam.horizonY - ((y - cam.y) / forward) * FOCAL;
  return { sx, sy, dist: forward };
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Ten clouds pinned to world bearings, so they stay put as you turn.
const CLOUDS = [];
for (let i = 0; i < 10; i++) {
  CLOUDS.push({
    bearing: (i / 10) * Math.PI * 2 + 0.31 * i,
    height: 90 + ((i * 53) % 130),
    size: 120 + ((i * 97) % 160),
    speed: 0.004 + (i % 3) * 0.002,
  });
}

function drawSky(ctx, cam, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#2f6cb8');
  sky.addColorStop(0.42, '#7fb2dd');
  sky.addColorStop(0.55, '#cfe4f2');
  sky.addColorStop(1, '#e8ddc0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Sun, fixed to a world bearing so it swings with the heading.
  const sunDiff = angleDiff(0.9, cam.heading);
  if (Math.abs(sunDiff) < FOV_H) {
    const sx = W / 2 + (sunDiff / (FOV_H / 2)) * (W / 2);
    const sy = cam.horizonY - 170;
    const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 120);
    glow.addColorStop(0, 'rgba(255,244,200,0.95)');
    glow.addColorStop(0.25, 'rgba(255,224,150,0.55)');
    glow.addColorStop(1, 'rgba(255,224,150,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - 120, sy - 120, 240, 240);
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(sx, sy, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  // Clouds drift slowly with the wind.
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  for (const c of CLOUDS) {
    const bearing = c.bearing + time * c.speed;
    const diff = angleDiff(bearing, cam.heading);
    if (Math.abs(diff) > FOV_H * 0.75) continue;
    const cx = W / 2 + (diff / (FOV_H / 2)) * (W / 2);
    const cy = cam.horizonY - c.height - 60;
    const s = c.size * 0.55;
    ctx.beginPath();
    ctx.ellipse(cx, cy, s, s * 0.32, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - s * 0.5, cy + s * 0.08, s * 0.6, s * 0.22, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + s * 0.55, cy + s * 0.06, s * 0.55, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The voxel pass: one ray per column, near to far, painting the ground in
// coalesced colour runs. Trees ride on the forest cells they belong to.
function drawTerrain(ctx, world, cam) {
  const horizonY = cam.horizonY;
  const sinH = Math.sin(cam.heading);
  const cosH = Math.cos(cam.heading);
  for (let col = 0; col < COLS; col++) {
    const ang = cam.heading + (col / COLS - 0.5) * FOV_H;
    const dx = Math.sin(ang);
    const dz = Math.cos(ang);
    const x0 = col * COL_W;
    // floorY: the lowest screen point painted so far in this column. A sample
    // only paints the strip between its own height and floorY, so the near
    // ground never overwrites the far mountains rising above it.
    let floorY = H;
    let runColor = null;
    let runTop = H;
    let runBottom = H;
    const flush = () => {
      if (runColor !== null && runTop < runBottom) {
        ctx.fillStyle = runColor;
        ctx.fillRect(x0, runTop, COL_W + 0.6, runBottom - runTop);
      }
      runColor = null;
    };
    let d = 14;
    while (d < CONFIG.viewDistance) {
      const x = cam.x + dx * d;
      const z = cam.z + dz * d;
      const h = world.terrainHeight(x, z);
      // Points below the camera sit below the horizon; points above it rise.
      const y = horizonY + ((cam.y - h) / d) * FOCAL;
      if (y < floorY) {
        let color;
        if (h <= CONFIG.waterLevel + 0.4) {
          color = world.waterColor(x, z);
        } else if (world.scorchAt(x, z)) {
          color = (Math.floor(x / 8) + Math.floor(z / 8)) % 3 === 0 ? '#7a3d16' : '#33261a';
        } else {
          color = world.groundColor(x, z, h);
        }
        if (color !== runColor) {
          flush();
          runColor = color;
          runTop = y;
          runBottom = floorY;
        } else {
          runTop = y;
        }
        // A pine on this forest cell, close enough to read.
        if (d < 300 && world.isForestAt(x, z)) {
          const t = world.treeAt(x, z);
          if (t > 0.08 && t < 0.52) {
            const treePx = (9 + t * 8) * (FOCAL / d);
            const cx = x0 + COL_W / 2;
            ctx.fillStyle = t > 0.3 ? '#1e4a1c' : '#275a22';
            ctx.beginPath();
            ctx.moveTo(cx, y - treePx);
            ctx.lineTo(cx - treePx * 0.32, y);
            ctx.lineTo(cx + treePx * 0.32, y);
            ctx.closePath();
            ctx.fill();
          }
        }
        floorY = y;
      }
      d += 1.1 + d * 0.02;
    }
    flush();
  }
}

function drawFires(ctx, world, cam, time) {
  for (const f of world.fires) {
    if (!f.alive) continue;
    const p = projectPoint(cam, f.x, f.ground, f.z);
    if (!p || p.dist > 900) continue;
    const s = FOCAL / p.dist;
    const flick = 0.85 + 0.15 * Math.sin(time * 9 + f.phase);
    const r = f.radius * s * f.intensity;
    // Ground glow.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(p.sx, p.sy, 2, p.sx, p.sy, r * 1.6);
    glow.addColorStop(0, `rgba(255,140,30,${0.5 * f.intensity})`);
    glow.addColorStop(1, 'rgba(255,80,10,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Three flame tongues.
    for (let i = 0; i < 3; i++) {
      const fx = p.sx + (i - 1) * r * 0.42;
      const fh = (26 + 12 * Math.sin(time * 11 + f.phase + i * 2.4)) * s * f.intensity * flick;
      const fw = r * 0.34;
      const grad = ctx.createLinearGradient(fx, p.sy, fx, p.sy - fh);
      grad.addColorStop(0, '#ff7a00');
      grad.addColorStop(0.6, '#ffb020');
      grad.addColorStop(1, '#ffe98a');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(fx - fw, p.sy);
      ctx.quadraticCurveTo(fx - fw * 0.7, p.sy - fh * 0.7, fx, p.sy - fh);
      ctx.quadraticCurveTo(fx + fw * 0.7, p.sy - fh * 0.7, fx + fw, p.sy);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawParticles(ctx, cam, particles) {
  for (const p of particles) {
    const pt = projectPoint(cam, p.x, p.y, p.z);
    if (!pt || pt.dist > 900) continue;
    const s = FOCAL / pt.dist;
    if (p.type === 'smoke') {
      const r = p.size * s * (1 + (1 - p.life) * 2.2);
      ctx.fillStyle = `rgba(70,70,72,${0.34 * p.life})`;
      ctx.beginPath();
      ctx.arc(pt.sx, pt.sy, Math.max(2, r), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'splash') {
      const r = p.size * s * (1 + (1 - p.life) * 3);
      ctx.strokeStyle = `rgba(200,230,255,${0.8 * p.life})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pt.sx, pt.sy, Math.max(2, r), 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.type === 'spray') {
      ctx.fillStyle = `rgba(235,245,255,${0.75 * p.life})`;
      ctx.fillRect(pt.sx - 1.5, pt.sy - 1.5, 3, 3);
    } else if (p.type === 'drop') {
      ctx.strokeStyle = `rgba(120,190,255,${0.85 * p.life})`;
      ctx.lineWidth = Math.max(1, 2.4 * s * 0.12);
      ctx.beginPath();
      ctx.moveTo(pt.sx, pt.sy - 14 * s * 0.1);
      ctx.lineTo(pt.sx, pt.sy + 6 * s * 0.1);
      ctx.stroke();
    }
  }
}

// The tanker, rear chase view: white fuselage, red cheatline, twin props.
function drawPlane(ctx, plane, time, dropping) {
  const cx = W / 2;
  const bob = Math.sin(time * 2.3) * 2 + Math.sin(time * 5.1) * 1;
  const cy = H * 0.6 + bob;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((plane.bank * Math.PI) / 180);
  ctx.scale(1, 1 - plane.pitch * 0.004);

  // Main wing.
  ctx.fillStyle = '#e8e4da';
  ctx.beginPath();
  ctx.moveTo(-190, 6);
  ctx.quadraticCurveTo(-120, -16, -58, -8);
  ctx.lineTo(58, -8);
  ctx.quadraticCurveTo(120, -16, 190, 6);
  ctx.quadraticCurveTo(120, 16, 58, 12);
  ctx.lineTo(-58, 12);
  ctx.quadraticCurveTo(-120, 16, -190, 6);
  ctx.closePath();
  ctx.fill();
  // Red wingtips.
  ctx.fillStyle = '#c22e1f';
  ctx.beginPath();
  ctx.moveTo(-190, 6);
  ctx.quadraticCurveTo(-168, -8, -150, -6);
  ctx.lineTo(-150, 10);
  ctx.quadraticCurveTo(-168, 14, -190, 6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(190, 6);
  ctx.quadraticCurveTo(168, -8, 150, -6);
  ctx.lineTo(150, 10);
  ctx.quadraticCurveTo(168, 14, 190, 6);
  ctx.closePath();
  ctx.fill();

  // Fuselage (rear view, tapering toward the tail we look at).
  const body = ctx.createLinearGradient(-34, 0, 34, 0);
  body.addColorStop(0, '#cfd6da');
  body.addColorStop(0.5, '#f4f2ec');
  body.addColorStop(1, '#c3cbcf');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-30, -58);
  ctx.quadraticCurveTo(0, -72, 30, -58);
  ctx.lineTo(36, 34);
  ctx.quadraticCurveTo(0, 52, -36, 34);
  ctx.closePath();
  ctx.fill();
  // Red cheatline down the spine.
  ctx.fillStyle = '#c22e1f';
  ctx.fillRect(-5, -66, 10, 108);
  // Belly tank with drop doors.
  ctx.fillStyle = '#8a2a1c';
  ctx.beginPath();
  ctx.ellipse(0, 40, 26, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dropping ? '#7fc4ee' : '#5d1d12';
  ctx.fillRect(-16, 36, 32, 7);

  // Tail fin.
  ctx.fillStyle = '#c22e1f';
  ctx.beginPath();
  ctx.moveTo(-14, -58);
  ctx.lineTo(0, -108);
  ctx.lineTo(14, -58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f4f2ec';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TIRTA', 0, -72);
  // Horizontal stabiliser.
  ctx.fillStyle = '#ded9cc';
  ctx.beginPath();
  ctx.moveTo(-72, -42);
  ctx.lineTo(72, -42);
  ctx.lineTo(58, -28);
  ctx.lineTo(-58, -28);
  ctx.closePath();
  ctx.fill();

  // Twin prop discs, spinning.
  for (const side of [-1, 1]) {
    const px = side * 96;
    ctx.fillStyle = 'rgba(40,44,48,0.28)';
    ctx.beginPath();
    ctx.ellipse(px, 2, 26, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,32,34,0.75)';
    ctx.lineWidth = 3;
    const a = time * 22 + (side > 0 ? 1.2 : 0);
    ctx.beginPath();
    ctx.moveTo(px - Math.cos(a) * 26, 2 - Math.sin(a) * 28);
    ctx.lineTo(px + Math.cos(a) * 26, 2 + Math.sin(a) * 28);
    ctx.moveTo(px - Math.cos(a + 1.57) * 26, 2 - Math.sin(a + 1.57) * 28);
    ctx.lineTo(px + Math.cos(a + 1.57) * 26, 2 + Math.sin(a + 1.57) * 28);
    ctx.stroke();
    ctx.fillStyle = '#2c2f33';
    ctx.beginPath();
    ctx.arc(px, 2, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Navigation lights: red port, green starboard, white tail.
  ctx.fillStyle = '#ff2a1a';
  ctx.beginPath();
  ctx.arc(-190, 6, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2aff5a';
  ctx.beginPath();
  ctx.arc(190, 6, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, -108, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Where a drop released now will land: the droplets keep the plane's forward
// speed and fall from the belly, so the impact point is ahead by the fall
// time, not by a fixed distance. The reticle and the physics agree on it.
function dropImpactPoint(world, plane) {
  const groundHere = world.inLake(plane.x, plane.z)
    ? CONFIG.waterLevel
    : world.terrainHeight(plane.x, plane.z);
  const agl = Math.max(1, plane.y - groundHere);
  const fallTime = (-16 + Math.sqrt(256 + 24 * agl)) / 12;
  const dist = plane.speed * 0.92 * fallTime;
  const ix = plane.x + Math.sin(plane.heading) * dist;
  const iz = plane.z + Math.cos(plane.heading) * dist;
  return { x: ix, z: iz, y: world.terrainHeight(ix, iz) };
}

function drawDropReticle(ctx, cam, world, plane, water) {
  if (water <= 0) return;
  const impact = dropImpactPoint(world, plane);
  const ay = impact.y;
  const p = projectPoint(cam, impact.x, ay + 2, impact.z);
  if (!p || p.dist > 700) return;
  const r = 26 * (FOCAL / p.dist) * 0.12 + 8;
  let overFire = false;
  for (const f of world.fires) {
    if (!f.alive) continue;
    const dx = impact.x - f.x;
    const dz = impact.z - f.z;
    if (dx * dx + dz * dz < f.radius * f.radius) overFire = true;
  }
  ctx.strokeStyle = overFire ? '#ffb020' : 'rgba(210,235,255,0.8)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.arc(p.sx, p.sy, Math.max(8, r), 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(p.sx - 8, p.sy);
  ctx.lineTo(p.sx + 8, p.sy);
  ctx.moveTo(p.sx, p.sy - 8);
  ctx.lineTo(p.sx, p.sy + 8);
  ctx.stroke();
  if (overFire) {
    ctx.fillStyle = '#ffb020';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DROP', p.sx, p.sy - Math.max(14, r) - 6);
  }
}

// One full frame: sky, voxel ground, fires, particles, reticle, aircraft.
export function renderFrame(ctx, game) {
  const plane = game.plane;
  const cam = {
    x: plane.x - Math.sin(plane.heading) * CONFIG.cameraBack,
    z: plane.z - Math.cos(plane.heading) * CONFIG.cameraBack,
    y: plane.y + CONFIG.cameraUp,
    heading: plane.heading,
    horizonY:
      H * CONFIG.horizonBase +
      plane.pitch * 5 +
      Math.sin(game.time * 1.7) * 1.5,
  };
  ctx.save();
  // The world rolls gently with the bank; the HUD never does.
  ctx.translate(W / 2, H / 2);
  ctx.rotate((-plane.bank * Math.PI) / 180 * 0.28);
  ctx.translate(-W / 2, -H / 2);
  drawSky(ctx, cam, game.time);
  drawTerrain(ctx, game.world, cam);
  drawFires(ctx, game.world, cam, game.time);
  drawParticles(ctx, cam, game.particles);
  drawDropReticle(ctx, cam, game.world, plane, plane.water);
  ctx.restore();
  drawPlane(ctx, plane, game.time, game.dropping);
  return cam;
}

export { W as VIEW_W, H as VIEW_H, FOCAL, clamp };
