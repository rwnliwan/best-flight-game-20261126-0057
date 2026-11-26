// TIRTA API — the game itself: flight model, missions, states and the main
// loop. The renderer draws what this simulates; the HUD reads what it holds.

import { CONFIG } from './config.js';
import { World } from './world.js';
import { renderFrame } from './render.js';
import { drawHud } from './hud.js';
import { SoundEngine } from './audio.js';
import { Input } from './input.js';
import { applyScene } from './scenes.js';
import { clamp } from './random.js';

const SEED = 20261126;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = new World(SEED);
    this.input = new Input(canvas);
    this.sound = new SoundEngine();
    this.input.onFirstGesture = () => this.sound.ensure();
    this.time = 0;
    this.elapsed = 0;
    this.score = 0;
    this.state = 'menu';
    this.crashReason = '';
    this.particles = [];
    this.dropping = false;
    this.scooping = false;
    this.autopilot = false;
    this.autoHeading = 0;
    this.autoAgl = 120;
    this.demoDrop = false;
    this.smokeTimer = 0;
    this.alarmTimer = 0;
    this.refuelTimer = 0;
    this.best = Number(window.localStorage.getItem('tirta-api-best') || 0);
    this.resetPlane();
    this.wireOverlays();
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  resetPlane() {
    const ground = this.world.terrainHeight(0, -260);
    this.plane = {
      x: 0,
      z: -260,
      y: ground + 1.2,
      heading: 0,
      pitch: 0,
      bank: 0,
      speed: 0,
      verticalSpeed: 0,
      throttle: 0,
      fuel: CONFIG.fuelCapacity,
      water: 0,
      damage: 0,
      onGround: true,
    };
    this.elapsed = 0;
    this.score = 0;
    this.particles.length = 0;
    this.dropping = false;
    this.scooping = false;
    this.demoDrop = false;
    this.autopilot = false;
    for (const f of this.world.fires) {
      f.alive = true;
      f.intensity = 1.0;
    }
  }

  agl() {
    const p = this.plane;
    if (this.world.inLake(p.x, p.z)) return p.y - CONFIG.waterLevel;
    return p.y - this.world.terrainHeight(p.x, p.z);
  }

  elapsedText() {
    const s = Math.floor(this.elapsed);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  nearestFire() {
    const p = this.plane;
    let best = null;
    let bestD = Infinity;
    for (const f of this.world.fires) {
      if (!f.alive) continue;
      const d = Math.hypot(f.x - p.x, f.z - p.z);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best === null ? null : { fire: best, dist: bestD };
  }

  startMission() {
    this.resetPlane();
    this.state = 'flying';
    this.showOnly(null);
    this.sound.ensure();
  }

  crash(reason) {
    if (this.state !== 'flying') return;
    this.state = 'crashed';
    this.crashReason = reason;
    this.sound.alarm();
    document.getElementById('crash-reason').textContent = reason;
    document.getElementById('crash-stats').textContent =
      `Score ${this.score}  •  Fires out ${CONFIG.fireCount - this.world.firesAlive()} of ${CONFIG.fireCount}  •  Time ${this.elapsedText()}`;
    this.showOnly('crash');
  }

  landComplete() {
    if (this.state !== 'flying') return;
    this.state = 'landed';
    const timeBonus = Math.max(0, CONFIG.timeBonusBase - Math.floor(this.elapsed) * CONFIG.timeBonusPerSecond);
    this.score += CONFIG.pointsLanding + timeBonus;
    if (this.score > this.best) {
      this.best = this.score;
      window.localStorage.setItem('tirta-api-best', String(this.best));
    }
    document.getElementById('debrief-stats').innerHTML =
      `Fires doused <b>${CONFIG.fireCount}</b> &times; ${CONFIG.pointsPerFire} pts<br>` +
      `Landing bonus <b>${CONFIG.pointsLanding}</b> pts<br>` +
      `Time bonus <b>${timeBonus}</b> pts &nbsp;(${this.elapsedText()})<br>` +
      `Damage <b>${Math.round(this.plane.damage)}%</b> &nbsp;•&nbsp; Fuel left <b>${Math.round(this.plane.fuel)} L</b><br>` +
      `<span class="big">FINAL SCORE ${this.score}</span><br>Best ${this.best}`;
    this.showOnly('debrief');
    this.sound.chime();
  }

  closeHelp() {
    if (this.state === 'paused') {
      this.state = 'flying';
      this.showOnly(null);
    } else {
      this.showOnly('menu');
    }
  }

  showOnly(id) {
    for (const name of ['menu', 'debrief', 'crash', 'pause', 'help']) {
      const el = document.getElementById(name);
      if (el) el.classList.toggle('hidden', name !== id);
    }
  }

  wireOverlays() {
    const byId = (id) => document.getElementById(id);
    byId('btn-start').addEventListener('click', () => this.startMission());
    byId('btn-help').addEventListener('click', () => this.showOnly('help'));
    byId('btn-help-close').addEventListener('click', () => this.closeHelp());
    byId('btn-again').addEventListener('click', () => this.startMission());
    byId('btn-retry').addEventListener('click', () => this.startMission());
    byId('btn-resume').addEventListener('click', () => {
      if (this.state === 'paused') {
        this.state = 'flying';
        this.showOnly(null);
      }
    });
    byId('btn-menu').addEventListener('click', () => {
      this.resetPlane();
      this.state = 'menu';
      this.showOnly('menu');
    });
    byId('btn-menu-2').addEventListener('click', () => {
      this.resetPlane();
      this.state = 'menu';
      this.showOnly('menu');
    });
    const bestEl = byId('best-score');
    if (bestEl) bestEl.textContent = this.best > 0 ? `Best score: ${this.best}` : '';
  }

  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    this.handleGlobalKeys();
    if (this.state === 'menu') {
      // A slow pan over the parked tanker behind the title screen.
      this.plane.heading += 0.03 * dt;
    } else if (this.state === 'flying') {
      this.update(dt);
    }
    renderFrame(this.ctx, this);
    if (this.state !== 'menu') drawHud(this.ctx, this);
    this.input.endFrame();
    requestAnimationFrame((t) => this.frame(t));
  }

  handleGlobalKeys() {
    const input = this.input;
    if (input.wasPressed('KeyM')) {
      this.sound.setMuted(!this.sound.muted);
    }
    if (input.wasPressed('Enter')) {
      if (this.state === 'menu' || this.state === 'crashed' || this.state === 'landed') {
        this.startMission();
      }
    }
    if (input.wasPressed('KeyR') && this.state !== 'menu') {
      this.startMission();
    }
    if (input.wasPressed('KeyP') && this.state === 'flying') {
      this.state = 'paused';
      this.showOnly('pause');
    } else if (input.wasPressed('KeyP') && this.state === 'paused') {
      this.state = 'flying';
      this.showOnly(null);
    }
    if (input.wasPressed('KeyA') && this.state === 'flying') {
      this.autopilot = !this.autopilot;
      this.autoHeading = this.plane.heading;
      this.autoAgl = Math.max(60, this.agl());
    }
    if (input.wasPressed('KeyH') && this.state === 'flying') {
      this.showOnly('help');
      this.state = 'paused';
    }
  }

  update(dt) {
    const p = this.plane;
    const input = this.input;
    this.elapsed += dt;

    // Any stick input hands control back from the autopilot.
    if (input.steerAxis() !== 0 || input.pitchAxis() !== 0) this.autopilot = false;

    // --- Controls: bank, pitch, throttle targets.
    let bankTarget = 0;
    let pitchTarget = 0;
    if (this.autopilot) {
      const headErrDeg = angleDiff(this.autoHeading, p.heading) * 180 / Math.PI;
      bankTarget = clamp(headErrDeg * 0.9, -30, 30);
      const aglErr = this.autoAgl - this.agl();
      pitchTarget = clamp(aglErr * 0.12, -8, 10);
      const speedTarget = 45;
      p.throttle = clamp(p.throttle + Math.sign(speedTarget - p.speed) * 0.25 * dt, 0, 1);
    } else {
      bankTarget = input.steerAxis() * CONFIG.maxBank;
      pitchTarget = input.pitchAxis() * (input.pitchAxis() > 0 ? CONFIG.maxPitchUp : -CONFIG.maxPitchDown);
      p.throttle = clamp(p.throttle + input.throttleAxis() * CONFIG.throttleRate * dt, 0, 1);
    }
    const bankStep = CONFIG.bankRate * dt;
    p.bank += clamp(bankTarget - p.bank, -bankStep, bankStep);
    const pitchStep = CONFIG.pitchRate * dt;
    p.pitch += clamp(pitchTarget - p.pitch, -pitchStep, pitchStep);

    // --- Fuel: empty tank means a dead engine and a glide.
    if (p.fuel > 0) {
      p.fuel -= (CONFIG.fuelBurnIdle + p.throttle * (CONFIG.fuelBurnFull - CONFIG.fuelBurnIdle)) * dt;
      if (p.fuel < 0) p.fuel = 0;
    }
    const thrust = p.fuel > 0 ? p.throttle : 0;

    // --- Speed: throttle pulls toward a target; climbing bleeds it off.
    // On the ground the target is pure throttle, so she rolls to a stop.
    let speedTarget = CONFIG.minSpeed + thrust * (CONFIG.maxSpeed - CONFIG.minSpeed);
    if (p.onGround) speedTarget = thrust * CONFIG.maxSpeed;
    speedTarget -= Math.max(0, p.pitch) * 0.9;
    if (!p.onGround && p.speed < CONFIG.stallSpeed) speedTarget = Math.min(speedTarget, p.speed + 2);
    const speedRate = p.onGround ? 9 : 5.5;
    p.speed += clamp(speedTarget - p.speed, -speedRate * dt * 1.6, speedRate * dt);
    if (p.speed < 0) p.speed = 0;

    // --- Turn: bank angle turns the nose; faster flight turns harder.
    const turnRate = (p.bank * Math.PI) / 180 * 0.22 * (p.speed / 45);
    p.heading += turnRate * dt;
    const gust = Math.sin(this.time * 0.21) * 0.5 + Math.sin(this.time * 0.077) * 0.5;
    const windSpeed = CONFIG.windBase + CONFIG.windGust * Math.max(0, gust);
    const windDir = 1.2 + Math.sin(this.time * 0.05) * 0.4;
    const windX = Math.sin(windDir) * windSpeed;
    const windZ = Math.cos(windDir) * windSpeed;
    p.x += (Math.sin(p.heading) * p.speed + windX * (p.onGround ? 0 : 1)) * dt;
    p.z += (Math.cos(p.heading) * p.speed + windZ * (p.onGround ? 0 : 1)) * dt;

    // --- Lift, sink and stall.
    if (p.onGround) {
      p.verticalSpeed = 0;
      const wantUp = input.pitchAxis() > 0 || this.autopilot;
      if (p.speed > CONFIG.takeoffSpeed && (wantUp || p.speed > 40)) {
        p.onGround = false;
        p.y = this.world.terrainHeight(p.x, p.z) + 1.5;
        p.verticalSpeed = 2;
      }
    } else {
      const lift = clamp(p.speed / CONFIG.stallSpeed, 0.3, 1);
      const climb = p.speed * Math.sin((p.pitch * Math.PI) / 180) * lift;
      const sink = (1 - lift) * 9 + (thrust === 0 ? 2.5 : 0);
      p.verticalSpeed = climb - sink;
      p.y += p.verticalSpeed * dt;
    }

    // --- Ground and water contact.
    const groundH = this.world.terrainHeight(p.x, p.z);
    const inLake = this.world.inLake(p.x, p.z);
    const surface = inLake ? CONFIG.waterLevel : groundH;
    if (!p.onGround && p.y <= surface + 0.3) {
      if (inLake) {
        if (p.speed > 46) return this.crash('You hit the lake too fast — the floats were never fitted.');
        return this.crash('You ditched in the lake. Scoop low, but never touch.');
      } else if (this.world.onRunway(p.x, p.z)) {
        const aligned = Math.min(Math.abs(angleDiff(p.heading, 0)), Math.abs(angleDiff(p.heading, Math.PI)));
        if (Math.abs(p.verticalSpeed) < 4.5 && Math.abs(p.bank) < 20 && aligned < 0.45 && p.speed < 62) {
          this.touchdown();
        } else {
          return this.crash('Hard landing on the runway — gear, wing, then silence.');
        }
      } else {
        return this.crash('Terrain strike — the valley does not forgive a low pass.');
      }
    }
    if (p.onGround) p.y = groundH + 1.2;

    // --- Refuel on the runway while stopped.
    if (p.onGround && p.speed < 5 && this.world.onRunway(p.x, p.z)) {
      this.refuelTimer += dt;
      if (this.refuelTimer > 2 && p.fuel < CONFIG.fuelCapacity) {
        p.fuel = Math.min(CONFIG.fuelCapacity, p.fuel + 45 * dt);
      }
    } else {
      this.refuelTimer = 0;
    }

    // --- Scooping: low and steady over the lake.
    this.scooping = false;
    if (!p.onGround && inLake && p.y >= CONFIG.waterLevel + 1.5 && p.y <= CONFIG.waterLevel + CONFIG.scoopMaxAgl &&
        p.speed >= CONFIG.scoopMinSpeed && p.speed <= CONFIG.scoopMaxSpeed) {
      this.scooping = true;
      if (p.water < CONFIG.waterCapacity) {
        p.water = Math.min(CONFIG.waterCapacity, p.water + CONFIG.scoopRate * dt);
        p.speed = Math.max(CONFIG.scoopMinSpeed, p.speed - 1.5 * dt);
        this.spawnSpray();
      }
    }

    // --- Dropping: Space, or the scene demo over a fire.
    let wantDrop = input.down('Space') && p.water > 0 && !p.onGround;
    if (this.demoDrop && p.water > 0 && !p.onGround) {
      const near = this.nearestFire();
      if (near && near.dist < 220) wantDrop = true;
    }
    if (wantDrop && !this.dropping) this.sound.whoosh();
    this.dropping = wantDrop;
    if (this.dropping) {
      p.water = Math.max(0, p.water - CONFIG.dropRate * dt);
      this.spawnDrops(dt);
    }

    // --- Fires spread while you watch them.
    for (const f of this.world.fires) {
      if (!f.alive) continue;
      f.intensity = Math.min(CONFIG.fireMaxIntensity, f.intensity + CONFIG.fireSpread * dt);
    }
    this.smokeTimer -= dt;
    if (this.smokeTimer <= 0) {
      this.smokeTimer = 0.14;
      for (const f of this.world.fires) {
        if (!f.alive || this.particles.length > 420) continue;
        this.particles.push({
          type: 'smoke',
          x: f.x + (Math.random() - 0.5) * 30,
          y: f.ground + 10 + Math.random() * 14,
          z: f.z + (Math.random() - 0.5) * 30,
          life: 1,
          size: 4 + Math.random() * 4,
        });
      }
    }

    // --- Particles.
    this.updateParticles(dt);

    // --- Damage from a very hard touchdown is counted at touchdown; here
    // the mission ends when the wheels stop on the runway, fires out.
    if (p.onGround && p.speed < 8 && this.world.firesAlive() === 0 && this.world.onRunway(p.x, p.z)) {
      this.landComplete();
    }

    // --- Sound and alarms.
    const near = this.nearestFire();
    this.sound.update(thrust, p.speed, p.onGround, dt, near ? near.dist : null, near ? near.fire.intensity : 0);
    this.alarmTimer -= dt;
    if (this.alarmTimer <= 0) {
      if ((!p.onGround && p.speed < CONFIG.stallSpeed + 2) || p.fuel < 40) {
        this.sound.alarm();
        this.alarmTimer = 1.1;
      }
    }

    // Keep the plane inside the valley; the ridges turn you back.
    if (Math.abs(p.x) > CONFIG.worldHalf - 60 || Math.abs(p.z) > CONFIG.worldHalf - 60) {
      p.heading += Math.PI * dt * 0.5;
      p.x = clamp(p.x, -CONFIG.worldHalf + 60, CONFIG.worldHalf - 60);
      p.z = clamp(p.z, -CONFIG.worldHalf + 60, CONFIG.worldHalf - 60);
    }
  }

  touchdown() {
    const p = this.plane;
    const hard = p.verticalSpeed < -3.2;
    p.onGround = true;
    p.y = this.world.terrainHeight(p.x, p.z) + 1.2;
    p.pitch = 0;
    p.bank *= 0.4;
    if (hard) {
      p.damage = Math.min(100, p.damage + 30);
      if (p.damage >= 100) {
        this.crash('The landing broke her back — too hard, too fast.');
        return;
      }
    }
    if (p.speed > 55) p.speed = 55;
  }

  spawnSpray() {
    const p = this.plane;
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        type: 'spray',
        x: p.x + (Math.random() - 0.5) * 12,
        y: CONFIG.waterLevel + 1 + Math.random() * 2,
        z: p.z + (Math.random() - 0.5) * 12,
        life: 1,
        size: 2,
      });
    }
  }

  spawnDrops(dt) {
    const p = this.plane;
    const n = Math.max(1, Math.round(dt * 60));
    for (let i = 0; i < n; i++) {
      this.particles.push({
        type: 'drop',
        x: p.x + (Math.random() - 0.5) * 8,
        y: p.y - 2,
        z: p.z + (Math.random() - 0.5) * 8,
        vx: Math.sin(p.heading) * p.speed * 0.92,
        vz: Math.cos(p.heading) * p.speed * 0.92,
        vy: -16 - Math.random() * 6,
        life: 1,
        size: 3,
      });
    }
  }

  updateParticles(dt) {
    const world = this.world;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      if (pt.type === 'smoke') {
        pt.y += 7 * dt;
        pt.x += Math.sin(this.time * 0.5 + i) * 2 * dt;
        pt.life -= dt * 0.22;
      } else if (pt.type === 'spray') {
        pt.life -= dt * 2.2;
      } else if (pt.type === 'splash') {
        pt.life -= dt * 1.4;
      } else if (pt.type === 'drop') {
        pt.x += pt.vx * dt;
        pt.z += pt.vz * dt;
        pt.y += pt.vy * dt;
        pt.vy -= 12 * dt;
        const ground = world.inLake(pt.x, pt.z) ? CONFIG.waterLevel : world.terrainHeight(pt.x, pt.z);
        if (pt.y <= ground) {
          for (const f of world.fires) {
            if (!f.alive) continue;
            const dx = pt.x - f.x;
            const dz = pt.z - f.z;
            if (dx * dx + dz * dz < f.radius * f.radius) {
              f.intensity -= CONFIG.dropDouse;
              if (f.intensity <= 0) {
                f.alive = false;
                f.intensity = 0;
                this.score += CONFIG.pointsPerFire;
                this.sound.chime();
              }
            }
          }
          this.particles[i] = {
            type: 'splash',
            x: pt.x,
            y: ground + 1,
            z: pt.z,
            life: 1,
            size: 4,
          };
          continue;
        }
        pt.life -= dt * 0.1;
      }
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
  }
}

// Boot: wire the canvas, the overlays and any ?scene= preset, then fly.
const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__game = game;
const params = new URLSearchParams(window.location.search);
const scene = params.get('scene');
if (scene) {
  applyScene(game, scene);
  game.showOnly(null);
  window.__scene = scene;
} else {
  game.showOnly('menu');
}
if (params.get('mute') === '1') game.sound.setMuted(true);
window.__gameReady = true;
