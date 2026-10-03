# EG Studio — KTU Engineering Graphics Learning Tool

An interactive, **100% front-end** (HTML + CSS + JavaScript) tool for learning
Engineering Graphics as per the **KTU (APJ Abdul Kalam Technological University)**
syllabus, using **first-angle projection** (Indian standard).

- 2D orthographic drawings rendered with **SVG** (true visible / hidden /
  construction / dimension line conventions, labelled points a, a', b, b').
- 3D pictorial view rendered with **Three.js**, showing the object together with
  the **HP** and **VP** planes and the **XY** reference line (orbit + zoom).
- Step-by-step construction player, formulas/theory, preloaded KTU-style
  problems, a practice mode, input validation and **PNG / PDF export**.

## Status
| # | Module | State |
|---|--------|-------|
| 1 | Projection of Points | ✅ fully working |
| 2 | Projection of Lines & Traces (HT/VT) | ✅ fully working |
| 3 | Projection of Planes | 🚧 scaffolded |
| 4 | Projection of Solids | 🚧 scaffolded |
| 5 | Sections of Solids | 🚧 scaffolded |
| 6 | Development of Surfaces | 🚧 scaffolded |
| 7 | Isometric Projection | 🚧 scaffolded |
| 8 | Perspective Projection | 🚧 scaffolded |
| 9 | Pictorial ↔ Orthographic | 🚧 scaffolded |
| 10 | Intersection of Surfaces | 🚧 scaffolded |

## Run it
No build step and no backend. Because browsers block some features on
`file://`, serve the folder over a tiny static server:

```bash
cd eg-tool
python3 -m http.server 8000
# then open http://localhost:8000
```

(Alternatively just double-click `index.html`; everything is vendored so it also
works offline from the file system in most browsers.)

## Folder structure
```
eg-tool/
├── index.html            # app shell, loads everything
├── css/styles.css        # responsive UI + drawing-sheet styling
├── vendor/               # offline libraries
│   ├── three.min.js      #   3D engine
│   └── jspdf.umd.min.js  #   PDF export
├── js/
│   ├── app.js            # module registry + sidebar navigation
│   ├── core/             # ENGINE (shared, reusable)
│   │   ├── geometry.js   #   pure projection MATH (no rendering)
│   │   ├── svg2d.js      #   2D SVG renderer (primitive list -> SVG)
│   │   ├── three3d.js    #   3D scene builder (spec -> Three.js) + orbit
│   │   ├── exporter.js   #   PNG / PDF export
│   │   └── workbench.js  #   generic UI shell every module plugs into
│   ├── data/problems.js  # shared helpers for samples / practice
│   └── modules/          # ONE FILE PER SYLLABUS MODULE
│       ├── points.js     #   Module 1  (complete)
│       ├── lines.js      #   Module 2  (complete)
│       └── …             #   Modules 3–10 (scaffolded)
└── README.md
```

## Architecture (design principles)
- **Math is separated from rendering.** `js/core/geometry.js` contains only
  pure functions (coordinates, true length, apparent angles, traces, polygons).
  Each module in `js/modules/` turns inputs into a *primitive list* (2D) and a
  *declarative spec* (3D); the renderers in `js/core/` know nothing about
  engineering rules.
- **Adding a module** = add one file in `js/modules/` that calls
  `App.register({ id, num, title, fields, compute, theory, samples, practice })`
  and a `<script>` tag in `index.html`. `compute(values)` returns
  `{ prims2D, spec3D, steps, results }`.
- Every construction step carries a `step` index on its primitives, which the
  **Next step** player reveals progressively.

## Drawing conventions
| Line | Meaning |
|------|---------|
| thick black | visible edges |
| dashed grey | hidden edges |
| thin blue | construction lines / arcs |
| dotted grey | projectors |
| orange | dimensions |
| dashed purple | locus / path of rotation |

---

## v2 — Drafting-office redesign + dimensioning (what changed)

**Design (PART 1).** New "engineering drawing office" theme: warm-graphite / drafting-grey
UI, a cream drawing sheet (`#F4EFE3`), a single vermilion accent (`#D8432B`), Space Grotesk
(UI) + IBM Plex Mono (numbers/labels) from Google Fonts, sharp corners, 1px hairlines, an
8px grid and no shadows/glows. Layout is a slim **left rail** (numbered modules 01–10 with
plain "coming soon" text + the active form + a results table), a centre **drawing sheet**
with a double border, centre marks and a bottom-right **title block** (topic · scale ·
first-angle symbol · sheet · date · "ALL DIMENSIONS IN MM"), a collapsible **3D drawer** on
the right (with HP/VP show-hide and a loading/empty state), and a numbered **step timeline**
with the current step in vermilion. BIS SP:46 line styles (thick visible, thin construction,
dashed hidden, **chain-line XY**) with a legend. Responsive (rail → top dropdown, 3D →
bottom sheet), subtle `stroke-dashoffset` step draw-in that respects
`prefers-reduced-motion`, AA contrast, visible focus rings, labelled inputs, and a
**light/dark toggle**.

**Dimensioning (PART 2).** New reusable `Svg2D.dimension(group, p1, p2, label, opts)` with
two thin extension lines, an offset dimension line, **SVG arrowhead markers** at both ends,
and centred text rotated along the line but kept upright. It marks true length, the apparent
lengths `a'b'` and `ab` (shown as e.g. `a'b' = 70 cos 45° = 49.50`), the heights of a'/b'
above XY, the depths of a/b below XY, and the HT/VT distances from A's projector — all to
2 dp with `mm`. Overlapping labels **auto-offset**, and a collision registry keeps dimension
text clear of the point/trace labels. A **Show dimensions** toggle controls them and they are
included in the PNG/PDF exports. The same system is ready for planes and solids.

**Fixes (PART 3).** Projection math is untouched (`geometry.js` and every module's
`compute()` are unchanged in logic). The HT/VT label clutter at XY was fixed by dropping the
redundant `v`/`h'` letters and routing dimension labels through the collision registry. The
empty 3D panel now has a proper loading/empty overlay, fills its drawer, and has an HP/VP
visibility toggle.

### Files changed
- `index.html` — rebuilt skeleton (rail, sheet + title block, 3D drawer, timeline).
- `css/styles.css` — full drafting-office theme + light/dark + responsive + motion.
- `js/core/svg2d.js` — dimension system, arrowheads, chain-line XY, theme palettes, draw-in.
- `js/core/three3d.js` — `setPlanesVisible()` + `setBackground()` (empty-state handled in UI).
- `js/core/workbench.js` — drives the new layout; theme / planes / dimensions toggles.
- `js/app.js` — rail + mobile-dropdown nav, theme toggle, collapsible drawer.
- `js/modules/points.js`, `js/modules/lines.js` — emit the new aligned dimensions.
- `js/core/geometry.js`, `js/core/exporter.js`, modules 3–10 — unchanged logic.
