import { fitPolynomial } from '../math/polynomial.js';
import { fmtGlsl } from './glslUtils.js';
import { toOklab, fromOklab, OKLAB_TO_SRGB_GLSL } from './oklab.js';

const fit = (samples, { degree = 3, tValues = null, colorSpace = 'srgb' } = {}) => {
  if (colorSpace !== 'oklab') return fitPolynomial(samples, degree, tValues);
  return { ...fitPolynomial(samples.map(toOklab), degree, tValues), colorSpace };
};

const evaluate = (coeffs, t) => {
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < coeffs.r.length; i++) {
    const term = Math.pow(t, i);
    r += coeffs.r[i] * term;
    g += coeffs.g[i] * term;
    b += coeffs.b[i] * term;
  }
  return coeffs.colorSpace === 'oklab' ? fromOklab({ r, g, b }) : { r, g, b };
};

const buildGLSL = (coeffs) => {
  const deg = coeffs.r.length - 1;
  const oklab = coeffs.colorSpace === 'oklab';
  // OKLab gets cubed and gamma-encoded, which amplifies rounding error
  const f = (n) => fmtGlsl(n, oklab ? 5 : 3);
  let code = oklab ? `${OKLAB_TO_SRGB_GLSL}\n\n// coefficients are OKLab (L, a, b), output is sRGB\n` : '';
  code += `vec3 polyPalette(float t) {\n`;
  code += `    vec3 c0 = vec3(${f(coeffs.r[0])}, ${f(coeffs.g[0])}, ${f(coeffs.b[0])});\n`;
  for (let i = 1; i <= deg; i++) {
    code += `    vec3 c${i} = vec3(${f(coeffs.r[i])}, ${f(coeffs.g[i])}, ${f(coeffs.b[i])});\n`;
  }
  const terms = [`c0`];
  for (let i = 1; i <= deg; i++) {
    const tStr = i === 1 ? 't' : i === 2 ? 't * t' : i === 3 ? 't * t * t' : `pow(t, ${i}.0)`;
    terms.push(`c${i} * ${tStr}`);
  }
  if (oklab) code += `\n    vec3 lab = ${terms.join(' + ')};\n    return oklabToSrgb(lab);\n}`;
  else code += `\n    vec3 color = ${terms.join(' + ')};\n    return clamp(color, 0.0, 1.0);\n}`;
  return code;
};

export default { id: 'poly', label: 'Poly', fit, eval: evaluate, buildGLSL };
