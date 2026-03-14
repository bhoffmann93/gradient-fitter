import React from 'react';
import { Activity, Eye } from 'lucide-react';

const GraphPanel = ({ graphRef, shaderCanvasRef }) => (
  <div className="bg-[var(--surface)] p-5 border border-[var(--border)] rounded-sm">
    <div className="space-y-2 mb-4">
      <h3 className="text-[10px] font-semibold text-[var(--text-muted)] flex items-center gap-2 uppercase tracking-widest">
        <Eye className="w-3 h-3" /> Shader Preview
      </h3>
      <div className="w-full h-16 bg-[var(--border)] border border-[var(--border-strong)] overflow-hidden">
        <canvas ref={shaderCanvasRef} width={500} height={64} className="w-full h-full" />
      </div>
    </div>
    <h2 className="font-semibold text-[var(--text)] text-[10px] uppercase tracking-widest mb-4 flex items-center gap-2">
      <Activity className="w-3 h-3 text-[var(--text-muted)]" /> RGB Channels
    </h2>
    <div className="w-full h-56 bg-[var(--bg)] border border-[var(--border)] overflow-hidden">
      <canvas ref={graphRef} className="w-full h-full" />
    </div>
  </div>
);

export default GraphPanel;
