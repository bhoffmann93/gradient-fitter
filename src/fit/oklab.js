import { converter } from 'culori';

const toOklabC = converter('oklab');
const toRgbC = converter('rgb');

// OKLab channels are stored in the r/g/b slots (r = L, g = a, b = b) so the
// per-channel fitters work unchanged
export const toOklab = (c) => {
  const { l, a, b } = toOklabC({ mode: 'rgb', r: c.r, g: c.g, b: c.b });
  return { r: l, g: a, b, lum: c.lum };
};

// Not clamped, so out-of-gamut overshoot stays visible in the graph
export const fromOklab = (c) => {
  const { r, g, b } = toRgbC({ mode: 'oklab', l: c.r, a: c.g, b: c.b });
  return { r, g, b };
};

// Björn Ottosson's OKLab → linear sRGB, then the exact sRGB transfer function.
// Scalar form (no mat3) so the regex-based HLSL conversion stays valid.
// Constants match culori so the preview and the shader agree.
export const OKLAB_TO_SRGB_GLSL = `float srgbTransfer(float c) {
    return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1.0 / 2.4) - 0.055;
}

// OKLab -> sRGB, https://bottosson.github.io/posts/oklab/
vec3 oklabToSrgb(vec3 lab) {
    float l_ = lab.x + 0.3963377773761749 * lab.y + 0.2158037573099136 * lab.z;
    float m_ = lab.x - 0.1055613458156586 * lab.y - 0.0638541728258133 * lab.z;
    float s_ = lab.x - 0.0894841775298119 * lab.y - 1.2914855480194092 * lab.z;
    float l = l_ * l_ * l_;
    float m = m_ * m_ * m_;
    float s = s_ * s_ * s_;
    vec3 lin = vec3(
         4.0767416360759574 * l - 3.3077115392580616 * m + 0.2309699031821044 * s,
        -1.2684379732850317 * l + 2.6097573492876887 * m - 0.3413193760026573 * s,
        -0.0041960761386756 * l - 0.7034186179359362 * m + 1.7076146940746117 * s);
    lin = clamp(lin, 0.0, 1.0);
    return vec3(srgbTransfer(lin.x), srgbTransfer(lin.y), srgbTransfer(lin.z));
}`;

export const buildOklabToSrgbJS = (ts = false) => {
  const num = ts ? ': number' : '';
  const tuple = ts ? ': [number, number, number]' : '';
  return [
    `// OKLab -> sRGB, https://bottosson.github.io/posts/oklab/`,
    `function oklabToSrgb(L${num}, A${num}, B${num})${tuple} {`,
    `  const l = (L + 0.3963377773761749 * A + 0.2158037573099136 * B) ** 3;`,
    `  const m = (L - 0.1055613458156586 * A - 0.0638541728258133 * B) ** 3;`,
    `  const s = (L - 0.0894841775298119 * A - 1.2914855480194092 * B) ** 3;`,
    `  const lin = [`,
    `    4.0767416360759574 * l - 3.3077115392580616 * m + 0.2309699031821044 * s,`,
    `    -1.2684379732850317 * l + 2.6097573492876887 * m - 0.3413193760026573 * s,`,
    `    -0.0041960761386756 * l - 0.7034186179359362 * m + 1.7076146940746117 * s,`,
    `  ];`,
    `  return lin.map((v) => {`,
    `    const c = Math.min(1, Math.max(0, v));`,
    `    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;`,
    `  })${ts ? ' as [number, number, number]' : ''};`,
    `}`,
  ].join('\n');
};
