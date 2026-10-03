/* =====================================================================
   svg2d.js — 2D RENDERER (primitive list -> SVG). Pure rendering.
   PART 2 adds a reusable aligned-dimension system with arrowheads,
   extension lines, upright rotated text, auto-offset and collision
   avoidance. BIS SP:46 line styles; theme palettes; draw-in animation.
   Primitive paper coords are y-UP, millimetres; Y is flipped for screen.

   Primitive kinds:
     xyline                       the XY reference line (chain line)
     line   {x1,y1,x2,y2,role}
     polygon{pts:[[x,y]..],close,role,fill}
     circle {cx,cy,r,role,fill}
     arc    {cx,cy,r,a0,a1,role}                 degrees, ccw (paper)
     point  {x,y,label,dir,role}
     text   {x,y,text,color,anchor,size}
     dimension {x1,y1,x2,y2,label,off,side}       <- NEW aligned dim
   role -> style: visible|construction|hidden|projector|axis|dim|locus
   ===================================================================== */
const Svg2D = (function () {
  const NS = 'http://www.w3.org/2000/svg';

  // BIS-style stroke widths (mm / viewBox units)
  const WIDTH = { visible: 0.7, construction: 0.25, hidden: 0.4, projector: 0.18, axis: 0.3, dim: 0.22, locus: 0.3 };

  // Theme palettes (ink + sheet differ; vermilion dimension is constant accent)
  const PALETTES = {
    light: { sheet: '#F4EFE3', ink: '#1E1D1B', thin: '#6b6459', hidden: '#4a463f', chain: '#2a2824', accent: '#D8432B', locus: '#8a6d3b', muted: '#6f6a5f' },
    dark:  { sheet: '#262522', ink: '#ECE7DA', thin: '#9a9384', hidden: '#b8b2a6', chain: '#d8d2c6', accent: '#E4573C', locus: '#c9a35a', muted: '#9a9384' }
  };

  const el = (name, attrs) => { const e = document.createElementNS(NS, name); for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); return e; };

  function styleFor(role, pal) {
    switch (role) {
      case 'construction': return { stroke: pal.thin, w: WIDTH.construction, dash: null };
      case 'projector':    return { stroke: pal.thin, w: WIDTH.projector, dash: `${WIDTH.projector * 3} ${WIDTH.projector * 6}` };
      case 'hidden':       return { stroke: pal.hidden, w: WIDTH.hidden, dash: `2 1.2` };
      case 'axis':         return { stroke: pal.chain, w: WIDTH.axis, dash: `7 1.4 1 1.4` };   // chain line
      case 'locus':        return { stroke: pal.locus, w: WIDTH.locus, dash: `1.6 1.6` };
      case 'dim':          return { stroke: pal.accent, w: WIDTH.dim, dash: null };
      default:             return { stroke: pal.ink, w: WIDTH.visible, dash: null };           // visible
    }
  }

  function bounds(prims) {
    let a = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    const acc = (x, y) => { if (x < a.minX) a.minX = x; if (x > a.maxX) a.maxX = x; if (y < a.minY) a.minY = y; if (y > a.maxY) a.maxY = y; };
    for (const p of prims) {
      switch (p.kind) {
        case 'line': acc(p.x1, p.y1); acc(p.x2, p.y2); break;
        case 'dim': case 'dimension': {
          // a dimension extends `off` perpendicular to the line plus its text;
          // inflate so offset dim lines/labels are never clipped by the sheet.
          const m = (p.off == null ? 9 : p.off) + ((p.label || p.text || '').length * 0.9) / 2 + 5;
          acc(p.x1 - m, p.y1 - m); acc(p.x1 + m, p.y1 + m); acc(p.x2 - m, p.y2 - m); acc(p.x2 + m, p.y2 + m);
          break;
        }
        case 'point': case 'text': acc(p.x, p.y); break;
        case 'circle': case 'arc': acc(p.cx - p.r, p.cy - p.r); acc(p.cx + p.r, p.cy + p.r); break;
        case 'polygon': p.pts.forEach(([x, y]) => acc(x, y)); break;
      }
    }
    if (!isFinite(a.minX)) a = { minX: -10, maxX: 10, minY: -10, maxY: 10 };
    acc(a.minX, 0); acc(a.maxX, 0);
    return a;
  }

  function defsMarkers(pal) {
    const defs = el('defs', {});
    const mk = (id, d, refX) => {
      const m = el('marker', { id, markerUnits: 'userSpaceOnUse', markerWidth: 5, markerHeight: 5, refX, refY: 2, orient: 'auto' });
      m.appendChild(el('path', { d, fill: pal.accent }));
      defs.appendChild(m);
    };
    mk('egArrowEnd', 'M0,0 L4,2 L0,4 Z', 3.7);     // tip forward
    mk('egArrowStart', 'M4,0 L0,2 L4,4 Z', 0.3);   // tip backward
    return defs;
  }

  /* ---- reusable aligned dimension ----
     Draws onto `group` in the SVG user coordinate system (screen units).
     A,B = measured endpoints; opts {off, side, pal, reg}. */
  function dimension(group, A, B, label, opts) {
    const pal = opts.pal, reg = opts.reg || { labels: [] };
    const dx = B.x - A.x, dy = B.y - A.y; const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L; let nx = -uy, ny = ux;        // unit + normal
    let off = opts.off == null ? 9 : opts.off;
    let sign = opts.side;
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    if (sign == null && opts.prefer) {
      // pick the sign whose normal best matches the requested screen direction
      const want = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[opts.prefer] || [0, -1];
      sign = (nx * want[0] + ny * want[1]) >= 0 ? 1 : -1;
    } else if (sign == null && reg.centroid) {
      const dP = (s) => (mx + nx * s * off - reg.centroid.x) ** 2 + (my + ny * s * off - reg.centroid.y) ** 2;
      sign = dP(1) >= dP(-1) ? 1 : -1;
    } else if (sign == null) sign = 1;

    // auto-offset to dodge existing labels
    const labelLen = (label || '').length;
    const rad = Math.max(5, labelLen * 1.05);
    let tries = 0, tc;
    while (tries < 9) {
      tc = { x: mx + nx * sign * (off + 2.6), y: my + ny * sign * (off + 2.6) };
      const hit = (reg.labels || []).some(o => Math.hypot(o.x - tc.x, o.y - tc.y) < (o.r + rad) * 0.55);
      if (!hit) break; off += 5.5; tries++;
    }
    const w = WIDTH.dim;
    const Ao = { x: A.x + nx * sign * off, y: A.y + ny * sign * off };
    const Bo = { x: B.x + nx * sign * off, y: B.y + ny * sign * off };
    const gap = 1.4, extBeyond = 2.0;
    // extension lines
    group.appendChild(el('line', { x1: A.x + nx * sign * gap, y1: A.y + ny * sign * gap, x2: A.x + nx * sign * (off + extBeyond), y2: A.y + ny * sign * (off + extBeyond), stroke: pal.accent, 'stroke-width': w }));
    group.appendChild(el('line', { x1: B.x + nx * sign * gap, y1: B.y + ny * sign * gap, x2: B.x + nx * sign * (off + extBeyond), y2: B.y + ny * sign * (off + extBeyond), stroke: pal.accent, 'stroke-width': w }));
    // dimension line with arrowheads
    group.appendChild(el('line', { x1: Ao.x, y1: Ao.y, x2: Bo.x, y2: Bo.y, stroke: pal.accent, 'stroke-width': w, 'marker-start': 'url(#egArrowStart)', 'marker-end': 'url(#egArrowEnd)' }));
    // upright text, centred above the dim line
    let ang = Math.atan2(uy, ux) * 180 / Math.PI; if (ang > 90 || ang < -90) ang += 180;
    const tx = (Ao.x + Bo.x) / 2 + nx * sign * 1.9, ty = (Ao.y + Bo.y) / 2 + ny * sign * 1.9;
    const t = el('text', { x: tx, y: ty, 'font-size': 3.3, 'font-family': '"IBM Plex Mono", monospace', fill: pal.accent, 'text-anchor': 'middle', transform: `rotate(${ang.toFixed(2)} ${tx} ${ty})` });
    t.setAttribute('dominant-baseline', 'auto');
    t.textContent = label; group.appendChild(t);
    (reg.labels || (reg.labels = [])).push({ x: tc.x, y: tc.y, r: rad });
  }

  function render(container, prims, opts = {}) {
    const pal = opts.palette || PALETTES.light;
    const showDims = opts.showDims !== false;
    const maxStep = opts.maxStep == null ? Infinity : opts.maxStep;
    const currentStep = opts.currentStep;
    const animate = !!opts.animate;

    let vis = prims.filter(p => (p.step == null ? 0 : p.step) <= maxStep);
    if (!showDims) vis = vis.filter(p => p.kind !== 'dimension' && p.kind !== 'dim');

    const b = bounds(vis.length ? vis : prims);
    const pad = Math.max(16, (b.maxX - b.minX + b.maxY - b.minY) * 0.1);
    const W = (b.maxX - b.minX) + pad * 2, H = (b.maxY - b.minY) + pad * 2;
    const sx = x => (x - b.minX) + pad, sy = y => (b.maxY - y) + pad;      // flip Y
    const centroid = { x: sx((b.minX + b.maxX) / 2), y: sy((b.minY + b.maxY) / 2) };

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid meet', xmlns: NS });
    svg.appendChild(defsMarkers(pal));
    svg.appendChild(el('rect', { x: 0, y: 0, width: W, height: H, fill: pal.sheet }));

    const reg = { labels: [], centroid };
    const dimGroup = el('g', {});    // dims drawn last, on top

    const drawLineLike = (node, lenScreen, step) => {
      if (animate && step === currentStep && lenScreen > 0) { node.setAttribute('class', 'anim-draw'); node.setAttribute('style', `--len:${lenScreen.toFixed(1)}`); }
      svg.appendChild(node);
    };

    const draw = (p) => {
      const role = p.role || 'visible';
      const st = styleFor(role, pal);
      const common = { stroke: st.stroke, 'stroke-width': st.w, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
      if (st.dash) common['stroke-dasharray'] = st.dash;
      switch (p.kind) {
        case 'xyline': {
          const x1 = sx(b.minX) - pad * 0.5, x2 = sx(b.maxX) + pad * 0.5, y = sy(0);
          const s = styleFor('axis', pal);
          svg.appendChild(el('line', { x1, y1: y, x2, y2: y, stroke: s.stroke, 'stroke-width': s.w, 'stroke-dasharray': s.dash }));
          const tX = el('text', { x: x1 - 1, y: y - 1.5, 'font-size': 4, fill: pal.ink, 'font-style': 'italic', 'text-anchor': 'end' }); tX.textContent = 'X'; svg.appendChild(tX);
          const tY = el('text', { x: x2 + 1, y: y - 1.5, 'font-size': 4, fill: pal.ink, 'font-style': 'italic' }); tY.textContent = 'Y'; svg.appendChild(tY);
          break;
        }
        case 'line': {
          const node = el('line', { x1: sx(p.x1), y1: sy(p.y1), x2: sx(p.x2), y2: sy(p.y2), ...common });
          drawLineLike(node, Math.hypot(sx(p.x2) - sx(p.x1), sy(p.y2) - sy(p.y1)), p.step);
          break;
        }
        case 'polygon': {
          const d = p.pts.map((pt, i) => `${i ? 'L' : 'M'}${sx(pt[0])} ${sy(pt[1])}`).join(' ') + (p.close === false ? '' : ' Z');
          const node = el('path', { d, ...common, fill: p.fill || 'none' });
          let per = 0; for (let i = 1; i < p.pts.length; i++) per += Math.hypot(sx(p.pts[i][0]) - sx(p.pts[i - 1][0]), sy(p.pts[i][1]) - sy(p.pts[i - 1][1]));
          drawLineLike(node, per, p.step);
          break;
        }
        case 'circle': svg.appendChild(el('circle', { cx: sx(p.cx), cy: sy(p.cy), r: p.r, ...common, fill: p.fill || 'none' })); break;
        case 'arc': {
          const a0 = p.a0 * Math.PI / 180, a1 = p.a1 * Math.PI / 180;
          const x0 = p.cx + p.r * Math.cos(a0), y0 = p.cy + p.r * Math.sin(a0);
          const x1 = p.cx + p.r * Math.cos(a1), y1 = p.cy + p.r * Math.sin(a1);
          const large = Math.abs(p.a1 - p.a0) > 180 ? 1 : 0, sweep = p.a1 > p.a0 ? 0 : 1;
          svg.appendChild(el('path', { d: `M${sx(x0)} ${sy(y0)} A ${p.r} ${p.r} 0 ${large} ${sweep} ${sx(x1)} ${sy(y1)}`, ...common }));
          break;
        }
        case 'point': {
          const col = (role === 'construction') ? pal.thin : pal.ink;
          svg.appendChild(el('circle', { cx: sx(p.x), cy: sy(p.y), r: 0.85, fill: col }));
          if (p.label) {
            const dir = p.dir || 'ne';
            const ox = dir.includes('w') ? -1.8 : dir.includes('e') ? 1.8 : 0;
            const oy = dir.includes('n') ? -1.8 : dir.includes('s') ? 3.6 : 1.2;
            const anchor = dir.includes('w') ? 'end' : dir.includes('e') ? 'start' : 'middle';
            const t = el('text', { x: sx(p.x) + ox, y: sy(p.y) + oy, 'font-size': 4.2, 'font-family': '"IBM Plex Mono", monospace', fill: col, 'text-anchor': anchor });
            t.textContent = p.label; svg.appendChild(t);
            reg.labels.push({ x: sx(p.x) + ox, y: sy(p.y) + oy, r: Math.max(4, p.label.length * 1.1) });
          }
          break;
        }
        case 'text': {
          const t = el('text', { x: sx(p.x), y: sy(p.y), 'font-size': p.size || 3.6, 'font-family': '"IBM Plex Mono", monospace', fill: p.color || pal.muted, 'text-anchor': p.anchor || 'start' });
          t.textContent = p.text; svg.appendChild(t);
          reg.labels.push({ x: sx(p.x), y: sy(p.y), r: Math.max(4, (p.text || '').length * 1.0) });
          break;
        }
        case 'dim': case 'dimension': {
          dimension(dimGroup, { x: sx(p.x1), y: sy(p.y1) }, { x: sx(p.x2), y: sy(p.y2) }, p.label != null ? p.label : (p.text || ''), { off: p.off, side: p.side, prefer: p.prefer, pal, reg });
          break;
        }
      }
    };

    // draw order: axis, projector, construction/locus, hidden, visible, points, text ; dims last
    const order = { axis: 0, projector: 1, construction: 2, locus: 2, hidden: 3, visible: 4 };
    const dims = [], others = [];
    vis.forEach(p => (p.kind === 'dim' || p.kind === 'dimension') ? dims.push(p) : others.push(p));
    others.sort((a, c) => (order[a.role || 'visible'] ?? 4) - (order[c.role || 'visible'] ?? 4));
    others.forEach(draw);
    dims.forEach(draw);
    svg.appendChild(dimGroup);

    container.innerHTML = '';
    container.appendChild(svg);
    return svg;
  }

  function toSVGString(svg) { return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg); }

  return { render, toSVGString, dimension, PALETTES, WIDTH };
})();
if (typeof window !== 'undefined') window.Svg2D = Svg2D;
