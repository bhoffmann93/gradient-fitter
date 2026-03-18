// Cosine palette technique by Inigo Quilez
// Copyright © 2015 Inigo Quilez – MIT License
// https://iquilezles.org/articles/palettes
// https://www.youtube.com/shorts/TH3OTy5fTog
// https://www.shadertoy.com/view/ll2GD3

import { solveCosineParams } from '../math/cosine.js';
import { fmtGlsl } from './glslUtils.js';

const fit = (samples, { lockFrequency = false, tValues = null } = {}) =>
  solveCosineParams(samples, undefined, lockFrequency, tValues);

const evaluate = (coeffs, t) => {
  const val = (p) => p.brightness + p.contrast * Math.cos(2 * Math.PI * (p.frequency * t + p.phase));
  return { r: val(coeffs.r), g: val(coeffs.g), b: val(coeffs.b) };
};

const buildGLSL = (coeffs) => {
  let code = `// Inigo Quilez (MIT) https://www.shadertoy.com/view/ll2GD3\nvec3 cosPalette(float t) {\n`;
  code += `    vec3 brightness = vec3(${fmtGlsl(coeffs.r.brightness)}, ${fmtGlsl(coeffs.g.brightness)}, ${fmtGlsl(coeffs.b.brightness)});\n`;
  code += `    vec3 contrast = vec3(${fmtGlsl(coeffs.r.contrast)}, ${fmtGlsl(coeffs.g.contrast)}, ${fmtGlsl(coeffs.b.contrast)});\n`;
  code += `    vec3 frequency = vec3(${fmtGlsl(coeffs.r.frequency)}, ${fmtGlsl(coeffs.g.frequency)}, ${fmtGlsl(coeffs.b.frequency)});\n`;
  code += `    vec3 phase = vec3(${fmtGlsl(coeffs.r.phase)}, ${fmtGlsl(coeffs.g.phase)}, ${fmtGlsl(coeffs.b.phase)});\n\n`;
  code += `    vec3 color = brightness + contrast * cos(6.28318 * (frequency * t + phase));\n`;
  code += `    return clamp(color, 0.0, 1.0);\n}`;
  return code;
};

export default { id: 'cosine', label: 'Cosine', fit, eval: evaluate, buildGLSL };
