import { extractColors } from 'extract-colors';
import { generativeKMeans } from '../math/kmeans.js';
import { DOMINANT_PIXEL_SAMPLE, GENERATIVE_PIXEL_SAMPLE } from '../config.js';

const toLinearColor = (r, g, b, area = 1) => ({
  r: r / 255,
  g: g / 255,
  b: b / 255,
  lum: 0.299 * r + 0.587 * g + 0.114 * b,
  area,
});

export const extractDominant = async (imageData, colorCount) => {
  const raw = await extractColors(imageData, {
    pixels: DOMINANT_PIXEL_SAMPLE,
    distance: 0.12,
    colorValidator: (r, g, b, a = 255) => a > 50,
    saturationDistance: 0.2,
    lightnessDistance: 0.2,
    hueDistance: 0.083,
  });
  const top = raw.slice(0, colorCount);
  if (top.length < 2) throw new Error('Not enough distinct colors found.');
  return top.map((c) => toLinearColor(c.red, c.green, c.blue, c.area ?? 1));
};

export const extractGenerative = (imageData, colorCount) => {
  const data = imageData.data;
  const totalPixels = imageData.width * imageData.height;
  const sampleSize = Math.min(GENERATIVE_PIXEL_SAMPLE, totalPixels);
  const pixels = [];
  const indices = Array.from({ length: totalPixels }, (_, i) => i);
  for (let i = 0; i < sampleSize; i++) {
    const j = i + Math.floor(Math.random() * (totalPixels - i));
    [indices[i], indices[j]] = [indices[j], indices[i]];
    const idx = indices[i] * 4;
    if (data[idx + 3] > 50) pixels.push([data[idx], data[idx + 1], data[idx + 2]]);
  }
  if (pixels.length < colorCount) throw new Error('Not enough pixels to sample.');
  return generativeKMeans(pixels, colorCount).map(({ centroid: c, area }) =>
    toLinearColor(c[0], c[1], c[2], area)
  );
};
