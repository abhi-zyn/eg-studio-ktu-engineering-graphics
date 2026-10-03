/* =====================================================================
   workbench.js — drives the drafting-sheet UI for the active module.
   Fills the rail form + results, the drawing sheet (SVG), the step
   timeline and the 3D drawer. Keeps the module contract unchanged:
     module.compute(values) -> { prims2D, spec3D, steps, results }
   ===================================================================== */
const Workbench = (function () {
  let scene3d = null, current = null, model = null, stepIndex = 0, curSvg = null;
  let showDims = true, planesVisible = true, themeName = 'light';
  const $ = id => document.getElementById(id);

  function palette() { return Svg2D.PALETTES[themeName] || Svg2D.PALETTES.light; }

  function mount(def) {
    current = def; model = null; stepIndex = 0; curSvg = null;
    // Title block
    $('tbTopic').textContent = `${String(def.num).padStart(2, '0')}  ${def.title}`;
    $('tbSheet').textContent = String(def.num).padStart(2, '0');
    $('tbDate').textContent = new Date().toISOString().slice(0, 10);
    $('formTitle').textContent = def.status === 'soon' ? 'Inputs — coming soon' : 'Inputs';
    buildLegend();
    buildForm(def);

    // (Re)create 3D scene bound to the canvas
    if (scene3d) { scene3d.dispose(); scene3d = null; }
    const overlay = $('threeEmpty');
    if (def.status === 'soon') {
      renderPlaceholder(def);
      if (overlay) { overlay.hidden = false; overlay.querySelector('p').textContent = 'No 3D model for this module yet.'; overlay.querySelector('.spinner').style.display = 'none'; }
      return;
    }
    if (overlay) { overlay.hidden = false; overlay.querySelector('.spinner').style.display = ''; overlay.querySelector('p').textContent = 'Preparing 3D model…'; }
    scene3d = new Three3D.Scene3D($('three-canvas'));
    scene3d.setBackground(themeName === 'dark' ? '#141311' : '#F4EFE3');
    scene3d.setPlanesVisible(planesVisible);

    try { draw(); } catch (e) { /* ignore first-draw issues */ }
    requestAnimationFrame(() => { if (overlay) overlay.hidden = true; });
  }

  function renderPlaceholder(def) {
    $('sheetSvg').innerHTML = `<div style="margin:auto;text-align:center;color:var(--muted);font-family:'IBM Plex Mono',monospace;padding:40px">
      <div style="font-size:34px">◱</div><p>Module ${String(def.num).padStart(2, '0')} — ${def.title}</p>
      <p style="font-size:12px">Scaffolded. Modules 01 &amp; 02 are fully interactive.</p></div>`;
    $('timeline').innerHTML = ''; $('stepDetail').textContent = 'This module is coming soon.';
    $('resultsHost').innerHTML = '<tbody><tr><td class="rk">—</td><td class="rv">—</td></tr></tbody>';
  }

  /* ---------- form ---------- */
  function buildForm(def) {
    const host = $('formHost'); host.innerHTML = '';
    if (!def.fields || !def.fields.length) { host.innerHTML = '<p class="hint">No inputs.</p>'; return; }
    def.fields.forEach(f => {
      const wrap = document.createElement('div'); wrap.className = 'field';
      let control;
      if (f.type === 'select') control = `<select id="fld-${f.name}">${f.options.map(o => `<option value="${o.value}" ${o.value == f.default ? 'selected' : ''}>${o.label}</option>`).join('')}</select>`;
      else control = `<input id="fld-${f.name}" type="${f.type || 'number'}" value="${f.default}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} step="${f.step || 'any'}" />`;
      wrap.innerHTML = `<label for="fld-${f.name}">${f.label}${f.unit ? ` (${f.unit})` : ''}</label>${control}${f.hint ? `<span class="hint">${f.hint}</span>` : ''}`;
      host.appendChild(wrap);
    });
  }

  function buildLegend() {
    const p = palette();
    $('legend').innerHTML = [
      ['Visible', `border-top:2px solid ${p.ink}`],
      ['Hidden', `border-top:1.5px dashed ${p.hidden}`],
      ['Construction', `border-top:1px solid ${p.thin}`],
      ['Projector', `border-top:1px dotted ${p.thin}`],
      ['Centre (XY)', `border-top:1.5px dashed ${p.chain}`],
      ['Dimension', `border-top:2px solid ${p.accent}`]
    ].map(([l, s]) => `<span><i style="${s}"></i>${l}</span>`).join('');
  }

  /* ---------- values / validation ---------- */
  function readValues() {
    const v = {};
    current.fields.forEach(f => { const el = $('fld-' + f.name); if (el) v[f.name] = (f.type === 'select' || f.type === 'text') ? el.value : parseFloat(el.value); });
    return v;
  }
  function validate(v) {
    for (const f of current.fields) {
      if (f.type === 'select' || f.type === 'text') continue;
      const x = v[f.name];
      if (Number.isNaN(x)) return `“${f.label}” must be a number.`;
      if (f.min != null && x < f.min) return `“${f.label}” must be ≥ ${f.min}.`;
      if (f.max != null && x > f.max) return `“${f.label}” must be ≤ ${f.max}.`;
    }
    return null;
  }

  /* ---------- draw ---------- */
  function draw() {
    const err = $('formError'); err.textContent = '';
    const v = readValues();
    const ve = validate(v); if (ve) { err.textContent = ve; return; }
    let m; try { m = current.compute(v); } catch (e) { err.textContent = e.message || String(e); return; }
    model = m; stepIndex = 0;
    renderResults(m.results || []);
    buildTimeline(m.steps || []);
    setStep(0, false);
    if (scene3d && m.spec3D) scene3d.buildFromSpec(m.spec3D);
  }

  function render2D(animate) {
    if (!model) return;
    curSvg = Svg2D.render($('sheetSvg'), model.prims2D, {
      palette: palette(), showDims, maxStep: stepIndex, currentStep: stepIndex, animate
    });
  }

  function renderResults(results) {
    const host = $('resultsHost');
    host.innerHTML = '<tbody>' + (results.length
      ? results.map(r => `<tr><td class="rk">${r.k}</td><td class="rv">${r.v}</td></tr>`).join('')
      : '<tr><td class="rk">No numeric results</td><td class="rv">—</td></tr>') + '</tbody>';
  }

  /* ---------- steps timeline ---------- */
  function buildTimeline(steps) {
    const tl = $('timeline'); tl.innerHTML = '';
    steps.forEach((s, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="t-no">${String(i + 1).padStart(2, '0')}</span><span class="t-label">${s.title}</span>`;
      li.addEventListener('click', () => setStep(i, true));
      tl.appendChild(li);
    });
  }

  function setStep(i, animate) {
    if (!model || !model.steps.length) return;
    const n = model.steps.length;
    stepIndex = Math.max(0, Math.min(n - 1, i));
    render2D(animate);
    Array.from($('timeline').children).forEach((li, idx) => {
      li.classList.toggle('current', idx === stepIndex);
      li.classList.toggle('done', idx < stepIndex);
    });
    const s = model.steps[stepIndex];
    $('stepDetail').innerHTML = `<span class="sd-title">Step ${stepIndex + 1} / ${n} — ${s.title}</span>${s.desc || ''}`;
    $('btnPrev').disabled = stepIndex === 0;
    $('btnNext').disabled = stepIndex === n - 1;
    // keep current step chip in view
    const cur = $('timeline').children[stepIndex]; if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  function reset() {
    current.fields.forEach(f => { const el = $('fld-' + f.name); if (el) el.value = f.default; });
    $('formError').textContent = ''; draw();
  }

  async function doExport(kind) {
    if (!curSvg) return;
    const name = (current.title || 'drawing').replace(/\s+/g, '_');
    if (kind === 'png') await Exporter.exportPNG(curSvg, name + '.png');
    else await Exporter.exportPDF(curSvg, `${String(current.num).padStart(2, '0')}. ${current.title}`, name + '.pdf');
  }

  /* ---------- theme / planes (called by app) ---------- */
  function setTheme(name) {
    themeName = name; buildLegend();
    if (scene3d) scene3d.setBackground(name === 'dark' ? '#141311' : '#F4EFE3');
    if (model) render2D(false);
  }
  function setPlanesVisible(v) { planesVisible = v; if (scene3d) scene3d.setPlanesVisible(v); }
  function setShowDims(v) { showDims = v; if (model) render2D(false); }

  /* ---------- wiring ---------- */
  function bind() {
    $('btnDraw').addEventListener('click', draw);
    $('btnReset').addEventListener('click', reset);
    $('btnPrev').addEventListener('click', () => setStep(stepIndex - 1, true));
    $('btnNext').addEventListener('click', () => setStep(stepIndex + 1, true));
    $('btnAll').addEventListener('click', () => setStep(model ? model.steps.length - 1 : 0, true));
    $('btnPng').addEventListener('click', () => doExport('png'));
    $('btnPdf').addEventListener('click', () => doExport('pdf'));
    $('toggleDims').addEventListener('change', e => setShowDims(e.target.checked));
    // Enter in a form field triggers Draw
    $('formHost').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); draw(); } });
  }

  return { mount, bind, setTheme, setPlanesVisible, setShowDims };
})();
if (typeof window !== 'undefined') window.Workbench = Workbench;
