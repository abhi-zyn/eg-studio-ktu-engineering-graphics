/* =====================================================================
   workbench.js — generic UI shell that every module plugs into.
   A module provides a declarative definition (fields, compute, theory,
   samples, practice). The workbench builds the form, draws the 2D + 3D
   panels, runs the step-by-step player and the export/reset controls.
   It never does projection math itself: it only calls module.compute()
   and hands the result to Svg2D (2D) and Three3D (3D).
   ===================================================================== */
const Workbench = (function () {
  let scene3d = null;         // current Three3D.Scene3D
  let current = null;         // current module def
  let model = null;           // last computed model {prims2D, spec3D, steps, results}
  let stepIndex = 0;
  let curSvg = null;          // live <svg> on screen (exports use a clean clone)
  let showDims = true;        // "Dimensions" toggle (also controls exports)
  let showPlanes = true;      // "HP / VP" toggle in the 3D panel
  let themeName = 'dark';
  let inputsHidden = false;   // inputs collapse to a summary bar after Draw

  const $ = (sel, root = document) => root.querySelector(sel);
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const pad2 = (n) => String(n).padStart(2, '0');
  const threeBg = () => '#171614';   // 3D viewport stays graphite in both themes (like a CAD viewport)

  function mount(moduleDef) {
    teardown();
    current = moduleDef; model = null; stepIndex = 0; curSvg = null;
    const wb = $('#workbench');
    if (moduleDef.status === 'soon') { wb.innerHTML = placeholder(moduleDef); return; }
    wb.innerHTML = '';
    wb.appendChild(h(`<div class="wb-head">
      <h2><span class="num">${pad2(moduleDef.num)}</span>${moduleDef.title}</h2>
      <p class="desc">${moduleDef.desc || ''}</p>
    </div>`));

    const grid = h(`<div class="grid"></div>`);
    grid.appendChild(buildControlColumn(moduleDef));
    grid.appendChild(buildDisplayColumn(moduleDef));
    wb.appendChild(grid);
    wb.appendChild(buildLowerPanels(moduleDef));

    // init 3D
    scene3d = new Three3D.Scene3D($('#three-canvas'));
    scene3d.setBackground(threeBg());
    scene3d.setPlanesVisible(showPlanes);
    initPanZoom($('#svg-host'));

    // auto-draw with the default values so the sheet is never empty
    try { draw(); } catch (e) { /* ignore initial */ }
  }

  function teardown() {
    if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    exitPseudoFs(); inputsHidden = false;
    if (scene3d) { scene3d.dispose(); scene3d = null; }
  }

  /* ---------- Left column: form + buttons + results ---------- */
  function buildControlColumn(m) {
    const col = h(`<div id="ctrl-col"></div>`);
    const form = h(`<div class="card"><h3>Inputs <span class="tag">${m.quadrantNote || 'first angle'}</span>
        <span class="h-tools"><button type="button" class="linkbtn" id="btn-hide-inputs" title="Hide the inputs (they also hide after Draw)">Hide</button></span></h3>
      <form id="form-fields" novalidate></form>
      <div class="field-err" id="form-error" role="alert" aria-live="assertive"></div>
      <div class="btn-row">
        <button class="btn" id="btn-draw" type="button">Draw</button>
        <button class="btn secondary" id="btn-reset" type="button">Reset</button>
      </div>
      <div class="btn-row">
        <button class="btn ghost" id="btn-png" type="button">Export PNG</button>
        <button class="btn ghost" id="btn-pdf" type="button">Export PDF</button>
      </div></div>`);
    const ff = form.querySelector('#form-fields');
    m.fields.forEach(f => ff.appendChild(fieldRow(f)));
    ff.addEventListener('submit', e => { e.preventDefault(); draw({ user: true }); });   // Enter key draws
    ff.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); draw({ user: true }); } });
    col.appendChild(form);

    col.appendChild(h(`<div class="card" id="results-card" style="margin-top:16px">
      <h3>Results <span class="tag">mm · degrees</span></h3><ul class="result-list" id="result-list"><li><span class="k">Press Draw</span><span class="v">—</span></li></ul></div>`));
    return col;
  }

  function fieldRow(f) {
    let control;
    if (f.type === 'select') {
      control = `<select id="fld-${f.name}" name="${f.name}">${f.options.map(o => `<option value="${o.value}" ${o.value == f.default ? 'selected' : ''}>${o.label}</option>`).join('')}</select>`;
    } else {
      control = `<input id="fld-${f.name}" name="${f.name}" type="${f.type || 'number'}" inputmode="decimal" value="${f.default}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} step="${f.step || 'any'}" ${f.hint ? `aria-describedby="hint-${f.name}"` : ''} />`;
    }
    return h(`<div class="form-row">
      <label for="fld-${f.name}">${f.label}${f.unit ? ` <span class="hint">(${f.unit})</span>` : ''}</label>
      ${control}
      ${f.hint ? `<span class="hint" id="hint-${f.name}">${f.hint}</span>` : ''}
    </div>`);
  }

  /* ---------- Right column: 2D + 3D + steps ---------- */
  function buildDisplayColumn(m) {
    const col = h(`<div id="display-col"></div>`);
    // summary bar shown when the inputs are hidden (after Draw)
    col.appendChild(h(`<div class="inputs-bar" id="inputs-bar" hidden>
      <span class="ib-title">Inputs</span><span class="ib-vals" id="inputs-summary"></span>
      <button class="btn secondary" type="button" id="btn-edit-inputs">Edit inputs</button></div>`));
    const views = h(`<div class="grid-views"></div>`);
    views.appendChild(h(`<div class="card view-card"><h3>2D Orthographic Views <span class="tag">FV above · TV below XY</span>
        <span class="h-tools"><label class="chk"><input type="checkbox" id="chk-dims" ${showDims ? 'checked' : ''}/>Dimensions</label>
        <button type="button" class="linkbtn fs-btn" data-fs="2d" aria-label="Show 2D views in full screen">Full screen</button></span></h3>
      <div class="svg-wrap" id="svg-host-wrap">
        <div id="svg-host" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center"><span class="svg-empty">Drawing…</span></div>
        <div class="svg-tools" aria-label="Sheet zoom">
          <button type="button" id="zoom-in" aria-label="Zoom in">+</button>
          <button type="button" id="zoom-out" aria-label="Zoom out">−</button>
          <button type="button" id="zoom-fit" aria-label="Fit drawing" style="width:auto;padding:0 8px">fit</button>
        </div>
        <div class="svg-steps" aria-label="Step controls">
          <button type="button" id="fs-prev" aria-label="Previous step">‹</button>
          <span id="fs-step">—</span>
          <button type="button" id="fs-next" aria-label="Next step">›</button>
        </div>
      </div>
      ${m.legend === false ? '' : legendHTML()}</div>`));
    views.appendChild(h(`<div class="card view-card"><h3>3D Pictorial <span class="tag">drag · scroll · pinch</span>
        <span class="h-tools"><label class="chk"><input type="checkbox" id="chk-planes" ${showPlanes ? 'checked' : ''}/>HP / VP</label>
        <button type="button" class="linkbtn fs-btn" data-fs="3d" aria-label="Show 3D view in full screen">Full screen</button></span></h3>
      <div class="three-wrap"><canvas id="three-canvas" aria-label="3D model of the object with HP and VP"></canvas>
        <div class="three-axes"><span><i style="background:#8A7A5A"></i>HP</span><span><i style="background:#5E6B73"></i>VP</span><span><i style="background:#C9A35A"></i>plan</span><span><i style="background:#9FB4C0"></i>elevation</span></div>
        <div class="three-hint">first angle · object in the quadrant entered</div></div></div>`));
    col.appendChild(views);

    col.appendChild(h(`<div class="card" id="steps-card" style="margin-top:16px">
      <h3>Construction Steps</h3>
      <div class="step-ticks" id="step-ticks" role="tablist" aria-label="Construction steps"></div>
      <div class="steps-ctrl">
        <button class="btn secondary" id="btn-first" type="button">From step 1</button>
        <button class="btn secondary" id="btn-prev" type="button">‹ Prev</button>
        <button class="btn" id="btn-next" type="button">Next step ›</button>
        <button class="btn ghost" id="btn-all" type="button">Show all</button>
        <span class="step-counter" id="step-counter">—</span>
      </div>
      <div class="step-box" id="step-box" aria-live="polite">Press <b>Draw</b> to begin the construction.</div>
    </div>`));
    return col;
  }

  // Legend drawn with real SVG strokes so it matches the sheet (BIS SP:46)
  function legendHTML() {
    const ln = (attrs) => `<svg viewBox="0 0 28 8" aria-hidden="true"><line x1="1" y1="4" x2="27" y2="4" stroke="currentColor" ${attrs}/></svg>`;
    const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#D8432B';
    return `<div class="legend" aria-label="Line types">
      <span>${ln('stroke-width="2.4"')}Visible</span>
      <span>${ln('stroke-width="1.2" stroke-dasharray="4 2.5"')}Hidden</span>
      <span>${ln('stroke-width=".7"')}Construction</span>
      <span>${ln('stroke-width=".7" stroke-dasharray="1 2"')}Projector</span>
      <span>${ln('stroke-width=".9" stroke-dasharray="9 2 2 2"')}XY / centre</span>
      <span><svg viewBox="0 0 28 8" aria-hidden="true"><line x1="4" y1="4" x2="24" y2="4" stroke="${acc}" stroke-width=".9"/><path d="M1 4l5-2.4v4.8zM27 4l-5-2.4v4.8z" fill="${acc}"/></svg>Dimension</span>
    </div>`;
  }

  /* ---------- Lower panels: theory / samples / practice ---------- */
  function buildLowerPanels(m) {
    const card = h(`<div class="card" style="margin-top:16px">
      <div class="subtabs" role="tablist">
        <button type="button" data-tab="theory" class="active" role="tab">Theory &amp; formulas</button>
        <button type="button" data-tab="samples" role="tab">KTU sample problems</button>
        ${m.practice ? '<button type="button" data-tab="practice" role="tab">Practice mode</button>' : ''}
      </div>
      <div id="tab-theory" class="theory">${m.theory || '<p>Theory coming soon.</p>'}</div>
      <div id="tab-samples" style="display:none"><div class="sample-grid"></div></div>
      ${m.practice ? '<div id="tab-practice" style="display:none"></div>' : ''}
    </div>`);
    const sbox = card.querySelector('#tab-samples .sample-grid');
    (m.samples || []).forEach((s, i) => {
      sbox.appendChild(h(`<div class="sample-item"><div class="s-no">Q${pad2(i + 1)}</div><div class="s-name">${s.name}</div>
        <div class="s-desc">${s.desc || ''}</div>
        <button class="btn secondary" type="button" data-sample="${i}">Load &amp; draw</button></div>`));
    });
    if (!(m.samples || []).length) sbox.outerHTML = '<p class="hint">No preloaded problems yet.</p>';
    return card;
  }

  /* ---------- Wiring (one delegated listener) ---------- */
  function bind() {
    document.addEventListener('click', (e) => {
      const t = e.target.closest && e.target.closest('button');
      if (!t) return;
      switch (t.id) {
        case 'btn-draw': return draw({ user: true });
        case 'btn-hide-inputs': return setInputsHidden(true);
        case 'btn-edit-inputs': return setInputsHidden(false, true);
        case 'fs-prev': return setStep(stepIndex - 1, true);
        case 'fs-next': return setStep(stepIndex + 1, true);
        case 'btn-reset': return reset();
        case 'btn-first': return setStep(0, true);
        case 'btn-next': return setStep(stepIndex + 1, true);
        case 'btn-prev': return setStep(stepIndex - 1, true);
        case 'btn-all': return setStep(model ? model.steps.length - 1 : 0);
        case 'btn-png': return doExport('png');
        case 'btn-pdf': return doExport('pdf');
        case 'zoom-in': return zoomBy(1 / 1.25);
        case 'zoom-out': return zoomBy(1.25);
        case 'zoom-fit': return fitView();
      }
      if (t.dataset.fs) toggleFullscreen(t);
      else if (t.dataset.tab) switchTab(t);
      else if (t.dataset.sample != null) loadSample(+t.dataset.sample);
      else if (t.dataset.step != null) setStep(+t.dataset.step, true);
    });
    // ← / → step through the construction (when not typing in a field)
    document.addEventListener('keydown', (e) => {
      if (!model || /INPUT|SELECT|TEXTAREA/.test((e.target.tagName || ''))) return;
      if (e.key === 'ArrowRight') { setStep(stepIndex + 1, true); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { setStep(stepIndex - 1, true); e.preventDefault(); }
      else if (e.key === 'Escape' && document.querySelector('.pseudo-fs')) exitPseudoFs();
    });
    document.addEventListener('fullscreenchange', syncFsButtons);
    document.addEventListener('webkitfullscreenchange', syncFsButtons);
    document.addEventListener('change', (e) => {
      if (e.target.id === 'chk-dims') { showDims = e.target.checked; render2D(false); }
      if (e.target.id === 'chk-planes') { showPlanes = e.target.checked; if (scene3d) scene3d.setPlanesVisible(showPlanes); }
    });
  }

  function setTheme(name) { themeName = name; if (scene3d) scene3d.setBackground(threeBg()); }

  function switchTab(btn) {
    const card = btn.closest('.card');
    card.querySelectorAll('.subtabs button').forEach(b => { b.classList.toggle('active', b === btn); b.setAttribute('aria-selected', String(b === btn)); });
    ['theory', 'samples', 'practice'].forEach(name => {
      const el = card.querySelector('#tab-' + name);
      if (el) el.style.display = (name === btn.dataset.tab) ? '' : 'none';
    });
    if (btn.dataset.tab === 'practice' && current.practice) {
      const box = card.querySelector('#tab-practice');
      if (!box.dataset.inited) { box.dataset.inited = '1'; newPractice(); }
    }
  }

  function readValues() {
    const vals = {};
    current.fields.forEach(f => {
      const el = document.getElementById('fld-' + f.name);
      if (!el) return;
      vals[f.name] = (f.type === 'select' || f.type === 'text') ? el.value : parseFloat(el.value);
    });
    return vals;
  }

  // returns {msg, field} for the first invalid field, or null
  function validate(vals) {
    for (const f of current.fields) {
      const v = vals[f.name];
      if (f.type === 'number' || f.type == null) {
        if (Number.isNaN(v)) return { field: f.name, msg: `“${f.label}” must be a number.` };
        if (f.min != null && v < f.min) return { field: f.name, msg: `“${f.label}” must be ≥ ${f.min}.` };
        if (f.max != null && v > f.max) return { field: f.name, msg: `“${f.label}” must be ≤ ${f.max}.` };
      }
    }
    return null;
  }

  // opts.user = true when the student pressed Draw / loaded a problem:
  // the inputs then collapse so the drawing gets the space.
  function draw(opts = {}) {
    const errBox = document.getElementById('form-error');
    errBox.textContent = '';
    document.querySelectorAll('#form-fields [aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    const vals = readValues();
    const vErr = validate(vals);
    if (vErr) {
      errBox.textContent = vErr.msg;
      const el = document.getElementById('fld-' + vErr.field); if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); }
      return;
    }
    let m;
    try { m = current.compute(vals); }
    catch (e) { errBox.textContent = e.message || String(e); return; }
    model = m;
    renderResults(m.results || []);
    buildTicks();
    // Draw shows the FINISHED drawing (all steps + dimensions). Use
    // "From step 1" / Next to replay the construction one step at a time.
    setStep(m.steps.length - 1);
    if (scene3d) scene3d.buildFromSpec(m.spec3D);
    updateSummary();
    if (opts.user) setInputsHidden(true);
  }

  /* ---------- Inputs: hide after Draw, summary bar + "Edit inputs" ---------- */
  function updateSummary() {
    const box = document.getElementById('inputs-summary'); if (!box || !current) return;
    box.innerHTML = current.fields.map(f => {
      const el = document.getElementById('fld-' + f.name); if (!el) return '';
      const v = f.type === 'select' ? (el.options[el.selectedIndex] || {}).text : el.value + (f.unit ? ' ' + f.unit : '');
      return `<span><i>${f.label}</i> ${v}</span>`;
    }).join('');
  }
  function setInputsHidden(v, focus) {
    const grid = document.querySelector('#workbench .grid'); if (!grid) return;
    inputsHidden = v;
    const ctrl = document.getElementById('ctrl-col'), disp = document.getElementById('display-col');
    const results = document.getElementById('results-card'), steps = document.getElementById('steps-card');
    grid.classList.toggle('inputs-hidden', v);
    ctrl.hidden = v;
    document.getElementById('inputs-bar').hidden = !v;
    // results stay visible: move them under the views while the inputs are hidden
    if (v) { disp.insertBefore(results, steps); results.classList.add('results-wide'); }
    else { ctrl.appendChild(results); results.classList.remove('results-wide'); }
    if (!v && focus) {
      const first = ctrl.querySelector('input,select');
      ctrl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (first) first.focus({ preventScroll: true });
    }
  }

  /* ---------- Full screen for the 2D / 3D panels ----------
     Uses the Fullscreen API; falls back to a fixed full-window panel
     (e.g. iPhone Safari, which has no element fullscreen). */
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  function toggleFullscreen(btn) {
    const card = btn.closest('.view-card');
    if (fsEl() === card) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    if (card.classList.contains('pseudo-fs')) { exitPseudoFs(); return; }
    const req = card.requestFullscreen || card.webkitRequestFullscreen;
    if (req) {
      Promise.resolve(req.call(card)).catch(() => enterPseudoFs(card));
    } else enterPseudoFs(card);
  }
  function enterPseudoFs(card) { card.classList.add('pseudo-fs'); document.body.classList.add('no-scroll'); syncFsButtons(); }
  function exitPseudoFs() { document.querySelectorAll('.pseudo-fs').forEach(c => c.classList.remove('pseudo-fs')); document.body.classList.remove('no-scroll'); syncFsButtons(); }
  function syncFsButtons() {
    document.querySelectorAll('.fs-btn').forEach(b => {
      const card = b.closest('.view-card');
      const on = fsEl() === card || card.classList.contains('pseudo-fs');
      b.textContent = on ? 'Exit full screen' : 'Full screen';
      card.classList.toggle('is-fs', on);
    });
  }

  function render2D(animate) {
    const host = document.getElementById('svg-host');
    if (!host || !model) return;
    curSvg = Svg2D.render(host, model.prims2D, {
      maxStep: stepIndex, currentStep: stepIndex, animate: !!animate,
      showDims, palette: Svg2D.PALETTES.light
    });
    curSvg.dataset.vb0 = curSvg.getAttribute('viewBox');   // remember the fitted view
  }

  function renderResults(results) {
    const ul = document.getElementById('result-list');
    if (!ul) return;
    ul.innerHTML = results.length
      ? results.map(r => `<li><span class="k">${r.k}</span><span class="v">${r.v}</span></li>`).join('')
      : '<li><span class="k">No numeric results</span><span class="v">—</span></li>';
  }

  function buildTicks() {
    const box = document.getElementById('step-ticks'); if (!box || !model) return;
    box.innerHTML = model.steps.map((s, i) =>
      `<button type="button" role="tab" data-step="${i}" title="${s.title.replace(/"/g, '&quot;')}">${pad2(i + 1)}</button>`).join('');
  }

  function setStep(i, animate) {
    if (!model) return;
    const n = model.steps.length;
    stepIndex = Math.max(0, Math.min(n - 1, i));
    render2D(animate);
    const s = model.steps[stepIndex];
    document.getElementById('step-box').innerHTML =
      `<span class="step-title"><span class="n">${pad2(stepIndex + 1)}</span>${s.title}</span>${s.desc || ''}`;
    document.getElementById('step-counter').textContent = `step ${stepIndex + 1} / ${n}`;
    const fsStep = document.getElementById('fs-step');
    if (fsStep) fsStep.textContent = `${pad2(stepIndex + 1)} / ${pad2(n)} · ${s.title}`;
    const fp = document.getElementById('fs-prev'), fn = document.getElementById('fs-next');
    if (fp) fp.disabled = stepIndex === 0; if (fn) fn.disabled = stepIndex === n - 1;
    document.querySelectorAll('#step-ticks button').forEach((b, k) => {
      b.classList.toggle('cur', k === stepIndex); b.classList.toggle('done', k < stepIndex);
      b.setAttribute('aria-selected', String(k === stepIndex));
    });
    document.getElementById('btn-prev').disabled = stepIndex === 0;
    document.getElementById('btn-first').disabled = stepIndex === 0;
    document.getElementById('btn-next').disabled = stepIndex === n - 1;
  }

  function reset() {
    current.fields.forEach(f => { const el = document.getElementById('fld-' + f.name); if (el) el.value = f.default; });
    document.getElementById('form-error').textContent = '';
    draw();
    setInputsHidden(false);
  }

  function loadSample(i) {
    const s = current.samples[i]; if (!s) return;
    Object.entries(s.values).forEach(([k, v]) => { const el = document.getElementById('fld-' + k); if (el) el.value = v; });
    draw({ user: true });
    document.getElementById('svg-host').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ---------- Export: always the fitted view, dimensions as toggled ---------- */
  async function doExport(kind) {
    if (!curSvg) return;
    const clean = curSvg.cloneNode(true);
    clean.setAttribute('viewBox', curSvg.dataset.vb0);           // ignore on-screen pan/zoom
    clean.querySelectorAll('.anim-draw, .anim-fade').forEach(n => { n.removeAttribute('class'); n.removeAttribute('style'); });
    const name = (current.title || 'drawing').replace(/\s+/g, '_');
    if (kind === 'png') await Exporter.exportPNG(clean, name + '.png');
    else await Exporter.exportPDF(clean, `${pad2(current.num)}. ${current.title}`, name + '.pdf');
  }

  /* ---------- Sheet pan / zoom (wheel, drag, pinch) via the viewBox ---------- */
  function vb() { return curSvg ? curSvg.getAttribute('viewBox').split(/\s+/).map(Number) : null; }
  function setVb(a) { if (curSvg) curSvg.setAttribute('viewBox', a.map(n => n.toFixed(3)).join(' ')); }
  function fitView() { if (curSvg) curSvg.setAttribute('viewBox', curSvg.dataset.vb0); }
  function zoomBy(f, fx = 0.5, fy = 0.5) {
    const a = vb(); if (!a) return;
    const b0 = curSvg.dataset.vb0.split(/\s+/).map(Number);
    const nw = Math.min(b0[2] * 3, Math.max(b0[2] / 8, a[2] * f)); const k = nw / a[2];
    setVb([a[0] + a[2] * fx * (1 - k), a[1] + a[3] * fy * (1 - k), a[2] * k, a[3] * k]);
  }
  function initPanZoom(host) {
    const wrap = host.parentElement; const pts = new Map(); let last = null, pinch0 = null;
    const rel = (e) => { const r = curSvg.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    wrap.addEventListener('wheel', e => { if (!curSvg) return; e.preventDefault(); const [fx, fy] = rel(e); zoomBy(e.deltaY > 0 ? 1.12 : 1 / 1.12, fx, fy); }, { passive: false });
    wrap.addEventListener('dblclick', fitView);
    wrap.addEventListener('pointerdown', e => {
      if (!curSvg || e.target.closest('.svg-tools, .svg-steps')) return;
      wrap.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      last = [e.clientX, e.clientY]; wrap.classList.add('panning');
      if (pts.size === 2) { const [p, q] = [...pts.values()]; pinch0 = Math.hypot(p[0] - q[0], p[1] - q[1]); }
    });
    wrap.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId) || !curSvg) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      const r = curSvg.getBoundingClientRect(); const a = vb();
      if (pts.size === 2 && pinch0) {                       // pinch zoom
        const [p, q] = [...pts.values()]; const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
        zoomBy(pinch0 / d, ((p[0] + q[0]) / 2 - r.left) / r.width, ((p[1] + q[1]) / 2 - r.top) / r.height); pinch0 = d; return;
      }
      const s = Math.max(a[2] / r.width, a[3] / r.height);  // px -> viewBox units (meet)
      setVb([a[0] - (e.clientX - last[0]) * s, a[1] - (e.clientY - last[1]) * s, a[2], a[3]]);
      last = [e.clientX, e.clientY];
    });
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = null; if (!pts.size) wrap.classList.remove('panning'); else last = [...pts.values()][0]; };
    wrap.addEventListener('pointerup', up); wrap.addEventListener('pointercancel', up);
  }

  /* ---------- Practice mode ---------- */
  function newPractice() {
    if (!current.practice) return;
    const box = document.getElementById('tab-practice'); if (!box) return;
    const p = current.practice();
    const fill = () => { Object.entries(p.values).forEach(([k, v]) => { const el = document.getElementById('fld-' + k); if (el) el.value = v; }); draw({ user: true }); };
    box.innerHTML = `<div class="practice-q">
      <div class="q-text"><b>Question.</b> ${p.question}</div>
      <div class="btn-row">
        <button class="btn" type="button" data-practice="load">Load values into form</button>
        <button class="btn secondary" type="button" data-practice="show">Show solution</button>
        <button class="btn ghost" type="button" data-practice="new">New question</button>
      </div>
      <div class="solution" id="practice-solution" style="display:none"></div>
    </div>`;
    box.querySelector('[data-practice="load"]').addEventListener('click', fill);
    box.querySelector('[data-practice="new"]').addEventListener('click', newPractice);
    box.querySelector('[data-practice="show"]').addEventListener('click', () => {
      fill();
      const sol = document.getElementById('practice-solution');
      sol.style.display = ''; sol.innerHTML = `<b>Solution.</b> ${p.solution}`;
    });
  }

  function placeholder(m) {
    return `<div class="wb-head"><h2><span class="num">${pad2(m.num)}</span>${m.title}</h2><p class="desc">${m.desc || ''}</p></div>
      <div class="card placeholder"><div class="ph-label">Coming next</div>
      <p>This module is scaffolded and will be built in a later round.</p>
      <p class="hint">Modules 01 (Points) and 02 (Lines &amp; Traces) are fully interactive now.</p></div>`;
  }

  return { mount, bind, setTheme };
})();
if (typeof window !== 'undefined') window.Workbench = Workbench;
