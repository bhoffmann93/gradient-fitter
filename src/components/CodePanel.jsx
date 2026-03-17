import React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { LANGS } from '../fit/index.js';

const EXAMPLE_LINKS = {
  glsl: { label: 'ShaderToy example', url: 'https://www.shadertoy.com/view/sf23zh' },
  hlsl: { label: 'ShaderToy example', url: 'https://www.shadertoy.com/view/sf23zh' },
  js:   {
    default: { label: 'p5.js example', url: 'https://editor.p5js.org/bhoffmann93/sketches/KP6EBi5KO' },
    catmull: { label: 'p5.js example', url: 'https://editor.p5js.org/bhoffmann93/sketches/-v3Wm2rqn' },
  },
  ts:   {
    default: { label: 'p5.js example', url: 'https://editor.p5js.org/bhoffmann93/sketches/KP6EBi5KO' },
    catmull: { label: 'p5.js example', url: 'https://editor.p5js.org/bhoffmann93/sketches/-v3Wm2rqn' },
  },
};

const getExampleLink = (language, fitMode) => {
  const entry = EXAMPLE_LINKS[language];
  if (!entry) return null;
  if (entry.default) return entry[fitMode] || entry.default;
  return entry;
};

const CodePanel = ({ glslCode, status, error, language, setLanguage, fitMode, className = '' }) => (
  <div className={`bg-[var(--code-bg)] text-[var(--code-text)] p-5 flex flex-col ${className || 'min-h-[480px]'}`}>
    <div className="flex justify-between items-center mb-4 gap-3">
      <div className="flex bg-[var(--code-border)] rounded-sm p-0.5 shrink-0">
        {LANGS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setLanguage(id)}
            className={`px-2.5 py-1 text-[9px] rounded-sm font-semibold tracking-widest uppercase transition-all ${
              language === id
                ? 'bg-[var(--code-surface)] text-[var(--accent)]'
                : 'text-[var(--code-text)] opacity-50 hover:opacity-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {status === 'processing' && (
          <div className="flex items-center gap-2 text-[11px] text-[var(--accent)]">
            <RefreshCw className="w-3 h-3 animate-spin" /> Processing…
          </div>
        )}
        {glslCode && (
          <button
            onClick={() => navigator.clipboard.writeText(glslCode)}
            className="text-[10px] bg-[var(--code-border)] hover:bg-[var(--text-hover)] text-[var(--code-text-strong)] px-3 py-1.5 rounded-sm tracking-widest uppercase font-semibold transition-colors shrink-0"
          >
            Copy
          </button>
        )}
      </div>
    </div>

    <div className="flex-1 min-h-0 font-mono text-xs leading-relaxed overflow-auto whitespace-pre bg-[var(--code-surface)] p-4 border border-[var(--code-border)] w-full min-w-0" style={{ scrollbarGutter: 'stable' }}>
      {glslCode || '// Upload an image to get started'}
    </div>

    <div className="mt-3 flex items-center justify-between">
      {(() => {
        const link = getExampleLink(language, fitMode);
        return link ? (
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-[var(--accent)] opacity-80 hover:opacity-100 transition-opacity tracking-wider"
          >
            {link.label} ↗
          </a>
        ) : null;
      })()}
    </div>

    {error && (
      <div className="mt-2 p-3 bg-red-900/20 border border-red-900/40 text-red-300 text-xs rounded-sm flex items-center gap-2">
        <AlertCircle className="w-4 h-4" /> {error}
      </div>
    )}
  </div>
);

export default CodePanel;
