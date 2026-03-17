import { solveCosineParams } from '../math/cosine.js';
import { fmtGlsl } from './glslUtils.js';

const fit = (samples, { lockFrequency = false, tValues = null } = {}) =>
  solveCosineParams(samples, undefined, lockFrequency, tValues);

const evaluate = (coeffs, t) => {
  const val = (p) => p.a + p.b * Math.cos(2 * Math.PI * (p.c * t + p.d));
  return { r: val(coeffs.r), g: val(coeffs.g), b: val(coeffs.b) };
};

const buildGLSL = (coeffs) => {
  let code = `vec3 cosPalette(float t) {\n`;
  code += `    vec3 a = vec3(${fmtGlsl(coeffs.r.a)}, ${fmtGlsl(coeffs.g.a)}, ${fmtGlsl(coeffs.b.a)});\n`;
  code += `    vec3 b = vec3(${fmtGlsl(coeffs.r.b)}, ${fmtGlsl(coeffs.g.b)}, ${fmtGlsl(coeffs.b.b)});\n`;
  code += `    vec3 c = vec3(${fmtGlsl(coeffs.r.c)}, ${fmtGlsl(coeffs.g.c)}, ${fmtGlsl(coeffs.b.c)});\n`;
  code += `    vec3 d = vec3(${fmtGlsl(coeffs.r.d)}, ${fmtGlsl(coeffs.g.d)}, ${fmtGlsl(coeffs.b.d)});\n\n`;
  code += `    return clamp(a + b * cos( 6.28318 * (c * t + d) ), 0.0, 1.0);\n}`;
  return code;
};

export default { id: 'cosine', label: 'Cosine', fit, eval: evaluate, buildGLSL };
