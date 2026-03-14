import { GRAPH_Y_MIN, GRAPH_Y_MAX } from '../config.js';
import { evalColor } from '../fit/index.js';

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const drawGraph = (canvas, samples, coeffs, mode) => {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth || 500;
  const H = canvas.clientHeight || 224;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const Y_RANGE = GRAPH_Y_MAX - GRAPH_Y_MIN;
  const mapY = (v) => H - ((v - GRAPH_Y_MIN) / Y_RANGE) * H;
  const mapX = (t) => t * W;

  ctx.clearRect(0, 0, W, H);

  const borderColor = cssVar('--border');
  const textMuted = cssVar('--text-muted');

  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  ctx.fillRect(0, 0, W, mapY(1.0));
  ctx.fillRect(0, mapY(0.0), W, H - mapY(0.0));

  const gridLines = [
    { v: 1.25, label: null, major: false },
    { v: 1.0,  label: '1.0', major: true },
    { v: 0.75, label: null,  major: false },
    { v: 0.5,  label: '0.5', major: false },
    { v: 0.25, label: null,  major: false },
    { v: 0.0,  label: '0.0', major: true },
    { v: -0.25, label: null, major: false },
  ];

  gridLines.forEach(({ v, label, major }) => {
    const y = mapY(v);
    ctx.beginPath();
    ctx.moveTo(label ? 30 : 0, y);
    ctx.lineTo(W, y);
    ctx.strokeStyle = major ? borderColor : `${borderColor}88`;
    ctx.lineWidth = major ? 1 : 0.5;
    ctx.stroke();
    if (label) {
      ctx.fillStyle = textMuted;
      ctx.font = '10px Basier Square, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(label, 26, y + 3.5);
    }
  });

  const drawData = (fn, color) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.2;
    samples.forEach((s, i) => {
      const t = i / (samples.length - 1);
      if (i === 0) ctx.moveTo(mapX(t), mapY(fn(s)));
      else ctx.lineTo(mapX(t), mapY(fn(s)));
    });
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  };
  drawData((s) => s.r, '#ef4444');
  drawData((s) => s.g, '#22c55e');
  drawData((s) => s.b, '#3b82f6');

  if (samples.length <= 12) {
    ['r', 'g', 'b'].forEach((ch, ci) => {
      const color = ['#ef4444', '#22c55e', '#3b82f6'][ci];
      samples.forEach((s, i) => {
        const t = i / (samples.length - 1);
        ctx.beginPath();
        ctx.arc(mapX(t), mapY(s[ch]), 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
    });
  }

  const drawFit = (channel, color) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    for (let x = 0; x <= W; x++) {
      const c = evalColor(coeffs, x / W, mode);
      if (x === 0) ctx.moveTo(x, mapY(c[channel]));
      else ctx.lineTo(x, mapY(c[channel]));
    }
    ctx.stroke();
  };
  drawFit('r', '#dc2626');
  drawFit('g', '#16a34a');
  drawFit('b', '#2563eb');
};
