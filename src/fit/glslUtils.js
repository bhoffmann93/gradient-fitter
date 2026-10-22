export const fmtGlsl = (n, digits = 3) => {
  const s = n.toFixed(digits);
  return s.indexOf('.') === -1 ? s + '.0' : s;
};
