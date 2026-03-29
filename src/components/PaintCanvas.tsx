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
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');

  // ── Compute scale factor ───────────────────────────────────────────────────
  // 'fit' uses the wrapper's available width and a fixed max-height cap.
  // An explicit number is used as-is.
  function resolvedZoom(): number {
    if (zoom !== 'fit') return zoom;
    const wrapper = wrapperRef.current;
    const availW = wrapper ? wrapper.clientWidth - 24 : 800;
    // Cap height at ~65 % of viewport so the toolbar stays visible
    const availH = window.innerHeight * 0.65;
    return Math.max(0.05, Math.min(1, availW / result.width, availH / result.height));
  }

  // ── Draw onto canvas when result or render-settings change ────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = result.width;
    canvas.height = result.height;
    renderPaintNumbers(canvas.getContext('2d')!, result, settings);
  }, [result, settings]);

  // ── Register canvas getter with parent ────────────────────────────────────
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

  const z   = resolvedZoom();
  const pct = Math.round(z * 100);

  // Scaled dimensions for the placeholder div that drives the scroll area.
  // The canvas itself is always rendered at native resolution and shifted
  // via CSS transform — this prevents CSS flow from ever clamping one axis
  // independently of the other.
  const scaledW = Math.round(result.width  * z);
  const scaledH = Math.round(result.height * z);

  return (
    <div className="paint-canvas-block">
      {/* Zoom toolbar */}
      <div className="zoom-bar">
        <button className="zoom-btn" onClick={zoomOut} aria-label="Zoom out">−</button>
        <span className="zoom-label">{pct}%</span>
        <button className="zoom-btn" onClick={zoomIn}  aria-label="Zoom in">+</button>
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
        {/*
          Placeholder div at the zoomed size — this is what the scroll area
          measures. The canvas sits inside it at native size and is scaled
          with CSS transform so neither axis is ever clipped by the flow.
        */}
        <div style={{ width: scaledW, height: scaledH, flexShrink: 0, position: 'relative' }}>
          <canvas
            ref={canvasRef}
            className="paint-canvas"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              transformOrigin: 'top left',
              transform: `scale(${z})`,
              imageRendering: z > 1.5 ? 'pixelated' : 'auto',
            }}
          />
        </div>
      </div>
    </div>
  );
}
