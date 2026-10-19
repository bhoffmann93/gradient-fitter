import { OVERLAY_LINE_WIDTH, OVERLAY_LINE_OUTLINE, OVERLAY_NODE_RADIUS, OVERLAY_NODE_RADIUS_HOVER, OVERLAY_NODE_OUTLINE } from '../config.js';
import { makePath, PATH_HANDLES } from '../math/path.js';

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const PATH_DRAW_STEPS = 128;

export const drawOverlay = (uiCanvas, sourceCanvas, shape, points, hoveredPoint = null) => {
  if (!uiCanvas || !sourceCanvas) return;
  const w = uiCanvas.width;
  const h = uiCanvas.height;
  const ctx = uiCanvas.getContext('2d');

  // s converts target CSS pixels → canvas pixels so sizes stay visually consistent
  // regardless of image resolution or aspect ratio
  const displayedW = uiCanvas.offsetWidth || w;
  const s = w / displayedW;
  const accent = cssVar('--accent');

  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(sourceCanvas, 0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, 0, w, h);

  const px = (p) => [p.x * w, p.y * h];

  // Faint helper lines: bezier control arms, circle radius
  const helpers =
    shape === 'curve'
      ? [[points.p1, points.c], [points.c, points.p2]]
      : shape === 'circle'
        ? [[points.p1, points.p2]]
        : [];
  if (helpers.length) {
    ctx.beginPath();
    for (const [a, b] of helpers) {
      ctx.moveTo(...px(a));
      ctx.lineTo(...px(b));
    }
    ctx.setLineDash([4 * s, 4 * s]);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const path = makePath(shape, points, w, h);
  ctx.beginPath();
  for (let i = 0; i <= PATH_DRAW_STEPS; i++) {
    const p = path.pointAt(i / PATH_DRAW_STEPS);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'white';
  ctx.lineWidth = OVERLAY_LINE_OUTLINE * s;
  ctx.stroke();
  ctx.strokeStyle = accent;
  ctx.lineWidth = OVERLAY_LINE_WIDTH * s;
  ctx.stroke();

  const drawNode = ([x, y], fill, stroke, hovered) => {
    ctx.beginPath();
    ctx.arc(x, y, (hovered ? OVERLAY_NODE_RADIUS_HOVER : OVERLAY_NODE_RADIUS) * s, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = OVERLAY_NODE_OUTLINE * s;
    ctx.stroke();
  };
  // Endpoints use the accent color; shape handles (bezier control, arc bulge, circle center) are white with an accent ring
  const isShapeHandle = (name) => name === 'c' || (shape === 'circle' && name === 'p1');
  for (const name of PATH_HANDLES[shape]) {
    const handle = isShapeHandle(name);
    drawNode(px(points[name]), handle ? 'white' : accent, handle ? accent : 'white', hoveredPoint === name);
  }
  ctx.restore();
};
