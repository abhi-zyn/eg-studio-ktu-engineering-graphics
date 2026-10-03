/* =====================================================================
   geometry.js  —  PURE PROJECTION MATH (no rendering here)
   ---------------------------------------------------------------------
   Conventions (First-angle / Indian standard):
     - "Paper" 2D coordinate space is y-UP, millimetres.
       The XY reference line lies on paper-y = 0.
       * Front View (elevation, a') is drawn ABOVE  xy  -> paper-y = +height above HP
       * Top   View (plan,     a ) is drawn BELOW  xy  -> paper-y = -distance in front of VP
     - 3D space (for Three.js) uses:
         X = distance measured to the right along the xy line
         Y = height above HP   (vertical)
         Z = distance in front of VP (towards the observer)
       HP is the plane Y = 0 ;  VP is the plane Z = 0 ; xy line is X-axis.
   ===================================================================== */
const EG = (function () {
  const DEG = Math.PI / 180;
  const RAD = 180 / Math.PI;
  const round = (v, d = 2) => {
    const f = Math.pow(10, d);
    return Math.round((v + Number.EPSILON) * f) / f;
  };
  const deg = (r) => r * RAD;
  const rad = (d) => d * DEG;

  /* ---- Quadrant helpers for a POINT -------------------------------- */
  // heightAboveHP > 0 => above HP ; distInFrontVP > 0 => in front of VP
  function quadrantOf(heightAboveHP, distInFrontVP) {
    const ah = heightAboveHP >= 0, fv = distInFrontVP >= 0;
    if (ah && fv) return { n: 'I',   name: 'First quadrant',  desc: 'Above HP, in front of VP' };
    if (ah && !fv) return { n: 'II',  name: 'Second quadrant', desc: 'Above HP, behind VP' };
    if (!ah && !fv) return { n: 'III', name: 'Third quadrant',  desc: 'Below HP, behind VP' };
    return { n: 'IV', name: 'Fourth quadrant', desc: 'Below HP, in front of VP' };
  }

  /* ---- POINT projection -------------------------------------------
     Returns the paper positions of the front view (fv) and top view (tv)
     for a point placed at horizontal position x (along xy).           */
  function projectPoint(x, heightAboveHP, distInFrontVP) {
    return {
      fv: { x, y: +heightAboveHP },      // elevation, above xy when above HP
      tv: { x, y: -distInFrontVP },      // plan, below xy when in front of VP
      space: { x, y: heightAboveHP, z: distInFrontVP }
    };
  }

  /* =====================================================================
     LINE projection  (the heart of Module 2)
     ---------------------------------------------------------------------
     We model a straight line AB by its two end points A and B, each given
     by (height above HP, distance in front of VP) and a horizontal offset.
     For the classic KTU problems we usually GENERATE the two endpoints from
     the stated conditions.  Here we expose a general solver that, given the
     true length (TL), the inclination to HP (theta) and to VP (phi), and the
     starting end A, returns everything an exam answer needs:
       - Front view length (FV) and its apparent angle (alpha) with xy
       - Top  view length (TV) and its apparent angle (beta)  with xy
       - Plan/elevation end coordinates
       - HT (horizontal trace) and VT (vertical trace) positions
     Core relations (standard results):
       FV length  = TL * sqrt(cos^2(theta) + sin^2(theta)*sin^2(phi))  ... (projection on VP)
       TV length  = TL * sqrt(cos^2(phi)   + sin^2(phi)*sin^2(theta))  ... (projection on HP)
       Height difference between ends  Δh = TL*sin(theta)
       Depth  difference between ends  Δd = TL*sin(phi)
       Plan length (horizontal run)    run = TL*cos(theta)   [projection onto HP for the length along xy uses tan relations]
     We build end coordinates directly from the component form, which is the
     most robust way and automatically yields the apparent angles & traces.
     ===================================================================== */
  // Build a line from end A plus true length and the two true inclinations.
  // Component method: the 3D direction has
  //   dz (depth, +front) and dy (height, +up) fixed by theta & phi,
  //   dx (run along xy) solved so that the 3D length equals TL.
  function solveLineFromInclinations(A, TL, thetaDeg, phiDeg) {
    const th = rad(thetaDeg), ph = rad(phiDeg);
    const dy = TL * Math.sin(th);           // rise (height difference)
    const dz = TL * Math.sin(ph);           // depth difference (front/back)
    const dx2 = TL * TL - dy * dy - dz * dz;
    if (dx2 < -1e-6) {
      throw new Error(
        'Impossible inclinations: θ + φ cannot exceed 90° for a single straight line (sin²θ + sin²φ ≤ 1).'
      );
    }
    const dx = Math.sqrt(Math.max(0, dx2)); // run along xy
    const B = {
      h: A.h + dy,        // height above HP of B
      d: A.d + dz,        // distance in front of VP of B
      x: A.x + dx
    };
    return finishLine(A, B, { TL, thetaDeg, phiDeg });
  }

  // Given the two end points in full (x along xy, h above HP, d in front VP),
  // compute all derived quantities, traces and the primitive-ready coords.
  function finishLine(A, B, meta = {}) {
    const dx = B.x - A.x, dy = B.h - A.h, dz = B.d - A.d;
    const TL = Math.sqrt(dx * dx + dy * dy + dz * dz);
    // Front view points (project out depth -> keep x & h)
    const fvA = { x: A.x, y: A.h }, fvB = { x: B.x, y: B.h };
    // Top view points (project out height -> keep x & -d)
    const tvA = { x: A.x, y: -A.d }, tvB = { x: B.x, y: -B.d };
    const fvLen = Math.hypot(fvB.x - fvA.x, fvB.y - fvA.y);
    const tvLen = Math.hypot(tvB.x - tvA.x, tvB.y - tvA.y);
    // Apparent angles with xy (always reported as magnitude)
    const alpha = deg(Math.atan2(Math.abs(fvB.y - fvA.y), Math.abs(fvB.x - fvA.x))); // FV vs xy
    const beta  = deg(Math.atan2(Math.abs(tvB.y - tvA.y), Math.abs(tvB.x - tvA.x))); // TV vs xy
    // True inclinations (recovered from components)
    const theta = deg(Math.asin(Math.min(1, Math.abs(dy) / (TL || 1)))); // to HP
    const phi   = deg(Math.asin(Math.min(1, Math.abs(dz) / (TL || 1)))); // to VP

    const traces = computeTraces(A, B);
    return {
      A, B,
      fv: { a: fvA, b: fvB, len: fvLen, angle: alpha },
      tv: { a: tvA, b: tvB, len: tvLen, angle: beta },
      TL, theta, phi,
      traces,
      meta
    };
  }

  /* ---- Traces of a line -------------------------------------------
     HT = point where the line (produced if needed) meets HP  -> h = 0
     VT = point where the line (produced if needed) meets VP   -> d = 0
     Parametrize P(t) = A + t*(B-A).
       HT at t where height h(t)=0 ;  VT at t where depth d(t)=0.
     The HT shows in the TOP view on xy extended; VT shows in FV on xy.   */
  function computeTraces(A, B) {
    const dh = B.h - A.h, dd = B.d - A.d, dx = B.x - A.x;
    let HT = null, VT = null;
    if (Math.abs(dh) > 1e-9) {
      const t = -A.h / dh;                // where height = 0
      HT = { x: A.x + t * dx, d: A.d + t * dd, t };
    }
    if (Math.abs(dd) > 1e-9) {
      const t = -A.d / dd;                // where depth = 0
      VT = { x: A.x + t * dx, h: A.h + t * dh, t };
    }
    return { HT, VT };
  }

  /* ---- Regular polygon vertices (for planes / solid bases) --------- */
  function regularPolygon(n, R, rotationDeg = 0, cx = 0, cy = 0) {
    const pts = [];
    const off = rad(rotationDeg) - Math.PI / 2; // start at top
    for (let i = 0; i < n; i++) {
      const a = off + (i * 2 * Math.PI) / n;
      pts.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
    }
    return pts;
  }
  // Side length <-> circumradius for regular n-gon
  const sideToCircumR = (n, s) => s / (2 * Math.sin(Math.PI / n));

  return {
    DEG, RAD, deg, rad, round,
    quadrantOf, projectPoint,
    solveLineFromInclinations, finishLine, computeTraces,
    regularPolygon, sideToCircumR
  };
})();
if (typeof window !== 'undefined') window.EG = EG;
