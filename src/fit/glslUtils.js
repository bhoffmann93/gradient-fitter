export const fmtGlsl = (n) => {
  const s = n.toFixed(3);
  return s.indexOf('.') === -1 ? s + '.0' : s;
};
