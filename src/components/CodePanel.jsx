import React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

const CodePanel = ({ glslCode, status, error, className = '' }) => (
  <div className={`bg-[var(--code-bg)] text-[var(--code-text)] p-5 flex flex-col min-h-[480px] ${className}`}>
    <div className="flex justify-between items-center mb-4">
      {status === 'processing' ? (
        <div className="flex items-center gap-2 text-[11px] text-[var(--accent)]">
          <RefreshCw className="w-3 h-3 animate-spin" /> Processing…
        </div>
      ) : <span />}
      {glslCode && (
        <button
          onClick={() => navigator.clipboard.writeText(glslCode)}
          className="text-[10px] bg-[var(--code-border)] hover:bg-[var(--text-hover)] text-[var(--code-text-strong)] px-3 py-1.5 rounded-sm tracking-widest uppercase font-semibold transition-colors"
        >
          Copy
        </button>
      )}
    </div>

    <div className="flex-1 min-h-0 font-mono text-xs leading-relaxed overflow-auto whitespace-pre bg-[var(--code-surface)] p-4 border border-[var(--code-border)] w-full min-w-0">
      {glslCode || '// Upload an image and select a mode...'}
    </div>

    {error && (
      <div className="mt-4 p-3 bg-red-900/20 border border-red-900/40 text-red-300 text-xs rounded-sm flex items-center gap-2">
        <AlertCircle className="w-4 h-4" /> {error}
      </div>
    )}
  </div>
);

export default CodePanel;
