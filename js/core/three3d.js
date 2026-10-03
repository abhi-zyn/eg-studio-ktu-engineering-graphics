/* =====================================================================
   three3d.js  —  3D RENDERER (Three.js). Builds a scene from a spec so
   module code stays free of Three.js. Includes a small built-in orbit
   control (drag = rotate, wheel/pinch = zoom) so we rely only on the
   core three.min.js global build (works offline).
   Axis mapping:  X = along xy,  Y = height above HP,  Z = in front of VP
   HP = plane Y=0  (horizontal) ;  VP = plane Z=0 (vertical).
   ===================================================================== */
const Three3D = (function () {
  class Scene3D {
    constructor(canvas) {
      this.canvas = canvas;
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x171614);
      this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
      this.target = new THREE.Vector3(0, 0, 0);
      this.dynamic = new THREE.Group();        // cleared each rebuild
      this.scene.add(this.dynamic);
      this._initLights();
      this._initPlanes();
      this._initOrbit();
      this.setView(40, 25, 1.6);               // default azimuth/elev, dist factor
      this._animate = this._animate.bind(this);
      this._raf = requestAnimationFrame(this._animate);
      this._onResize = () => this.resize();
      window.addEventListener('resize', this._onResize);
      this.unfold = null; // development animation hook {t, apply(t)}
    }

    _initLights() {
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const d = new THREE.DirectionalLight(0xffffff, 0.8); d.position.set(80, 140, 120);
      this.scene.add(d);
      const d2 = new THREE.DirectionalLight(0xffe6cc, 0.3); d2.position.set(-100, 60, -80);
      this.scene.add(d2);
    }

    _initPlanes() {
      const S = 120;
      // HP (horizontal, Y=0) spanning X & Z
      const hp = new THREE.Mesh(
        new THREE.PlaneGeometry(S, S),
        new THREE.MeshBasicMaterial({ color: 0x8A7A5A, transparent: true, opacity: 0.30, side: THREE.DoubleSide, depthWrite: false })
      );
      hp.rotation.x = -Math.PI / 2; hp.position.set(S / 2 - 15, 0, S / 2 - 15);
      this._planeObjs = this._planeObjs || [];
      // VP (vertical, Z=0) spanning X & Y
      const vp = new THREE.Mesh(
        new THREE.PlaneGeometry(S, S),
        new THREE.MeshBasicMaterial({ color: 0x5E6B73, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false })
      );
      vp.position.set(S / 2 - 15, S / 2 - 15, 0);
      this.scene.add(hp); this.scene.add(vp);
      // grid on HP
      const grid = new THREE.GridHelper(S, 12, 0x7a7262, 0x4a463e);
      grid.position.set(S / 2 - 15, 0.02, S / 2 - 15); this.scene.add(grid);
      this._planeObjs.push(hp, vp, grid);
      // XY reference line (intersection of HP & VP) -> X axis
      this.scene.add(this._tube([[-18, 0, 0], [S - 15, 0, 0]], 0xD8432B, 0.45, 0xffffff));
      // small axis labels via sprites
      this._planeObjs.push(this._addLabel('HP', new THREE.Vector3(S - 20, 0.5, 40), '#B8995C'));
      this._planeObjs.push(this._addLabel('VP', new THREE.Vector3(S - 20, 40, 0.5), '#7F97A4'));
      this._addLabel('X', new THREE.Vector3(-22, 0, 0), '#D8432B');
      this._addLabel('Y', new THREE.Vector3(S - 12, 0, 0), '#D8432B');
    }

    _addLabel(text, pos, color = '#ddd') {
      const c = document.createElement('canvas'); c.width = 128; c.height = 64;
      const ctx = c.getContext('2d'); ctx.fillStyle = color; ctx.font = 'bold 40px Georgia'; ctx.textAlign = 'center';
      ctx.fillText(text, 64, 46);
      const tex = new THREE.CanvasTexture(c);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
      sp.position.copy(pos); sp.scale.set(10, 5, 1);
      this.scene.add(sp);
      return sp;
    }

    setPlanesVisible(v) { (this._planeObjs || []).forEach(o => { o.visible = v; }); }
    setBackground(hex) { this.scene.background = new THREE.Color(hex); }

    _tube(points, color, r = 0.4, ignored) {
      const g = new THREE.Group();
      for (let i = 0; i < points.length - 1; i++) {
        const a = new THREE.Vector3(...points[i]), b = new THREE.Vector3(...points[i + 1]);
        const len = a.distanceTo(b);
        const geo = new THREE.CylinderGeometry(r, r, len, 10);
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(a.clone().add(b).multiplyScalar(0.5));
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        g.add(m);
      }
      return g;
    }

    /* ---- built-in orbit controls (mouse + touch) ---- */
    _initOrbit() {
      const el = this.canvas;
      let dragging = false, lx = 0, ly = 0, pinchD = 0;
      const down = (x, y) => { dragging = true; lx = x; ly = y; };
      const move = (x, y) => {
        if (!dragging) return;
        this.az -= (x - lx) * 0.5; this.el += (y - ly) * 0.5;
        this.el = Math.max(-85, Math.min(85, this.el));
        lx = x; ly = y; this._place();
      };
      const up = () => { dragging = false; };
      el.addEventListener('mousedown', e => down(e.clientX, e.clientY));
      window.addEventListener('mousemove', e => move(e.clientX, e.clientY));
      window.addEventListener('mouseup', up);
      el.addEventListener('wheel', e => { e.preventDefault(); this.distF *= (1 + Math.sign(e.deltaY) * 0.1); this.distF = Math.max(0.5, Math.min(5, this.distF)); this._place(); }, { passive: false });
      el.addEventListener('touchstart', e => {
        if (e.touches.length === 1) down(e.touches[0].clientX, e.touches[0].clientY);
        else if (e.touches.length === 2) pinchD = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }, { passive: false });
      el.addEventListener('touchmove', e => {
        e.preventDefault();
        if (e.touches.length === 1) move(e.touches[0].clientX, e.touches[0].clientY);
        else if (e.touches.length === 2) {
          const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
          if (pinchD) { this.distF *= pinchD / d; this.distF = Math.max(0.5, Math.min(5, this.distF)); this._place(); }
          pinchD = d;
        }
      }, { passive: false });
      el.addEventListener('touchend', up);
    }

    setView(az, el, distF) { this.az = az; this.el = el; this.distF = distF; this._baseDist = 170; this._place(); }
    _place() {
      const a = this.az * Math.PI / 180, e = this.el * Math.PI / 180;
      // pull the camera back in tall/narrow panels so the object stays framed
      const d = this._baseDist * this.distF * (this._aspectK || 1);
      const cx = this.target.x, cy = this.target.y, cz = this.target.z;
      this.camera.position.set(
        cx + d * Math.cos(e) * Math.sin(a),
        cy + d * Math.sin(e),
        cz + d * Math.cos(e) * Math.cos(a)
      );
      this.camera.lookAt(this.target);
    }

    resize() {
      const r = this.canvas.getBoundingClientRect();
      const w = Math.max(10, r.width), h = Math.max(10, r.height);
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
      const k = Math.max(1, 1.25 / this.camera.aspect);
      if (Math.abs(k - (this._aspectK || 1)) > 1e-3) { this._aspectK = k; this._place(); }
    }

    clearDynamic() { while (this.dynamic.children.length) { const c = this.dynamic.children.pop(); c.traverse?.(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); this.dynamic.remove(c); } this.unfold = null; }

    _animate() { this.resize(); if (this.unfold) this.unfold.tick(); this.renderer.render(this.scene, this.camera); this._raf = requestAnimationFrame(this._animate); }
    dispose() { cancelAnimationFrame(this._raf); window.removeEventListener('resize', this._onResize); this.renderer.dispose(); }

    /* =================================================================
       buildFromSpec — turns a declarative object into 3D geometry.
       Spec shapes (all coords use X=along xy, Y=height, Z=front):
         {type:'points', items:[{x,y,z,label}], projections:true}
         {type:'line', a:{x,y,z}, b:{x,y,z}, projections:true, traces:{HT,VT}}
         {type:'polygon', verts:[{x,y,z}..], face:true}       (planes)
         {type:'solid', mesh:'prism|pyramid|cylinder|cone', ...}
       ================================================================= */
    buildFromSpec(spec) {
      this.clearDynamic();
      if (!spec) return;
      const add = o => this.dynamic.add(o);
      const V = p => new THREE.Vector3(p.x, p.y, p.z);
      const mkDot = (p, color = 0xE4573C, label) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(1.8, 16, 16), new THREE.MeshStandardMaterial({ color }));
        m.position.copy(V(p)); add(m);
        if (label) this._addDynLabel(label, V(p).add(new THREE.Vector3(2, 2, 0)), '#ECE7DA');
      };
      const projLines = (p) => {
        // drop to HP (y=0) and to VP (z=0)
        add(this._tube([[p.x, p.y, p.z], [p.x, 0, p.z]], 0x8C8678, 0.18));  // to HP (plan)
        add(this._tube([[p.x, p.y, p.z], [p.x, p.y, 0]], 0x8C8678, 0.18));  // to VP (elevation)
        mkDot({ x: p.x, y: 0, z: p.z }, 0xC9A35A);  // top view point on HP
        mkDot({ x: p.x, y: p.y, z: 0 }, 0x9FB4C0);  // front view point on VP
      };

      if (spec.type === 'points') {
        const items = spec.items || [];
        this._frame(items.map(V));
        items.forEach(p => { mkDot(p, 0xE4573C, p.label); if (spec.projections) projLines(p); });
      }
      else if (spec.type === 'line') {
        const a = spec.a, b = spec.b;
        this._frame([V(a), V(b)]);
        add(this._tube([[a.x, a.y, a.z], [b.x, b.y, b.z]], 0xECE7DA, 0.6));
        mkDot(a, 0xE4573C, spec.labelA || 'A'); mkDot(b, 0xE4573C, spec.labelB || 'B');
        if (spec.projections) {
          // front view (on VP) and top view (on HP)
          add(this._tube([[a.x, a.y, 0], [b.x, b.y, 0]], 0x9FB4C0, 0.4));
          add(this._tube([[a.x, 0, a.z], [b.x, 0, b.z]], 0xC9A35A, 0.4));
          projLines(a); projLines(b);
        }
        if (spec.traces) {
          if (spec.traces.HT) mkDot({ x: spec.traces.HT.x, y: 0, z: spec.traces.HT.d }, 0xF4EFE3, 'HT');
          if (spec.traces.VT) mkDot({ x: spec.traces.VT.x, y: spec.traces.VT.h, z: 0 }, 0xF4EFE3, 'VT');
        }
      }
      else if (spec.type === 'polygon') {
        const vs = spec.verts.map(V);
        this._frame(vs);
        const geo = new THREE.BufferGeometry().setFromPoints(vs.concat([vs[0]]));
        add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xECE7DA })));
        if (spec.face) {
          const shapeGeo = new THREE.BufferGeometry().setFromPoints(vs);
          const idx = []; for (let i = 1; i < vs.length - 1; i++) idx.push(0, i, i + 1);
          shapeGeo.setIndex(idx); shapeGeo.computeVertexNormals();
          add(new THREE.Mesh(shapeGeo, new THREE.MeshStandardMaterial({ color: 0xD8432B, transparent: true, opacity: 0.45, side: THREE.DoubleSide })));
        }
        (spec.labels || []).forEach((t, i) => vs[i] && this._addDynLabel(t, vs[i].clone().add(new THREE.Vector3(2, 2, 0)), '#ECE7DA'));
      }
      else if (spec.type === 'solid') {
        const m = this._buildSolid(spec);
        add(m.group); this._frame(m.bounds);
        if (spec.unfold) this._setupUnfold(m, spec);
      }
    }

    _addDynLabel(text, pos, color = '#ddd') {
      const c = document.createElement('canvas'); c.width = 128; c.height = 64;
      const ctx = c.getContext('2d'); ctx.fillStyle = color; ctx.font = 'bold 42px Georgia'; ctx.textAlign = 'center';
      ctx.fillText(text, 64, 46);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
      sp.position.copy(pos); sp.scale.set(8, 4, 1); this.dynamic.add(sp);
    }

    // Fit camera target/distance to the content
    _frame(points) {
      if (!points || !points.length) return;
      const box = new THREE.Box3().setFromPoints(points);
      const c = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length();
      this.target.copy(c); this._baseDist = Math.max(60, size * 1.9); this._place();
    }

    /* ---- Solids (prism, pyramid, cylinder, cone) ---- */
    _buildSolid(spec) {
      const group = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: spec.color || 0xcfd8e3, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide, flatShading: true });
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x111111 });
      let geo;
      const h = spec.height || 60, R = spec.radius || 25, n = spec.sides || 6;
      if (spec.mesh === 'cylinder') geo = new THREE.CylinderGeometry(R, R, h, 48);
      else if (spec.mesh === 'cone') geo = new THREE.ConeGeometry(R, h, 48);
      else if (spec.mesh === 'pyramid') geo = new THREE.ConeGeometry(R, h, n);
      else geo = new THREE.CylinderGeometry(R, R, h, n); // prism
      const mesh = new THREE.Mesh(geo, mat);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 1), edgeMat);
      const pivot = new THREE.Group(); pivot.add(mesh); pivot.add(edges);
      // base sits on HP: shift so base at y=0
      pivot.position.y = h / 2;
      // optional tilt (axis inclined to HP): rotate about Z by (90-angle)
      if (spec.tiltHP) pivot.rotation.z = (spec.tiltHP) * Math.PI / 180;
      if (spec.tiltVP) pivot.rotation.x = (spec.tiltVP) * Math.PI / 180;
      const outer = new THREE.Group(); outer.add(pivot);
      outer.position.set(spec.x || 25, 0, spec.z || 25);
      group.add(outer);
      const bounds = [new THREE.Vector3(spec.x || 25, 0, spec.z || 25), new THREE.Vector3((spec.x || 25) + R, h, (spec.z || 25) + R), new THREE.Vector3((spec.x || 25) - R, 0, (spec.z || 25) - R)];
      return { group, mesh, edges, pivot, bounds, spec };
    }

    _setupUnfold(solidObj, spec) {
      // Simple illustrative unfolding: gradually flatten by scaling height->0
      // and spreading a development strip on the HP (schematic animation).
      let t = 0, dir = 1;
      const strip = new THREE.Group(); this.dynamic.add(strip);
      this.unfold = {
        tick: () => {
          t += 0.006 * dir; if (t > 1) { t = 1; dir = -1; } if (t < 0) { t = 0; dir = 1; }
          solidObj.pivot.scale.y = 1 - 0.85 * t;
          solidObj.pivot.children.forEach(c => c.material && (c.material.opacity = 1 - 0.6 * t, c.material.transparent = true));
        }
      };
    }
  }
  return { Scene3D };
})();
if (typeof window !== 'undefined') window.Three3D = Three3D;
