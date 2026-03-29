import type { Color } from '../types';
import { buildColorNumbers, toHex } from '../lib/render';
import { nearestWebColor } from '../lib/webColors';

interface Props {
  palette: Color[];
}

export default function ColorLegend({ palette }: Props) {
  const numbers = buildColorNumbers(palette);

  return (
    <div className="legend">
      <h3 className="legend__title">Colour Key</h3>
      <div className="legend__grid">
        {palette.map((color, i) => {
          const hex = toHex(color);
          const web = nearestWebColor(color);
          return (
            <div key={i} className="legend__item">
              <div
                className="legend__swatch"
                style={{ background: hex }}
              />
              <span className="legend__num">{numbers[i]}</span>
              <div className="legend__labels">
                <span className="legend__name">{web.name}</span>
                <span className="legend__hex">{hex.toUpperCase()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
