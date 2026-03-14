import { fmtGlsl } from './glslUtils.js';

const fit = (colors, { tValues = null } = {}) => ({
  colors,
  tValues: tValues ?? colors.map((_, i) => i / (colors.length - 1)),
});

const evaluate = ({ colors, tValues }, t) => {
  const n = colors.length;
  let segIdx = n - 2, localT = 1.0;
  for (let j = 0; j < n - 1; j++) {
    if (t <= tValues[j + 1] || j === n - 2) {
      segIdx = j;
      const range = tValues[j + 1] - tValues[j];
      localT = range > 0 ? Math.max(0, Math.min(1, (t - tValues[j]) / range)) : 0;
      break;
    }
  }
  const p = (idx) => colors[Math.max(0, Math.min(n - 1, idx))];
  const p0 = p(segIdx - 1), p1 = p(segIdx), p2 = p(segIdx + 1), p3 = p(segIdx + 2);
  const lt = localT, lt2 = lt * lt, lt3 = lt2 * lt;
  const b1 = -lt3 + 2 * lt2 - lt;
  const b2 = 3 * lt3 - 5 * lt2 + 2;
  const b3 = -3 * lt3 + 4 * lt2 + lt;
  const b4 = lt3 - lt2;
  return {
    r: 0.5 * (b1 * p0.r + b2 * p1.r + b3 * p2.r + b4 * p3.r),
    g: 0.5 * (b1 * p0.g + b2 * p1.g + b3 * p2.g + b4 * p3.g),
    b: 0.5 * (b1 * p0.b + b2 * p1.b + b3 * p2.b + b4 * p3.b),
  };
};

const buildGLSL = ({ colors, tValues }, { linearLight = false } = {}) => {
  const n = colors.length;
  const isUniform = tValues.every((tv, i) => Math.abs(tv - i / (n - 1)) < 0.001);

  let code = `vec3 catmullRom(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t) {\n`;
  code += `    float t2 = t * t;\n    float t3 = t2 * t;\n`;
  code += `    float b1 = -t3 + 2.0 * t2 - t;\n`;
  code += `    float b2 = 3.0 * t3 - 5.0 * t2 + 2.0;\n`;
  code += `    float b3 = -3.0 * t3 + 4.0 * t2 + t;\n`;
  code += `    float b4 = t3 - t2;\n`;
  code += `    return 0.5 * (b1 * p0 + b2 * p1 + b3 * p2 + b4 * p3);\n}\n\n`;
  code += `vec3 palette(float t) {\n`;

  if (isUniform) {
    code += `    vec3 colors[${n}] = vec3[](\n`;
    code += colors.map((c, i) => `        vec3(${fmtGlsl(c.r)}, ${fmtGlsl(c.g)}, ${fmtGlsl(c.b)})${i < n - 1 ? ',' : ''}`).join('\n');
    code += `\n    );\n`;
    code += `    float f = clamp(t, 0.0, 1.0) * ${n - 1}.0;\n`;
    code += `    int i = clamp(int(f), 0, ${n - 2});\n`;
    code += `    float localT = fract(f);\n`;
    code += `    vec3 p0 = colors[max(i - 1, 0)];\n`;
    code += `    vec3 p1 = colors[i];\n`;
    code += `    vec3 p2 = colors[min(i + 1, ${n - 1})];\n`;
    code += `    vec3 p3 = colors[min(i + 2, ${n - 1})];\n`;
  } else {
    code += `    vec4 stops[${n}] = vec4[](\n`;
    code += colors.map((c, i) => `        vec4(${fmtGlsl(c.r)}, ${fmtGlsl(c.g)}, ${fmtGlsl(c.b)}, ${fmtGlsl(tValues[i])})${i < n - 1 ? ',' : ''}`).join('\n');
    code += `\n    );\n`;
    code += `    int i = ${n - 2}; float localT = 1.0;\n`;
    for (let j = 0; j < n - 1; j++) {
      const range = Math.max(0.00001, tValues[j + 1] - tValues[j]).toFixed(5);
      const cond = j === 0 ? `if` : j === n - 2 ? `else` : `else if`;
      const guard = j === n - 2 ? `` : ` (t < stops[${j + 1}].w)`;
      code += `    ${cond}${guard} { i = ${j}; localT = clamp((t - stops[${j}].w) / ${range}, 0.0, 1.0); }\n`;
    }
    code += `    vec3 p0 = stops[max(i - 1, 0)].rgb;\n`;
    code += `    vec3 p1 = stops[i].rgb;\n`;
    code += `    vec3 p2 = stops[min(i + 1, ${n - 1})].rgb;\n`;
    code += `    vec3 p3 = stops[min(i + 2, ${n - 1})].rgb;\n`;
  }
  const returnExpr = linearLight
    ? `pow(clamp(catmullRom(p0, p1, p2, p3, localT), 0.0, 1.0), vec3(0.4545))`
    : `catmullRom(p0, p1, p2, p3, localT)`;
  code += `    return ${returnExpr};\n}`;
  return code;
};

export default { id: 'catmull', label: 'Catmull', fit, eval: evaluate, buildGLSL };
