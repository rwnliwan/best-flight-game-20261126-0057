// TIRTA API — sound with no audio files: a WebAudio engine hum, wind,
// water and fire, all synthesised live from the flight state.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.windSource = null;
    this.windGain = null;
    this.windFilter = null;
    this.crackleTimer = 0;
  }

  // Browsers only allow audio after a gesture; call from the first key/click.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    } catch (e) {
      this.ctx = null;
      return;
    }
    const ctx = this.ctx;
    // Engine: two detuned saws through a lowpass, pitch follows throttle.
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 28;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(ctx.destination);
    this.engineOsc.start();
    this.engineOsc2.start();
    // Wind: looped noise through a bandpass, gain follows airspeed.
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.windSource = ctx.createBufferSource();
    this.windSource.buffer = buffer;
    this.windSource.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 420;
    this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(ctx.destination);
    this.windSource.start();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx) this.ctx.destination.gain = muted ? 0 : 1;
  }

  // Called every frame while flying.
  update(throttle, speed, onGround, dt, nearestFire, fireIntensity) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const engineLevel = onGround && throttle < 0.05 ? 0.0 : 0.05 + throttle * 0.075;
    this.engineGain.gain.setTargetAtTime(engineLevel, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(52 + throttle * 68, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(26 + throttle * 34, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(260 + throttle * 620, t, 0.1);
    this.windGain.gain.setTargetAtTime(Math.min(0.12, speed * 0.0016), t, 0.15);
    this.windFilter.frequency.setTargetAtTime(300 + speed * 9, t, 0.15);
    // Fire crackle: random short noise pops, louder when a fire is near.
    this.crackleTimer -= dt;
    if (nearestFire !== null && fireIntensity > 0 && this.crackleTimer <= 0) {
      this.crackleTimer = 0.05 + Math.random() * 0.12;
      const loud = Math.max(0, 1 - nearestFire / 500) * 0.5 * fireIntensity;
      if (loud > 0.02) this.pop(loud);
    }
  }

  pop(loud) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const dur = 0.05 + Math.random() * 0.06;
    const src = ctx.createBufferSource();
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900 + Math.random() * 1800;
    const gain = ctx.createGain();
    gain.gain.value = loud;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  // A short noise burst: the water doors opening.
  whoosh() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const dur = 0.7;
    const src = ctx.createBufferSource();
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.value = 0.35;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  // Two-note chime when a fire goes out.
  chime() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    for (const [freq, when] of [[660, 0], [880, 0.14]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.22, ctx.currentTime + when);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + 0.55);
    }
  }

  // Low alarm buzz for stall / low fuel.
  alarm() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 220;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
  }
}
