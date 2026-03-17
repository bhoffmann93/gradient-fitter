import { solveLinearSystem } from './linalg.js';

export const fitPolynomial = (samples, deg, tValues = null) => {
  const N = Math.min(deg + 1, samples.length);
  const ATA = Array(N).fill(0).map(() => Array(N).fill(0));
  const ATb = { r: Array(N).fill(0), g: Array(N).fill(0), b: Array(N).fill(0) };

  for (let i = 0; i < samples.length; i++) {
    const t = tValues ? tValues[i] : i / (samples.length - 1);
    const powers = Array.from({ length: N }, (_, p) => Math.pow(t, p));
    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) ATA[row][col] += powers[row] * powers[col];
      ATb.r[row] += powers[row] * samples[i].r;
      ATb.g[row] += powers[row] * samples[i].g;
      ATb.b[row] += powers[row] * samples[i].b;
    }
  }

  return {
    r: solveLinearSystem(ATA, ATb.r),
    g: solveLinearSystem(ATA, ATb.g),
    b: solveLinearSystem(ATA, ATb.b),
  };
};
