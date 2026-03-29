import { useEffect, useRef, useState } from 'react';
import type { ProcessResult, Settings } from '../types';
import { renderPaintNumbers } from '../lib/render';

interface Props {
  result: ProcessResult;
  settings: Pick<
    Settings,
    'minRegionSize' | 'showColors' | 'borderThickness' | 'borderColor' | 'fontSize' | 'numberColor'
  >;
  /** Called once so parent can grab the canvas node for export */
  onRegisterCanvas: (getCanvas: () => HTMLCanvasElement | null) => void;
}

const ZOOM_STEPS = [0.1, 0.2, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4];

export default function PaintCanvas({ result, settings, onRegisterCanvas }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');

  // ── Compute pixel zoom from 'fit' or explicit value ──────────────────────
  function resolvedZoom(): number {
    if (zoom !== 'fit') return zoom;
    const wrapper = wrapperRef.current;
    if (!wrapper) return 1;
    const maxW = wrapper.clientWidth  - 24; // 12px padding each side
    const maxH = wrapper.clientHeight - 24;
    return Math.min(1, maxW / result.width, maxH / result.height);
  }

  // ── Re-render when result or settings change ──────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = result.width;
    canvas.height = result.height;
    const ctx = canvas.getContext('2d')!;
    renderPaintNumbers(ctx, result, settings);
  }, [result, settings]);

  // ── Apply CSS zoom ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const z = resolvedZoom();
    canvas.style.width  = `${Math.round(result.width  * z)}px`;
    canvas.style.height = `${Math.round(result.height * z)}px`;
  });

  // ── Register canvas getter ────────────────────────────────────────────────
  useEffect(() => {
    onRegisterCanvas(() => canvasRef.current);
  }, [onRegisterCanvas]);

  function zoomIn() {
    const cur = resolvedZoom();
    const next = ZOOM_STEPS.find(s => s > cur + 0.001) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
    setZoom(next);
  }

  function zoomOut() {
    const cur = resolvedZoom();
    const prev = [...ZOOM_STEPS].reverse().find(s => s < cur - 0.001) ?? ZOOM_STEPS[0];
    setZoom(prev);
  }

  const pct = Math.round(resolvedZoom() * 100);

  return (
    <div className="paint-canvas-block">
      {/* Zoom toolbar */}
      <div className="zoom-bar">
        <button className="zoom-btn" onClick={zoomOut} aria-label="Zoom out">−</button>
        <span className="zoom-label">{pct}%</span>
        <button className="zoom-btn" onClick={zoomIn} aria-label="Zoom in">+</button>
        <button
          className={`zoom-fit-btn${zoom === 'fit' ? ' zoom-fit-btn--active' : ''}`}
          onClick={() => setZoom('fit')}
        >
          Fit
        </button>
        <button
          className={`zoom-fit-btn${zoom === 1 ? ' zoom-fit-btn--active' : ''}`}
          onClick={() => setZoom(1)}
        >
          100%
        </button>
      </div>

      {/* Scrollable viewport */}
      <div className="canvas-wrapper" ref={wrapperRef}>
        <canvas ref={canvasRef} className="paint-canvas" />
      </div>
    </div>
  );
}

