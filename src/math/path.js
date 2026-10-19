// Sampling paths for line mode. Points are stored normalized (0–1 per axis);
// all geometry happens in pixel space so arcs and circles stay round on non-square images.

export const PATH_SHAPES = ['line', 'curve', 'arc', 'circle'];

// Draggable handles per shape. For 'circle', p1 is the center and p2 the radius/start handle.
export const PATH_HANDLES = {
  line: ['p1', 'p2'],
  curve: ['p1', 'c', 'p2'],
  arc: ['p1', 'c', 'p2'],
  circle: ['p1', 'p2'],
};

const TAU = Math.PI * 2;
const ARC_LENGTH_SEGMENTS = 128;
const HANDLE_NUDGE = 0.05;

const toPx = (p, w, h) => ({ x: p.x * w, y: p.y * h });
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const clampPoint = (p) => ({ x: clamp01(p.x), y: clamp01(p.y) });
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// Circle through a, m, b, swept from a to b via m. Returns null when the points are (nearly) collinear.
const threePointArc = (a, m, b) => {
  const d = 2 * (a.x * (m.y - b.y) + m.x * (b.y - a.y) + b.x * (a.y - m.y));
  const chord2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (Math.abs(d) < 1e-4 * chord2 || chord2 === 0) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const m2 = m.x * m.x + m.y * m.y;
  const b2 = b.x * b.x + b.y * b.y;
  const cx = (a2 * (m.y - b.y) + m2 * (b.y - a.y) + b2 * (a.y - m.y)) / d;
  const cy = (a2 * (b.x - m.x) + m2 * (a.x - b.x) + b2 * (m.x - a.x)) / d;
  const r = Math.hypot(a.x - cx, a.y - cy);
  const norm = (x) => ((x % TAU) + TAU) % TAU;
  const a0 = Math.atan2(a.y - cy, a.x - cx);
  let sweep = norm(Math.atan2(b.y - cy, b.x - cx) - a0);
  if (norm(Math.atan2(m.y - cy, m.x - cx) - a0) > sweep) sweep -= TAU;
  return (t) => ({ x: cx + r * Math.cos(a0 + sweep * t), y: cy + r * Math.sin(a0 + sweep * t) });
};

// Raw parametric curve in pixel space; t is not necessarily uniform along the path.
const rawCurve = (shape, points, w, h) => {
  const a = toPx(points.p1, w, h);
  const b = toPx(points.p2, w, h);
  if (shape === 'curve') {
    const c = toPx(points.c, w, h);
    return (t) => {
      const u = 1 - t;
      return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
    };
  }
  if (shape === 'arc') {
    const arc = threePointArc(a, toPx(points.c, w, h), b);
    if (arc) return arc;
  }
  if (shape === 'circle') {
    const r = Math.hypot(b.x - a.x, b.y - a.y);
    const a0 = Math.atan2(b.y - a.y, b.x - a.x);
    return (t) => ({ x: a.x + r * Math.cos(a0 + TAU * t), y: a.y + r * Math.sin(a0 + TAU * t) });
  }
  return (t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
};

// Arc-length parameterized path: pointAt(s) with s in [0,1] moves at constant speed along the curve.
export const makePath = (shape, points, w, h) => {
  const raw = rawCurve(shape, points, w, h);
  const lengths = new Float64Array(ARC_LENGTH_SEGMENTS + 1);
  let prev = raw(0);
  for (let i = 1; i <= ARC_LENGTH_SEGMENTS; i++) {
    const p = raw(i / ARC_LENGTH_SEGMENTS);
    lengths[i] = lengths[i - 1] + Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  const length = lengths[ARC_LENGTH_SEGMENTS];

  const pointAt = (s) => {
    if (length === 0) return raw(s);
    const target = s * length;
    let lo = 0,
      hi = ARC_LENGTH_SEGMENTS;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (lengths[mid] < target) lo = mid;
      else hi = mid;
    }
    const seg = lengths[hi] - lengths[lo];
    const f = seg > 0 ? (target - lengths[lo]) / seg : 0;
    return raw((lo + f) / ARC_LENGTH_SEGMENTS);
  };

  return { pointAt, length };
};

// Bilinear RGB lookup at pixel-space position (x, y); pixel centers sit at i + 0.5.
export const sampleBilinear = (data, w, h, x, y) => {
  const fx = Math.max(0, Math.min(w - 1, x - 0.5));
  const fy = Math.max(0, Math.min(h - 1, y - 0.5));
  const x0 = Math.floor(fx),
    y0 = Math.floor(fy);
  const x1 = Math.min(w - 1, x0 + 1),
    y1 = Math.min(h - 1, y0 + 1);
  const tx = fx - x0,
    ty = fy - y0;
  const i00 = (y0 * w + x0) * 4,
    i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4,
    i11 = (y1 * w + x1) * 4;
  const ch = (o) => {
    const top = data[i00 + o] * (1 - tx) + data[i10 + o] * tx;
    const bottom = data[i01 + o] * (1 - tx) + data[i11 + o] * tx;
    return (top * (1 - ty) + bottom * ty) / 255;
  };
  return { r: ch(0), g: ch(1), b: ch(2) };
};

// Midpoint of p1–p2, pushed slightly sideways so a new handle starts nearly straight but grabbable.
const nudgedMidpoint = (p1, p2, w, h) => {
  const m = midpoint(p1, p2);
  const dx = (p2.x - p1.x) * w,
    dy = (p2.y - p1.y) * h;
  return clampPoint({ x: m.x + (-dy * HANDLE_NUDGE) / w, y: m.y + (dx * HANDLE_NUDGE) / h });
};

// Carry the handles over when switching shape so the path stays roughly where it was.
export const convertPoints = (from, to, points, w, h) => {
  let { p1, p2, c } = points;
  if (from === 'circle' && to !== 'circle') {
    // Diameter through the start handle
    p1 = clampPoint({ x: 2 * p1.x - p2.x, y: 2 * p1.y - p2.y });
  } else if (to === 'circle' && from !== 'circle') {
    const m = midpoint(p1, p2);
    p2 = { x: m.x + (p2.x - m.x) / 2, y: m.y + (p2.y - m.y) / 2 };
    p1 = m;
  }
  if (to === 'curve' || to === 'arc') {
    const m = midpoint(p1, p2);
    if (from === 'curve' && to === 'arc') {
      // Quadratic bezier apex at t=0.5 is halfway between the chord midpoint and the control point
      c = { x: m.x + (c.x - m.x) / 2, y: m.y + (c.y - m.y) / 2 };
    } else if (from === 'arc' && to === 'curve') {
      c = clampPoint({ x: m.x + (c.x - m.x) * 2, y: m.y + (c.y - m.y) * 2 });
    } else {
      c = nudgedMidpoint(p1, p2, w, h);
    }
  }
  return { p1, p2, c };
};
