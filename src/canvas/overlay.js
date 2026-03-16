import { OVERLAY_LINE_WIDTH, OVERLAY_LINE_OUTLINE, OVERLAY_NODE_RADIUS, OVERLAY_NODE_RADIUS_HOVER, OVERLAY_NODE_OUTLINE, OVERLAY_NODE_RING } from '../config.js';

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const drawOverlay = (uiCanvas, sourceCanvas, p1, p2, hoveredPoint = null) => {
  if (!uiCanvas || !sourceCanvas) return;
  const w = uiCanvas.width;
  const h = uiCanvas.height;
  const ctx = uiCanvas.getContext('2d');

  // s converts target CSS pixels → canvas pixels so sizes stay visually consistent
  // regardless of image resolution or aspect ratio
  const displayedW = uiCanvas.offsetWidth || w;
  const s = w / displayedW;

  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(sourceCanvas, 0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, 0, w, h);

  const x1 = p1.x * w, y1 = p1.y * h;
  const x2 = p2.x * w, y2 = p2.y * h;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = 'white';
  ctx.lineWidth = OVERLAY_LINE_OUTLINE * s;
  ctx.stroke();
  ctx.strokeStyle = cssVar('--accent');
  ctx.lineWidth = OVERLAY_LINE_WIDTH * s;
  ctx.stroke();

  const drawNode = (x, y, color, hovered) => {
    if (hovered) {
      ctx.beginPath();
      ctx.arc(x, y, OVERLAY_NODE_RING * s, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 * s;
      ctx.globalAlpha = 0.35;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.arc(x, y, (hovered ? OVERLAY_NODE_RADIUS_HOVER : OVERLAY_NODE_RADIUS) * s, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = OVERLAY_NODE_OUTLINE * s;
    ctx.stroke();
  };
  drawNode(x1, y1, cssVar('--accent'), hoveredPoint === 'p1');
  drawNode(x2, y2, cssVar('--accent'), hoveredPoint === 'p2');
  ctx.restore();
};
