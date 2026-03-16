export const DEFAULTS = {
  fitMode: 'poly',
  degree: 3,
  colorCount: 5,
  lockFrequency: true,
  paletteFitMode: 'catmull',
  linearLight: false,
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
export const POINT_HIT_RADIUS = 15;
export const OVERLAY_LINE_WIDTH = 2.5;
export const OVERLAY_LINE_OUTLINE = 4;
export const OVERLAY_NODE_RADIUS = 7;
export const OVERLAY_NODE_RADIUS_HOVER = 9;
export const OVERLAY_NODE_OUTLINE = 2;
export const OVERLAY_NODE_RING = 14;
export const KMEANS_RUNS = 24;
export const DOMINANT_PIXEL_SAMPLE = 10000;
export const API_SEED_PIXEL_SAMPLE = 5000;
export const GENERATIVE_PIXEL_SAMPLE = 3000;
export const GRAPH_Y_MIN = -0.25;
export const GRAPH_Y_MAX = 1.25;

export const COLORMIND_API_URL = 'https://solitary-paper-83a2.b-hoffmann.workers.dev/api/';
export const COLORMIND_LIST_URL = 'https://solitary-paper-83a2.b-hoffmann.workers.dev/list/';
