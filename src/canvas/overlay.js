const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const drawOverlay = (uiCanvas, sourceCanvas, p1, p2) => {
  if (!uiCanvas || !sourceCanvas) return;
  const dpr = window.devicePixelRatio || 1;
  const lw = uiCanvas.width / dpr;
  const lh = uiCanvas.height / dpr;
  const ctx = uiCanvas.getContext('2d');

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, lw, lh);
  ctx.drawImage(sourceCanvas, 0, 0, lw, lh);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, 0, lw, lh);

  const x1 = p1.x * lw, y1 = p1.y * lh;
  const x2 = p2.x * lw, y2 = p2.y * lh;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = cssVar('--accent');
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const drawNode = (x, y, color) => {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };
  drawNode(x1, y1, '#22c55e');
  drawNode(x2, y2, '#ef4444');
  ctx.restore();
};
