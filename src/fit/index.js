import linear from './linear.js';
import catmull from './catmull.js';
import poly from './poly.js';
import cosine from './cosine.js';
import { glslToHLSL, buildPolyJS, buildCosineJS, buildLinearJS, buildCatmullJS, buildColorCode } from './buildCode.js';

export { buildColorCode };

export const FIT_MODES = { linear, catmull, poly, cosine };

export const LANGS = [
  { id: 'glsl', label: 'GLSL' },
  { id: 'hlsl', label: 'HLSL' },
  { id: 'js',   label: 'JS' },
  { id: 'ts',   label: 'TS' },
];

export const linearize = (c) => ({
  r: Math.pow(Math.max(0, c.r), 2.2),
  g: Math.pow(Math.max(0, c.g), 2.2),
  b: Math.pow(Math.max(0, c.b), 2.2),
  lum: c.lum,
});

export const gammaEncode = (c) => ({
  r: Math.pow(Math.max(0, c.r), 1 / 2.2),
  g: Math.pow(Math.max(0, c.g), 1 / 2.2),
  b: Math.pow(Math.max(0, c.b), 1 / 2.2),
});

export const evalColor = (coeffs, t, mode, linearLight = false) => {
  const c = FIT_MODES[mode].eval(coeffs, t);
  return linearLight ? gammaEncode(c) : c;
};

export const LINEAR_LIGHT_MODES = ['linear', 'catmull'];

export const buildCode = (fitMode, result, opts = {}, lang = 'glsl') => {
  const ts = lang === 'ts';

  if (lang === 'glsl') return FIT_MODES[fitMode].buildGLSL(result, opts);

  if (lang === 'hlsl') return glslToHLSL(FIT_MODES[fitMode].buildGLSL(result, opts));

  // JS / TS
  if (fitMode === 'poly')   return buildPolyJS(result, ts);
  if (fitMode === 'cosine') return buildCosineJS(result, ts);
  if (fitMode === 'linear') return buildLinearJS(result, opts, ts);
  if (fitMode === 'catmull') return buildCatmullJS(result, opts, ts);

  return FIT_MODES[fitMode].buildGLSL(result, opts);
};
