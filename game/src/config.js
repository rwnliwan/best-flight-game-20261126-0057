// TIRTA API — Wildfire Air Tanker: tuning constants and game balance.
// One job: every number the flight model, the world and the HUD agree on.

export const CONFIG = {
  canvasWidth: 1280,
  canvasHeight: 720,

  // World (metres). The map is a 4096 m square centred on the runway.
  worldSize: 4096,
  worldHalf: 2048,
  gridCells: 512, // heightfield grid; 8 m per cell
  waterLevel: 0,
  runwayElevation: 6,

  // Runway: a strip along +Z (north) through the origin.
  runway: { x: 0, zMin: -380, zMax: 480, halfWidth: 15, corridor: 46 },

  // The lake you scoop from: ellipse centre and radii.
  lake: { x: -650, z: 1350, rx: 430, rz: 270 },

  // Flight model.
  stallSpeed: 24, // m/s; below this the wing stops flying
  maxSpeed: 78, // m/s at full throttle, level
  minSpeed: 16,
  takeoffSpeed: 30,
  turnRate: 0.055, // heading change per second per degree of bank, scaled by speed
  maxBank: 46, // degrees
  maxPitchUp: 16, // degrees
  maxPitchDown: -13, // degrees
  pitchRate: 26, // degrees per second toward the target pitch
  bankRate: 70, // degrees per second toward the target bank
  throttleRate: 0.55, // per second
  fuelCapacity: 240, // litres
  fuelBurnIdle: 0.22, // litres per second
  fuelBurnFull: 1.05, // litres per second at full throttle
  waterCapacity: 3000, // litres in the belly tank
  scoopRate: 850, // litres per second while skimming the lake
  scoopMinSpeed: 25, // m/s
  scoopMaxSpeed: 50, // m/s
  scoopMaxAgl: 9, // metres above the water
  dropRate: 900, // litres per second while the doors are open

  // Fires and scoring.
  fireCount: 3,
  fireRadius: 62, // metres; a drop inside this ring douses
  fireSpread: 0.0045, // intensity per second while unattended
  fireMaxIntensity: 1.35,
  dropDouse: 0.011, // intensity removed per droplet that lands in the ring
  pointsPerFire: 600,
  pointsLanding: 400,
  timeBonusBase: 900,
  timeBonusPerSecond: 2,

  // Camera and renderer.
  cameraBack: 16, // metres behind the plane
  cameraUp: 7, // metres above the plane
  viewDistance: 760, // metres; voxel rays stop here
  columns: 320, // voxel columns across the screen
  horizonBase: 0.44, // fraction of screen height

  // Wind: slow gusts that push the plane and shake the camera.
  windBase: 2.2, // m/s
  windGust: 3.5, // m/s extra at gust peaks
};

export const MESSAGES = {
  title: 'TIRTA API',
  subtitle: 'Wildfire Air Tanker — scoop the lake, douse the forest fires, bring her home',
};
