import React from 'react';

const Toggle = ({ on, onToggle, labelOn, labelOff }) => (
  <button
    onClick={onToggle}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
      on ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'
    }`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
        on ? 'translate-x-4' : 'translate-x-1'
      }`}
    />
    <span className="sr-only">{on ? labelOn : labelOff}</span>
  </button>
);

const ALGO_DESCRIPTIONS = {
  poly: 'Least-squares polynomial fit per RGB channel. Higher degree = more flexibility but may overshoot outside 0–1. Use degree 3–4 for most gradients.',
  cosine: (
    <>
      Fits{' '}
      <code className="font-mono bg-[var(--accent-bg)] text-[var(--accent)] px-1 py-0.5 rounded-sm text-[9px]">
        a + b·cos(2π(ct+d))
      </code>{' '}
      per RGB color channel. Loops for t &gt; 1.0 if freq locked.
    </>
  ),
};

const LineModeSettings = ({ fitMode, setFitMode, degree, setDegree, lockFrequency, setLockFrequency }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">
        Curve Fitting Function
      </span>
      <div className="flex-1 border-t border-[var(--border)]" />
    </div>

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

    <div className="min-h-[40px]">
      <p
        key={fitMode}
        className="text-[10px] text-[var(--text-muted)] leading-relaxed"
        style={{ animation: 'fadeIn 0.15s ease' }}
      >
        {ALGO_DESCRIPTIONS[fitMode]}
      </p>
    </div>

    <div className="relative h-[52px]">
      <div
        className={`absolute inset-0 transition-opacity duration-150 space-y-2 ${fitMode === 'cosine' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        <p className="text-[10px] text-[var(--text-muted)]">
          More info:{' '}
          <a
            href="https://iquilezles.org/articles/palettes/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[var(--text)] transition-colors"
          >
            iquilezles.org/articles/palettes
          </a>
        </p>
        <div className="flex items-center gap-3">
          <label className="text-[10px] font-semibold text-[var(--text-secondary)] w-20 uppercase tracking-wider">
            Lock freq
          </label>
          <Toggle on={lockFrequency} onToggle={() => setLockFrequency((v) => !v)} labelOn="Locked" labelOff="Free" />
          <span className="text-[10px] text-[var(--text-muted)]">
            {lockFrequency ? 'Locked – loops for t > 1.0' : 'Free – more accurate, may not loop'}
          </span>
        </div>
      </div>
      <div
        className={`absolute inset-0 flex items-center gap-4 transition-opacity duration-150 ${fitMode === 'poly' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        <label className="text-[10px] font-semibold text-[var(--text-secondary)] w-20 uppercase tracking-wider">
          Degree
        </label>
        <input
          type="range"
          min="1"
          max="6"
          step="1"
          value={degree}
          onChange={(e) => setDegree(parseInt(e.target.value))}
          className="flex-1 h-1 bg-[var(--border)] rounded cursor-pointer accent-[var(--accent)]"
        />
        <span className="text-xs font-mono bg-[var(--accent-bg)] text-[var(--accent)] px-2 py-0.5 rounded-sm">
          {degree}
        </span>
      </div>
    </div>
  </div>
);

export default LineModeSettings;
