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

## v4 — Focus mode, per-step dimensions, full screen

- **Sidebar hides after a module is chosen.** The **Modules** button in the header shows it again
  (desktop: in-layout column; phone: slide-in drawer).
- **Inputs hide after Draw** (also after *Load & draw* / practice). A one-line summary of the values
  appears above the drawing with **Edit inputs** to bring the form back; *Reset* and the *Hide* link
  in the Inputs card also control it. Results move under the views while the inputs are hidden.
- **Lengths appear with each line, not only at the end.** Every dimension carries the `step` of the
  line it measures (heights of a'/a at step 1, each view with its own step, traces at the trace step).
  In the rotating-line method the intermediate lines are dimensioned too — `ab1 = TL cos θ`,
  `ab2 = TL`, `a'b2' = TL cos φ` — and are shown only during their construction steps
  (primitive option `until`), so the final sheet stays clean. New dims fade in with their line.
- **Full screen** button on the 2D and 3D panels (Fullscreen API, with a full-window fallback for
  iPhone Safari). In 2D full screen there are ‹ / › step controls; ← / → keys step anywhere.

## v3 — Original layout restored, restyled, with dimensions

The v2 "title block / drawer / timeline" layout was replaced by the **original v1 layout**
(header · module sidebar · Inputs + Results | 2D views | 3D pictorial · construction steps ·
theory / samples / practice tabs). Only the look changed, and dimensioning was kept.

**Look (no "AI template" styling).** Warm graphite UI (`#1E1D1B`) with a cream drawing paper
(`#F4EFE3`) for the 2D views, one accent (vermilion `#D8432B`), Space Grotesk + IBM Plex Mono,
2px corners, 1px hairlines, no shadows, gradients, pill badges or emoji. Module numbers 01–10
with plain "coming soon" text, underline tabs, a numbered step bar, mono results table, a
first-angle projection symbol as the logo, and a light/dark toggle (the paper stays cream).

**Dimensions on the 2D drawing** (`Svg2D.dimension`, reusable for planes/solids later):
aligned dimensions with extension lines, arrowheads, upright rotated text, values to 2 dp + mm.
Lines show TL, a'b' and ab with their working (e.g. `ab = 70 cos 30° = 60.62 mm`), heights of
a'/b' above XY, depths of a/b below XY, and HT/VT distances from A's projector. Short dims put
arrows outside; labels are collision-checked along their full length (no HT/VT overlap at XY).
A **Dimensions** checkbox controls the sheet and the PNG/PDF export.

**Fixes.** *Draw* now shows the finished drawing (v1 showed only step 1, which looked empty);
use *From step 1* / *Next* to replay. 3D panel fills its card (no empty space) and has an
**HP / VP** toggle; the camera re-frames for tall panels. Sheet supports wheel / drag / pinch
zoom with + / − / fit (exports always use the fitted view). Frame stays fixed while stepping.

**Unchanged.** `geometry.js`, every module's projection math, steps, traces, theory, samples,
practice and the exporter.

### Files changed in v3
`index.html`, `css/styles.css`, `js/app.js`, `js/core/workbench.js` (v1 layout restored + new
controls), `js/core/svg2d.js` (dimension placement, label collision, framing),
`js/core/three3d.js` (colours, framing only), `js/modules/lines.js` (dimension labels/placement
only — math untouched).
