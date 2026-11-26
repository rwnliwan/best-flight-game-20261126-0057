// TIRTA API — keyboard and mouse: one job, the pressed keys and the pointer.
// The game reads this; it never touches DOM events itself.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered: cleared once per frame by the game
    this.mouseDown = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.canvas = canvas;
    this.onFirstGesture = null;
    this.attach();
  }

  attach() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (this.onFirstGesture) this.onFirstGesture();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    this.canvas.addEventListener('pointerdown', (e) => {
      this.mouseDown = true;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      if (this.onFirstGesture) this.onFirstGesture();
    });
    window.addEventListener('pointerup', () => {
      this.mouseDown = false;
    });
    window.addEventListener('pointermove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
  }

  down(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  endFrame() {
    this.pressed.clear();
  }

  // Steering intent in [-1, 1] from keys, plus mouse steering while held.
  steerAxis() {
    let axis = 0;
    if (this.down('ArrowLeft') || this.down('KeyA')) axis -= 1;
    if (this.down('ArrowRight') || this.down('KeyD')) axis += 1;
    if (this.mouseDown) {
      const rect = this.canvas.getBoundingClientRect();
      const rel = (this.mouseX - rect.left) / rect.width - 0.5;
      axis += Math.max(-1, Math.min(1, rel * 2.4));
    }
    return Math.max(-1, Math.min(1, axis));
  }

  pitchAxis() {
    let axis = 0;
    if (this.down('ArrowUp') || this.down('KeyW')) axis += 1; // climb
    if (this.down('ArrowDown') || this.down('KeyS')) axis -= 1; // descend
    return axis;
  }

  throttleAxis() {
    let axis = 0;
    if (this.down('ShiftLeft') || this.down('ShiftRight') || this.down('KeyE')) axis += 1;
    if (this.down('ControlLeft') || this.down('KeyQ')) axis -= 1;
    return axis;
  }
}
