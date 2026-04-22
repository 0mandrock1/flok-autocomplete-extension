(function () {

  // ── Dictionaries ────────────────────────────────────────────────────────────

  const hydraBase = ['osc','noise','shape','src','solid','gradient','voronoi'];

  const hydraChain = {
    osc:      ['modulate','modulateKaleid','modulateRotate','modulateScale',
               'modulateScrollX','modulateScrollY','rotate','kaleid','color',
               'brightness','contrast','saturate','posterize','repeat','pixelate',
               'invert','scale','blend','diff','mult','add','layer','thresh',
               'luma','scrollX','scrollY','out'],
    noise:    ['modulate','modulateKaleid','modulateRotate','modulateScale',
               'modulateScrollX','modulateScrollY','rotate','kaleid','color',
               'brightness','contrast','saturate','posterize','repeat','pixelate',
               'invert','scale','blend','diff','mult','add','layer','thresh',
               'luma','scrollX','scrollY','out'],
    shape:    ['modulate','modulateKaleid','modulateRotate','modulateScale',
               'modulateScrollX','modulateScrollY','rotate','kaleid','color',
               'brightness','contrast','saturate','posterize','repeat','pixelate',
               'invert','scale','blend','diff','mult','add','layer','thresh',
               'luma','scrollX','scrollY','out'],
    gradient: ['modulate','rotate','kaleid','color','brightness','contrast',
               'saturate','posterize','repeat','pixelate','invert','scale',
               'blend','diff','mult','add','layer','thresh','luma','scrollX',
               'scrollY','out'],
    voronoi:  ['modulate','rotate','kaleid','color','brightness','contrast',
               'saturate','posterize','repeat','pixelate','invert','scale',
               'blend','diff','mult','add','layer','thresh','luma','scrollX',
               'scrollY','out'],
    src:      ['modulate','modulateKaleid','modulateRotate','modulateScale',
               'modulateScrollX','modulateScrollY','scale','rotate','kaleid',
               'color','brightness','contrast','saturate','blend','diff','mult',
               'add','layer','thresh','luma','scrollX','scrollY','out'],
    solid:    ['color','brightness','contrast','invert','posterize',
               'blend','diff','mult','add','layer','out'],
  };

  const allChainMethods = new Set(Object.values(hydraChain).flat());

  const strudel = [
    'note','s','stack','sound','bd','sn','hh','cp',
    'slow','fast','every','density','jux','rev',
    'gain','pan','speed','room','delay','delaytime','delayfeedback',
    'lpf','hpf','bpf','crush','n','midinote','chord',
    'euclidean','orbit','struct','echo','seq','cat',
  ];

  // ── Audio (world: MAIN — direct AudioContext access, no isolation) ───────────

  (function hookAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const orig = AC.prototype.createAnalyser;
    let active = null;
    AC.prototype.createAnalyser = function () {
      const a = orig.call(this);
      if (active) return a;
      active = a;
      a.fftSize = 256;
      const data = new Uint8Array(a.frequencyBinCount);
      (function tick() {
        try {
          a.getByteFrequencyData(data);
          let b=0, m=0, t=0;
          for (let i=0; i<data.length; i++) {
            const v=data[i];
            if(i<10) b+=v; else if(i<40) m+=v; else t+=v;
          }
          window.__flokAudio = { bass:b/10, mid:m/30, treble:t/40, energy:(b+m+t)/data.length };
        } catch(e) {}
        requestAnimationFrame(tick);
      })();
      return a;
    };
  })();

  function getAudio() {
    return window.__flokAudio || { bass:0, mid:0, treble:0, energy:0 };
  }

  // ── Context + suggestions ────────────────────────────────────────────────────

  function parseHydraContext(lineUpToCursor) {
    if (!/\.\w*$/.test(lineUpToCursor)) return null;
    const tokens = lineUpToCursor.match(/\w+/g) || [];
    for (let i=tokens.length-1; i>=0; i--)
      if (hydraBase.includes(tokens[i])) return tokens[i];
    for (let i=tokens.length-1; i>=0; i--)
      if (allChainMethods.has(tokens[i])) return '__chain__';
    return null;
  }

  function getSuggestions(lineUpToCursor, prefix) {
    const audio = getAudio();
    const ctx = parseHydraContext(lineUpToCursor);
    let pool;
    if (ctx === '__chain__')         pool = [...allChainMethods];
    else if (ctx && hydraChain[ctx]) pool = hydraChain[ctx];
    else                             pool = [...hydraBase, ...strudel];

    const filtered = pool.filter(w => w.startsWith(prefix) && w !== prefix);
    filtered.sort((a, b) => {
      const sc = w => {
        let s=0;
        if (['bd','osc'].includes(w))                     s += audio.bass   * 2;
        if (['sn','shape','modulate'].includes(w))        s += audio.mid    * 1.5;
        if (['hh','noise','kaleid','rotate'].includes(w)) s += audio.treble * 2;
        s += audio.energy * 0.2;
        return s;
      };
      return sc(b) - sc(a);
    });
    return filtered;
  }

  // ── CM6 helpers (MAIN world — cmView accessible) ─────────────────────────────

  function getView(contentEl) {
    try { return contentEl.cmView.rootView.view; } catch(e) { return null; }
  }

  function getWordInfo(view) {
    const state = view.state;
    const head  = state.selection.main.head;
    const line  = state.doc.lineAt(head);
    const col   = head - line.from;
    const text  = line.text;
    let ws = col;
    while (ws > 0 && /\w/.test(text[ws-1])) ws--;
    return {
      lineUpToCursor: text.slice(0, col),
      prefix:         text.slice(ws, col),
      wordFrom:       line.from + ws,
      head,
    };
  }

  // ── Dropdown ─────────────────────────────────────────────────────────────────

  let dropdown = null, selIdx = 0, suggs = [], activeView = null, activeWordFrom = 0;

  function ensureDropdown() {
    if (dropdown) return dropdown;
    dropdown = document.createElement('div');
    dropdown.id = '__flok-ac';
    dropdown.style.cssText = [
      'position:fixed','z-index:99999','background:#1e1e2e',
      'border:1px solid #585b70','border-radius:6px','max-height:220px',
      'overflow-y:auto','font-family:monospace','font-size:13px',
      'min-width:170px','box-shadow:0 6px 20px rgba(0,0,0,.6)','display:none',
    ].join(';');
    document.body.appendChild(dropdown);
    return dropdown;
  }

  function itemStyle(el, active) {
    el.style.background = active ? '#313244' : 'transparent';
    el.style.color      = active ? '#cba6f7' : '#cdd6f4';
  }

  function render() {
    const dd = ensureDropdown();
    dd.innerHTML = '';
    suggs.forEach((word, i) => {
      const item = document.createElement('div');
      item.textContent = word;
      item.style.cssText = 'padding:4px 12px;cursor:pointer;white-space:nowrap;';
      itemStyle(item, i === selIdx);
      item.addEventListener('mousedown', e => { e.preventDefault(); accept(i); });
      dd.appendChild(item);
    });
  }

  function show(view, s, coords, wordFrom) {
    activeView = view; activeWordFrom = wordFrom; suggs = s; selIdx = 0;
    render();
    const dd = ensureDropdown();
    dd.style.top     = (coords.bottom + 4) + 'px';
    dd.style.left    = coords.left + 'px';
    dd.style.display = 'block';
    console.log('[flok-ac] showing', s.length, 'suggestions:', s.slice(0,3));
  }

  function hide() {
    if (dropdown) dropdown.style.display = 'none';
    suggs = []; activeView = null;
  }

  function visible() {
    return dropdown && dropdown.style.display !== 'none' && suggs.length > 0;
  }

  function moveSel(d) {
    selIdx = Math.max(0, Math.min(selIdx + d, suggs.length - 1));
    [...dropdown.children].forEach((el, i) => itemStyle(el, i === selIdx));
    dropdown.children[selIdx]?.scrollIntoView({ block: 'nearest' });
  }

  function accept(idx) {
    if (!activeView || !suggs[idx]) return;
    const word = suggs[idx];
    const head = activeView.state.selection.main.head;
    activeView.dispatch({
      changes:   { from: activeWordFrom, to: head, insert: word + '()' },
      selection: { anchor: activeWordFrom + word.length + 1 },
    });
    activeView.focus();
    hide();
    console.log('[flok-ac] accepted:', word);
  }

  // ── Keyboard (capture phase — runs before CM6) ───────────────────────────────

  document.addEventListener('keydown', e => {
    if (!visible()) return;
    if (e.key === 'ArrowDown')                     { e.preventDefault(); e.stopPropagation(); moveSel(+1); }
    else if (e.key === 'ArrowUp')                  { e.preventDefault(); e.stopPropagation(); moveSel(-1); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); accept(selIdx); }
    else if (e.key === 'Escape')                   { e.preventDefault(); hide(); }
  }, true);

  // ── Editor attachment ────────────────────────────────────────────────────────

  function onKey(contentEl) {
    const view = getView(contentEl);
    if (!view) { console.warn('[flok-ac] no view'); return; }

    const { lineUpToCursor, prefix, wordFrom } = getWordInfo(view);
    if (prefix.length < 1) { hide(); return; }

    const s = getSuggestions(lineUpToCursor, prefix);
    if (s.length === 0) { hide(); return; }

    const coords = view.coordsAtPos(wordFrom);
    if (!coords || coords.top == null) { hide(); return; }
    show(view, s, coords, wordFrom);
  }

  function attach(contentEl) {
    if (contentEl.dataset.flokAc) return;
    contentEl.dataset.flokAc = '1';

    contentEl.addEventListener('keyup', e => {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
           'Enter','Escape','Tab','Shift','Control','Alt','Meta'].includes(e.key)) return;
      onKey(contentEl);
    });

    contentEl.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === ' ') { e.preventDefault(); onKey(contentEl); }
    });

    contentEl.addEventListener('blur', () => setTimeout(hide, 150));
    console.log('[flok-ac] attached to editor');
  }

  function attachAll() {
    document.querySelectorAll('.cm-content').forEach(attach);
  }

  new MutationObserver(attachAll).observe(document.body, { childList: true, subtree: true });
  attachAll();
  setTimeout(attachAll, 1000);
  setTimeout(attachAll, 3000);

  console.log('[flok-ac] loaded (world: MAIN)');

})();
