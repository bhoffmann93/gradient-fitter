import React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

const CodePanel = ({ glslCode, status, error }) => (
  <div className="min-w-0 lg:self-stretch">
    <div className="bg-[var(--code-bg)] text-[var(--code-text)] p-5 rounded-sm h-full flex flex-col overflow-hidden w-full border border-[var(--code-border)]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-[var(--code-text-strong)] text-[10px] uppercase tracking-widest flex items-center gap-2">
          Generated GLSL
        </h2>
        {glslCode && (
          <button
            onClick={() => navigator.clipboard.writeText(glslCode)}
            className="text-[10px] bg-[var(--code-border)] hover:bg-[var(--text-hover)] text-[var(--code-text-strong)] px-3 py-1.5 rounded-sm tracking-widest uppercase font-semibold transition-colors"
          >
            Copy
          </button>
        )}
      </div>

      {status === 'processing' && (
        <div className="mb-3 flex items-center gap-2 text-[11px] text-[var(--accent)]">
          <RefreshCw className="w-3 h-3 animate-spin" /> Processing…
        </div>
      )}

      <div className="flex-1 font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre bg-[var(--code-surface)] p-4 border border-[var(--code-border)] w-full min-w-0">
        {glslCode || '// Upload an image and select a mode...'}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-900/40 text-red-300 text-xs rounded-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
    </div>
  </div>
);

export default CodePanel;
