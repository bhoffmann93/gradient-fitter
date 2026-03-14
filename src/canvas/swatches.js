import { evalColor } from '../fit/index.js';

export const drawSwatches = (canvas, colors) => {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const sw = w / colors.length;
  ctx.clearRect(0, 0, w, h);
  colors.forEach((c, i) => {
    ctx.fillStyle = `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`;
    ctx.fillRect(Math.floor(i * sw), 0, Math.ceil(sw), h);
  });
};

export const drawPaletteGradient = (canvas, coeffs, mode, linearLight = false) => {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const imageData = ctx.createImageData(w, h);
  for (let x = 0; x < w; x++) {
    const c = evalColor(coeffs, x / (w - 1), mode, linearLight);
    const r = Math.max(0, Math.min(1, c.r)) * 255;
    const g = Math.max(0, Math.min(1, c.g)) * 255;
    const b = Math.max(0, Math.min(1, c.b)) * 255;
    for (let y = 0; y < h; y++) {
      const idx = (y * w + x) * 4;
      imageData.data[idx] = r;
      imageData.data[idx + 1] = g;
      imageData.data[idx + 2] = b;
      imageData.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
};
