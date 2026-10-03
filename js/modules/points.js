/* =====================================================================
   Module 1 — PROJECTION OF POINTS
   Math lives in EG.projectPoint / EG.quadrantOf; this file maps inputs
   to drawing primitives, a 3D spec, step narration, results and problems.
   ===================================================================== */
(function () {
  function compute(v) {
    // ---- interpret inputs into signed engineering coordinates ----
    const h = Math.abs(v.h), d = Math.abs(v.d);
    const heightAboveHP = v.hp === 'above' ? h : v.hp === 'below' ? -h : 0;
    const distFront     = v.vp === 'front' ? d : v.vp === 'behind' ? -d : 0;
    const p = EG.projectPoint(0, heightAboveHP, distFront);  // x = 0 (centred)
    const q = EG.quadrantOf(heightAboveHP, distFront);

    const fvY = p.fv.y, tvY = p.tv.y;      // paper y (y-up): FV above xy(+), TV below(-)
    const fvDir = heightAboveHP >= 0 ? 'ne' : 'se';
    const tvDir = distFront >= 0 ? 'se' : 'ne';

    // ---- 2D primitives (paper coords, mm, y-up) ----
    const prims = [];
    prims.push({ kind: 'xyline', step: 0 });
    // projector connecting the two views (they share the same vertical line)
    prims.push({ kind: 'line', x1: 0, y1: Math.max(0, fvY), x2: 0, y2: Math.min(0, tvY), role: 'projector', step: 1 });
    // front view a'
    prims.push({ kind: 'point', x: 0, y: fvY, label: "a'", dir: fvDir, role: 'visible', step: 2 });
    // top view a
    prims.push({ kind: 'point', x: 0, y: tvY, label: 'a', dir: tvDir, role: 'visible', step: 3 });
    // dimensions (aligned, vermilion, pushed to the left of the projector)
    if (heightAboveHP !== 0) prims.push({ kind: 'dimension', x1: 0, y1: 0, x2: 0, y2: fvY, label: `${EG.round(h)} mm`, prefer: 'left', off: 9, step: 2 });   // with a'
    if (distFront !== 0) prims.push({ kind: 'dimension', x1: 0, y1: 0, x2: 0, y2: tvY, label: `${EG.round(d)} mm`, prefer: 'left', off: 9, step: 3 });   // with a
    prims.push({ kind: 'text', x: 9, y: fvY || 2, text: 'FV (elevation)', color: '#555', size: 3.4, step: 2 });
    prims.push({ kind: 'text', x: 9, y: (tvY || -2), text: 'TV (plan)', color: '#555', size: 3.4, step: 3 });

    // ---- step narration ----
    const steps = [
      { title: 'Draw the XY reference line', desc: 'XY separates the Vertical Plane (above) from the Horizontal Plane (below) on the sheet.' },
      { title: 'Erect the projector', desc: 'Both views of a point lie on one vertical projector. Mark it through the chosen position.' },
      { title: "Plot the front view a'", desc: heightAboveHP === 0 ? "The point is in the HP, so a' lies on XY." : `Measure ${h} mm ${heightAboveHP > 0 ? 'above' : 'below'} XY — this is the front view a'.` },
      { title: 'Plot the top view a', desc: distFront === 0 ? 'The point is in the VP, so a lies on XY.' : `Measure ${d} mm ${distFront > 0 ? 'below' : 'above'} XY — this is the top view a.` },
      { title: 'Dimension & identify quadrant', desc: `Read the two distances off the sheet. This point lies in the <b>${q.name}</b> (${q.desc}).` }
    ];

    // ---- 3D spec ----
    const spec3D = { type: 'points', projections: true, items: [{ x: 0, y: heightAboveHP, z: distFront, label: 'A' }] };

    // ---- results ----
    const results = [
      { k: 'Quadrant', v: `${q.n} — ${q.name}` },
      { k: 'Height above HP', v: `${EG.round(heightAboveHP)} mm` },
      { k: 'Distance in front of VP', v: `${EG.round(distFront)} mm` },
      { k: "Front view a'", v: heightAboveHP === 0 ? 'on XY' : `${EG.round(Math.abs(fvY))} mm ${fvY > 0 ? 'above' : 'below'} XY` },
      { k: 'Top view a', v: distFront === 0 ? 'on XY' : `${EG.round(Math.abs(tvY))} mm ${tvY > 0 ? 'above' : 'below'} XY` }
    ];
    return { prims2D: prims, spec3D, steps, results };
  }

  const theory = `
    <p>A point is located by its perpendicular distances from the two reference planes: the <b>Horizontal Plane (HP)</b> and the <b>Vertical Plane (VP)</b>. In <b>first-angle projection</b> the object lies between the observer and the plane, so:</p>
    <div class="formula">Front view (a')  →  drawn ABOVE XY by the height above HP
Top view   (a )  →  drawn BELOW XY by the distance in front of VP</div>
    <h4>The four quadrants</h4>
    <ul>
      <li><b>I</b> — above HP &amp; in front of VP → a' above XY, a below XY.</li>
      <li><b>II</b> — above HP &amp; behind VP → a' and a <i>both above</i> XY.</li>
      <li><b>III</b> — below HP &amp; behind VP → a' below XY, a above XY.</li>
      <li><b>IV</b> — below HP &amp; in front of VP → a' and a <i>both below</i> XY.</li>
    </ul>
    <h4>Special positions</h4>
    <ul>
      <li>Point <b>in HP</b> → top view on XY (height = 0), a' = a projected up.</li>
      <li>Point <b>in VP</b> → front view on XY (depth = 0).</li>
      <li>Point <b>on both planes</b> → both views on XY.</li>
    </ul>
    <p>Both views always lie on the <b>same vertical projector</b>, because projectors are perpendicular to XY.</p>`;

  const samples = [
    { name: 'KTU — First quadrant', desc: 'A point 25 mm above HP and 40 mm in front of VP.', values: { h: 25, hp: 'above', d: 40, vp: 'front' } },
    { name: 'KTU — Second quadrant', desc: 'A point 30 mm above HP and 35 mm behind VP.', values: { h: 30, hp: 'above', d: 35, vp: 'behind' } },
    { name: 'KTU — Third quadrant', desc: 'A point 20 mm below HP and 30 mm behind VP.', values: { h: 20, hp: 'below', d: 30, vp: 'behind' } },
    { name: 'KTU — Point in the HP', desc: 'A point in the HP and 35 mm in front of VP.', values: { h: 0, hp: 'on', d: 35, vp: 'front' } },
    { name: 'KTU — Point in the VP', desc: 'A point 40 mm above HP and lying in the VP.', values: { h: 40, hp: 'above', d: 0, vp: 'on' } }
  ];

  function practice() {
    const h = Problems.randInt(10, 50, 5), d = Problems.randInt(10, 50, 5);
    const hp = Problems.pick(['above', 'below']), vp = Problems.pick(['front', 'behind']);
    const q = EG.quadrantOf(hp === 'above' ? h : -h, vp === 'front' ? d : -d);
    return {
      question: `Draw the projections of a point that is ${h} mm ${hp} the HP and ${d} mm ${vp} the VP. State the quadrant.`,
      values: { h, hp, d, vp },
      solution: `The point lies in the <b>${q.name}</b> (${q.desc}). Front view a' is ${h} mm ${hp} XY; top view a is ${d} mm ${vp === 'front' ? 'below' : 'above'} XY, both on one projector.`
    };
  }

  App.register({
    id: 'points', num: 1, status: 'ready',
    title: 'Projection of Points',
    desc: 'Project a point in any quadrant from its distances to the HP and VP. See the elevation, plan and the live 3D model.',
    quadrantNote: 'any quadrant',
    fields: [
      { name: 'h', label: 'Distance from HP', unit: 'mm', type: 'number', default: 25, min: 0, max: 200 },
      { name: 'hp', label: 'Relative to HP', type: 'select', default: 'above', options: [{ value: 'above', label: 'Above HP' }, { value: 'below', label: 'Below HP' }, { value: 'on', label: 'In the HP' }] },
      { name: 'd', label: 'Distance from VP', unit: 'mm', type: 'number', default: 40, min: 0, max: 200 },
      { name: 'vp', label: 'Relative to VP', type: 'select', default: 'front', options: [{ value: 'front', label: 'In front of VP' }, { value: 'behind', label: 'Behind VP' }, { value: 'on', label: 'In the VP' }] }
    ],
    compute, theory, samples, practice
  });
})();
