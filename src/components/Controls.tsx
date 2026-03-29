import type { Settings, Algorithm } from '../types';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onReset: () => void;
  processing: boolean;
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="control-group">
      <div className="control-label">
        <span>{label}</span>
        <span className="control-value">{value}</span>
      </div>
      {hint && <p className="control-hint">{hint}</p>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="slider"
      />
      <div className="slider-bounds">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export default function Controls({ settings, onChange, onReset, processing }: Props) {
  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <aside className="controls">
      <h2 className="controls__title">Settings</h2>

      <div className="control-group">
        <label className="control-label" htmlFor="algo-select">Algorithm</label>
        <p className="control-hint">K-means tends to give richer colours; Median Cut is faster.</p>
        <div className="segmented">
          {(['kmeans', 'mediancut'] as Algorithm[]).map(a => (
            <button
              key={a}
              className={`segmented__btn${settings.algorithm === a ? ' segmented__btn--active' : ''}`}
              onClick={() => set('algorithm', a)}
            >
              {a === 'kmeans' ? 'K-Means' : 'Median Cut'}
            </button>
          ))}
        </div>
      </div>

      <Slider
        label="Number of colours"
        hint="More colours = more detail, but harder to paint."
        value={settings.numColors}
        min={2}
        max={24}
        onChange={v => set('numColors', v)}
      />

      <Slider
        label="Simplification"
        hint="Higher values blur fine detail and reduce the number of tiny regions."
        value={settings.blur}
        min={0}
        max={20}
        onChange={v => set('blur', v)}
      />

      <Slider
        label="Min region size (px)"
        hint="Regions smaller than this won't receive a number label."
        value={settings.minRegionSize}
        min={10}
        max={600}
        step={10}
        onChange={v => set('minRegionSize', v)}
      />

      <div className="control-group">
        <label className="control-label toggle-label">
          <span>Show colours</span>
          <span className="control-hint">Preview the palette fill</span>
          <div
            className={`toggle${settings.showColors ? ' toggle--on' : ''}`}
            role="switch"
            aria-checked={settings.showColors}
            tabIndex={0}
            onClick={() => set('showColors', !settings.showColors)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') set('showColors', !settings.showColors); }}
          >
            <div className="toggle__knob" />
          </div>
        </label>
      </div>

      {processing && (
        <div className="processing-badge">
          <span className="spinner" /> Processing…
        </div>
      )}

      <button className="btn btn--ghost" onClick={onReset}>
        Load new image
      </button>
    </aside>
  );
}
