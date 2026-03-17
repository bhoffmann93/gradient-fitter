import { evalColor } from '../fit/index.js';

const renderToCanvas = (canvas, coeffs, mode, linearLight = false) => {
  const dpr = window.devicePixelRatio || 1;
  const w = (canvas.clientWidth || 500) * dpr;
  const h = (canvas.clientHeight || 64) * dpr;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
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

export const renderGradientPreview = renderToCanvas;
