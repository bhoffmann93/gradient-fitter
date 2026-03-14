import { KMEANS_RUNS } from '../config.js';

export const generativeKMeans = (pixels, k, runs = KMEANS_RUNS) => {
  const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

  const kmeans = (initCentroids) => {
    let centroids = initCentroids.map((c) => [...c]);
    for (let iter = 0; iter < 20; iter++) {
      const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
      for (const px of pixels) {
        let best = 0, bestD = Infinity;
        for (let j = 0; j < k; j++) {
          const d = dist2(px, centroids[j]);
          if (d < bestD) { bestD = d; best = j; }
        }
        sums[best][0] += px[0]; sums[best][1] += px[1];
        sums[best][2] += px[2]; sums[best][3]++;
      }
      let moved = false;
      for (let j = 0; j < k; j++) {
        if (sums[j][3] > 0) {
          const next = [sums[j][0] / sums[j][3], sums[j][1] / sums[j][3], sums[j][2] / sums[j][3]];
          if (dist2(next, centroids[j]) > 1) moved = true;
          centroids[j] = next;
        }
      }
      if (!moved) break;
    }
    return centroids;
  };

  const score = (centroids) => {
    let spread = 0;
    for (let i = 0; i < centroids.length; i++)
      for (let j = i + 1; j < centroids.length; j++) spread += Math.sqrt(dist2(centroids[i], centroids[j]));
    const lums = centroids.map((c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]);
    return spread + (Math.max(...lums) - Math.min(...lums)) * 200;
  };

  const allRuns = [];
  for (let r = 0; r < runs; r++) {
    const inits = [pixels[Math.floor(Math.random() * pixels.length)]];
    for (let i = 1; i < k; i++) {
      const weights = pixels.map((px) => Math.min(...inits.map((c) => dist2(px, c))));
      const total = weights.reduce((a, b) => a + b, 0);
      let rand = Math.random() * total;
      let chosen = pixels[pixels.length - 1];
      for (let j = 0; j < pixels.length; j++) {
        rand -= weights[j];
        if (rand <= 0) { chosen = pixels[j]; break; }
      }
      inits.push(chosen);
    }
    const result = kmeans(inits);
    allRuns.push({ result, score: score(result) });
  }

  const best = allRuns.reduce((b, r) => (r.score > b.score ? r : b));
  const sizes = new Array(k).fill(0);
  for (const px of pixels) {
    let bi = 0, bd = Infinity;
    for (let j = 0; j < k; j++) {
      const d = dist2(px, best.result[j]);
      if (d < bd) { bd = d; bi = j; }
    }
    sizes[bi]++;
  }
  return best.result.map((c, i) => ({ centroid: c, area: sizes[i] / pixels.length }));
};
