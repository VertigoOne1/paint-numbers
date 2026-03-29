import type { Color } from '../types';
import { buildColorNumbers } from '../lib/render';

interface Props {
  palette: Color[];
}

function toHex(c: Color) {
  return '#' +
    c.r.toString(16).padStart(2, '0') +
    c.g.toString(16).padStart(2, '0') +
    c.b.toString(16).padStart(2, '0');
}

export default function ColorLegend({ palette }: Props) {
  const numbers = buildColorNumbers(palette);

  return (
    <div className="legend">
      <h3 className="legend__title">Colour Key</h3>
      <div className="legend__grid">
        {palette.map((color, i) => (
          <div key={i} className="legend__item">
            <div
              className="legend__swatch"
              style={{ background: toHex(color) }}
            />
            <span className="legend__num">{numbers[i]}</span>
            <span className="legend__hex">{toHex(color)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
