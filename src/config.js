export const DEFAULTS = {
  fitMode: 'poly',
  degree: 3,
  colorCount: 5,
  lockFrequency: true,
  paletteFitMode: 'catmull',
  weightDominance: false,
  paletteMethod: 'dominant',
  apiModel: 'default',
  apiSeedCount: 3,
  contrast: 1.0,
  minLevel: 0,
  maxLevel: 255,
  p1: { x: 0.05, y: 0.5 },
  p2: { x: 0.95, y: 0.5 },
};

export const SOLVER_STEPS = 5000;
export const IMAGE_MAX_SIZE = 500;
export const POINT_HIT_RADIUS = 20;
export const KMEANS_RUNS = 24;
export const DOMINANT_PIXEL_SAMPLE = 10000;
export const API_SEED_PIXEL_SAMPLE = 5000;
export const GENERATIVE_PIXEL_SAMPLE = 3000;
export const GRAPH_Y_MIN = -0.25;
export const GRAPH_Y_MAX = 1.25;

export const COLORMIND_API_URL = 'http://colormind.io/api/';
export const COLORMIND_LIST_URL = 'http://colormind.io/list/';
