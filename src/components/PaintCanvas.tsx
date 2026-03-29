import { useEffect, useRef } from 'react';
import type { ProcessResult } from '../types';
import { renderPaintNumbers } from '../lib/render';

interface Props {
  result: ProcessResult;
  minRegionSize: number;
  showColors: boolean;
  onDownload: (getCanvas: () => HTMLCanvasElement | null) => void;
}

export default function PaintCanvas({ result, minRegionSize, showColors, onDownload }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = result.width;
    canvas.height = result.height;
    const ctx = canvas.getContext('2d')!;
    renderPaintNumbers(ctx, result, minRegionSize, showColors);
  }, [result, minRegionSize, showColors]);

  // Expose the canvas node to parent for download
  useEffect(() => {
    onDownload(() => canvasRef.current);
  }, [onDownload]);

  return (
    <div className="canvas-wrapper">
      <canvas ref={canvasRef} className="paint-canvas" />
    </div>
  );
}
