# flok-autocomplete-extension

A Manifest V3 Chrome/Edge extension that injects **chain-aware autocomplete** and **audio-reactive suggestion ranking** into the [flok.cc](https://flok.cc) live coding environment.

Targets [Hydra](https://hydra.ojack.xyz/) (visual synth) and [Strudel](https://strudel.cc/) (rhythm patterns) workflows inside the CodeMirror 6 editor.

## Features

- **Chain-aware autocomplete** — knows which methods are valid after each Hydra source (`osc`, `noise`, `voronoi`, …)
- **Audio-reactive ranking** — suggestions are sorted by bass/mid/treble energy in real time
- **Manual trigger** — `Ctrl+Space` opens the dropdown at any time
- **Strudel support** — pattern and rhythm token completion
- Keyboard navigation: `↑ ↓` to move, `Enter` / `Tab` to accept, `Esc` to dismiss

## Installation

No build step required — load the directory directly as an unpacked extension.

1. Download or clone this repository
2. Open `edge://extensions` (or `chrome://extensions`)
3. Enable **Developer mode**
4. Click **Load unpacked** → select the repository folder

After editing `content.js`, click the refresh icon on the extension card and reload the flok.cc tab.

## How it works

All logic lives in `content.js` as a single IIFE injected at `document_idle` into `https://flok.cc/*`.

### Audio hook

Injected via an inline `<script>` tag into the page context (bypasses MV3 content-script isolation). Wraps `AudioContext.prototype.createAnalyser`, reads FFT data in a `requestAnimationFrame` loop, and writes `{bass, mid, treble, energy}` as JSON to `document.documentElement.dataset.flokAudio`.

### Autocomplete dropdown

A fixed-position `<div>` appended to `document.body`. Triggered on `keyup` inside `.cm-content` elements:

1. `getWordInfo(view)` — reads current line and cursor position
2. `parseHydraContext(line)` — walks tokens right-to-left to find the root Hydra source
3. `getSuggestions(line, prefix)` — selects the suggestion pool, filters by prefix, sorts by audio score
4. Positions dropdown using `view.coordsAtPos()` for accurate screen coordinates
5. Accepts selection via `view.dispatch()`, placing the cursor inside `()`

Arrow / Enter / Tab / Escape are intercepted at the `document` level in **capture phase** so they run before CodeMirror.

## Extending

| Goal | Where to edit |
|---|---|
| Add Hydra source | Push to `hydraBase`; add key to `hydraChain` |
| Add chain methods | Extend the array for the relevant source in `hydraChain` |
| Change audio reactivity | Edit the `sc()` comparator inside `getSuggestions` |
| Add Strudel tokens | Extend the `strudel` array |

## License

[MIT](LICENSE)
