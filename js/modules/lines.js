/* =====================================================================
   Module 2 — PROJECTION OF STRAIGHT LINES (with HT / VT traces)
   Cases: parallel to both, perpendicular to HP, perpendicular to VP,
   inclined to HP only, inclined to VP only, inclined to BOTH planes
   (the classic rotating-line / true-length method, drawn step by step).
   All numbers come from EG.finishLine(); this file only lays out drawing.
   ===================================================================== */
(function () {
  const S = (deg) => Math.sin(EG.rad(deg)), C = (deg) => Math.cos(EG.rad(deg));

  function compute(v) {
    const TL = Math.abs(v.tl);
    const theta = Math.abs(v.theta), phi = Math.abs(v.phi);
    const aH = v.ah, aV = v.av;             // end A: above HP, in front of VP
    const kase = v.kase;
    const A = { x: 0, h: aH, d: aV };
    let B, prims = [], steps = [];

    // base: XY line + end A
    prims.push({ kind: 'xyline', step: 0 });
    prims.push({ kind: 'point', x: 0, y: aH, label: "a'", dir: 'nw', role: 'visible', step: 0 });
    prims.push({ kind: 'point', x: 0, y: -aV, label: 'a', dir: 'sw', role: 'visible', step: 0 });
    prims.push({ kind: 'line', x1: 0, y1: aH, x2: 0, y2: -aV, role: 'projector', step: 0 });
    steps.push({ title: 'Draw XY and fix end A', desc: `Mark a' (${aH} mm above XY) and a (${aV} mm below XY) on one projector.` });

    if (kase === 'parallel') {
      // parallel to both planes: both views are true length, parallel to XY
      B = { x: TL, h: aH, d: aV };
      prims.push({ kind: 'line', x1: 0, y1: aH, x2: TL, y2: aH, role: 'visible', step: 1 });
      prims.push({ kind: 'line', x1: 0, y1: -aV, x2: TL, y2: -aV, role: 'visible', step: 1 });
      prims.push({ kind: 'point', x: TL, y: aH, label: "b'", dir: 'ne', step: 1 });
      prims.push({ kind: 'point', x: TL, y: -aV, label: 'b', dir: 'se', step: 1 });      steps.push({ title: 'Draw both views (true length)', desc: "A line parallel to both planes shows its TRUE LENGTH in both views, each parallel to XY. a'b' = ab = TL." });
      steps.push({ title: 'Dimension', desc: 'Both views equal the true length. No inclinations, no traces (line is parallel to both planes).' });
    }
    else if (kase === 'perpHP') {
      // perpendicular to HP: FV vertical (true length), TV is a point
      B = { x: 0, h: aH + TL, d: aV };
      prims.push({ kind: 'line', x1: 0, y1: aH, x2: 0, y2: aH + TL, role: 'visible', step: 1 });
      prims.push({ kind: 'point', x: 0, y: aH + TL, label: "b'", dir: 'ne', step: 1 });
      prims.push({ kind: 'point', x: 0, y: -aV, label: 'a b', dir: 'se', step: 2 });      steps.push({ title: 'Front view = true length', desc: "Perpendicular to HP ⇒ the front view a'b' is vertical and equals the true length." });
      steps.push({ title: 'Top view is a point', desc: 'Both ends project to the same plan point, so the top view a≡b is a single point.' });
    }
    else if (kase === 'perpVP') {
      // perpendicular to VP: TV perpendicular to XY (true length), FV is a point
      B = { x: 0, h: aH, d: aV + TL };
      prims.push({ kind: 'line', x1: 0, y1: -aV, x2: 0, y2: -aV - TL, role: 'visible', step: 1 });
      prims.push({ kind: 'point', x: 0, y: -aV - TL, label: 'b', dir: 'se', step: 1 });
      prims.push({ kind: 'point', x: 0, y: aH, label: "a' b'", dir: 'ne', step: 2 });      steps.push({ title: 'Top view = true length', desc: 'Perpendicular to VP ⇒ the top view ab is perpendicular to XY and equals the true length.' });
      steps.push({ title: 'Front view is a point', desc: "Both ends project to the same elevation point, so the front view a'≡b' is a single point." });
    }
    else if (kase === 'inclHP') {
      // inclined theta to HP, parallel to VP
      B = { x: TL * C(theta), h: aH + TL * S(theta), d: aV };
      const bx = B.x;
      prims.push({ kind: 'line', x1: 0, y1: aH, x2: bx, y2: aH + TL * S(theta), role: 'visible', step: 1 });
      prims.push({ kind: 'point', x: bx, y: aH + TL * S(theta), label: "b'", dir: 'ne', step: 1 });
      prims.push({ kind: 'arc', cx: 0, cy: aH, r: TL, a0: 0, a1: theta, role: 'construction', step: 1 });
      prims.push({ kind: 'line', x1: 0, y1: -aV, x2: bx, y2: -aV, role: 'visible', step: 2 });
      prims.push({ kind: 'point', x: bx, y: -aV, label: 'b', dir: 'se', step: 2 });
      prims.push({ kind: 'line', x1: bx, y1: aH + TL * S(theta), x2: bx, y2: -aV, role: 'projector', step: 2 });
      steps.push({ title: "Front view a'b' = true length", desc: `Draw a'b' = ${TL} mm at ${theta}° to XY (the true inclination to HP). FV shows true length.` });
      steps.push({ title: 'Project the top view', desc: 'Drop projectors; the top view ab is parallel to XY with length = TL·cos θ (fore-shortened plan).' });
    }
    else if (kase === 'inclVP') {
      // inclined phi to VP, parallel to HP
      B = { x: TL * C(phi), h: aH, d: aV + TL * S(phi) };
      const bx = B.x;
      prims.push({ kind: 'line', x1: 0, y1: -aV, x2: bx, y2: -aV - TL * S(phi), role: 'visible', step: 1 });
      prims.push({ kind: 'point', x: bx, y: -aV - TL * S(phi), label: 'b', dir: 'se', step: 1 });
      prims.push({ kind: 'arc', cx: 0, cy: -aV, r: TL, a0: 0, a1: -phi, role: 'construction', step: 1 });
      prims.push({ kind: 'line', x1: 0, y1: aH, x2: bx, y2: aH, role: 'visible', step: 2 });
      prims.push({ kind: 'point', x: bx, y: aH, label: "b'", dir: 'ne', step: 2 });
      prims.push({ kind: 'line', x1: bx, y1: aH, x2: bx, y2: -aV - TL * S(phi), role: 'projector', step: 2 });
      steps.push({ title: 'Top view ab = true length', desc: `Draw ab = ${TL} mm at ${phi}° to XY (the true inclination to VP). TV shows true length.` });
      steps.push({ title: 'Project the front view', desc: "Project up; the front view a'b' is parallel to XY with length = TL·cos φ." });
    }
    else { // inclined to BOTH — rotating line / true-length method
      const dy = TL * S(theta), dz = TL * S(phi);
      const dx2 = TL * TL - dy * dy - dz * dz;
      if (dx2 < -1e-6) throw new Error('Impossible: for one straight line, θ + φ ≤ 90° (sin²θ + sin²φ ≤ 1). Reduce the angles.');
      const dx = Math.sqrt(Math.max(0, dx2));
      B = { x: dx, h: aH + dy, d: aV + dz };
      const planLen = TL * C(theta);   // = a-b1 (final top-view length)
      const elevLen = TL * C(phi);     // = a'-b2' (final front-view length)
      // stage 1: FV true length at theta
      const b1p = { x: planLen, y: aH + dy };
      const b1 = { x: planLen, y: -aV };
      // stage 2: TV true length at phi
      const b2 = { x: elevLen, y: -aV - dz };
      const b2p = { x: elevLen, y: aH };
      // final
      const bp = { x: dx, y: aH + dy };
      const bf = { x: dx, y: -aV - dz };

      // Step 1: FV true length a'b1' at theta
      prims.push({ kind: 'line', x1: 0, y1: aH, x2: b1p.x, y2: b1p.y, role: 'construction', step: 1 });
      prims.push({ kind: 'point', x: b1p.x, y: b1p.y, label: "b1'", dir: 'ne', role: 'construction', step: 1 });
      prims.push({ kind: 'arc', cx: 0, cy: aH, r: TL, a0: 0, a1: theta, role: 'construction', step: 1 });
      // Step 2: its plan a-b1 parallel to xy
      prims.push({ kind: 'line', x1: b1p.x, y1: b1p.y, x2: b1.x, y2: b1.y, role: 'projector', step: 2 });
      prims.push({ kind: 'line', x1: 0, y1: -aV, x2: b1.x, y2: b1.y, role: 'construction', step: 2 });
      prims.push({ kind: 'point', x: b1.x, y: b1.y, label: 'b1', dir: 'se', role: 'construction', step: 2 });
      // Step 3: TV true length a-b2 at phi
      prims.push({ kind: 'line', x1: 0, y1: -aV, x2: b2.x, y2: b2.y, role: 'construction', step: 3 });
      prims.push({ kind: 'point', x: b2.x, y: b2.y, label: 'b2', dir: 'se', role: 'construction', step: 3 });
      prims.push({ kind: 'arc', cx: 0, cy: -aV, r: TL, a0: 0, a1: -phi, role: 'construction', step: 3 });
      // Step 4: its elevation a'-b2' parallel to xy
      prims.push({ kind: 'line', x1: b2.x, y1: b2.y, x2: b2p.x, y2: b2p.y, role: 'projector', step: 4 });
      prims.push({ kind: 'line', x1: 0, y1: aH, x2: b2p.x, y2: b2p.y, role: 'construction', step: 4 });
      prims.push({ kind: 'point', x: b2p.x, y: b2p.y, label: "b2'", dir: 'ne', role: 'construction', step: 4 });
      // Step 5: loci of final B
      prims.push({ kind: 'line', x1: b1p.x, y1: b1p.y, x2: dx + 6, y2: b1p.y, role: 'locus', step: 5 });
      prims.push({ kind: 'line', x1: b2.x, y1: b2.y, x2: dx + 6, y2: b2.y, role: 'locus', step: 5 });
      // Step 6: arcs locate final b' and b
      prims.push({ kind: 'arc', cx: 0, cy: aH, r: elevLen, a0: 0, a1: EG.deg(Math.atan2(dy, dx)), role: 'construction', step: 6 });
      prims.push({ kind: 'arc', cx: 0, cy: -aV, r: planLen, a0: 0, a1: -EG.deg(Math.atan2(dz, dx)), role: 'construction', step: 6 });
      prims.push({ kind: 'point', x: bp.x, y: bp.y, label: "b'", dir: 'ne', step: 6 });
      prims.push({ kind: 'point', x: bf.x, y: bf.y, label: 'b', dir: 'se', step: 6 });
      // Step 7: final views
      prims.push({ kind: 'line', x1: 0, y1: aH, x2: bp.x, y2: bp.y, role: 'visible', step: 7 });
      prims.push({ kind: 'line', x1: 0, y1: -aV, x2: bf.x, y2: bf.y, role: 'visible', step: 7 });
      prims.push({ kind: 'line', x1: bp.x, y1: bp.y, x2: bf.x, y2: bf.y, role: 'projector', step: 7 });

      steps.push({ title: 'Stage 1 — incline θ to HP (∥ VP)', desc: `Draw a'b1' = TL = ${TL} at ${theta}° to XY. This front view is true length.` });
      steps.push({ title: 'Project its plan', desc: 'Drop b1′ to the plan level of a to get a b1 (∥ XY). a b1 = TL·cos θ is the final plan length.' });
      steps.push({ title: 'Stage 2 — incline φ to VP (∥ HP)', desc: `Draw a b2 = TL = ${TL} at ${phi}° below XY. This top view is true length.` });
      steps.push({ title: 'Project its elevation', desc: "Project b2 up to the level of a' to get a' b2′ (∥ XY). a'b2′ = TL·cos φ is the final FV length." });
      steps.push({ title: 'Draw the loci of B', desc: 'Horizontal locus through b1′ fixes the final height of B; horizontal locus through b2 fixes its final depth.' });
      steps.push({ title: 'Locate final b′ and b', desc: "Arc (centre a', R = a'b2′) cuts the b1′-locus at b′. Arc (centre a, R = a b1) cuts the b2-locus at b. Both lie on one projector." });
      steps.push({ title: "Join final views a'b' and ab", desc: 'These are the required front and top views. Their apparent angles α, β are greater than the true θ, φ.' });
    }

    const R = EG.finishLine(A, B);
    // ----- traces (not for lines parallel to a plane) -----
    const tr = R.traces;
    let stepTrace = steps.length;
    if (kase !== 'parallel') {
      if (tr.VT) { // VT lies on VP: front view v' at (x, h); top view v on XY
        prims.push({ kind: 'point', x: tr.VT.x, y: tr.VT.h, label: 'VT', dir: 'nw', role: 'visible', step: stepTrace });
        prims.push({ kind: 'point', x: tr.VT.x, y: 0, role: 'construction', step: stepTrace });
        prims.push({ kind: 'line', x1: tr.VT.x, y1: tr.VT.h, x2: tr.VT.x, y2: 0, role: 'projector', step: stepTrace });
      }
      if (tr.HT) { // HT lies on HP: top view at (x, -d); front view h' on XY
        prims.push({ kind: 'point', x: tr.HT.x, y: -tr.HT.d, label: 'HT', dir: 'sw', role: 'visible', step: stepTrace });
        prims.push({ kind: 'point', x: tr.HT.x, y: 0, role: 'construction', step: stepTrace });
        prims.push({ kind: 'line', x1: tr.HT.x, y1: -tr.HT.d, x2: tr.HT.x, y2: 0, role: 'projector', step: stepTrace });
      }
      steps.push({
        title: 'Locate the traces HT & VT',
        desc: `Produce the front view to meet XY, project down to the produced top view → <b>HT</b>. Produce the top view to meet XY, project up to the produced front view → <b>VT</b>.${!tr.HT ? ' (Line ∥ HP ⇒ no HT.)' : ''}${!tr.VT ? ' (Line ∥ VP ⇒ no VT.)' : ''}`
      });
    }

    // ----- dimensions (PART 2): mark true length, apparent lengths, heights,
    // depths and trace distances. All shown only on the final step and gated
    // by the "Show dimensions" toggle. Values rounded to 2 dp with "mm". -----
    const DS = steps.length - 1;
    const f2 = (x) => EG.round(x).toFixed(2);
    const fvA = { x: A.x, y: A.h }, fvB = { x: B.x, y: B.h };
    const tvA = { x: A.x, y: -A.d }, tvB = { x: B.x, y: -B.d };
    const D = [];
    // heights above XY (a', b')
    if (A.h !== 0) D.push({ x1: A.x, y1: 0, x2: A.x, y2: A.h, label: `${f2(A.h)} mm`, prefer: 'left', off: 9 });
    if (B.h !== 0 && kase !== 'perpVP') D.push({ x1: B.x, y1: 0, x2: B.x, y2: B.h, label: `${f2(B.h)} mm`, prefer: 'right', off: 9 });
    // distances below XY (a, b)
    if (A.d !== 0) D.push({ x1: A.x, y1: 0, x2: A.x, y2: -A.d, label: `${f2(A.d)} mm`, prefer: 'left', off: 16 });
    if (B.d !== 0 && kase !== 'perpHP') D.push({ x1: B.x, y1: 0, x2: B.x, y2: -B.d, label: `${f2(B.d)} mm`, prefer: 'right', off: 16 });
    // apparent lengths of the two views (with the cos relation when inclined to both)
    const fvPt = Math.hypot(fvB.x - fvA.x, fvB.y - fvA.y) < 1e-6;
    const tvPt = Math.hypot(tvB.x - tvA.x, tvB.y - tvA.y) < 1e-6;
    if (!fvPt) D.push({ x1: fvA.x, y1: fvA.y, x2: fvB.x, y2: fvB.y, prefer: 'up', off: 7,
      label: kase === 'both' ? `a'b' = ${TL} cos ${phi}° = ${f2(R.fv.len)}` : `a'b' = ${f2(R.fv.len)} mm` });
    if (!tvPt) D.push({ x1: tvA.x, y1: tvA.y, x2: tvB.x, y2: tvB.y, prefer: 'down', off: 7,
      label: kase === 'both' ? `ab = ${TL} cos ${theta}° = ${f2(R.tv.len)}` : `ab = ${f2(R.tv.len)} mm` });
    // true-length line (rotating-line method draws it explicitly for 'both')
    if (kase === 'both') {
      const b1p = { x: TL * C(theta), y: aH + TL * S(theta) };
      D.push({ x1: 0, y1: aH, x2: b1p.x, y2: b1p.y, label: `TL = ${f2(TL)} mm`, prefer: 'up', off: 7 });
    }
    // trace distances from the projector of A
    if (tr.HT && Math.abs(tr.HT.x) > 1) D.push({ x1: 0, y1: -A.d, x2: tr.HT.x, y2: -A.d, label: `HT ${f2(Math.abs(tr.HT.x))} mm`, prefer: 'down', off: 11 });
    if (tr.VT && Math.abs(tr.VT.x) > 1) D.push({ x1: 0, y1: A.h, x2: tr.VT.x, y2: A.h, label: `VT ${f2(Math.abs(tr.VT.x))} mm`, prefer: 'up', off: 11 });
    D.forEach(d => prims.push(Object.assign({ kind: 'dimension', step: DS }, d)));

    // ----- results -----
    const results = [
      { k: 'True length (TL)', v: `${EG.round(R.TL)} mm` },
      { k: 'Inclination to HP (θ)', v: `${EG.round(R.theta)}°` },
      { k: 'Inclination to VP (φ)', v: `${EG.round(R.phi)}°` },
      { k: 'Front view length', v: `${EG.round(R.fv.len)} mm` },
      { k: 'Apparent angle α (FV∧XY)', v: `${EG.round(R.fv.angle)}°` },
      { k: 'Top view length', v: `${EG.round(R.tv.len)} mm` },
      { k: 'Apparent angle β (TV∧XY)', v: `${EG.round(R.tv.angle)}°` },
      { k: 'HT (dist. in front of VP)', v: tr.HT ? `${EG.round(tr.HT.d)} mm` : '— (∥ HP)' },
      { k: 'VT (dist. above HP)', v: tr.VT ? `${EG.round(tr.VT.h)} mm` : '— (∥ VP)' }
    ];

    const spec3D = {
      type: 'line', projections: true,
      a: { x: A.x, y: A.h, z: A.d }, b: { x: B.x, y: B.h, z: B.d },
      labelA: 'A', labelB: 'B',
      traces: { HT: tr.HT ? { x: tr.HT.x, d: tr.HT.d } : null, VT: tr.VT ? { x: tr.VT.x, h: tr.VT.h } : null }
    };

    return { prims2D: prims, spec3D, steps, results };
  }

  const theory = `
    <p>A straight line is represented by the two projections of its ends. The <b>true length (TL)</b> and the <b>true inclinations</b> θ (to HP) and φ (to VP) are the goal of most problems.</p>
    <h4>Key results</h4>
    <div class="formula">Front view length  = TL · cos φ
Top view length    = TL · cos θ
Rise  (height diff) = TL · sin θ
Depth (front diff)  = TL · sin φ
Constraint         : sin²θ + sin²φ ≤ 1   ⇒   θ + φ ≤ 90°</div>
    <p>The <b>apparent angles</b> α (front view ∧ XY) and β (top view ∧ XY) are always greater than the true angles θ and φ respectively.</p>
    <h4>Rotating-line (true-length) method — inclined to both planes</h4>
    <ul>
      <li>Stage 1: assume the line ∥ VP and inclined θ to HP → front view is true length.</li>
      <li>Stage 2: assume the line ∥ HP and inclined φ to VP → top view is true length.</li>
      <li>Swing arcs of the true length and use the loci of B to fix the final b′ and b.</li>
    </ul>
    <h4>Traces</h4>
    <div class="formula">HT (Horizontal Trace): point where the line (produced) meets HP  → height = 0
VT (Vertical Trace)  : point where the line (produced) meets VP   → depth  = 0</div>
    <ul>
      <li>HT is found in the TOP view; its front projection h′ lies on XY.</li>
      <li>VT is found in the FRONT view; its top projection v lies on XY.</li>
      <li>A line ∥ to a plane has <i>no</i> trace on that plane.</li>
    </ul>`;

  const samples = [
    { name: 'KTU — Inclined to both', desc: 'Line AB, TL 70 mm, inclined 30° to HP and 45° to VP. End A is 10 mm above HP and 15 mm in front of VP. Find traces.', values: { kase: 'both', tl: 70, theta: 30, phi: 45, ah: 10, av: 15 } },
    { name: 'KTU — Inclined to HP only', desc: 'Line 60 mm long, inclined 45° to HP and parallel to VP, 20 mm in front of VP; lower end 12 mm above HP.', values: { kase: 'inclHP', tl: 60, theta: 45, phi: 0, ah: 12, av: 20 } },
    { name: 'KTU — Inclined to VP only', desc: 'Line 75 mm long, inclined 30° to VP and parallel to HP, 25 mm above HP; one end 15 mm in front of VP.', values: { kase: 'inclVP', tl: 75, theta: 0, phi: 30, ah: 25, av: 15 } },
    { name: 'KTU — Perpendicular to HP', desc: 'Line 50 mm long, perpendicular to HP; lower end 10 mm above HP and 20 mm in front of VP.', values: { kase: 'perpHP', tl: 50, theta: 90, phi: 0, ah: 10, av: 20 } },
    { name: 'KTU — Parallel to both', desc: 'Line 65 mm long, parallel to both HP and VP, 20 mm above HP and 25 mm in front of VP.', values: { kase: 'parallel', tl: 65, theta: 0, phi: 0, ah: 20, av: 25 } }
  ];

  function practice() {
    const tl = Problems.randInt(50, 90, 5);
    const theta = Problems.randInt(20, 45, 5), phi = Problems.randInt(20, 40, 5);
    const ah = Problems.randInt(8, 20, 2), av = Problems.randInt(10, 25, 5);
    return {
      question: `Line AB is ${tl} mm long, inclined ${theta}° to the HP and ${phi}° to the VP. End A is ${ah} mm above HP and ${av} mm in front of VP. Draw the projections and locate the traces.`,
      values: { kase: 'both', tl, theta, phi, ah, av },
      solution: `FV length = ${EG.round(tl * C(phi))} mm, TV length = ${EG.round(tl * C(theta))} mm. Use the rotating-line method; then produce the views to XY to mark HT and VT.`
    };
  }

  App.register({
    id: 'lines', num: 2, status: 'ready',
    title: 'Projection of Lines & Traces',
    desc: 'All standard line cases including inclined-to-both via the rotating-line method, with HT/VT traces, true length and apparent angles.',
    quadrantNote: 'first quadrant',
    fields: [
      { name: 'kase', label: 'Case', type: 'select', default: 'both', options: [
        { value: 'both', label: 'Inclined to both planes' },
        { value: 'inclHP', label: 'Inclined to HP only (∥ VP)' },
        { value: 'inclVP', label: 'Inclined to VP only (∥ HP)' },
        { value: 'perpHP', label: 'Perpendicular to HP' },
        { value: 'perpVP', label: 'Perpendicular to VP' },
        { value: 'parallel', label: 'Parallel to both planes' }
      ] },
      { name: 'tl', label: 'True length', unit: 'mm', type: 'number', default: 70, min: 5, max: 250 },
      { name: 'theta', label: 'Inclination to HP (θ)', unit: '°', type: 'number', default: 30, min: 0, max: 90, hint: 'Used when inclined to HP / both' },
      { name: 'phi', label: 'Inclination to VP (φ)', unit: '°', type: 'number', default: 45, min: 0, max: 90, hint: 'Used when inclined to VP / both' },
      { name: 'ah', label: 'End A above HP', unit: 'mm', type: 'number', default: 10, min: 0, max: 200 },
      { name: 'av', label: 'End A in front of VP', unit: 'mm', type: 'number', default: 15, min: 0, max: 200 }
    ],
    compute, theory, samples, practice
  });
})();
