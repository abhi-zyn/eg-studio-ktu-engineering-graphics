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
          // inflate only along the dimension's normal (offset side unknown, so
          // both ways) and along its own direction for a displaced label
          const L = Math.hypot(p.x2 - p.x1, p.y2 - p.y1) || 1;
          const ux = (p.x2 - p.x1) / L, uy = (p.y2 - p.y1) / L, nx = -uy, ny = ux;
          const m = (p.off == null ? 9 : p.off) + 7;
          const tw = (p.label || p.text || '').length * 3.5 * 0.6;
          const along = tw > L - 2 ? tw + 6 : Math.max(0, (tw - L) / 2) + 2;
          [[p.x1, p.y1, -along], [p.x2, p.y2, along]].forEach(([x, y, k]) => {
            acc(x + nx * m, y + ny * m); acc(x - nx * m, y - ny * m); acc(x + ux * k, y + uy * k);
          });
          break;
        }
        case 'point': acc(p.x, p.y); acc(p.x + 8, p.y + 5); acc(p.x - 8, p.y - 5); break;   // + label room
        case 'text': {                                   // include the text run
          const w = (p.text || '').length * (p.size || 3.6) * 0.6, a = p.anchor || 'start';
          const x0 = a === 'start' ? p.x : a === 'end' ? p.x - w : p.x - w / 2;
          acc(x0, p.y); acc(x0 + w, p.y + (p.size || 3.6)); break;
        }
        case 'circle': case 'arc': acc(p.cx - p.r, p.cy - p.r); acc(p.cx + p.r, p.cy + p.r); break;
        case 'polygon': p.pts.forEach(([x, y]) => acc(x, y)); break;
      }
    }
    if (!isFinite(a.minX)) a = { minX: -10, maxX: 10, minY: -10, maxY: 10 };
    // minimum sheet extent (mm) so small drawings keep a sensible print scale
    // instead of being blown up (keeps text/arrow sizes consistent)
    const MINW = 150, MINH = 120;
    if (a.maxX - a.minX < MINW) { const c = (a.maxX + a.minX) / 2; a.minX = c - MINW / 2; a.maxX = c + MINW / 2; }
    if (a.maxY - a.minY < MINH) { const c = (a.maxY + a.minY) / 2; a.minY = c - MINH / 2; a.maxY = c + MINH / 2; }
    acc(a.minX, 0); acc(a.maxX, 0);
    return a;
  }

  function defsMarkers(pal) {
    const defs = el('defs', {});
    const mk = (id, d, refX) => {
      const m = el('marker', { id, markerUnits: 'userSpaceOnUse', markerWidth: 3.2, markerHeight: 1.6, refX, refY: 0.6, orient: 'auto' });
      m.appendChild(el('path', { d, fill: pal.accent }));
      defs.appendChild(m);
    };
    mk('egArrowEnd', 'M0,0 L3,0.6 L0,1.2 Z', 2.9);     // tip forward  (3 x 1.2, BIS proportion)
    mk('egArrowStart', 'M3,0 L0,0.6 L3,1.2 Z', 0.1);   // tip backward
    return defs;
  }

  /* ---- collision registry ----
     Every placed label (point labels, dimension texts) is stored as a row
     of sample points along its text, so long rotated labels collide properly. */
  const CW = 0.6;                                  // mono char width / font-size
  function textSamples(cx, cy, ux, uy, len) {      // samples along a text run
    const out = [], n = Math.max(1, Math.ceil(len / 2));
    for (let i = 0; i <= n; i++) { const t = -len / 2 + (len * i) / n; out.push({ x: cx + ux * t, y: cy + uy * t }); }
    return out;
  }
  const hits = (reg, pts, clr) => pts.some(q => reg.samples.some(o => Math.hypot(o.x - q.x, o.y - q.y) < clr));

  /* ---- reusable aligned dimension ----
     dimension(group, A, B, label, opts)  — A,B in SVG user units (screen).
     Draws: 2 thin extension lines, a dimension line parallel to AB at
     `off`, arrowheads (SVG markers) at both ends, and the value centred
     above the line, rotated along it and kept upright (aligned system).
     opts: {off, side(+1/-1), prefer('left'|'right'|'up'|'down'), pal, reg}
     - auto-offset: pushes the dim outward until its text is clear of
       every label already on the sheet (registry).
     - short dims: arrows go outside; text goes beyond the B end. */
  function dimension(group, A, B, label, opts) {
    const pal = opts.pal, reg = opts.reg || (opts.reg = { samples: [] });
    reg.samples = reg.samples || [];
    const dx = B.x - A.x, dy = B.y - A.y; const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L; const nx = -uy, ny = ux;      // unit + normal
    let off = opts.off == null ? 9 : opts.off;
    let sign = opts.side;
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    if (sign == null && opts.prefer) {
      // pick the normal sign that best matches the requested screen direction
      const want = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[opts.prefer] || [0, -1];
      sign = (nx * want[0] + ny * want[1]) >= 0 ? 1 : -1;
    } else if (sign == null && reg.centroid) {
      const dP = (s) => (mx + nx * s * off - reg.centroid.x) ** 2 + (my + ny * s * off - reg.centroid.y) ** 2;
      sign = dP(1) >= dP(-1) ? 1 : -1;
    } else if (sign == null) sign = 1;

    const FS = 3.5, tw = (label || '').length * FS * CW;          // text width
    // text fits between the arrows (long dims may overrun the ends slightly)
    const fits = tw <= L - 2 || (L >= 30 && tw <= L * 1.35);
    let ang = Math.atan2(uy, ux) * 180 / Math.PI; let flip = false;
    if (ang > 90 || ang < -90) { ang += 180; flip = true; }

    // text centre for a given offset (inside, or beyond the B end if it doesn't fit)
    const textAt = (o) => {
      const base = { x: mx + nx * sign * o, y: my + ny * sign * o };
      if (fits) return { x: base.x + nx * sign * 1.9, y: base.y + ny * sign * 1.9 };
      const along = L / 2 + 3 + tw / 2;                            // past the B end
      return { x: base.x + ux * along + nx * sign * 1.2, y: base.y + uy * along + ny * sign * 1.2 };
    };
    // auto-offset: move outward until the whole text run is clear
    let tries = 0, tc;
    while (true) {
      tc = textAt(off);
      const samp = textSamples(tc.x, tc.y - FS * 0.35, ux, uy, tw);
      if (!hits(reg, samp, 3.0) || tries >= 12) break;
      off += 3.5; tries++;
    }

    const w = WIDTH.dim;
    const Ao = { x: A.x + nx * sign * off, y: A.y + ny * sign * off };
    const Bo = { x: B.x + nx * sign * off, y: B.y + ny * sign * off };
    const gap = 1.4, extBeyond = 2.0;
    // extension lines (small gap from the object, run 2 units past the dim line)
    group.appendChild(el('line', { x1: A.x + nx * sign * gap, y1: A.y + ny * sign * gap, x2: A.x + nx * sign * (off + extBeyond), y2: A.y + ny * sign * (off + extBeyond), stroke: pal.accent, 'stroke-width': w }));
    group.appendChild(el('line', { x1: B.x + nx * sign * gap, y1: B.y + ny * sign * gap, x2: B.x + nx * sign * (off + extBeyond), y2: B.y + ny * sign * (off + extBeyond), stroke: pal.accent, 'stroke-width': w }));
    // dimension line + arrowheads; if too short for two arrowheads (< 9),
    // draw them OUTSIDE pointing inwards (BIS practice)
    if (L >= 9) {
      group.appendChild(el('line', { x1: Ao.x, y1: Ao.y, x2: Bo.x, y2: Bo.y, stroke: pal.accent, 'stroke-width': w, 'marker-start': 'url(#egArrowStart)', 'marker-end': 'url(#egArrowEnd)' }));
    } else {
      const k = 5;
      group.appendChild(el('line', { x1: Ao.x, y1: Ao.y, x2: Bo.x, y2: Bo.y, stroke: pal.accent, 'stroke-width': w }));
      group.appendChild(el('line', { x1: Ao.x - ux * k, y1: Ao.y - uy * k, x2: Ao.x, y2: Ao.y, stroke: pal.accent, 'stroke-width': w, 'marker-end': 'url(#egArrowEnd)' }));
      group.appendChild(el('line', { x1: Bo.x + ux * k, y1: Bo.y + uy * k, x2: Bo.x, y2: Bo.y, stroke: pal.accent, 'stroke-width': w, 'marker-end': 'url(#egArrowEnd)' }));
    }
    if (!fits) {   // leader along the dim line out to the displaced text
      const e = { x: Bo.x + ux * (2.5), y: Bo.y + uy * (2.5) };
      group.appendChild(el('line', { x1: Bo.x, y1: Bo.y, x2: e.x, y2: e.y, stroke: pal.accent, 'stroke-width': w }));
    }
    // upright text, centred on its run, rotated along the dim line
    const t = el('text', { x: tc.x, y: tc.y, 'font-size': FS, 'font-family': '"IBM Plex Mono", monospace', fill: pal.accent, 'text-anchor': 'middle', transform: `rotate(${ang.toFixed(2)} ${tc.x} ${tc.y})` });
    t.textContent = label; group.appendChild(t);
    textSamples(tc.x, tc.y - FS * 0.35, ux, uy, tw).forEach(q => reg.samples.push(q));
  }

  function render(container, prims, opts = {}) {
    const pal = opts.palette || PALETTES.light;
    const showDims = opts.showDims !== false;
    const maxStep = opts.maxStep == null ? Infinity : opts.maxStep;
    const currentStep = opts.currentStep;
    const animate = !!opts.animate;

    let vis = prims.filter(p => (p.step == null ? 0 : p.step) <= maxStep);
    if (!showDims) vis = vis.filter(p => p.kind !== 'dimension' && p.kind !== 'dim');

    // frame from ALL steps so the drawing does not jump while stepping
    const b = bounds(showDims ? prims : prims.filter(p => p.kind !== 'dimension' && p.kind !== 'dim'));
    const pad = Math.max(10, (b.maxX - b.minX + b.maxY - b.minY) * 0.05);
    const W = (b.maxX - b.minX) + pad * 2, H = (b.maxY - b.minY) + pad * 2;
    const sx = x => (x - b.minX) + pad, sy = y => (b.maxY - y) + pad;      // flip Y
    const centroid = { x: sx((b.minX + b.maxX) / 2), y: sy((b.minY + b.maxY) / 2) };

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid meet', xmlns: NS });
    svg.appendChild(defsMarkers(pal));
    svg.appendChild(el('rect', { x: 0, y: 0, width: W, height: H, fill: pal.sheet }));

    const reg = { samples: [], centroid };
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
            // Keep point labels (a, a', HT, VT, ...) from colliding: try the
            // requested direction, then the remaining compass directions.
            const r = Math.max(4, p.label.length * 1.1);
            const tw = p.label.length * 2.6;                         // approx text width
            const place = (dir) => {
              const ox = dir.includes('w') ? -1.8 : dir.includes('e') ? 1.8 : 0;
              const oy = dir.includes('n') ? -1.8 : dir.includes('s') ? 3.6 : 1.2;
              const anchor = dir.includes('w') ? 'end' : dir.includes('e') ? 'start' : 'middle';
              const cx = sx(p.x) + ox + (anchor === 'end' ? -tw / 2 : anchor === 'start' ? tw / 2 : 0);
              return { ox, oy, anchor, cx, cy: sy(p.y) + oy - 1.4 };
            };
            const want = p.dir || 'ne';
            // alternatives stay on the same side of the point first (a label
            // below XY should stay below XY), then fall back to the other side
            const ns = want[0] === 'n' || want[0] === 's' ? want[0] : '';
            const all = ['ne', 'nw', 'se', 'sw', 'e', 'w', 'n', 's'];
            const order = [want, ...all.filter(d => d !== want && ns && d[0] === ns), 'e', 'w', ...all.filter(d => d !== want && !(ns && d[0] === ns))]
              .filter((d, i, arr) => arr.indexOf(d) === i);
            let pick = place(want);
            for (const d of order) {
              const c = place(d);
              const hit = hits(reg, textSamples(c.cx, c.cy, 1, 0, tw), 3.4);
              if (!hit) { pick = c; break; }
            }
            const t = el('text', { x: sx(p.x) + pick.ox, y: sy(p.y) + pick.oy, 'font-size': 4.2, 'font-family': '"IBM Plex Mono", monospace', fill: col, 'text-anchor': pick.anchor });
            t.textContent = p.label; svg.appendChild(t);
            textSamples(pick.cx, pick.cy, 1, 0, tw).forEach(q => reg.samples.push(q));
          }
          break;
        }
        case 'text': {
          const t = el('text', { x: sx(p.x), y: sy(p.y), 'font-size': p.size || 3.6, 'font-family': '"IBM Plex Mono", monospace', fill: p.color || pal.muted, 'text-anchor': p.anchor || 'start' });
          t.textContent = p.text; svg.appendChild(t);
          { const fs = p.size || 3.6, w = (p.text || '').length * fs * CW, a = p.anchor || 'start';
            const cx = sx(p.x) + (a === 'start' ? w / 2 : a === 'end' ? -w / 2 : 0);
            textSamples(cx, sy(p.y) - fs * 0.35, 1, 0, w).forEach(q => reg.samples.push(q)); }
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
