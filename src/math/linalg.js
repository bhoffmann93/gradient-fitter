export const solveLinearSystem = (A, b) => {
  const n = b.length;
  const M = A.map((row) => [...row]);
  const v = [...b];

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
    }
    [M[i], M[maxRow]] = [M[maxRow], M[i]];
    [v[i], v[maxRow]] = [v[maxRow], v[i]];

    for (let k = i + 1; k < n; k++) {
      const factor = M[k][i] / M[i][i];
      v[k] -= factor * v[i];
      for (let j = i; j < n; j++) M[k][j] -= factor * M[i][j];
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) sum += M[i][j] * x[j];
    x[i] = (v[i] - sum) / M[i][i];
  }
  return x;
};
