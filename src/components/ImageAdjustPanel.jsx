import React from 'react';
import { Sliders } from 'lucide-react';

const ImageAdjustPanel = ({ contrast, setContrast, minLevel, setMinLevel, maxLevel, setMaxLevel }) => (
  <div className="space-y-3 p-4 bg-[var(--bg)] rounded-sm border border-[var(--border)]">
    <h3 className="text-[10px] font-semibold text-[var(--text-muted)] flex items-center gap-2 uppercase tracking-widest">
      <Sliders className="w-3 h-3" /> Image Processing
    </h3>

    <div className="flex items-center gap-4">
      <label className="text-[10px] font-semibold text-[var(--text-secondary)] w-16 uppercase tracking-wider">
        Contrast
      </label>
      <input
        type="range"
        min="0" max="2" step="0.1"
        value={contrast}
        onChange={(e) => setContrast(parseFloat(e.target.value))}
        className="flex-1 h-1 bg-[var(--border)] rounded appearance-none cursor-pointer accent-[var(--accent)]"
      />
      <span className="text-xs w-8 text-right font-mono text-[var(--text-secondary)]">
        {contrast.toFixed(1)}
      </span>
    </div>

    <div className="flex items-center gap-4">
      <label className="text-[10px] font-semibold text-[var(--text-secondary)] w-16 uppercase tracking-wider">
        Levels
      </label>
      <div className="flex-1 flex gap-2">
        <input
          type="range"
          min="0" max="255" step="1"
          value={minLevel}
          onChange={(e) => setMinLevel(Math.min(parseInt(e.target.value), maxLevel - 5))}
          className="flex-1 h-1 bg-[var(--border)] rounded appearance-none cursor-pointer accent-[var(--accent)]"
        />
        <input
          type="range"
          min="0" max="255" step="1"
          value={maxLevel}
          onChange={(e) => setMaxLevel(Math.max(parseInt(e.target.value), minLevel + 5))}
          className="flex-1 h-1 bg-[var(--border)] rounded appearance-none cursor-pointer accent-[var(--accent)]"
        />
      </div>
      <div className="flex flex-col text-[10px] w-8 text-right leading-3 font-mono text-[var(--text-secondary)]">
        <span>{maxLevel}</span>
        <span className="text-[var(--text-muted)]">{minLevel}</span>
      </div>
    </div>
  </div>
);

export default ImageAdjustPanel;
