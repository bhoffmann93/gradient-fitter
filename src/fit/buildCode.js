import { fmtGlsl as fmt } from './glslUtils.js';

const fmtArr = (vals) => `[${vals.map(fmt).join(', ')}]`;
const clamp01 = (expr) => `Math.min(1, Math.max(0, ${expr}))`;

// ─── HLSL: transform GLSL output ─────────────────────────────────────────────

export const glslToHLSL = (code) =>
  code
    .replace(/\bvec3\b/g, 'float3')
    .replace(/\bvec4\b/g, 'float4')
    .replace(/= float3\[\]\(/g, '= {')
    .replace(/= float4\[\]\(/g, '= {')
    .replace(/^(\s+)\);$/gm, '$1};')
    .replace(/\bmix\(/g, 'lerp(')
    .replace(/\bfract\(/g, 'frac(')
    .replace(/\bint\(/g, '(int)(');

// ─── Poly JS/TS ───────────────────────────────────────────────────────────────

export const buildPolyJS = (coeffs, ts = false) => {
  const typeAnn = ts ? ': number[][]' : '';
  const retType = ts ? ': [number, number, number]' : '';
  const cast = ts ? ' as [number, number, number]' : '';
  const tParam = ts ? 't: number' : 't';
  const deg = coeffs.r.length;
  const rows = Array.from({ length: deg }, (_, i) =>
    fmtArr([coeffs.r[i], coeffs.g[i], coeffs.b[i]])
  );
  return [
    `// Returns [r, g, b] in [0, 1] — normalized sRGB (use * 255 for CSS rgb())`,
    `const polyPalette = (${tParam})${retType} => {`,
    `  const coeffs${typeAnn} = [`,
    ...rows.map((r, i) => `    ${r}${i < rows.length - 1 ? ',' : ''}`),
    `  ];`,
    `  return [0, 1, 2].map(k => {`,
    `    let v = 0;`,
    `    for (let i = 0; i < coeffs.length; i++) v += coeffs[i][k] * Math.pow(t, i);`,
    `    return ${clamp01('v')};`,
    `  })${cast};`,
    `};`,
  ].join('\n');
};

// ─── Cosine JS/TS ─────────────────────────────────────────────────────────────

export const buildCosineJS = (coeffs, ts = false) => {
  const retType = ts ? ': [number, number, number]' : '';
  const cast = ts ? ' as [number, number, number]' : '';
  const tParam = ts ? 't: number' : 't';
  return [
    `// Returns [r, g, b] in [0, 1] — normalized sRGB (use * 255 for CSS rgb())`,
    `const cosPalette = (${tParam})${retType} => {`,
    `  const offset    = ${fmtArr([coeffs.r.a, coeffs.g.a, coeffs.b.a])};`,
    `  const amplitude = ${fmtArr([coeffs.r.b, coeffs.g.b, coeffs.b.b])};`,
    `  const frequency = ${fmtArr([coeffs.r.c, coeffs.g.c, coeffs.b.c])};`,
    `  const phase     = ${fmtArr([coeffs.r.d, coeffs.g.d, coeffs.b.d])};`,
    `  return [0, 1, 2].map(k =>`,
    `    offset[k] + amplitude[k] * Math.cos(6.28318 * (frequency[k] * t + phase[k]))`,
    `  )${cast};`,
    `};`,
  ].join('\n');
};

// ─── Linear JS/TS ─────────────────────────────────────────────────────────────

export const buildLinearJS = ({ colors, tValues }, { linearLight = false } = {}, ts = false) => {
  const n = colors.length;
  const isUniform = tValues.every((tv, i) => Math.abs(tv - i / (n - 1)) < 0.001);
  const retType = ts ? ': [number, number, number]' : '';
  const cast = ts ? ' as [number, number, number]' : '';
  const tParam = ts ? 't: number' : 't';
  const colorSpace = linearLight ? 'Linear RGB' : 'sRGB';
  const lines = [
    `// Returns [r, g, b] in [0, 1] — normalized ${colorSpace} (use * 255 for CSS rgb())`,
    `const linearPalette = (${tParam})${retType} => {`,
  ];

  if (isUniform) {
    lines.push(`  // ${colorSpace}`);
    lines.push(`  const colors = [`);
    colors.forEach((c, i) => lines.push(`    ${fmtArr([c.r, c.g, c.b])}${i < n - 1 ? ',' : ''}`));
    lines.push(`  ];`);
    lines.push(`  const f  = Math.min(1, Math.max(0, t)) * ${n - 1};`);
    lines.push(`  const i  = Math.min(Math.floor(f), ${n - 2});`);
    lines.push(`  const ft = f - Math.floor(f);`);
    if (linearLight) {
      lines.push(`  const raw = [0, 1, 2].map(k => colors[i][k] + (colors[i + 1][k] - colors[i][k]) * ft);`);
      lines.push(`  return raw.map(v => Math.pow(${clamp01('v')}, 0.4545))${cast}; // to sRGB`);
    } else {
      lines.push(`  return [0, 1, 2].map(k => colors[i][k] + (colors[i + 1][k] - colors[i][k]) * ft)${cast};`);
    }
  } else {
    lines.push(`  // ${colorSpace}, w = stop position`);
    lines.push(`  const colors = [`);
    colors.forEach((c, i) => lines.push(`    ${fmtArr([c.r, c.g, c.b])}${i < n - 1 ? ',' : ''}`));
    lines.push(`  ];`);
    lines.push(`  const pos = [${tValues.map(fmt).join(', ')}];`);
    lines.push(ts ? `  let rgb: number[] = colors[${n - 1}];` : `  let rgb = colors[${n - 1}];`);
    lines.push(`  for (let i = 0; i < colors.length - 1; i++) {`);
    lines.push(`    if (t < pos[i + 1]) {`);
    lines.push(`      const f = (t - pos[i]) / (pos[i + 1] - pos[i]);`);
    lines.push(`      rgb = [0, 1, 2].map(k => colors[i][k] + (colors[i + 1][k] - colors[i][k]) * f);`);
    lines.push(`      break;`);
    lines.push(`    }`);
    lines.push(`  }`);
    if (linearLight) {
      lines.push(`  return rgb.map(v => Math.pow(${clamp01('v')}, 0.4545))${cast}; // to sRGB`);
    } else {
      lines.push(`  return rgb${cast};`);
    }
  }
  lines.push(`};`);
  return lines.join('\n');
};

// ─── Catmull-Rom JS/TS ────────────────────────────────────────────────────────

export const buildCatmullJS = ({ colors, tValues }, { linearLight = false } = {}, ts = false) => {
  const n = colors.length;
  const isUniform = tValues.every((tv, i) => Math.abs(tv - i / (n - 1)) < 0.001);
  const retType = ts ? ': [number, number, number]' : '';
  const tParam = ts ? 't: number' : 't';
  const crParam = ts
    ? 'p0: number[], p1: number[], p2: number[], p3: number[], t: number'
    : 'p0, p1, p2, p3, t';
  const crRet = ts ? ': number[]' : '';
  const cast = ts ? ' as [number, number, number]' : '';
  const colorSpace = linearLight ? 'Linear RGB' : 'sRGB';

  const lines = [
    `const catmullRom = (${crParam})${crRet} => {`,
    `  const t2 = t * t, t3 = t2 * t;`,
    `  const b1 = -t3 + 2*t2 - t,  b2 = 3*t3 - 5*t2 + 2;`,
    `  const b3 = -3*t3 + 4*t2 + t, b4 = t3 - t2;`,
    `  return [0, 1, 2].map(k => 0.5 * (b1*p0[k] + b2*p1[k] + b3*p2[k] + b4*p3[k]));`,
    `};`,
    ``,
    `// Returns [r, g, b] in [0, 1] — normalized ${colorSpace} (use * 255 for CSS rgb())`,
    `const catmullPalette = (${tParam})${retType} => {`,
  ];

  if (isUniform) {
    lines.push(`  // ${colorSpace}`);
    lines.push(`  const colors = [`);
    colors.forEach((c, i) => lines.push(`    ${fmtArr([c.r, c.g, c.b])}${i < n - 1 ? ',' : ''}`));
    lines.push(`  ];`);
    lines.push(`  const f      = Math.min(1, Math.max(0, t)) * ${n - 1};`);
    lines.push(`  const i      = Math.min(Math.floor(f), ${n - 2});`);
    lines.push(`  const localT = f - Math.floor(f);`);
    lines.push(`  const p0 = colors[Math.max(i - 1, 0)];`);
    lines.push(`  const p1 = colors[i];`);
    lines.push(`  const p2 = colors[Math.min(i + 1, ${n - 1})];`);
    lines.push(`  const p3 = colors[Math.min(i + 2, ${n - 1})];`);
  } else {
    lines.push(`  // ${colorSpace}, w = stop position`);
    lines.push(`  const colors = [`);
    colors.forEach((c, i) => lines.push(`    ${fmtArr([c.r, c.g, c.b])}${i < n - 1 ? ',' : ''}`));
    lines.push(`  ];`);
    lines.push(`  const pos = [${tValues.map(fmt).join(', ')}];`);
    lines.push(`  let i = ${n - 2}, localT = 1.0;`);
    for (let j = 0; j < n - 1; j++) {
      const range = Math.max(0.00001, tValues[j + 1] - tValues[j]).toFixed(5);
      const cond = j === 0 ? 'if' : j === n - 2 ? 'else' : 'else if';
      const guard = j === n - 2 ? '' : ` (t < pos[${j + 1}])`;
      lines.push(`  ${cond}${guard} { i = ${j}; localT = Math.min(1, Math.max(0, (t - pos[${j}]) / ${range})); }`);
    }
    lines.push(`  const p0 = colors[Math.max(i - 1, 0)];`);
    lines.push(`  const p1 = colors[i];`);
    lines.push(`  const p2 = colors[Math.min(i + 1, ${n - 1})];`);
    lines.push(`  const p3 = colors[Math.min(i + 2, ${n - 1})];`);
  }

  if (linearLight) {
    lines.push(`  const col = catmullRom(p0, p1, p2, p3, localT);`);
    lines.push(`  return col.map(v => Math.pow(${clamp01('v')}, 0.4545))${cast}; // to sRGB`);
  } else {
    lines.push(`  return catmullRom(p0, p1, p2, p3, localT)${cast};`);
  }
  lines.push(`};`);
  return lines.join('\n');
};

// ─── Extracted color block ────────────────────────────────────────────────────

export const buildColorCode = (colors, lang) => {
  const f = (n) => n.toFixed(3);
  const n = colors.length;

  if (lang === 'js' || lang === 'ts') {
    const typeAnn = lang === 'ts' ? ': [number, number, number]' : '';
    const arrType = lang === 'ts' ? ': [number, number, number][]' : '';
    let code = `// Extracted colors – normalized sRGB [0, 1] (use * 255 for CSS rgb()), luminance sorted\n`;
    colors.forEach((c, i) => {
      code += `const color${i + 1}${typeAnn} = [${f(c.r)}, ${f(c.g)}, ${f(c.b)}];\n`;
    });
    code += `\n// Same colors as an array (for indexed access)\nconst extractedColors${arrType} = [\n`;
    code += colors.map((c, i) => `  [${f(c.r)}, ${f(c.g)}, ${f(c.b)}]${i < n - 1 ? ',' : ''}`).join('\n');
    code += `\n];`;
    return code;
  }

  if (lang === 'hlsl') {
    let code = `// Extracted colors – sRGB, luminance sorted\n`;
    colors.forEach((c, i) => {
      code += `float3 color${i + 1} = float3(${f(c.r)}, ${f(c.g)}, ${f(c.b)});\n`;
    });
    code += `\n// Same colors as an array (for indexed access)\nfloat3 extractedColors[${n}] = {\n`;
    code += colors.map((c, i) => `    float3(${f(c.r)}, ${f(c.g)}, ${f(c.b)})${i < n - 1 ? ',' : ''}`).join('\n');
    code += `\n};`;
    return code;
  }

  // GLSL
  let code = `// Extracted colors – sRGB, luminance sorted\n`;
  colors.forEach((c, i) => {
    code += `vec3 color${i + 1} = vec3(${f(c.r)}, ${f(c.g)}, ${f(c.b)});\n`;
  });
  code += `\n// Same colors as an array (for indexed access)\nvec3 extractedColors[${n}] = vec3[](\n`;
  code += colors.map((c, i) => `    vec3(${f(c.r)}, ${f(c.g)}, ${f(c.b)})${i < n - 1 ? ',' : ''}`).join('\n');
  code += `\n);`;
  return code;
};
