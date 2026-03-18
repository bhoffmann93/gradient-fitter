import { SOLVER_STEPS } from '../config.js';

export const computeWeightedTValues = (colors) => {
  const areas = colors.map((c) => (c.area > 0 ? c.area : 1));
  const total = areas.reduce((a, b) => a + b, 0);
  let cum = 0;
  return colors.map((_, i) => {
    const t = (cum + areas[i] / 2) / total;
    cum += areas[i];
    return t;
  });
};

export const solveCosineParams = (samples, steps = SOLVER_STEPS, lockFreq = false, tValues = null) => {
  const solveChannel = (accessor) => {
    let bestParams = { brightness: 0.5, contrast: 0.5, frequency: 1.0, phase: 0.0 };
    let bestError = Infinity;

    const cCandidates = lockFreq ? [1, 2, 3] : null;

    const calcError = (p) => {
      let err = 0;
      for (let i = 0; i < samples.length; i++) {
        const t = tValues ? tValues[i] : i / (samples.length - 1);
        const predicted = p.brightness + p.contrast * Math.cos(2 * Math.PI * (p.frequency * t + p.phase));
        err += (accessor(samples[i]) - predicted) ** 2;
      }
      return err;
    };

    for (let r = 0; r < (cCandidates ? 3 : 50); r++) {
      const p = {
        brightness: cCandidates ? 0.5 : Math.random(),
        contrast:   cCandidates ? 0.3 : Math.random(),
        frequency:  cCandidates ? cCandidates[r] : 0.5 + Math.random() * 3.0,
        phase:      cCandidates ? 0.0 : Math.random(),
      };
      let err = calcError(p);
      let lr = 0.1;
      let cur = p;
      for (let i = 0; i < 200; i++) {
        const candidate = {
          brightness: cur.brightness + (Math.random() - 0.5) * lr,
          contrast:   cur.contrast   + (Math.random() - 0.5) * lr,
          frequency:  lockFreq ? cur.frequency : cur.frequency + (Math.random() - 0.5) * lr,
          phase:      cur.phase      + (Math.random() - 0.5) * lr,
        };
        const cErr = calcError(candidate);
        if (cErr < err) { cur = candidate; err = cErr; }
      }
      if (err < bestError) { bestError = err; bestParams = cur; }
    }

    let p = bestParams;
    let err = bestError;
    let lr = 0.05;
    for (let i = 0; i < steps; i++) {
      if (i % 500 === 0) lr *= 0.8;
      const candidate = {
        brightness: p.brightness + (Math.random() - 0.5) * lr,
        contrast:   p.contrast   + (Math.random() - 0.5) * lr,
        frequency:  lockFreq ? p.frequency : p.frequency + (Math.random() - 0.5) * lr * 0.5,
        phase:      p.phase      + (Math.random() - 0.5) * lr,
      };
      const cErr = calcError(candidate);
      if (cErr < err) { p = candidate; err = cErr; }
    }
    return p;
  };

  return {
    r: solveChannel((s) => s.r),
    g: solveChannel((s) => s.g),
    b: solveChannel((s) => s.b),
  };
};
