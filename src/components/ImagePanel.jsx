import React from 'react';
import { Upload } from 'lucide-react';

const ImagePanel = ({
  imageSrc,
  appMode,
  canvasRef,
  uiCanvasRef,
  onImageUpload,
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
          <div className="text-[var(--text-muted)] flex flex-col items-center gap-2 pointer-events-none cursor-pointer">
            <Upload className="w-10 h-10 opacity-25" />
            <span className="text-xs font-semibold tracking-widest uppercase">Upload an image</span>
            <span className="text-[10px] opacity-60 tracking-wider">PNG · JPG · WebP</span>
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
