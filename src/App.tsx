import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProcessResult, Settings } from './types';
import { processImage } from './lib/processor';
import { renderPaintNumbers, createColorReferenceCanvas } from './lib/render';
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
  borderThickness: 1,
  borderColor: '#cccccc',
  fontSize: 10,
  numberColor: '#888888',
};

/** Extract raw ImageData from an HTMLImageElement via an offscreen canvas. */
function imageToData(img: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width  = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
}

/** Trigger a browser download of `canvas` as a PNG. */
function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const a = document.createElement('a');
  a.href     = canvas.toDataURL('image/png');
  a.download = filename;
  a.click();
}

export default function App() {
  const [imageData, setImageData]   = useState<ImageData | null>(null);
  const [imageSrc, setImageSrc]     = useState<string>('');
  const [settings, setSettings]     = useState<Settings>(DEFAULT_SETTINGS);
  const [result, setResult]         = useState<ProcessResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError]           = useState<string>('');

  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const getCanvasRef  = useRef<(() => HTMLCanvasElement | null) | null>(null);

  // ── Load image ──────────────────────────────────────────────────────────────
  function handleImage(img: HTMLImageElement) {
    const thumb = document.createElement('canvas');
    thumb.width  = img.naturalWidth;
    thumb.height = img.naturalHeight;
    thumb.getContext('2d')!.drawImage(img, 0, 0);
    setImageSrc(thumb.toDataURL('image/jpeg', 0.6));

    setImageData(imageToData(img));
    setResult(null);
    setError('');
  }

  // ── Process on settings/image change (debounced 350 ms) ────────────────────
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

  // ── Export: line-art (current showColors state) ─────────────────────────────
  function handleDownload() {
    const canvas = getCanvasRef.current?.();
    if (!canvas) return;
    downloadCanvas(canvas, 'paint-by-numbers.png');
  }

  // ── Export: forced colour fill ──────────────────────────────────────────────
  function handleDownloadWithColor() {
    if (!result) return;
    const tmp = document.createElement('canvas');
    tmp.width  = result.width;
    tmp.height = result.height;
    const ctx  = tmp.getContext('2d')!;
    renderPaintNumbers(ctx, result, { ...settings, showColors: true });
    downloadCanvas(tmp, 'paint-by-numbers-colour.png');
  }

  // ── Export: colour reference card ───────────────────────────────────────────
  function handleDownloadColorRef() {
    if (!result) return;
    downloadCanvas(createColorReferenceCanvas(result.palette), 'paint-colour-reference.png');
  }

  const handleRegisterCanvas = useCallback(
    (fn: () => HTMLCanvasElement | null) => { getCanvasRef.current = fn; },
    [],
  );

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
                <li>High-contrast photos with clear subjects work best</li>
                <li>Landscapes and portraits are ideal</li>
                <li>Start with 6–10 colours for a manageable painting</li>
                <li>Increase Simplification if there are too many tiny regions</li>
                <li>Photos are scaled up to 4K for output — originals are never uploaded</li>
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
                  <span className="spinner spinner--large" />
                  Processing image at up to 4K…
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
                    <div className="canvas-toolbar__actions">
                      <button className="btn btn--primary" onClick={handleDownload}>
                        Download PNG
                      </button>
                      <button className="btn btn--secondary" onClick={handleDownloadWithColor}>
                        Export with colour
                      </button>
                      <button className="btn btn--secondary" onClick={handleDownloadColorRef}>
                        Colour reference card
                      </button>
                    </div>
                  </div>

                  {processing && (
                    <div className="processing-overlay">
                      <span className="spinner" /> Updating…
                    </div>
                  )}

                  <PaintCanvas
                    result={result}
                    settings={settings}
                    onRegisterCanvas={handleRegisterCanvas}
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
        All processing happens locally in your browser — no image is ever uploaded.
      </footer>
    </div>
  );
}
