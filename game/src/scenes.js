// TIRTA API — scene presets: named starting states for screenshots and for
// trying the game mid-flight. A scene only chooses the starting state and
// switches the autopilot assist on; the simulation underneath is the same one
// the player flies, and any keypress hands control straight back.

export function applyScene(game, name) {
  const p = game.plane;
  const world = game.world;
  const fire = world.fires;
  game.state = 'flying';
  game.autopilot = true;
  game.demoDrop = false;
  if (name === 'takeoff') {
    // On the runway, rolling: throttle up, nose on the centreline.
    p.x = 0;
    p.z = -260;
    p.y = world.terrainHeight(0, -260) + 1.2;
    p.heading = 0;
    p.pitch = 0;
    p.bank = 0;
    p.speed = 14;
    p.throttle = 0.75;
    p.onGround = true;
    p.water = 0;
    p.fuel = 210;
  } else if (name === 'scoop') {
    // Skimming the lake along its long axis, scoops open, spray flying.
    p.x = -1000;
    p.z = 1350;
    p.y = 5;
    p.heading = 1.35;
    p.pitch = 0;
    p.bank = 0;
    p.speed = 36;
    p.throttle = 0.62;
    p.onGround = false;
    p.water = 900;
    p.fuel = 180;
  } else if (name === 'drop') {
    // On final to fire 2, tank full, doors opening over the flames.
    const f = fire[1];
    p.x = f.x - Math.sin(0.5) * 450;
    p.z = f.z - Math.cos(0.5) * 450;
    p.y = f.ground + 62;
    p.heading = 0.5;
    p.pitch = -4;
    p.bank = 0;
    p.speed = 44;
    p.throttle = 0.55;
    p.onGround = false;
    p.water = 3000;
    p.fuel = 160;
    game.demoDrop = true;
  } else if (name === 'land') {
    // Short final, lined up on the runway, fires already out.
    for (const f of world.fires) {
      f.alive = false;
      f.intensity = 0;
    }
    game.score = 1800;
    p.x = 24;
    p.z = 980;
    p.y = world.terrainHeight(24, 980) + 118;
    p.heading = Math.PI; // flying south, back down the runway
    p.pitch = -5;
    p.bank = 0;
    p.speed = 42;
    p.throttle = 0.34;
    p.onGround = false;
    p.water = 0;
    p.fuel = 120;
  } else {
    // cover (default): low over the valley floor, the first fire front
    // burning ahead with its smoke column, tank full.
    const f = fire[0];
    p.x = f.x - Math.sin(0.42) * 380;
    p.z = f.z - Math.cos(0.42) * 380;
    p.y = f.ground + 80;
    p.heading = 0.42;
    p.pitch = 4;
    p.bank = 6;
    p.speed = 52;
    p.throttle = 0.72;
    p.onGround = false;
    p.water = 3000;
    p.fuel = 200;
  }
  p.verticalSpeed = 0;
  p.damage = 0;
  // The autopilot holds the scene's own heading and height, so the frame
  // stays composed while the simulation runs underneath.
  game.autoHeading = p.heading;
  const holdAgl = { takeoff: 80, scoop: 5, drop: 60, land: 90 };
  game.autoAgl = holdAgl[name] ?? 80;
  game.elapsed = 0;
  game.particles.length = 0;
}
