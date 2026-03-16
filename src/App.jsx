import React from 'react';
import { DEFAULTS, IMAGE_MAX_SIZE, POINT_HIT_RADIUS } from './config.js';
import { FIT_MODES, buildCode, buildColorCode, linearize, LINEAR_LIGHT_MODES } from './fit/index.js';
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
  const [linearLight, setLinearLight] = React.useState(DEFAULTS.linearLight);
  const [weightDominance, setWeightDominance] = React.useState(DEFAULTS.weightDominance);
  const [apiModel, setApiModel] = React.useState(DEFAULTS.apiModel);
  const [apiModels, setApiModels] = React.useState(['default', 'ui']);
  const [apiSeedCount, setApiSeedCount] = React.useState(DEFAULTS.apiSeedCount);

  const [contrast, setContrast] = React.useState(DEFAULTS.contrast);
  const [minLevel, setMinLevel] = React.useState(DEFAULTS.minLevel);
  const [maxLevel, setMaxLevel] = React.useState(DEFAULTS.maxLevel);

  const [language, setLanguage] = React.useState('glsl');
  const [coefficients, setCoefficients] = React.useState(null);
  const [glslCode, setGlslCode] = React.useState('');
  const [error, setError] = React.useState(null);
  const [status, setStatus] = React.useState('idle');

  const [p1, setP1] = React.useState(DEFAULTS.p1);
  const [p2, setP2] = React.useState(DEFAULTS.p2);
  const [activePoint, setActivePoint] = React.useState(null);
  const [hoveredPoint, setHoveredPoint] = React.useState(null);
  const hoveredPointRef = React.useRef(null);

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
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    const destImageData = ctx.createImageData(w, h);
    const dest = destImageData.data;
    const min = minLevel / 255,
      max = maxLevel / 255;
    const range = max - min;
    for (let i = 0; i < src.length; i += 4) {
      let r = (src[i] / 255 - 0.5) * contrast + 0.5;
      let g = (src[i + 1] / 255 - 0.5) * contrast + 0.5;
      let b = (src[i + 2] / 255 - 0.5) * contrast + 0.5;
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
        const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
        const w = canvasRef.current.width,
          h = canvasRef.current.height;
        const data = ctx.getImageData(0, 0, w, h).data;
        const x1 = p1.x * w,
          y1 = p1.y * h;
        const x2 = p2.x * w,
          y2 = p2.y * h;
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
        setGlslCode(buildCode(fitMode, result, { linearLight }, language));
        drawGraph(graphRef.current, samples, result, fitMode, linearLight);
        renderGradientPreview(shaderCanvasRef.current, result, fitMode, linearLight);
        drawOverlay(uiCanvasRef.current, canvasRef.current, p1, p2, hoveredPointRef.current);
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
    const useLinearLight = linearLight && LINEAR_LIGHT_MODES.includes(paletteFitMode);
    const fittingColors = useLinearLight ? colors.map(linearize) : colors;
    const result = FIT_MODES[paletteFitMode].fit(fittingColors, { degree, lockFrequency, tValues });
    setCoefficients(result);
    setGlslCode(
      buildCode(paletteFitMode, result, { linearLight: useLinearLight }, language) + '\n\n' + buildColorCode(colors, language),
    );
    drawGraph(graphRef.current, colors, result, paletteFitMode, useLinearLight);
    renderGradientPreview(shaderCanvasRef.current, result, paletteFitMode, useLinearLight);
    setPaletteDrawData({ colors, result, mode: paletteFitMode, linearLight: useLinearLight });
  };

  const performPaletteFit = async () => {
    if (!canvasRef.current || !imageSrc) return;
    setStatus('processing');
    setError(null);
    try {
      const imageData = canvasRef.current
        .getContext('2d', { willReadFrequently: true })
        .getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      let colors;
      if (paletteMethod === 'dominant') {
        colors = await extractDominant(imageData, colorCount);
      } else if (paletteMethod === 'api') {
        const { colors: apiColors, seeds } = await generateColormindPalette(imageData, {
          model: apiModel,
          seedCount: apiSeedCount,
          cachedSeeds: apiSeedsRef.current,
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
    const mx = e.clientX - rect.left,
      my = e.clientY - rect.top;
    if (Math.hypot(mx - p1.x * rect.width, my - p1.y * rect.height) < POINT_HIT_RADIUS) {
      setActivePoint('p1');
    } else if (Math.hypot(mx - p2.x * rect.width, my - p2.y * rect.height) < POINT_HIT_RADIUS) {
      setActivePoint('p2');
    }
  };

  const handleMouseMove = (e) => {
    if (!uiCanvasRef.current || !imageSrc || appMode !== 'line') return;
    const rect = uiCanvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (activePoint) {
      const x = Math.max(0, Math.min(1, mx / rect.width));
      const y = Math.max(0, Math.min(1, my / rect.height));
      if (activePoint === 'p1') setP1({ x, y });
      else setP2({ x, y });
    } else {
      const d1 = Math.hypot(mx - p1.x * rect.width, my - p1.y * rect.height);
      const d2 = Math.hypot(mx - p2.x * rect.width, my - p2.y * rect.height);
      const newHover = d1 < POINT_HIT_RADIUS ? 'p1' : d2 < POINT_HIT_RADIUS ? 'p2' : null;
      if (newHover !== hoveredPointRef.current) {
        hoveredPointRef.current = newHover;
        setHoveredPoint(newHover);
      }
    }
  };

  const handleMouseUp = () => {
    if (activePoint) {
      setActivePoint(null);
      performFitting();
    }
  };

  const handleMouseLeave = () => {
    hoveredPointRef.current = null;
    setHoveredPoint(null);
    handleMouseUp();
  };

  const TOUCH_HIT_RADIUS = 40;

  const handleTouchStart = (e) => {
    if (!uiCanvasRef.current || !imageSrc || appMode !== 'line') return;
    const touch = e.touches[0];
    const rect = uiCanvasRef.current.getBoundingClientRect();
    const mx = touch.clientX - rect.left,
      my = touch.clientY - rect.top;
    if (Math.hypot(mx - p1.x * rect.width, my - p1.y * rect.height) < TOUCH_HIT_RADIUS) {
      setActivePoint('p1');
    } else if (Math.hypot(mx - p2.x * rect.width, my - p2.y * rect.height) < TOUCH_HIT_RADIUS) {
      setActivePoint('p2');
    }
  };

  const handleTouchMove = (e) => {
    if (!activePoint || !uiCanvasRef.current) return;
    const touch = e.touches[0];
    const rect = uiCanvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (touch.clientY - rect.top) / rect.height));
    if (activePoint === 'p1') setP1({ x, y });
    else setP2({ x, y });
  };

  const handleTouchEnd = () => {
    if (activePoint) {
      setActivePoint(null);
      performFitting();
    }
  };

  const handleReset = () => {
    setImageSrc(null);
    setP1(DEFAULTS.p1);
    setP2(DEFAULTS.p2);
    setCoefficients(null);
    setGlslCode('');
    setError(null);
    setStatus('idle');
    setExtractedColors([]);
    setPaletteDrawData(null);
    extractedColorsRef.current = [];
    apiSeedsRef.current = null;
    for (const ref of [shaderCanvasRef, graphRef, uiCanvasRef]) {
      const canvas = ref.current;
      if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setImageSrc(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleExampleLoad = (src) => setImageSrc(src);

  React.useEffect(() => {
    if (!imageSrc || !canvasRef.current) return;
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      let w = img.width,
        h = img.height;
      if (w > h && w > IMAGE_MAX_SIZE) {
        h *= IMAGE_MAX_SIZE / w;
        w = IMAGE_MAX_SIZE;
      } else if (h > IMAGE_MAX_SIZE) {
        w *= IMAGE_MAX_SIZE / h;
        h = IMAGE_MAX_SIZE;
      }
      w = Math.round(w);
      h = Math.round(h);
      canvasRef.current.width = w;
      canvasRef.current.height = h;
      const MIN_UI_PIXELS = 800;
      const uiScale = Math.max(1, MIN_UI_PIXELS / Math.max(w, h));
      uiCanvasRef.current.width = Math.round(w * uiScale);
      uiCanvasRef.current.height = Math.round(h * uiScale);
      const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
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
    if (imageSrc && appMode === 'line' && uiCanvasRef.current && canvasRef.current) {
      drawOverlay(uiCanvasRef.current, canvasRef.current, p1, p2, hoveredPointRef.current);
    }
  }, [p1, p2, hoveredPoint]);

  React.useEffect(() => {
    if (imageSrc && appMode === 'palette') {
      apiSeedsRef.current = null;
      performPaletteFit();
    }
  }, [colorCount, paletteMethod, apiModel, apiSeedCount]);

  React.useEffect(() => {
    if (imageSrc && appMode === 'palette' && extractedColorsRef.current.length >= 2)
      performPaletteRefit(extractedColorsRef.current);
  }, [paletteFitMode, lockFrequency, degree, weightDominance, linearLight]);

  React.useEffect(() => {
    if (!paletteDrawData) return;
    drawSwatches(paletteSwatchRef.current, paletteDrawData.colors);
    drawPaletteGradient(
      paletteGradientRef.current,
      paletteDrawData.result,
      paletteDrawData.mode,
      paletteDrawData.linearLight,
    );
  }, [paletteDrawData]);

  React.useEffect(() => {
    if (paletteMethod !== 'api') return;
    fetchColormindModels()
      .then((models) => {
        if (models.length) setApiModels(models);
      })
      .catch(() => {});
  }, [paletteMethod]);

  React.useEffect(() => {
    if (!coefficients || !imageSrc) return;
    if (appMode === 'line') {
      setGlslCode(buildCode(fitMode, coefficients, { linearLight }, language));
    } else if (appMode === 'palette' && extractedColorsRef.current.length >= 2) {
      const useLinearLight = linearLight && LINEAR_LIGHT_MODES.includes(paletteFitMode);
      setGlslCode(
        buildCode(paletteFitMode, coefficients, { linearLight: useLinearLight }, language) +
          '\n\n' + buildColorCode(extractedColorsRef.current, language),
      );
    }
  }, [language]);

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
        <div className="flex items-center mb-4 gap-3">
          <div className="flex bg-[var(--surface-muted)] p-0.5 rounded-sm border border-[var(--border)] shrink-0">
            {[
              ['line', 'Line Sample'],
              ['palette', 'Palette Extract'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setAppMode(id)}
                className={`px-2 sm:px-4 py-1.5 text-[10px] rounded-sm font-semibold tracking-widest uppercase transition-all ${
                  appMode === id
                    ? 'bg-[var(--surface)] text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-[11px] font-semibold tracking-widest text-[var(--text-muted)] uppercase select-none ml-auto">
            Gradient Fitter
          </span>
          <a
            href="https://github.com/bhoffmann93/gradient-fitter"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors shrink-0"
            aria-label="GitHub"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
            </svg>
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-5 items-start lg:items-stretch">
          <div className="space-y-4 min-w-0">
            <ImagePanel
              imageSrc={imageSrc}
              appMode={appMode}
              canvasRef={canvasRef}
              uiCanvasRef={uiCanvasRef}
              onImageUpload={handleImageUpload}
              onExampleLoad={handleExampleLoad}
              onReset={handleReset}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              hoveredPoint={hoveredPoint}
              activePoint={activePoint}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            />
            <GraphPanel graphRef={graphRef} shaderCanvasRef={shaderCanvasRef} />
          </div>

          <div className="min-w-0 border border-[var(--border)] rounded-sm overflow-hidden flex flex-col">
            {appMode === 'line' ? (
              <>
                <div className="bg-[var(--surface)] p-5 space-y-5">
                  <ImageAdjustPanel
                    contrast={contrast}
                    setContrast={setContrast}
                    minLevel={minLevel}
                    setMinLevel={setMinLevel}
                    maxLevel={maxLevel}
                    setMaxLevel={setMaxLevel}
                  />
                  <LineModeSettings fitMode={fitMode} setFitMode={setFitMode} degree={degree} setDegree={setDegree} />
                </div>
                <div className="border-t border-[var(--border)] flex-1 flex flex-col">
                  <CodePanel glslCode={glslCode} status={status} error={error} language={language} setLanguage={setLanguage} fitMode={fitMode} className="flex-1" />
                </div>
              </>
            ) : (
              <>
                <div className="flex bg-[var(--surface-muted)] border-b border-[var(--border)] shrink-0">
                  {[
                    ['settings', 'Settings'],
                    ['code', 'Code'],
                  ].map(([id, label]) => (
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
                <div className="relative flex-1 min-h-0 overflow-hidden">
                  <div className={`h-full ${rightTab === 'code' ? 'invisible pointer-events-none' : ''}`}>
                    <div className="bg-[var(--surface)] p-5 h-full overflow-auto">
                      <div className="space-y-5">
                        <ImageAdjustPanel
                          contrast={contrast}
                          setContrast={setContrast}
                          minLevel={minLevel}
                          setMinLevel={setMinLevel}
                          maxLevel={maxLevel}
                          setMaxLevel={setMaxLevel}
                        />
                        <PaletteModeSettings
                          paletteMethod={paletteMethod}
                          setPaletteMethod={setPaletteMethod}
                          paletteFitMode={paletteFitMode}
                          setPaletteFitMode={setPaletteFitMode}
                          colorCount={colorCount}
                          setColorCount={setColorCount}
                          lockFrequency={lockFrequency}
                          setLockFrequency={setLockFrequency}
                          linearLight={linearLight}
                          setLinearLight={setLinearLight}
                          weightDominance={weightDominance}
                          setWeightDominance={setWeightDominance}
                          degree={degree}
                          setDegree={setDegree}
                          apiModel={apiModel}
                          setApiModel={setApiModel}
                          apiModels={apiModels}
                          apiSeedCount={apiSeedCount}
                          setApiSeedCount={setApiSeedCount}
                          extractedColors={extractedColors}
                          paletteSwatchRef={paletteSwatchRef}
                          paletteGradientRef={paletteGradientRef}
                          imageSrc={imageSrc}
                          onRegenerate={performPaletteFit}
                          onShuffle={shuffleColors}
                        />
                      </div>
                    </div>
                  </div>
                  <div className={`absolute inset-0 ${rightTab !== 'code' ? 'invisible pointer-events-none' : ''}`}>
                    <CodePanel glslCode={glslCode} status={status} error={error} language={language} setLanguage={setLanguage} fitMode={paletteFitMode} className="h-full" />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
