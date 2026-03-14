import { fmtGlsl } from './glslUtils.js';

const fit = (colors) => {
  const areas = colors.map((c) => (c.area > 0 ? c.area : 1));
  const total = areas.reduce((a, b) => a + b, 0);
  let cum = 0;
  const tBoundaries = [];
  for (let i = 0; i < colors.length - 1; i++) {
    cum += areas[i] / total;
    tBoundaries.push(cum);
  }
  return { colors, tBoundaries };
};

const evaluate = ({ colors, tBoundaries }, t) => {
  for (let i = 0; i < tBoundaries.length; i++) {
    if (t < tBoundaries[i]) return colors[i];
  }
  return colors[colors.length - 1];
};

const buildGLSL = ({ colors, tBoundaries }) => {
  const n = colors.length;
  const isUniform = tBoundaries.every((b, i) => Math.abs(b - (i + 1) / n) < 0.001);

  let code = `vec3 palette(float t) {\n`;
  if (isUniform) {
    code += `    vec3 colors[${n}] = vec3[](\n`;
    code += colors.map((c, i) => `        vec3(${fmtGlsl(c.r)}, ${fmtGlsl(c.g)}, ${fmtGlsl(c.b)})${i < n - 1 ? ',' : ''}`).join('\n');
    code += `\n    );\n    return colors[clamp(int(t * ${n}.0), 0, ${n - 1})];\n}`;
  } else {
    code += `    vec4 stops[${n}] = vec4[](\n`;
    code += colors.map((c, i) => {
      const boundary = i < tBoundaries.length ? tBoundaries[i] : 1.0;
      return `        vec4(${fmtGlsl(c.r)}, ${fmtGlsl(c.g)}, ${fmtGlsl(c.b)}, ${fmtGlsl(boundary)})${i < n - 1 ? ',' : ''}`;
    }).join('\n');
    code += `\n    );\n`;
    for (let i = 0; i < n - 1; i++) code += `    if (t < stops[${i}].w) return stops[${i}].rgb;\n`;
    code += `    return stops[${n - 1}].rgb;\n}`;
  }
  return code;
};

export default { id: 'steps', label: 'Steps', fit, eval: evaluate, buildGLSL };
