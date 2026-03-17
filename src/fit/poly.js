import { fitPolynomial } from '../math/polynomial.js';
import { fmtGlsl } from './glslUtils.js';

const fit = (samples, { degree = 3, tValues = null } = {}) =>
  fitPolynomial(samples, degree, tValues);

const evaluate = (coeffs, t) => {
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < coeffs.r.length; i++) {
    const term = Math.pow(t, i);
    r += coeffs.r[i] * term;
    g += coeffs.g[i] * term;
    b += coeffs.b[i] * term;
  }
  return { r, g, b };
};

const buildGLSL = (coeffs) => {
  const deg = coeffs.r.length - 1;
  let code = `vec3 polyPalette(float t) {\n`;
  code += `    vec3 c0 = vec3(${fmtGlsl(coeffs.r[0])}, ${fmtGlsl(coeffs.g[0])}, ${fmtGlsl(coeffs.b[0])});\n`;
  for (let i = 1; i <= deg; i++) {
    code += `    vec3 c${i} = vec3(${fmtGlsl(coeffs.r[i])}, ${fmtGlsl(coeffs.g[i])}, ${fmtGlsl(coeffs.b[i])});\n`;
  }
  const terms = [`c0`];
  for (let i = 1; i <= deg; i++) {
    const tStr = i === 1 ? 't' : i === 2 ? 't * t' : i === 3 ? 't * t * t' : `pow(t, ${i}.0)`;
    terms.push(`c${i} * ${tStr}`);
  }
  code += `\n    vec3 color = ${terms.join(' + ')};\n    return clamp(color, vec3(0.0), vec3(1.0));\n}`;
  return code;
};

export default { id: 'poly', label: 'Poly', fit, eval: evaluate, buildGLSL };
