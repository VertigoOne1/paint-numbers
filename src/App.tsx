import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProcessResult, Settings } from './types';
import { processImage } from './lib/processor';
import DropZone from './components/DropZone';
import Controls from './components/Controls';
import PaintCanvas from './components/PaintCanvas';
import ColorLegend from './components/ColorLegend';

const DEFAULT_SETTINGS: Settings = {
  numColors: 8,
  algorithm: 'kmeans',
  blur: 4,
  minRegionSize: 80,
  showColors: false,
};

/** Extract raw ImageData from an HTMLImageElement via an offscreen canvas. */
function imageToData(img: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width  = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export default function App() {
  const [imageData, setImageData]   = useState<ImageData | null>(null);
  const [imageSrc, setImageSrc]     = useState<string>('');
  const [settings, setSettings]     = useState<Settings>(DEFAULT_SETTINGS);
  const [result, setResult]         = useState<ProcessResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError]           = useState<string>('');

  // Debounce handle
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // For the download callback
  const getCanvasRef = useRef<(() => HTMLCanvasElement | null) | null>(null);

  // ── Load image ──────────────────────────────────────────────────────────────
  function handleImage(img: HTMLImageElement) {
    const src = img.src; // already an object URL (revoked after load — store data instead)
    // Re-draw onto canvas to get a stable URL for the thumbnail
    const thumb = document.createElement('canvas');
    thumb.width  = img.naturalWidth;
    thumb.height = img.naturalHeight;
    thumb.getContext('2d')!.drawImage(img, 0, 0);
    setImageSrc(thumb.toDataURL('image/jpeg', 0.6));

    const data = imageToData(img);
    setImageData(data);
    setResult(null);
    setError('');
    void src; // suppress lint warning
  }

  // ── Run processor whenever imageData or settings change (debounced 350 ms) ─
  useEffect(() => {
    if (!imageData) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setProcessing(true);
      setError('');
      try {
        const r = await processImage(imageData, settings);
        setResult(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Processing failed');
      } finally {
        setProcessing(false);
      }
    }, 350);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [imageData, settings]);

  // ── Download handler ────────────────────────────────────────────────────────
  function handleDownload() {
    const canvas = getCanvasRef.current?.();
    if (!canvas) return;
    const a = document.createElement('a');
    a.href     = canvas.toDataURL('image/png');
    a.download = 'paint-by-numbers.png';
    a.click();
  }

  const handleGetCanvas = useCallback((fn: () => HTMLCanvasElement | null) => {
    getCanvasRef.current = fn;
  }, []);

  // ── Reset ───────────────────────────────────────────────────────────────────
  function handleReset() {
    setImageData(null);
    setImageSrc('');
    setResult(null);
    setError('');
  }

  const hasImage = imageData !== null;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__inner">
          <span className="app-header__logo">🎨</span>
          <h1 className="app-header__title">Paint by Numbers</h1>
          <p className="app-header__subtitle">Turn any photo into a numbered colour template</p>
        </div>
      </header>

      <main className="app-main">
        {!hasImage ? (
          <div className="upload-screen">
            <DropZone onImage={handleImage} />
            <div className="upload-tips">
              <h3>Tips for best results</h3>
              <ul>
                <li>Use high-contrast photos with clear subjects</li>
                <li>Landscapes and portraits work especially well</li>
                <li>Start with 6–10 colours for a manageable painting</li>
                <li>Increase Simplification if there are too many tiny regions</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="editor">
            <Controls
              settings={settings}
              onChange={setSettings}
              onReset={handleReset}
              processing={processing}
            />

            <div className="editor__canvas-area">
              {error && <div className="error-banner">{error}</div>}

              {!result && !processing && (
                <div className="placeholder">Waiting for processing…</div>
              )}

              {processing && !result && (
                <div className="placeholder">
                  <span className="spinner spinner--large" /> Processing image…
                </div>
              )}

              {result && (
                <>
                  <div className="canvas-toolbar">
                    <div className="canvas-toolbar__info">
                      {result.width} × {result.height} px &nbsp;·&nbsp;
                      {result.palette.length} colours &nbsp;·&nbsp;
                      {result.regions.length.toLocaleString()} regions
                    </div>
                    <button className="btn btn--primary" onClick={handleDownload}>
                      Download PNG
                    </button>
                  </div>

                  <PaintCanvas
                    result={result}
                    minRegionSize={settings.minRegionSize}
                    showColors={settings.showColors}
                    onDownload={handleGetCanvas}
                  />

                  <ColorLegend palette={result.palette} />

                  {imageSrc && (
                    <details className="original-toggle">
                      <summary>Show original photo</summary>
                      <img src={imageSrc} alt="Original" className="original-img" />
                    </details>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        All processing happens locally in your browser — no image is uploaded anywhere.
      </footer>
    </div>
  );
}
