// TIRTA API — the instruments: altitude, speed and heading on lit glass,
// fuel and water gauges, an artificial horizon, and the mission line. All
// drawn on the canvas so they are in every screenshot, exactly as flown.

import { CONFIG } from './config.js';
import { clamp } from './random.js';

const W = CONFIG.canvasWidth;
const H = CONFIG.canvasHeight;
const PANEL = 'rgba(6,16,24,0.58)';
const EDGE = 'rgba(120,220,255,0.35)';
const INK = '#d6f2ff';
const AMBER = '#ffc866';
const RED = '#ff5a4a';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PANEL;
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w * clamp(frac, 0, 1), h, 4);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 6, y + h / 2 + 4);
}

function compassLabel(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return dirs[i];
}

export function drawHud(ctx, game) {
  const p = game.plane;
  const headingDeg = (((p.heading * 180) / Math.PI) % 360 + 360) % 360;
  const altFt = Math.round((p.y - game.world.terrainHeight(p.x, p.z)) * 3.28084);
  const altMsl = Math.round(p.y * 3.28084);
  const spdKts = Math.round(p.speed * 1.94384);
  const vsiFpm = Math.round(p.verticalSpeed * 196.85);
  const time = game.time;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Compass tape across the top.
  panel(ctx, W / 2 - 260, 12, 520, 46);
  ctx.save();
  ctx.beginPath();
  ctx.rect(W / 2 - 260, 12, 520, 46);
  ctx.clip();
  for (let off = -180; off <= 180; off += 15) {
    const deg = Math.round((headingDeg + off) / 15) * 15;
    const norm = ((deg % 360) + 360) % 360;
    const sx = W / 2 + off * 1.4;
    const major = norm % 45 === 0;
    ctx.strokeStyle = major ? INK : 'rgba(214,242,255,0.4)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(sx, 20);
    ctx.lineTo(sx, major ? 34 : 28);
    ctx.stroke();
    if (major) {
      ctx.fillStyle = INK;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      const label = norm % 90 === 0 ? compassLabel(norm) : String(norm).padStart(3, '0');
      ctx.fillText(label, sx, 48);
    }
  }
  ctx.restore();
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`HDG ${String(Math.round(headingDeg)).padStart(3, '0')}°`, W / 2, 74);

  // Altitude / speed block, top left.
  panel(ctx, 14, 12, 208, 140);
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('ALTITUDE', 28, 34);
  ctx.font = 'bold 30px "Consolas", "DejaVu Sans Mono", monospace';
  ctx.fillText(`${altFt.toLocaleString()} ft`, 28, 66);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(214,242,255,0.7)';
  ctx.fillText(`MSL ${altMsl.toLocaleString()} ft   VSI ${vsiFpm >= 0 ? '+' : ''}${vsiFpm} fpm`, 28, 88);
  ctx.fillStyle = INK;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('AIRSPEED', 28, 112);
  ctx.font = 'bold 22px "Consolas", "DejaVu Sans Mono", monospace';
  ctx.fillText(`${spdKts} kt`, 28, 138);

  // Throttle / fuel / water block, top right.
  panel(ctx, W - 232, 12, 218, 108);
  bar(ctx, W - 218, 26, 190, 18, p.throttle, '#37c8e8', `THR ${Math.round(p.throttle * 100)}%`);
  bar(ctx, W - 218, 52, 190, 18, p.fuel / CONFIG.fuelCapacity, p.fuel < 50 ? RED : AMBER, `FUEL ${Math.round(p.fuel)} L`);
  bar(ctx, W - 218, 78, 190, 18, p.water / CONFIG.waterCapacity, '#4aa8ff', `WATER ${Math.round(p.water)} L`);
  ctx.fillStyle = 'rgba(214,242,255,0.7)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(p.onGround ? 'ON GROUND' : `AGL ${altFt} ft`, W - 218, 106);

  // Artificial horizon, bottom left.
  const hx = 78;
  const hy = H - 78;
  const hr = 56;
  ctx.save();
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(hx, hy);
  ctx.rotate((-p.bank * Math.PI) / 180);
  ctx.translate(0, p.pitch * 1.6);
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-hr - 4, -hr - 4, hr * 2 + 8, hr + 4);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-hr - 4, 0, hr * 2 + 8, hr + 4);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-hr, 0);
  ctx.lineTo(hr, 0);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(hx - 18, hy);
  ctx.lineTo(hx + 18, hy);
  ctx.moveTo(hx, hy - 6);
  ctx.lineTo(hx, hy + 6);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', hx, hy + hr + 16);

  // Mission line, bottom centre.
  const alive = game.world.firesAlive();
  panel(ctx, W / 2 - 300, H - 56, 600, 40);
  ctx.fillStyle = alive > 0 ? '#ffb020' : '#7dff9a';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  let line;
  if (game.state === 'flying') {
    line = alive > 0
      ? `FIRES BURNING: ${alive}  —  scoop the lake low & slow, drop on the flames`
      : 'ALL FIRES OUT — return to the runway and land her';
  } else if (game.state === 'landed') {
    line = 'MISSION COMPLETE — wheels down, fires out';
  } else {
    line = 'TIRTA API — wildfire air tanker';
  }
  ctx.fillText(line, W / 2, H - 30);

  // Score and clock, bottom right.
  panel(ctx, W - 232, H - 56, 218, 40);
  ctx.fillStyle = INK;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${game.score}`, W - 218, H - 30);
  ctx.textAlign = 'right';
  ctx.fillText(game.elapsedText(), W - 28, H - 30);
  ctx.textAlign = 'left';

  // Warnings, flashing, centre-top under the compass.
  const warnings = [];
  if (game.state === 'flying') {
    if (p.speed < CONFIG.stallSpeed + 2 && !p.onGround) warnings.push('STALL — NOSE DOWN, FULL THROTTLE');
    if (p.fuel < 40) warnings.push('LOW FUEL — RETURN TO BASE');
    if (altFt < 120 && p.verticalSpeed < -6 && !p.onGround) warnings.push('PULL UP — TERRAIN');
    if (game.scooping) warnings.push('SCOOPING — HOLD HER STEADY');
  }
  if (warnings.length && Math.floor(time * 2.4) % 2 === 0) {
    ctx.fillStyle = RED;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(warnings[0], W / 2, 104);
  }

  // Flight-path marker at screen centre.
  ctx.strokeStyle = 'rgba(214,242,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(W / 2, H * 0.44, 10, 0, Math.PI * 2);
  ctx.moveTo(W / 2 - 16, H * 0.44);
  ctx.lineTo(W / 2 - 8, H * 0.44);
  ctx.moveTo(W / 2 + 8, H * 0.44);
  ctx.lineTo(W / 2 + 16, H * 0.44);
  ctx.moveTo(W / 2, H * 0.44 - 16);
  ctx.lineTo(W / 2, H * 0.44 - 8);
  ctx.stroke();

  ctx.restore();
}
