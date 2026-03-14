import { extractColors } from 'extract-colors';
import { COLORMIND_API_URL, COLORMIND_LIST_URL, API_SEED_PIXEL_SAMPLE } from '../config.js';

export const fetchColormindModels = async () => {
  const res = await fetch(COLORMIND_LIST_URL);
  const data = await res.json();
  return data.result ?? [];
};

export const generateColormindPalette = async (imageData, { model, seedCount, cachedSeeds }) => {
  let seeds = cachedSeeds;
  if (!seeds) {
    const raw = await extractColors(imageData, { pixels: API_SEED_PIXEL_SAMPLE, distance: 0.2 });
    seeds = raw.slice(0, 4).map((c) => [c.red, c.green, c.blue]);
  }
  const usedCount = Math.min(seedCount, seeds.length);
  const input = [...seeds.slice(0, usedCount), ...Array(5 - usedCount).fill('N')];
  const res = await fetch(COLORMIND_API_URL, {
    method: 'POST',
    body: JSON.stringify({ model, input }),
  });
  if (!res.ok) throw new Error(`Colormind API error ${res.status}`);
  const json = await res.json();
  if (!json.result) throw new Error('Unexpected Colormind response');
  return {
    seeds,
    colors: json.result.map(([r, g, b]) => ({
      r: r / 255, g: g / 255, b: b / 255,
      lum: 0.299 * r + 0.587 * g + 0.114 * b,
      area: 1,
    })),
  };
};
