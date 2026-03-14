import React from 'react';
import { DEFAULTS, IMAGE_MAX_SIZE, POINT_HIT_RADIUS } from './config.js';
import { FIT_MODES, buildColorGLSL } from './fit/index.js';
import { computeWeightedTValues } from './math/cosine.js';
import { extractDominant, extractGenerative } from './palette/extract.js';
import { generateColormindPalette, fetchColormindModels } from './palette/colormind.js';
import { drawGraph } from './canvas/graph.js';
import { drawOverlay } from './canvas/overlay.js';
import { renderGradientPreview } from './canvas/preview.js';
import { drawSwatches, drawPaletteGradient } from './canvas/swatches.js';
import ImagePanel from './components/ImagePanel.jsx';
import LineModeSettings from './components/LineModeSettings.jsx';
import ImageAdjustPanel from './components/ImageAdjustPanel.jsx';
import PaletteModeSettings from './components/PaletteModeSettings.jsx';
import GraphPanel from './components/GraphPanel.jsx';
import CodePanel from './components/CodePanel.jsx';

const App = () => {
  const [imageSrc, setImageSrc] = React.useState(null);
  const [appMode, setAppMode] = React.useState('line');
  const [rightTab, setRightTab] = React.useState('settings');

  const [fitMode, setFitMode] = React.useState(DEFAULTS.fitMode);
  const [degree, setDegree] = React.useState(DEFAULTS.degree);

  const [colorCount, setColorCount] = React.useState(DEFAULTS.colorCount);
  const [lockFrequency, setLockFrequency] = React.useState(DEFAULTS.lockFrequency);
  const [extractedColors, setExtractedColors] = React.useState([]);
  const [paletteMethod, setPaletteMethod] = React.useState(DEFAULTS.paletteMethod);
  const [paletteFitMode, setPaletteFitMode] = React.useState(DEFAULTS.paletteFitMode);
  const [paletteDrawData, setPaletteDrawData] = React.useState(null);
  const [weightDominance, setWeightDominance] = React.useState(DEFAULTS.weightDominance);
  const [apiModel, setApiModel] = React.useState(DEFAULTS.apiModel);
  const [apiModels, setApiModels] = React.useState(['default', 'ui']);
  const [apiSeedCount, setApiSeedCount] = React.useState(DEFAULTS.apiSeedCount);

  const [contrast, setContrast] = React.useState(DEFAULTS.contrast);
  const [minLevel, setMinLevel] = React.useState(DEFAULTS.minLevel);
  const [maxLevel, setMaxLevel] = React.useState(DEFAULTS.maxLevel);

  const [coefficients, setCoefficients] = React.useState(null);
  const [glslCode, setGlslCode] = React.useState('');
  const [error, setError] = React.useState(null);
  const [status, setStatus] = React.useState('idle');

  const [p1, setP1] = React.useState(DEFAULTS.p1);
  const [p2, setP2] = React.useState(DEFAULTS.p2);
  const [activePoint, setActivePoint] = React.useState(null);

  const originalDataRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const uiCanvasRef = React.useRef(null);
  const graphRef = React.useRef(null);
  const shaderCanvasRef = React.useRef(null);
  const apiSeedsRef = React.useRef(null);
  const extractedColorsRef = React.useRef([]);
  const paletteGradientRef = React.useRef(null);
  const paletteSwatchRef = React.useRef(null);

  const applyImageFilters = () => {
    if (!originalDataRef.current || !canvasRef.current) return;
    const { width: w, height: h, data: src } = originalDataRef.current;
    const ctx = canvasRef.current.getContext('2d');
    const destImageData = ctx.createImageData(w, h);
    const dest = destImageData.data;
    const min = minLevel / 255, max = maxLevel / 255;
    const range = max - min;
    for (let i = 0; i < src.length; i += 4) {
      let r = (src[i] / 255 - 0.5) * contrast + 0.5;
      let g = (src[i + 1] / 255 - 0.5) * contrast + 0.5;
      let b = (src[i + 2] / 255 - 0.5) * contrast + 0.5;
      if (range > 0.001) {
        r = (r - min) / range; g = (g - min) / range; b = (b - min) / range;
      } else {
        r = r >= min ? 1 : 0; g = g >= min ? 1 : 0; b = b >= min ? 1 : 0;
      }
      dest[i]     = Math.max(0, Math.min(1, r)) * 255;
      dest[i + 1] = Math.max(0, Math.min(1, g)) * 255;
      dest[i + 2] = Math.max(0, Math.min(1, b)) * 255;
      dest[i + 3] = src[i + 3];
    }
    ctx.putImageData(destImageData, 0, 0);
    const uiCtx = uiCanvasRef.current.getContext('2d');
    uiCtx.drawImage(canvasRef.current, 0, 0, uiCanvasRef.current.width, uiCanvasRef.current.height);
    if (appMode === 'line') performFitting();
    else performPaletteFit();
  };

  const performFitting = () => {
    if (!canvasRef.current || !imageSrc) return;
    setStatus('processing');
    setError(null);
    setTimeout(() => {
      try {
        const ctx = canvasRef.current.getContext('2d');
        const w = canvasRef.current.width, h = canvasRef.current.height;
        const data = ctx.getImageData(0, 0, w, h).data;
        const x1 = p1.x * w, y1 = p1.y * h;
        const x2 = p2.x * w, y2 = p2.y * h;
        const numSteps = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
        const samples = [];
        for (let i = 0; i < numSteps; i++) {
          const t = i / (numSteps - 1);
          const px = Math.floor(x1 + (x2 - x1) * t);
          const py = Math.floor(y1 + (y2 - y1) * t);
          if (px >= 0 && px < w && py >= 0 && py < h) {
            const idx = (py * w + px) * 4;
            samples.push({ r: data[idx] / 255, g: data[idx + 1] / 255, b: data[idx + 2] / 255 });
          }
        }
        if (samples.length < 2) throw new Error('Line too short');
        const result = FIT_MODES[fitMode].fit(samples, { degree });
        setCoefficients(result);
        setGlslCode(FIT_MODES[fitMode].buildGLSL(result));
        drawGraph(graphRef.current, samples, result, fitMode);
        renderGradientPreview(shaderCanvasRef.current, result, fitMode);
        drawOverlay(uiCanvasRef.current, canvasRef.current, p1, p2);
        setStatus('done');
      } catch (e) {
        setError(e.message || 'Error during fitting');
        setStatus('error');
      }
    }, 10);
  };

  const performPaletteRefit = (colors) => {
    if (!colors || colors.length < 2) return;
    const tValues = weightDominance ? computeWeightedTValues(colors) : null;
    const result = FIT_MODES[paletteFitMode].fit(colors, { degree, lockFrequency, tValues });
    setCoefficients(result);
    setGlslCode(FIT_MODES[paletteFitMode].buildGLSL(result) + '\n\n' + buildColorGLSL(colors));
    drawGraph(graphRef.current, colors, result, paletteFitMode);
    renderGradientPreview(shaderCanvasRef.current, result, paletteFitMode);
    setPaletteDrawData({ colors, result, mode: paletteFitMode });
  };

  const performPaletteFit = async () => {
    if (!canvasRef.current || !imageSrc) return;
    setStatus('processing');
    setError(null);
    try {
      const imageData = canvasRef.current.getContext('2d')
        .getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      let colors;
      if (paletteMethod === 'dominant') {
        colors = await extractDominant(imageData, colorCount);
      } else if (paletteMethod === 'api') {
        const { colors: apiColors, seeds } = await generateColormindPalette(imageData, {
          model: apiModel, seedCount: apiSeedCount, cachedSeeds: apiSeedsRef.current,
        });
        apiSeedsRef.current = seeds;
        colors = apiColors;
      } else {
        colors = extractGenerative(imageData, colorCount);
      }
      colors.sort((a, b) => a.lum - b.lum);
      extractedColorsRef.current = colors;
      setExtractedColors(colors);
      drawSwatches(paletteSwatchRef.current, colors);
      performPaletteRefit(colors);
      setStatus('done');
    } catch (e) {
      setError(e.message || 'Error during palette extraction');
      setStatus('error');
    }
  };

  const shuffleColors = () => {
    if (extractedColors.length === 0) return;
    const shuffled = [...extractedColors].sort(() => Math.random() - 0.5);
    extractedColorsRef.current = shuffled;
    setExtractedColors(shuffled);
    performPaletteRefit(shuffled);
  };

  const handleMouseDown = (e) => {
    if (!uiCanvasRef.current || !imageSrc || appMode !== 'line') return;
    const rect = uiCanvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    if (Math.hypot(mx - p1.x * rect.width, my - p1.y * rect.height) < POINT_HIT_RADIUS) {
      setActivePoint('p1');
    } else if (Math.hypot(mx - p2.x * rect.width, my - p2.y * rect.height) < POINT_HIT_RADIUS) {
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
    if (activePoint) { setActivePoint(null); performFitting(); }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setImageSrc(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  React.useEffect(() => {
    if (!imageSrc || !canvasRef.current) return;
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > h && w > IMAGE_MAX_SIZE) { h *= IMAGE_MAX_SIZE / w; w = IMAGE_MAX_SIZE; }
      else if (h > IMAGE_MAX_SIZE) { w *= IMAGE_MAX_SIZE / h; h = IMAGE_MAX_SIZE; }
      w = Math.round(w); h = Math.round(h);
      const dpr = window.devicePixelRatio || 1;
      canvasRef.current.width = w;
      canvasRef.current.height = h;
      uiCanvasRef.current.width = w * dpr;
      uiCanvasRef.current.height = h * dpr;
      const ctx = canvasRef.current.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      originalDataRef.current = ctx.getImageData(0, 0, w, h);
      apiSeedsRef.current = null;
      applyImageFilters();
    };
  }, [imageSrc]);

  React.useEffect(() => {
    if (imageSrc) applyImageFilters();
  }, [contrast, minLevel, maxLevel]);

  React.useEffect(() => {
    if (imageSrc && appMode === 'line') performFitting();
  }, [degree, fitMode]);

  React.useEffect(() => {
    if (imageSrc && appMode === 'palette') performPaletteFit();
  }, [colorCount, paletteMethod, apiModel, apiSeedCount]);

  React.useEffect(() => {
    if (imageSrc && appMode === 'palette' && extractedColorsRef.current.length >= 2)
      performPaletteRefit(extractedColorsRef.current);
  }, [paletteFitMode, lockFrequency, degree, weightDominance]);

  React.useEffect(() => {
    if (!paletteDrawData) return;
    drawSwatches(paletteSwatchRef.current, paletteDrawData.colors);
    drawPaletteGradient(paletteGradientRef.current, paletteDrawData.result, paletteDrawData.mode);
  }, [paletteDrawData]);

  React.useEffect(() => {
    if (paletteMethod !== 'api') return;
    fetchColormindModels()
      .then((models) => { if (models.length) setApiModels(models); })
      .catch(() => {});
  }, [paletteMethod]);

  React.useEffect(() => {
    if (!imageSrc) return;
    if (appMode === 'palette') {
      if (canvasRef.current && uiCanvasRef.current) {
        const ui = uiCanvasRef.current;
        ui.getContext('2d').drawImage(canvasRef.current, 0, 0, ui.width, ui.height);
      }
      performPaletteFit();
    } else {
      performFitting();
    }
  }, [appMode]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-4 md:p-5">
      <div className="max-w-[1500px] mx-auto">

        <div className="flex items-center justify-between mb-4">
          <div className="flex bg-[var(--surface-muted)] p-0.5 rounded-sm border border-[var(--border)]">
            {[['line', 'Line Sample'], ['palette', 'Palette Extract']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setAppMode(id)}
                className={`px-4 py-1.5 text-[10px] rounded-sm font-semibold tracking-widest uppercase transition-all ${
                  appMode === id
                    ? 'bg-[var(--surface)] text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-[11px] font-semibold tracking-widest text-[var(--text-muted)] uppercase select-none">
            Gradient Fitter
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-5 items-start">
          <div className="space-y-4 min-w-0">
            <ImagePanel
              imageSrc={imageSrc}
              appMode={appMode}
              canvasRef={canvasRef}
              uiCanvasRef={uiCanvasRef}
              onImageUpload={handleImageUpload}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            />
            <GraphPanel graphRef={graphRef} shaderCanvasRef={shaderCanvasRef} />
          </div>

          <div className="min-w-0 border border-[var(--border)] rounded-sm overflow-hidden">
            <div className="flex bg-[var(--surface-muted)] border-b border-[var(--border)]">
              {[['settings', 'Settings'], ['code', 'Code']].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setRightTab(id)}
                  className={`px-5 py-3 text-[10px] font-semibold tracking-widest uppercase transition-all border-r border-[var(--border)] last:border-r-0 ${
                    rightTab === id
                      ? 'bg-[var(--surface)] text-[var(--accent)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className={rightTab === 'settings' ? '' : 'hidden'}>
              <div className="bg-[var(--surface)] p-5">
                <div className="space-y-5">
                  {appMode === 'line' && (
                    <LineModeSettings
                      fitMode={fitMode} setFitMode={setFitMode}
                      degree={degree} setDegree={setDegree}
                    />
                  )}
                  <ImageAdjustPanel
                    contrast={contrast} setContrast={setContrast}
                    minLevel={minLevel} setMinLevel={setMinLevel}
                    maxLevel={maxLevel} setMaxLevel={setMaxLevel}
                  />
                  {appMode === 'palette' && (
                    <PaletteModeSettings
                      paletteMethod={paletteMethod} setPaletteMethod={setPaletteMethod}
                      paletteFitMode={paletteFitMode} setPaletteFitMode={setPaletteFitMode}
                      colorCount={colorCount} setColorCount={setColorCount}
                      lockFrequency={lockFrequency} setLockFrequency={setLockFrequency}
                      weightDominance={weightDominance} setWeightDominance={setWeightDominance}
                      degree={degree} setDegree={setDegree}
                      apiModel={apiModel} setApiModel={setApiModel}
                      apiModels={apiModels}
                      apiSeedCount={apiSeedCount} setApiSeedCount={setApiSeedCount}
                      extractedColors={extractedColors}
                      paletteSwatchRef={paletteSwatchRef}
                      paletteGradientRef={paletteGradientRef}
                      imageSrc={imageSrc}
                      onRegenerate={performPaletteFit}
                      onShuffle={shuffleColors}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className={rightTab === 'code' ? '' : 'hidden'}>
              <CodePanel glslCode={glslCode} status={status} error={error} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
