# Paint by Numbers

A browser-based tool that converts any photo into a numbered paint-by-numbers template — no server required. All processing happens locally in your browser.

![Paint by Numbers screenshot](docs/screenshot.png)

## Features

- **Drag-and-drop image upload** — PNG, JPG, WEBP, or any format your browser supports
- **Two colour-quantisation algorithms:**
  - **K-Means** — iteratively clusters pixels to minimise colour variance; generally produces richer, more perceptually-even palettes
  - **Median Cut** — recursively splits the colour space along its widest axis; faster and deterministic
- **Live preview** — results re-render automatically ~350 ms after any control change
- **Simplification slider** — box-blur applied before quantisation to reduce noise and merge fine detail; higher values produce fewer, simpler regions
- **Colour count** — choose 2–24 colours
- **Minimum region size** — suppress number labels on regions smaller than a chosen pixel threshold
- **Colour / line-art toggle** — view the filled palette preview or the classic black-outline numbering style
- **Colour key** — swatches with hex codes and paint numbers shown beneath the canvas
- **Download PNG** — export the final paint-by-numbers canvas at the processed resolution
- **Fully private** — nothing is sent to any server

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev
# → http://localhost:5173
```

To build for production:

```bash
npm run build
# output in dist/
```

Preview the production build:

```bash
npm run preview
```

## How it works

```
Photo → Scale (≤700 px) → Blur → Quantise → Colour map → Segments → Render
```

1. **Scale** — the image is scaled to a maximum of 700 px on its longest edge before processing. This keeps CPU time and memory usage manageable without visibly degrading the output at typical screen sizes.

2. **Blur** (`src/lib/blur.ts`) — a separable box blur is applied to the raw pixel data. Multiple passes at increasing radii approximate a Gaussian blur. Higher amounts merge nearby colours and reduce the number of disconnected tiny regions.

3. **Quantisation** (`src/lib/quantize.ts`)
   - *K-Means*: samples up to 15 000 pixels, seeds centroids with K-Means++ to minimise empty-cluster risk, then iterates until convergence (max 25 passes). The final palette is applied to every pixel via nearest-neighbour lookup.
   - *Median Cut*: samples up to 20 000 pixels, recursively splits the bucket with the widest colour range until *k* buckets exist, then averages each bucket.

4. **Segmentation** (`src/lib/segment.ts`) — an iterative 4-connected flood-fill assigns each contiguous run of identically-indexed pixels its own region record (centroid, area, pixel list).

5. **Rendering** (`src/lib/render.ts`) — border pixels (where a pixel's colour index differs from a neighbour) are painted black; the centroid of each region large enough to exceed `minRegionSize` receives its colour number.

## Project structure

```
paint-numbers/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx            # React entry point
    ├── App.tsx             # Top-level state & orchestration
    ├── index.css           # All styles (CSS variables, dark theme)
    ├── types.ts            # Shared TypeScript interfaces
    ├── lib/
    │   ├── blur.ts         # Separable box blur
    │   ├── quantize.ts     # K-Means & Median Cut algorithms
    │   ├── segment.ts      # Connected-component flood fill
    │   ├── render.ts       # Canvas drawing & colour-number assignment
    │   └── processor.ts    # Pipeline: scale → blur → quantise → segment
    └── components/
        ├── DropZone.tsx    # Drag-and-drop / click upload area
        ├── Controls.tsx    # Settings sidebar (sliders, toggles, segmented buttons)
        ├── PaintCanvas.tsx # Canvas element that renders the result
        └── ColorLegend.tsx # Numbered colour swatch grid
```

## Controls reference

| Control | Range | Effect |
|---|---|---|
| Algorithm | K-Means / Median Cut | Colour quantisation method |
| Number of colours | 2–24 | Palette size |
| Simplification | 0–20 | Blur radius before quantisation |
| Min region size | 10–600 px | Minimum area for a number label |
| Show colours | on/off | Toggle filled preview vs line-art |

## Tips

- **Too many tiny regions?** — Increase *Simplification* or *Min region size*.
- **Colours look muddy?** — Reduce *Simplification* so less blurring happens before quantisation.
- **Want a simpler painting?** — Lower *Number of colours* (6–8 is a good starting point).
- **K-Means is non-deterministic** — if you don't like the colour split, re-run with the same settings for a different initialisation.
- **Large images** — the tool scales internally to 700 px; the download will be at that resolution. Crop your photo first if you want a higher-resolution output.

## License

MIT
