import steps from './steps.js';
import linear from './linear.js';
import catmull from './catmull.js';
import poly from './poly.js';
import cosine from './cosine.js';

export const FIT_MODES = { steps, linear, catmull, poly, cosine };

export const evalColor = (coeffs, t, mode) => FIT_MODES[mode].eval(coeffs, t);

export const buildColorGLSL = (colors) => {
  const fmt = (n) => n.toFixed(3);
  let code = `// Extracted colors (luminance sorted)\n`;
  colors.forEach((c, i) => {
    code += `vec3 color${i + 1} = vec3(${fmt(c.r)}, ${fmt(c.g)}, ${fmt(c.b)});\n`;
  });
  code += `\n// Array form\nvec3 palette[${colors.length}] = vec3[](\n`;
  code += colors
    .map((c, i) => `    vec3(${fmt(c.r)}, ${fmt(c.g)}, ${fmt(c.b)})${i < colors.length - 1 ? ',' : ''}`)
    .join('\n');
  code += `\n);`;
  return code;
};
