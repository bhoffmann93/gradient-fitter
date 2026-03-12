import React from 'react';
import { extractColors } from 'extract-colors';
import { Upload, Activity, Code, Zap, AlertCircle, MousePointer2, Eye, RefreshCw, Sliders, Palette, Shuffle } from 'lucide-react';

const App = () => {
  const [imageSrc, setImageSrc] = React.useState(null);

  // Top-level workflow mode
  const [appMode, setAppMode] = React.useState('line'); // 'line' | 'palette'

  // Fitting State (line mode)
  const [fitMode, setFitMode] = React.useState('poly'); // 'poly' or 'cosine'
  const [degree, setDegree] = React.useState(3);
  const [solverSteps] = React.useState(5000);

  // Palette Mode State
  const [colorCount, setColorCount] = React.useState(7);
  const [lockFrequency, setLockFrequency] = React.useState(true);
  const [extractedColors, setExtractedColors] = React.useState([]);
  const [paletteMethod, setPaletteMethod] = React.useState('dominant'); // 'dominant' | 'generative' | 'api'
  const [paletteFitMode, setPaletteFitMode] = React.useState('cosine'); // 'cosine' | 'poly'
  // Holds the last fitted result for palette mode so canvas effects can redraw after commit
  const [paletteDrawData, setPaletteDrawData] = React.useState(null);
  // Colormind API
  const [apiModel, setApiModel] = React.useState('default');
  const [apiModels, setApiModels] = React.useState(['default', 'ui']);
  const apiSeedsRef = React.useRef(null); // cached seeds so regenerate only re-POSTs
  const paletteGradientRef = React.useRef(null);
  const paletteSwatchRef = React.useRef(null);

  // Image Processing State
  const [contrast, setContrast] = React.useState(1.0);
  const [minLevel, setMinLevel] = React.useState(0);
  const [maxLevel, setMaxLevel] = React.useState(255);

  // Results
  const [coefficients, setCoefficients] = React.useState(null);
  const [glslCode, setGlslCode] = React.useState('');
  const [error, setError] = React.useState(null);
  const [status, setStatus] = React.useState('idle');

  // Line Sampling Points
  const [p1, setP1] = React.useState({ x: 0.05, y: 0.5 });
  const [p2, setP2] = React.useState({ x: 0.95, y: 0.5 });
  const [activePoint, setActivePoint] = React.useState(null);

  // Refs
  const originalDataRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const uiCanvasRef = React.useRef(null);
  const graphRef = React.useRef(null);
  const shaderCanvasRef = React.useRef(null);

  // --- Math Logic: Linear Solver (Polynomials) ---
  const solveLinearSystem = (A, b) => {
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
        for (let j = i; j < n; j++) {
          M[k][j] -= factor * M[i][j];
        }
      }
    }

    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < n; j++) {
        sum += M[i][j] * x[j];
      }
      x[i] = (v[i] - sum) / M[i][i];
    }
    return x;
  };

  // --- Math Logic: Polynomial Solver ---
  const fitPolynomial = (samples, deg) => {
    const N = deg + 1;
    const ATA = Array(N).fill(0).map(() => Array(N).fill(0));
    const ATb = { r: Array(N).fill(0), g: Array(N).fill(0), b: Array(N).fill(0) };
    for (let i = 0; i < samples.length; i++) {
      const t = i / (samples.length - 1);
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

  // --- Math Logic: Iterative Solver (Cosine) ---
  const solveCosineParams = (samples, steps, lockFreq = false) => {
    const solveChannel = (accessor) => {
      let bestParams = { a: 0.5, b: 0.5, c: 1.0, d: 0.0 };
      let bestError = Infinity;

      // When locked, try integer c values 1, 2, 3
      const cCandidates = lockFreq ? [1, 2, 3] : null;

      const calcError = (p) => {
        let err = 0;
        for (let i = 0; i < samples.length; i++) {
          const t = i / (samples.length - 1);
          const actual = accessor(samples[i]);
          const predicted = p.a + p.b * Math.cos(2 * Math.PI * (p.c * t + p.d));
          err += (actual - predicted) ** 2;
        }
        return err;
      };

      const initialCs = cCandidates || Array.from({ length: 50 }, () => null);

      for (let r = 0; r < (cCandidates ? 3 : 50); r++) {
        const startP = {
          a: cCandidates ? 0.5 : Math.random(),
          b: cCandidates ? 0.3 : Math.random(),
          c: cCandidates ? cCandidates[r] : 0.5 + Math.random() * 3.0,
          d: cCandidates ? 0.0 : Math.random(),
        };

        let p = { ...startP };
        let err = calcError(p);
        let learningRate = 0.1;
        for (let i = 0; i < 200; i++) {
          const candidate = {
            a: p.a + (Math.random() - 0.5) * learningRate,
            b: p.b + (Math.random() - 0.5) * learningRate,
            c: lockFreq ? p.c : p.c + (Math.random() - 0.5) * learningRate,
            d: p.d + (Math.random() - 0.5) * learningRate,
          };
          const cErr = calcError(candidate);
          if (cErr < err) {
            p = candidate;
            err = cErr;
          }
        }
        if (err < bestError) {
          bestError = err;
          bestParams = p;
        }
      }

      let p = bestParams;
      let err = bestError;
      let lr = 0.05;

      for (let i = 0; i < steps; i++) {
        if (i % 500 === 0) lr *= 0.8;
        const candidate = {
          a: p.a + (Math.random() - 0.5) * lr,
          b: p.b + (Math.random() - 0.5) * lr,
          c: lockFreq ? p.c : p.c + (Math.random() - 0.5) * lr * 0.5,
          d: p.d + (Math.random() - 0.5) * lr,
        };
        const cErr = calcError(candidate);
        if (cErr < err) {
          p = candidate;
          err = cErr;
        }
      }
      return p;
    };

    return {
      r: solveChannel((s) => s.r),
      g: solveChannel((s) => s.g),
      b: solveChannel((s) => s.b),
    };
  };

  // --- Interaction Logic (Line Mode) ---
  const handleMouseDown = (e) => {
    if (!uiCanvasRef.current || !imageSrc || appMode !== 'line') return;
    const rect = uiCanvasRef.current.getBoundingClientRect();
    const mousePxX = e.clientX - rect.left;
    const mousePxY = e.clientY - rect.top;
    const hitRadius = 20;

    const p1PxX = p1.x * rect.width;
    const p1PxY = p1.y * rect.height;

    if (Math.hypot(mousePxX - p1PxX, mousePxY - p1PxY) < hitRadius) {
      setActivePoint('p1');
      return;
    }

    const p2PxX = p2.x * rect.width;
    const p2PxY = p2.y * rect.height;
    if (Math.hypot(mousePxX - p2PxX, mousePxY - p2PxY) < hitRadius) {
      setActivePoint('p2');
    }
  };

  const handleMouseMove = (e) => {
    if (!activePoint || !uiCanvasRef.current) return;
    const rect = uiCanvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    if (activePoint === 'p1') setP1({ x, y });
    else setP2({ x, y });
  };

  const handleMouseUp = () => {
    if (activePoint) {
      setActivePoint(null);
      performFitting();
    }
  };

  // --- Image Processing ---
  const applyImageFilters = () => {
    if (!originalDataRef.current || !canvasRef.current) return;

    const w = originalDataRef.current.width;
    const h = originalDataRef.current.height;
    const src = originalDataRef.current.data;

    const ctx = canvasRef.current.getContext('2d');
    const destImageData = ctx.createImageData(w, h);
    const dest = destImageData.data;

    const min = minLevel / 255;
    const max = maxLevel / 255;
    const range = max - min;
    const contrastFactor = contrast;

    for (let i = 0; i < src.length; i += 4) {
      let r = src[i] / 255;
      let g = src[i + 1] / 255;
      let b = src[i + 2] / 255;

      r = (r - 0.5) * contrastFactor + 0.5;
      g = (g - 0.5) * contrastFactor + 0.5;
      b = (b - 0.5) * contrastFactor + 0.5;

      if (range > 0.001) {
        r = (r - min) / range;
        g = (g - min) / range;
        b = (b - min) / range;
      } else {
        r = r >= min ? 1 : 0;
        g = g >= min ? 1 : 0;
        b = b >= min ? 1 : 0;
      }

      dest[i] = Math.max(0, Math.min(1, r)) * 255;
      dest[i + 1] = Math.max(0, Math.min(1, g)) * 255;
      dest[i + 2] = Math.max(0, Math.min(1, b)) * 255;
      dest[i + 3] = src[i + 3];
    }

    ctx.putImageData(destImageData, 0, 0);

    const uiCtx = uiCanvasRef.current.getContext('2d');
    uiCtx.putImageData(destImageData, 0, 0);

    if (appMode === 'line') {
      performFitting();
    } else {
      performPaletteFit();
    }
  };

  // --- Generative K-Means (colormind-style) ---
  // Runs k-means many times with random inits, scores each by perceptual spread, returns best.
  const generativeKMeans = (pixels, k, runs = 24) => {
    const dist2 = (a, b) => (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2;

    const kmeans = (initCentroids) => {
      let centroids = initCentroids.map(c => [...c]);
      for (let iter = 0; iter < 20; iter++) {
        const sums = Array.from({ length: k }, () => [0, 0, 0, 0]); // r,g,b,count
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
            const next = [sums[j][0]/sums[j][3], sums[j][1]/sums[j][3], sums[j][2]/sums[j][3]];
            if (dist2(next, centroids[j]) > 1) moved = true;
            centroids[j] = next;
          }
        }
        if (!moved) break;
      }
      return centroids;
    };

    // Score = sum of pairwise distances (spread) + luminance range coverage
    const score = (centroids) => {
      let spread = 0;
      for (let i = 0; i < centroids.length; i++)
        for (let j = i + 1; j < centroids.length; j++)
          spread += Math.sqrt(dist2(centroids[i], centroids[j]));
      const lums = centroids.map(c => 0.299*c[0] + 0.587*c[1] + 0.114*c[2]);
      const lumRange = Math.max(...lums) - Math.min(...lums);
      return spread + lumRange * 200; // weight luminance range
    };

    const allRuns = [];
    for (let r = 0; r < runs; r++) {
      // k-means++ random init
      const inits = [];
      inits.push(pixels[Math.floor(Math.random() * pixels.length)]);
      for (let i = 1; i < k; i++) {
        const weights = pixels.map(px => Math.min(...inits.map(c => dist2(px, c))));
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
    // Return the best-scoring run (variety comes from random pixel sampling upstream)
    return allRuns.reduce((best, r) => r.score > best.score ? r : best).result;
  };

  // --- Palette Extraction & Fitting ---
  const performPaletteFit = async () => {
    if (!canvasRef.current || !imageSrc) return;

    setStatus('processing');
    setError(null);

    try {
      const w = canvasRef.current.width;
      const h = canvasRef.current.height;
      const ctx = canvasRef.current.getContext('2d');
      const imageData = ctx.getImageData(0, 0, w, h);

      let withLuminance;

      if (paletteMethod === 'dominant') {
        // extract-colors: frequency-based dominant colors
        const rawColors = await extractColors(imageData, {
          pixels: 10000,
          distance: 0.12,
          colorValidator: (r, g, b, a = 255) => a > 50,
          saturationDistance: 0.2,
          lightnessDistance: 0.2,
          hueDistance: 0.083,
        });
        const topColors = rawColors.slice(0, colorCount);
        if (topColors.length < 2) throw new Error('Not enough distinct colors found.');
        withLuminance = topColors.map((c) => ({
          r: c.red / 255, g: c.green / 255, b: c.blue / 255,
          lum: 0.299 * c.red + 0.587 * c.green + 0.114 * c.blue,
        }));
      } else if (paletteMethod === 'api') {
        // Extract seeds from image only if we don't have them yet (new image / first run)
        if (!apiSeedsRef.current) {
          const seedRaw = await extractColors(imageData, { pixels: 5000, distance: 0.2 });
          const seedCount = Math.min(seedRaw.length, 4); // always leave ≥1 "N"
          apiSeedsRef.current = seedRaw.slice(0, seedCount).map(c => [c.red, c.green, c.blue]);
        }
        const input = [...apiSeedsRef.current, ...Array(5 - apiSeedsRef.current.length).fill('N')];
        const res = await fetch('http://colormind.io/api/', {
          method: 'POST',
          body: JSON.stringify({ model: apiModel, input }),
        });
        if (!res.ok) throw new Error('Colormind API error ' + res.status);
        const json = await res.json();
        if (!json.result) throw new Error('Unexpected Colormind response');
        withLuminance = json.result.map(([r, g, b]) => ({
          r: r / 255, g: g / 255, b: b / 255,
          lum: 0.299 * r + 0.587 * g + 0.114 * b,
        }));
      } else {
        // Generative: randomly sample a different pixel subset each call so
        // each regenerate emphasises different image regions (colormind approach)
        const data = imageData.data;
        const totalPixels = w * h;
        const sampleSize = Math.min(3000, totalPixels);
        const pixels = [];
        const indices = Array.from({ length: totalPixels }, (_, i) => i);
        for (let i = 0; i < sampleSize; i++) {
          const j = i + Math.floor(Math.random() * (totalPixels - i));
          [indices[i], indices[j]] = [indices[j], indices[i]];
          const idx = indices[i] * 4;
          if (data[idx + 3] > 50) pixels.push([data[idx], data[idx + 1], data[idx + 2]]);
        }
        if (pixels.length < colorCount) throw new Error('Not enough pixels to sample.');
        const centroids = generativeKMeans(pixels, colorCount);
        withLuminance = centroids.map((c) => ({
          r: c[0] / 255, g: c[1] / 255, b: c[2] / 255,
          lum: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2],
        }));
      }

      withLuminance.sort((a, b) => a.lum - b.lum);

      setExtractedColors(withLuminance);
      drawSwatches(withLuminance);

      // Fit both, primary determined by paletteFitMode
      const primaryResult = paletteFitMode === 'cosine'
        ? solveCosineParams(withLuminance, solverSteps, lockFrequency)
        : fitPolynomial(withLuminance, degree);
      setCoefficients(primaryResult);
      setGlslCode(buildGLSL(primaryResult, paletteFitMode) + '\n\n' + buildColorGLSL(withLuminance));
      drawGraph(withLuminance, primaryResult, paletteFitMode);
      renderGradientPreview(primaryResult, paletteFitMode);
      // Defer swatch/gradient canvas drawing to after React commits the DOM
      setPaletteDrawData({ colors: withLuminance, result: primaryResult, mode: paletteFitMode });
      setStatus('done');
    } catch (e) {
      console.error(e);
      setError(e.message || 'Error during palette extraction');
      setStatus('error');
    }
  };

  const shuffleColors = () => {
    if (extractedColors.length === 0) return;
    const shuffled = [...extractedColors].sort(() => Math.random() - 0.5);
    setExtractedColors(shuffled);
    const primaryResult = paletteFitMode === 'cosine'
      ? solveCosineParams(shuffled, solverSteps, lockFrequency)
      : fitPolynomial(shuffled, degree);
    setCoefficients(primaryResult);
    setGlslCode(buildGLSL(primaryResult, paletteFitMode) + '\n\n' + buildColorGLSL(shuffled));
    drawGraph(shuffled, primaryResult, paletteFitMode);
    renderGradientPreview(primaryResult, paletteFitMode);
    setPaletteDrawData({ colors: shuffled, result: primaryResult, mode: paletteFitMode });
  };

  const drawSwatches = (colors) => {
    if (!paletteSwatchRef.current) return;
    const canvas = paletteSwatchRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const sw = w / colors.length;

    ctx.clearRect(0, 0, w, h);
    colors.forEach((c, i) => {
      ctx.fillStyle = `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`;
      ctx.fillRect(Math.floor(i * sw), 0, Math.ceil(sw), h);
    });
  };

  const drawPaletteGradient = (coeffs, mode = 'cosine') => {
    if (!paletteGradientRef.current) return;
    const canvas = paletteGradientRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const imageData = ctx.createImageData(w, h);

    for (let x = 0; x < w; x++) {
      const t = x / (w - 1);
      const c = evalColor(coeffs, t, mode);
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

  // --- Line Fitting Pipeline ---
  const performFitting = () => {
    if (!canvasRef.current || !imageSrc) return;

    setStatus('processing');
    setError(null);

    setTimeout(() => {
      try {
        const ctx = canvasRef.current.getContext('2d');
        const w = canvasRef.current.width;
        const h = canvasRef.current.height;
        const data = ctx.getImageData(0, 0, w, h).data;

        const samples = [];
        const x1 = p1.x * w;
        const y1 = p1.y * h;
        const x2 = p2.x * w;
        const y2 = p2.y * h;
        const dist = Math.hypot(x2 - x1, y2 - y1);
        const numSteps = Math.max(2, Math.ceil(dist));

        for (let i = 0; i < numSteps; i++) {
          const t = i / (numSteps - 1);
          const px = Math.floor(x1 + (x2 - x1) * t);
          const py = Math.floor(y1 + (y2 - y1) * t);
          if (px >= 0 && px < w && py >= 0 && py < h) {
            const idx = (py * w + px) * 4;
            samples.push({
              r: data[idx] / 255,
              g: data[idx + 1] / 255,
              b: data[idx + 2] / 255,
            });
          }
        }

        if (samples.length < 2) throw new Error('Line too short');

        let result = null;

        if (fitMode === 'poly') {
          result = fitPolynomial(samples, degree);
        } else {
          result = solveCosineParams(samples, solverSteps);
        }

        setCoefficients(result);
        setGlslCode(buildGLSL(result, fitMode));
        drawGraph(samples, result, fitMode);
        renderGradientPreview(result, fitMode);
        drawOverlay();
        setStatus('done');
      } catch (e) {
        console.error(e);
        setError(e.message || 'Error during fitting');
        setStatus('error');
      }
    }, 10);
  };

  // --- GLSL Generation ---
  const buildColorGLSL = (colors) => {
    const fmt = (n) => n.toFixed(3);
    let code = `// Extracted colors (luminance sorted)\n`;
    colors.forEach((c, i) => {
      code += `vec3 color${i + 1} = vec3(${fmt(c.r)}, ${fmt(c.g)}, ${fmt(c.b)});\n`;
    });
    code += `\n// Array form\nvec3 palette[${colors.length}] = vec3[](\n`;
    code += colors.map((c, i) =>
      `    vec3(${fmt(c.r)}, ${fmt(c.g)}, ${fmt(c.b)})${i < colors.length - 1 ? ',' : ''}`
    ).join('\n');
    code += `\n);`;
    return code;
  };

  const buildGLSL = (coeffs, mode) => {
    const fmt = (n) => {
      let s = n.toFixed(3);
      return s.indexOf('.') === -1 ? s + '.0' : s;
    };
    const deg = coeffs.r.length ? coeffs.r.length - 1 : degree;

    if (mode === 'poly') {
      let code = `// Polynomial Gradient (Degree ${deg})\n`;
      code += `vec3 gradient(float t) {\n`;
      code += `    vec3 c0 = vec3(${fmt(coeffs.r[0])}, ${fmt(coeffs.g[0])}, ${fmt(coeffs.b[0])});\n`;
      for (let i = 1; i <= deg; i++) {
        code += `    vec3 c${i} = vec3(${fmt(coeffs.r[i])}, ${fmt(coeffs.g[i])}, ${fmt(coeffs.b[i])});\n`;
      }
      code += `\n    vec3 color = c0`;
      for (let i = 1; i <= deg; i++) {
        let tStr = i === 2 ? 't*t' : i === 3 ? 't*t*t' : i === 1 ? 't' : `pow(t, ${i}.0)`;
        code += `\n        + c${i} * ${tStr}`;
      }
      code += `;\n    return clamp(color, vec3(0.0), vec3(1.0));\n}`;
      return code;
    } else {
      let code = `// Cosine Gradient (Inigo Quilez style)\n// color(t) = a + b * cos( 2*pi * (c*t + d) )\n`;
      code += `vec3 palette(float t) {\n`;
      code += `    vec3 a = vec3(${fmt(coeffs.r.a)}, ${fmt(coeffs.g.a)}, ${fmt(coeffs.b.a)});\n`;
      code += `    vec3 b = vec3(${fmt(coeffs.r.b)}, ${fmt(coeffs.g.b)}, ${fmt(coeffs.b.b)});\n`;
      code += `    vec3 c = vec3(${fmt(coeffs.r.c)}, ${fmt(coeffs.g.c)}, ${fmt(coeffs.b.c)});\n`;
      code += `    vec3 d = vec3(${fmt(coeffs.r.d)}, ${fmt(coeffs.g.d)}, ${fmt(coeffs.b.d)});\n\n`;
      code += `    return a + b * cos( 6.28318 * (c * t + d) );\n}`;
      return code;
    }
  };

  // --- Visualization ---
  const evalColor = (coeffs, t, mode) => {
    if (mode === 'poly') {
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < coeffs.r.length; i++) {
        const term = Math.pow(t, i);
        r += coeffs.r[i] * term;
        g += coeffs.g[i] * term;
        b += coeffs.b[i] * term;
      }
      return { r, g, b };
    } else {
      const val = (p) => p.a + p.b * Math.cos(2 * Math.PI * (p.c * t + p.d));
      return { r: val(coeffs.r), g: val(coeffs.g), b: val(coeffs.b) };
    }
  };

  const renderGradientPreview = (coeffs, mode) => {
    if (!shaderCanvasRef.current) return;
    const ctx = shaderCanvasRef.current.getContext('2d');
    const w = shaderCanvasRef.current.width;
    const h = shaderCanvasRef.current.height;
    const imageData = ctx.createImageData(w, h);

    for (let x = 0; x < w; x++) {
      const t = x / w;
      const c = evalColor(coeffs, t, mode);
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

  const drawGraph = (samples, coeffs, mode) => {
    if (!graphRef.current) return;
    const ctx = graphRef.current.getContext('2d');
    const W = graphRef.current.width;
    const H = graphRef.current.height;

    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const y = i * (H / 4);
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();

    const mapY = (val) => H - val * H;
    const mapX = (t) => t * W;

    const drawData = (fn, color) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.25;
      samples.forEach((s, i) => {
        const t = i / (samples.length - 1);
        const y = mapY(fn(s));
        if (i === 0) ctx.moveTo(mapX(t), y);
        else ctx.lineTo(mapX(t), y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    };
    drawData((s) => s.r, '#ef4444');
    drawData((s) => s.g, '#22c55e');
    drawData((s) => s.b, '#3b82f6');

    // Draw sample dots for palette mode
    if (samples.length <= 12) {
      ['r', 'g', 'b'].forEach((ch, ci) => {
        const color = ['#ef4444', '#22c55e', '#3b82f6'][ci];
        samples.forEach((s, i) => {
          const t = i / (samples.length - 1);
          ctx.beginPath();
          ctx.arc(mapX(t), mapY(s[ch]), 3, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        });
      });
    }

    const drawFit = (channel, color) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      for (let x = 0; x <= W; x += 2) {
        const t = x / W;
        let val = 0;
        if (mode === 'poly') {
          const cs = coeffs[channel];
          for (let i = 0; i < cs.length; i++) val += cs[i] * Math.pow(t, i);
        } else {
          const p = coeffs[channel];
          val = p.a + p.b * Math.cos(2 * Math.PI * (p.c * t + p.d));
        }
        if (x === 0) ctx.moveTo(x, mapY(val));
        else ctx.lineTo(x, mapY(val));
      }
      ctx.stroke();
    };
    drawFit('r', '#dc2626');
    drawFit('g', '#16a34a');
    drawFit('b', '#2563eb');
  };

  const drawOverlay = () => {
    if (!uiCanvasRef.current || !canvasRef.current) return;
    const ctx = uiCanvasRef.current.getContext('2d');
    const w = uiCanvasRef.current.width;
    const h = uiCanvasRef.current.height;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(canvasRef.current, 0, 0, w, h);

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 0, w, h);

    const x1 = p1.x * w, y1 = p1.y * h;
    const x2 = p2.x * w, y2 = p2.y * h;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.stroke();

    const node = (x, y, c) => {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
    };
    node(x1, y1, '#22c55e');
    node(x2, y2, '#ef4444');
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setImageSrc(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  // Initialization: Load Image
  React.useEffect(() => {
    if (imageSrc && canvasRef.current) {
      const img = new Image();
      img.src = imageSrc;
      img.onload = () => {
        const MAX = 500;
        let w = img.width, h = img.height;
        if (w > h && w > MAX) { h *= MAX / w; w = MAX; }
        else if (h > MAX) { w *= MAX / h; h = MAX; }
        w = Math.round(w);
        h = Math.round(h);

        canvasRef.current.width = w;
        canvasRef.current.height = h;
        uiCanvasRef.current.width = w;
        uiCanvasRef.current.height = h;

        const ctx = canvasRef.current.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        originalDataRef.current = ctx.getImageData(0, 0, w, h);
        apiSeedsRef.current = null; // reset so API mode re-extracts seeds for new image

        applyImageFilters();
      };
    }
  }, [imageSrc]);

  React.useEffect(() => {
    if (imageSrc) applyImageFilters();
  }, [contrast, minLevel, maxLevel]);

  React.useEffect(() => {
    if (imageSrc && appMode === 'line') performFitting();
  }, [degree, fitMode]);

  React.useEffect(() => {
    if (imageSrc && appMode === 'palette') performPaletteFit();
  }, [colorCount, lockFrequency, paletteMethod, paletteFitMode]);

  // Draw palette swatches + gradient strip AFTER React commits the DOM
  React.useEffect(() => {
    if (!paletteDrawData) return;
    drawSwatches(paletteDrawData.colors);
    drawPaletteGradient(paletteDrawData.result, paletteDrawData.mode);
  }, [paletteDrawData]);

  // Fetch available Colormind models when API mode is selected
  React.useEffect(() => {
    if (paletteMethod !== 'api') return;
    fetch('http://colormind.io/list/')
      .then(r => r.json())
      .then(data => { if (data.result?.length) setApiModels(data.result); })
      .catch(() => {}); // silently keep defaults on failure
  }, [paletteMethod]);

  // Switch modes: re-run the appropriate pipeline
  React.useEffect(() => {
    if (!imageSrc) return;
    if (appMode === 'palette') {
      // Redraw image without overlay
      if (canvasRef.current && uiCanvasRef.current) {
        const ctx = uiCanvasRef.current.getContext('2d');
        ctx.drawImage(canvasRef.current, 0, 0);
      }
      performPaletteFit();
    } else {
      performFitting();
    }
  }, [appMode]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Code className="w-8 h-8 text-indigo-600" />
            Gradient-to-Shader Fitter
          </h1>
          <p className="text-slate-500 mt-2">Convert images to math. Line sampling or dominant palette extraction.</p>

          {/* Top-level mode selector */}
          <div className="flex bg-slate-200 p-1 rounded-xl mt-4 w-fit gap-1">
            <button
              onClick={() => setAppMode('line')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                appMode === 'line'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <MousePointer2 className="w-4 h-4" /> Line Sample
            </button>
            <button
              onClick={() => setAppMode('palette')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                appMode === 'palette'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Palette className="w-4 h-4" /> Palette Extract
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6 min-w-0">
            {/* IMAGE */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  {appMode === 'line'
                    ? <><MousePointer2 className="w-4 h-4 text-slate-400" />{imageSrc ? 'Sample Line' : 'Input'}</>
                    : <><Palette className="w-4 h-4 text-slate-400" />Palette Source</>
                  }
                </h2>
                <label className="text-xs bg-indigo-600 text-white px-3 py-1 rounded cursor-pointer hover:bg-indigo-700">
                  {imageSrc ? 'Change' : 'Upload'}
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>

              <div className="relative flex justify-center items-center bg-slate-100 rounded-lg border border-slate-200 overflow-hidden min-h-[200px] select-none">
                {!imageSrc && (
                  <div className="text-slate-400 flex flex-col items-center">
                    <Upload className="w-8 h-8 mb-2 opacity-50" />
                    No Image
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
                <canvas
                  ref={uiCanvasRef}
                  className={`max-w-full touch-none shadow-lg ${!imageSrc ? 'hidden' : 'block'} ${appMode === 'line' ? 'cursor-crosshair' : 'cursor-default'}`}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />
              </div>

              {/* Settings */}
              <div className="mt-6 space-y-6">
                {/* Fit mode toggle — line mode only */}
                {appMode === 'line' && (
                  <div className="space-y-3">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button onClick={() => setFitMode('poly')}
                        className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all ${fitMode === 'poly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        Polynomial
                      </button>
                      <button onClick={() => setFitMode('cosine')}
                        className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all ${fitMode === 'cosine' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        Cosine
                      </button>
                    </div>
                    {fitMode === 'poly' && (
                      <div className="flex items-center gap-4">
                        <label className="text-xs font-medium text-slate-600 w-16">Degree</label>
                        <input type="range" min="1" max="6" step="1" value={degree}
                          onChange={(e) => setDegree(parseInt(e.target.value))}
                          className="flex-1 accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                        />
                        <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{degree}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Image Processing */}
                <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <h3 className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                    <Sliders className="w-3 h-3" /> Image Processing
                  </h3>
                  <div className="flex items-center gap-4">
                    <label className="text-xs font-medium text-slate-600 w-16">Contrast</label>
                    <input type="range" min="0" max="2" step="0.1" value={contrast}
                      onChange={(e) => setContrast(parseFloat(e.target.value))}
                      className="flex-1 accent-indigo-500 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs w-8 text-right">{contrast.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="text-xs font-medium text-slate-600 w-16">Levels</label>
                    <div className="flex-1 flex gap-2">
                      <input type="range" min="0" max="255" step="1" value={minLevel}
                        onChange={(e) => setMinLevel(Math.min(parseInt(e.target.value), maxLevel - 5))}
                        className="flex-1 accent-slate-800 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <input type="range" min="0" max="255" step="1" value={maxLevel}
                        onChange={(e) => setMaxLevel(Math.max(parseInt(e.target.value), minLevel + 5))}
                        className="flex-1 accent-slate-400 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-col text-[10px] w-8 text-right leading-3">
                      <span>{maxLevel}</span>
                      <span className="text-slate-400">{minLevel}</span>
                    </div>
                  </div>
                </div>

                {/* Palette controls */}
                {appMode === 'palette' && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                      <Palette className="w-3 h-3" /> Palette Settings
                    </h3>
                    {/* Method toggle */}
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button onClick={() => setPaletteMethod('dominant')}
                        className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all ${paletteMethod === 'dominant' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        Dominant
                      </button>
                      <button onClick={() => setPaletteMethod('generative')}
                        className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all ${paletteMethod === 'generative' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        Generative
                      </button>
                      <button onClick={() => setPaletteMethod('api')}
                        className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all ${paletteMethod === 'api' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        API
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        {paletteMethod === 'dominant' && 'Most frequent colors by pixel area.'}
                        {paletteMethod === 'generative' && 'Random pixel sample → k-means 24×, best spread wins.'}
                        {paletteMethod === 'api' && 'Seeds up to 4 image colors into Colormind, always returns 5.'}
                      </p>
                      {(paletteMethod === 'generative' || paletteMethod === 'api') && imageSrc && (
                        <button
                          onClick={performPaletteFit}
                          className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded ml-3 shrink-0"
                        >
                          <RefreshCw className="w-3 h-3" /> Regenerate
                        </button>
                      )}
                    </div>
                    {paletteMethod === 'api' && (
                      <div className="flex items-center gap-3">
                        <label className="text-xs font-medium text-slate-600 w-20 shrink-0">Model</label>
                        <select
                          value={apiModel}
                          onChange={e => setApiModel(e.target.value)}
                          className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 cursor-pointer"
                        >
                          {apiModels.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                      <button onClick={() => setPaletteFitMode('cosine')}
                        className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all ${paletteFitMode === 'cosine' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        Cosine
                      </button>
                      <button onClick={() => setPaletteFitMode('poly')}
                        className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all ${paletteFitMode === 'poly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        Polynomial
                      </button>
                    </div>
                    {paletteFitMode === 'poly' && (
                      <div className="flex items-center gap-4">
                        <label className="text-xs font-medium text-slate-600 w-16">Degree</label>
                        <input type="range" min="1" max="6" step="1" value={degree}
                          onChange={(e) => setDegree(parseInt(e.target.value))}
                          className="flex-1 accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                        />
                        <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{degree}</span>
                      </div>
                    )}
                    {paletteMethod !== 'api' && <div className="flex items-center gap-4">
                      <label className="text-xs font-medium text-slate-600 w-20">Colors</label>
                      <input type="range" min="3" max="12" step="1" value={colorCount}
                        onChange={(e) => setColorCount(parseInt(e.target.value))}
                        className="flex-1 accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      />
                      <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{colorCount}</span>
                    </div>}
                    {paletteFitMode === 'cosine' && (
                      <div className="flex items-center gap-3">
                        <label className="text-xs font-medium text-slate-600 w-20">Lock freq</label>
                        <button
                          onClick={() => setLockFrequency((v) => !v)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${lockFrequency ? 'bg-indigo-500' : 'bg-slate-300'}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${lockFrequency ? 'translate-x-4' : 'translate-x-1'}`} />
                        </button>
                        <span className="text-xs text-slate-400">{lockFrequency ? 'Integer c (perfect loop)' : 'Free float c'}</span>
                      </div>
                    )}

                    {/* Extracted color swatches — always mounted so refs are valid */}
                    <div className={`space-y-1 ${extractedColors.length === 0 ? 'hidden' : ''}`}>
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Extracted Points</h4>
                        <button onClick={shuffleColors}
                          className="flex items-center gap-1 text-[10px] bg-blue-500 hover:bg-blue-600 text-white px-2 py-0.5 rounded transition-colors">
                          <Shuffle className="w-3 h-3" /> Shuffle
                        </button>
                      </div>
                      <div className="rounded overflow-hidden border border-slate-200 h-8">
                        <canvas ref={paletteSwatchRef} width={500} height={32} className="w-full h-full" />
                      </div>
                      <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide pt-1">Fitted Gradient</h4>
                      <div className="rounded overflow-hidden border border-slate-200 h-8">
                        <canvas ref={paletteGradientRef} width={500} height={32} className="w-full h-full" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ANALYSIS GRAPH */}

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-slate-400" /> Analysis
              </h2>
              <div className="w-full h-48 bg-slate-50 rounded border border-slate-100 overflow-hidden mb-4">
                <canvas ref={graphRef} width={500} height={300} className="w-full h-full" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                  <Eye className="w-3 h-3" /> Shader Preview
                </h3>
                <div className="w-full h-12 bg-slate-100 rounded border border-slate-200 overflow-hidden">
                  <canvas ref={shaderCanvasRef} width={500} height={50} className="w-full h-full" />
                </div>
              </div>
            </div>
          </div>

          {/* CODE OUTPUT */}
          <div className="space-y-6 min-w-0">
            <div className="bg-slate-900 text-slate-200 p-6 rounded-xl shadow-lg h-full flex flex-col overflow-hidden w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" /> Generated GLSL
                </h2>
                {glslCode && (
                  <button
                    onClick={() => navigator.clipboard.writeText(glslCode)}
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded"
                  >
                    Copy
                  </button>
                )}
              </div>

              {/* Status badge */}
              {status === 'processing' && (
                <div className="mb-3 flex items-center gap-2 text-xs text-yellow-400">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Processing…
                </div>
              )}

              <div className="flex-1 font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre bg-slate-950 p-4 rounded-lg border border-slate-800 w-full min-w-0">
                {glslCode || '// Upload an image and select a mode...'}
              </div>
              {error && (
                <div className="mt-4 p-3 bg-red-900/30 border border-red-800/50 text-red-200 text-sm rounded flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
