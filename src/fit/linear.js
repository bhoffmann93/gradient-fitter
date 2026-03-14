import { fmtGlsl } from './glslUtils.js';

const fit = (colors, { tValues = null } = {}) => ({
  colors,
  tValues: tValues ?? colors.map((_, i) => i / (colors.length - 1)),
});

const evaluate = ({ colors, tValues }, t) => {
  for (let i = 0; i < colors.length - 1; i++) {
    const t0 = tValues[i], t1 = tValues[i + 1];
    if (t <= t1 || i === colors.length - 2) {
      const frac = t1 > t0 ? Math.max(0, Math.min(1, (t - t0) / (t1 - t0))) : 0;
      return {
        r: colors[i].r + (colors[i + 1].r - colors[i].r) * frac,
        g: colors[i].g + (colors[i + 1].g - colors[i].g) * frac,
        b: colors[i].b + (colors[i + 1].b - colors[i].b) * frac,
      };
    }
  }
  return colors[colors.length - 1];
};

const buildGLSL = ({ colors, tValues }, { linearLight = false } = {}) => {
  const n = colors.length;
  const isUniform = tValues.every((tv, i) => Math.abs(tv - i / (n - 1)) < 0.001);
  const ret = (expr) => linearLight
    ? `pow(clamp(${expr}, 0.0, 1.0), vec3(0.4545))`
    : expr;

  let code = `vec3 palette(float t) {\n`;
  if (isUniform) {
    code += `    vec3 colors[${n}] = vec3[](\n`;
    code += colors.map((c, i) => `        vec3(${fmtGlsl(c.r)}, ${fmtGlsl(c.g)}, ${fmtGlsl(c.b)})${i < n - 1 ? ',' : ''}`).join('\n');
    code += `\n    );\n`;
    code += `    float f = clamp(t, 0.0, 1.0) * ${n - 1}.0;\n`;
    code += `    int i = clamp(int(f), 0, ${n - 2});\n`;
    code += `    return ${ret('mix(colors[i], colors[i + 1], fract(f))')};\n}`;
  } else {
    code += `    vec4 stops[${n}] = vec4[](\n`;
    code += colors.map((c, i) => `        vec4(${fmtGlsl(c.r)}, ${fmtGlsl(c.g)}, ${fmtGlsl(c.b)}, ${fmtGlsl(tValues[i])})${i < n - 1 ? ',' : ''}`).join('\n');
    code += `\n    );\n`;
    code += `    vec3 _r = stops[${n - 1}].rgb;\n`;
    for (let i = 0; i < n - 1; i++) {
      const kw = i === 0 ? 'if' : 'else if';
      code += `    ${kw} (t < stops[${i + 1}].w) _r = mix(stops[${i}].rgb, stops[${i + 1}].rgb,\n`;
      code += `        (t - stops[${i}].w) / (stops[${i + 1}].w - stops[${i}].w));\n`;
    }
    code += `    return ${ret('_r')};\n}`;
  }
  return code;
};

export default { id: 'linear', label: 'Linear', fit, eval: evaluate, buildGLSL };
