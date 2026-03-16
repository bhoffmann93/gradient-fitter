import React from 'react';
import { Upload } from 'lucide-react';
import flameImg from '../assets/images/flame.jpg';
import tulipImg from '../assets/images/tulip.jpg';
import spectrumImg from '../assets/images/spectrum.jpg';

const EXAMPLES = [
  { src: flameImg, label: 'Flame' },
  { src: tulipImg, label: 'Tulip' },
  { src: spectrumImg, label: 'Spectrum' },
];

const ImagePanel = ({
  imageSrc,
  appMode,
  canvasRef,
  uiCanvasRef,
  onImageUpload,
  onExampleLoad,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}) => {
  const fileInputRef = React.useRef(null);

  return (
    <div className="bg-[var(--surface)] p-5 border border-[var(--border)] rounded-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-[var(--text)] text-[10px] uppercase tracking-widest">
          {appMode === 'line' ? (imageSrc ? 'Sample Line' : 'Input') : 'Palette Source'}
        </h2>
        <label className="text-[10px] font-semibold bg-[var(--text)] text-[var(--bg)] px-3 py-1.5 rounded-sm cursor-pointer hover:bg-[var(--text-hover)] tracking-widest uppercase transition-colors">
          {imageSrc ? 'Change' : 'Upload'}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={onImageUpload} className="hidden" />
        </label>
      </div>

      <div
        className="relative flex justify-center items-center bg-[var(--bg)] border-2 border-dashed border-[var(--border-strong)] overflow-hidden min-h-[200px] max-h-[380px] select-none"
        onClick={() => !imageSrc && fileInputRef.current?.click()}
      >
        {!imageSrc && (
          <div className="flex flex-col items-center gap-4 pointer-events-none">
            <div className="text-[var(--text-muted)] flex flex-col items-center gap-2">
              <Upload className="w-10 h-10 opacity-25" />
              <span className="text-xs font-semibold tracking-widest uppercase">Upload an image</span>
              <span className="text-[10px] opacity-60 tracking-wider">PNG · JPG · WebP</span>
            </div>
            <div className="flex flex-col items-center gap-2 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-[var(--text-muted)] opacity-60">Examples</span>
              <div className="flex gap-2">
              {EXAMPLES.map(({ src, label }) => (
                <button
                  key={label}
                  onClick={() => onExampleLoad(src)}
                  className="flex flex-col items-center gap-1 group"
                >
                  <img
                    src={src}
                    alt={label}
                    className="w-16 h-10 object-cover rounded-sm border border-[var(--border)] group-hover:border-[var(--accent)] transition-colors"
                  />
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors">
                    {label}
                  </span>
                </button>
              ))}
              </div>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
        <canvas
          ref={uiCanvasRef}
          className={`max-w-full max-h-[380px] object-contain touch-none ${!imageSrc ? 'hidden' : 'block'} ${appMode === 'line' ? 'cursor-crosshair' : 'cursor-default'}`}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />
      </div>
    </div>
  );
};

export default ImagePanel;
