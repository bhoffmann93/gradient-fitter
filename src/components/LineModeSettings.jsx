import React from 'react';

const ALGO_DESCRIPTIONS = {
  poly: 'Least-squares polynomial fit per RGB channel. Higher degree = more flexibility but may overshoot outside 0–1. Use degree 3–4 for most gradients.',
  cosine: (
    <>
      Fits a + b·cos(2π(ct+d)) per channel. Smooth, loops perfectly with freq locked. Best for organic gradients.{' '}
      <a href="https://iquilezles.org/articles/palettes/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--text)] transition-colors">
        iquilezles.org/articles/palettes
      </a>
    </>
  ),
};

const LineModeSettings = ({ fitMode, setFitMode, degree, setDegree }) => (
  <div className="space-y-3">
    <div className="flex bg-[var(--surface-muted)] p-0.5 rounded-sm">
      {['poly', 'cosine'].map((mode) => (
        <button
          key={mode}
          onClick={() => setFitMode(mode)}
          className={`flex-1 py-1.5 text-[10px] rounded-sm font-semibold tracking-widest uppercase transition-all ${
            fitMode === mode
              ? 'bg-[var(--surface)] text-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          {mode === 'poly' ? 'Polynomial' : 'Cosine'}
        </button>
      ))}
    </div>

    <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
      {ALGO_DESCRIPTIONS[fitMode]}
    </p>

    {fitMode === 'poly' && (
      <div className="flex items-center gap-4">
        <label className="text-[10px] font-semibold text-[var(--text-secondary)] w-16 uppercase tracking-wider">
          Degree
        </label>
        <input
          type="range"
          min="1" max="6" step="1"
          value={degree}
          onChange={(e) => setDegree(parseInt(e.target.value))}
          className="flex-1 h-1 bg-[var(--border)] rounded cursor-pointer accent-[var(--accent)]"
        />
        <span className="text-xs font-mono bg-[var(--accent-bg)] text-[var(--accent)] px-2 py-0.5 rounded-sm">
          {degree}
        </span>
      </div>
    )}
  </div>
);

export default LineModeSettings;
