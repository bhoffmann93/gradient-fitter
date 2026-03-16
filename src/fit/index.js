import linear from './linear.js';
import catmull from './catmull.js';
import poly from './poly.js';
import cosine from './cosine.js';

export const FIT_MODES = { linear, catmull, poly, cosine };

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

export const buildColorGLSL = (colors) => {
  const fmt = (n) => n.toFixed(3);
  let code = `// Extracted colors – sRGB, luminance sorted\n`;
  colors.forEach((c, i) => {
    code += `vec3 color${i + 1} = vec3(${fmt(c.r)}, ${fmt(c.g)}, ${fmt(c.b)});\n`;
  });
  code += `\n// Same colors as an array (for indexed access)\nvec3 extractedColors[${colors.length}] = vec3[](\n`;
  code += colors
    .map((c, i) => `    vec3(${fmt(c.r)}, ${fmt(c.g)}, ${fmt(c.b)})${i < colors.length - 1 ? ',' : ''}`)
    .join('\n');
  code += `\n);`;
  return code;
};
