import React from 'react';
import { Upload, Activity, Code, Zap, AlertCircle, MousePointer2, Eye, RefreshCw, Sliders } from 'lucide-react';

const App = () => {
  const [imageSrc, setImageSrc] = React.useState(null);

  // Fitting State
  const [fitMode, setFitMode] = React.useState('poly'); // 'poly' or 'cosine'
  const [degree, setDegree] = React.useState(3);
  const [solverSteps, setSolverSteps] = React.useState(5000);

  // Image Processing State
  const [contrast, setContrast] = React.useState(1.0);
  const [minLevel, setMinLevel] = React.useState(0); // Black Point (0-255)
  const [maxLevel, setMaxLevel] = React.useState(255); // White Point (0-255)

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
  const originalDataRef = React.useRef(null); // Stores the raw resized original image data
  const canvasRef = React.useRef(null); // Stores the PROCESSED image used for fitting
  const uiCanvasRef = React.useRef(null); // Visible canvas
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

  // --- Math Logic: Iterative Solver (Cosine) ---
  const solveCosineParams = (samples, steps) => {
    const solveChannel = (accessor) => {
      let bestParams = { a: 0.5, b: 0.5, c: 1.0, d: 0.0 };
      let bestError = Infinity;

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

      for (let r = 0; r < 50; r++) {
        const startP = {
          a: Math.random(),
          b: Math.random(),
          c: 0.5 + Math.random() * 3.0,
          d: Math.random(),
        };

        let p = { ...startP };
        let err = calcError(p);
        let learningRate = 0.1;
        for (let i = 0; i < 100; i++) {
          const candidate = {
            a: p.a + (Math.random() - 0.5) * learningRate,
            b: p.b + (Math.random() - 0.5) * learningRate,
            c: p.c + (Math.random() - 0.5) * learningRate,
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
          c: p.c + (Math.random() - 0.5) * lr * 0.5,
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

  // --- Interaction Logic ---
  const handleMouseDown = (e) => {
    if (!uiCanvasRef.current || !imageSrc) return;
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
      // Don't re-process image, just re-fit based on new line coords
      performFitting();
    }
  };

  // --- Image Processing ---

  // Applies Contrast + Levels to originalDataRef and saves to canvasRef
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
      // 1. Normalize [0..1]
      let r = src[i] / 255;
      let g = src[i + 1] / 255;
      let b = src[i + 2] / 255;

      // 2. Contrast (centered around 0.5)
      r = (r - 0.5) * contrastFactor + 0.5;
      g = (g - 0.5) * contrastFactor + 0.5;
      b = (b - 0.5) * contrastFactor + 0.5;

      // 3. Levels (Input Range)
      if (range > 0.001) {
        r = (r - min) / range;
        g = (g - min) / range;
        b = (b - min) / range;
      } else {
        // Hard threshold if range is 0
        r = r >= min ? 1 : 0;
        g = g >= min ? 1 : 0;
        b = b >= min ? 1 : 0;
      }

      // 4. Clamp and Save
      dest[i] = Math.max(0, Math.min(1, r)) * 255;
      dest[i + 1] = Math.max(0, Math.min(1, g)) * 255;
      dest[i + 2] = Math.max(0, Math.min(1, b)) * 255;
      dest[i + 3] = src[i + 3]; // Keep alpha
    }

    // Update Hidden Processing Canvas
    ctx.putImageData(destImageData, 0, 0);

    // Update Visible UI Canvas
    const uiCtx = uiCanvasRef.current.getContext('2d');
    uiCtx.putImageData(destImageData, 0, 0);

    // Trigger fitting on new data
    performFitting();
  };

  // --- Main Pipeline ---

  const performFitting = () => {
    if (!canvasRef.current || !imageSrc) return;

    setStatus('processing');
    setError(null);

    setTimeout(() => {
      try {
        const ctx = canvasRef.current.getContext('2d');
        const w = canvasRef.current.width;
        const h = canvasRef.current.height;
        const data = ctx.getImageData(0, 0, w, h).data; // Reads PROCESSED data

        // 1. Sampling
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

        // 2. Fitting
        if (fitMode === 'poly') {
          const N = degree + 1;
          const ATA = Array(N)
            .fill(0)
            .map(() => Array(N).fill(0));
          const ATb = { r: Array(N).fill(0), g: Array(N).fill(0), b: Array(N).fill(0) };

          for (let i = 0; i < samples.length; i++) {
            const t = i / (samples.length - 1);
            const powers = [];
            for (let p = 0; p <= degree; p++) powers.push(Math.pow(t, p));

            for (let row = 0; row < N; row++) {
              for (let col = 0; col < N; col++) ATA[row][col] += powers[row] * powers[col];
              ATb.r[row] += powers[row] * samples[i].r;
              ATb.g[row] += powers[row] * samples[i].g;
              ATb.b[row] += powers[row] * samples[i].b;
            }
          }
          result = {
            r: solveLinearSystem(ATA, ATb.r),
            g: solveLinearSystem(ATA, ATb.g),
            b: solveLinearSystem(ATA, ATb.b),
          };
        } else {
          result = solveCosineParams(samples, solverSteps);
        }

        setCoefficients(result);
        generateGLSL(result, fitMode);
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
  const generateGLSL = (coeffs, mode) => {
    const fmt = (n) => {
      let s = n.toFixed(3);
      return s.indexOf('.') === -1 ? s + '.0' : s;
    };

    let code = '';

    if (mode === 'poly') {
      code = `// Polynomial Gradient (Degree ${degree})\n`;
      code += `vec3 gradient(float t) {\n`;
      code += `    vec3 c0 = vec3(${fmt(coeffs.r[0])}, ${fmt(coeffs.g[0])}, ${fmt(coeffs.b[0])});\n`;
      for (let i = 1; i <= degree; i++) {
        code += `    vec3 c${i} = vec3(${fmt(coeffs.r[i])}, ${fmt(coeffs.g[i])}, ${fmt(coeffs.b[i])});\n`;
      }
      code += `\n    return c0`;
      for (let i = 1; i <= degree; i++) {
        let tStr = i === 2 ? 't*t' : i === 3 ? 't*t*t' : i === 1 ? 't' : `pow(t, ${i}.0)`;
        code += ` + c${i} * ${tStr}`;
      }
      code += `;\n}`;
    } else {
      code = `// Cosine Gradient (Inigo Quilez style)\n// color(t) = a + b * cos( 2*pi * (c*t + d) )\n`;
      code += `vec3 gradient(float t) {\n`;
      code += `    vec3 a = vec3(${fmt(coeffs.r.a)}, ${fmt(coeffs.g.a)}, ${fmt(coeffs.b.a)});\n`;
      code += `    vec3 b = vec3(${fmt(coeffs.r.b)}, ${fmt(coeffs.g.b)}, ${fmt(coeffs.b.b)});\n`;
      code += `    vec3 c = vec3(${fmt(coeffs.r.c)}, ${fmt(coeffs.g.c)}, ${fmt(coeffs.b.c)});\n`;
      code += `    vec3 d = vec3(${fmt(coeffs.r.d)}, ${fmt(coeffs.g.d)}, ${fmt(coeffs.b.d)});\n\n`;
      code += `    return a + b * cos( 6.28318 * (c * t + d) );\n}`;
    }

    setGlslCode(code);
  };

  // --- Visualization ---
  const evalColor = (coeffs, t, mode) => {
    if (mode === 'poly') {
      let r = 0,
        g = 0,
        b = 0;
      for (let i = 0; i < coeffs.r.length; i++) {
        const term = Math.pow(t, i);
        r += coeffs.r[i] * term;
        g += coeffs.g[i] * term;
        b += coeffs.b[i] * term;
      }
      return { r, g, b };
    } else {
      const val = (p) => p.a + p.b * Math.cos(2 * Math.PI * (p.c * t + p.d));
      return {
        r: val(coeffs.r),
        g: val(coeffs.g),
        b: val(coeffs.b),
      };
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

    // Grid
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

    // Data
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

    // Fit
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

    // Note: uiCanvasRef ALREADY contains the processed image via applyImageFilters
    // We just draw the overlay ON TOP, but clearing it wipes the image.
    // So we must redraw the processed image from canvasRef first.
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(canvasRef.current, 0, 0, w, h);

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 0, w, h);

    const x1 = p1.x * w,
      y1 = p1.y * h;
    const x2 = p2.x * w,
      y2 = p2.y * h;

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

  // Initialization: Load Image -> Resize -> Save Raw Data -> Process
  React.useEffect(() => {
    if (imageSrc && canvasRef.current) {
      const img = new Image();
      img.src = imageSrc;
      img.onload = () => {
        const MAX = 500;
        let w = img.width,
          h = img.height;
        if (w > h && w > MAX) {
          h *= MAX / w;
          w = MAX;
        } else if (h > MAX) {
          w *= MAX / h;
          h = MAX;
        }
        w = Math.round(w);
        h = Math.round(h);

        // Set canvas dimensions
        canvasRef.current.width = w;
        canvasRef.current.height = h;
        uiCanvasRef.current.width = w;
        uiCanvasRef.current.height = h;

        // Draw original to hidden canvas to extract data
        const ctx = canvasRef.current.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        // Store Original Data for filters
        originalDataRef.current = ctx.getImageData(0, 0, w, h);

        // Initial Filter Application
        applyImageFilters();
      };
    }
  }, [imageSrc]);

  // Re-run filters when sliders change
  React.useEffect(() => {
    if (imageSrc) applyImageFilters();
  }, [contrast, minLevel, maxLevel]);

  // Re-run fitting when method changes (filters are already baked into canvasRef)
  React.useEffect(() => {
    if (imageSrc) performFitting();
  }, [degree, fitMode]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Code className="w-8 h-8 text-indigo-600" />
            Gradient-to-Shader Fitter
          </h1>
          <p className="text-slate-500 mt-2">Convert images to math. Supports Polynomial and Cosine Palettes.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            {/* IMAGE & CONTROLS */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <MousePointer2 className="w-4 h-4 text-slate-400" />
                  {imageSrc ? 'Sample Line' : 'Input'}
                </h2>
                {!imageSrc && (
                  <label className="text-xs bg-indigo-600 text-white px-3 py-1 rounded cursor-pointer hover:bg-indigo-700">
                    Upload <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                )}
                {imageSrc && (
                  <label className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer font-medium">
                    Change <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                )}
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
                  className={`max-w-full cursor-crosshair touch-none shadow-lg ${!imageSrc ? 'hidden' : 'block'}`}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                />
              </div>

              {/* Settings Group */}
              <div className="mt-6 space-y-6">
                {/* 1. Filter Controls */}
                <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <h3 className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                    <Sliders className="w-3 h-3" /> Image Processing
                  </h3>

                  {/* Contrast */}
                  <div className="flex items-center gap-4">
                    <label className="text-xs font-medium text-slate-600 w-16">Contrast</label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={contrast}
                      onChange={(e) => setContrast(parseFloat(e.target.value))}
                      className="flex-1 accent-indigo-500 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-xs w-8 text-right">{contrast.toFixed(1)}</span>
                  </div>

                  {/* Levels (Dual Slider Implementation simulated with two inputs for simplicity) */}
                  <div className="flex items-center gap-4">
                    <label className="text-xs font-medium text-slate-600 w-16">Levels</label>
                    <div className="flex-1 flex gap-2">
                      <input
                        type="range"
                        min="0"
                        max="255"
                        step="1"
                        value={minLevel}
                        onChange={(e) => setMinLevel(Math.min(parseInt(e.target.value), maxLevel - 5))}
                        className="flex-1 accent-slate-800 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <input
                        type="range"
                        min="0"
                        max="255"
                        step="1"
                        value={maxLevel}
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

                {/* 2. Solver Controls */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                    <RefreshCw className="w-3 h-3" /> Solver Settings
                  </h3>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                      onClick={() => setFitMode('poly')}
                      className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all ${
                        fitMode === 'poly'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Polynomial
                    </button>
                    <button
                      onClick={() => setFitMode('cosine')}
                      className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-all ${
                        fitMode === 'cosine'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Cosine
                    </button>
                  </div>

                  {fitMode === 'poly' ? (
                    <div className="flex items-center gap-4">
                      <label className="text-xs font-medium text-slate-600 w-16">Degree</label>
                      <input
                        type="range"
                        min="1"
                        max="6"
                        step="1"
                        value={degree}
                        onChange={(e) => setDegree(parseInt(e.target.value))}
                        className="flex-1 accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      />
                      <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                        {degree}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center text-xs text-slate-400 italic">
                      Iterative solver auto-runs {solverSteps} steps.
                    </div>
                  )}
                </div>
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
          <div className="space-y-6">
            <div className="bg-slate-900 text-slate-200 p-6 rounded-xl shadow-lg h-full flex flex-col">
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
              <div className="flex-1 font-mono text-xs leading-relaxed overflow-auto whitespace-pre bg-slate-950 p-4 rounded-lg border border-slate-800">
                {glslCode || '// Upload an image...'}
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
