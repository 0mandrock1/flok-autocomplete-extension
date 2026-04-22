# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Manifest V3 Chrome extension (2 files) that injects chain-aware autocomplete and audio-reactive suggestion ranking into the Monaco editor on [flok.cc](https://flok.cc). Targets Hydra (visual synth) and Strudel (live coding) workflows.

## Installation / Loading

No build step — load the directory directly as an unpacked extension:

1. Open `edge://extensions` (or `chrome://extensions`)
2. Enable Developer mode
3. Click "Load unpacked" → select this directory

After editing `content.js`, click the refresh icon on the extension card and reload the flok.cc tab.

## Architecture

All logic lives in `content.js` as a single IIFE injected at `document_idle` into `https://flok.cc/*`.

**Important:** flok.cc uses **CodeMirror 6** (not Monaco). The EditorView is accessed via `el.cmView.rootView.view` on any `.cm-content` DOM element.

**Two subsystems:**

1. **Audio hook** (`injectAudioHook`) — injected via an inline `<script>` tag into the page's own context (bypasses MV3 content-script window isolation). Wraps `AudioContext.prototype.createAnalyser`, reads FFT data in a `requestAnimationFrame` loop, and writes `{bass, mid, treble, energy}` as JSON to `document.documentElement.dataset.flokAudio`. Content script reads it back via `getAudio()`.

2. **Custom autocomplete dropdown** — a fixed-position `<div>` injected into `document.body`. Triggered by `keyup` on `.cm-content` elements (and `Ctrl+Space` for manual trigger). Flow:
   - `getWordInfo(view)` — reads current line and cursor from `view.state`, finds word boundary
   - `parseHydraContext(line)` — walks all tokens right-to-left to find root Hydra source
   - `getSuggestions(line, prefix)` — picks pool (chain methods / base / strudel), filters by prefix, sorts by audio score
   - Positions dropdown using `view.coordsAtPos(wordFrom)` (returns real screen coords)
   - Accepts selection via `view.dispatch({changes, selection})` placing cursor inside `()`
   - Arrow/Enter/Tab/Escape intercepted at `document` in **capture phase** so they run before CM6

**Key data structures:**
- `hydraBase` — top-level Hydra source functions
- `hydraChain` — map of source → allowed chained methods  
- `allChainMethods` — flat Set of all chain methods (used as fallback for deep chains)
- `strudel` — Strudel pattern/rhythm tokens

## Extending

- Add new Hydra sources: push to `hydraBase` and add a key to `hydraChain`.
- Add chain methods: extend the array for the relevant source in `hydraChain`.
- Change audio reactivity: edit the `sc()` comparator inside `getSuggestions`.
- The extension has no permissions declared — it relies solely on content-script injection matching `https://flok.cc/*`.
