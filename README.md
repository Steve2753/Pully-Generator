# Pulley Lab

A browser-based HTD timing pulley configurator for robotics. It uses Replicad
and Open CASCADE WebAssembly to build actual solids, with a Three.js preview.
No CAD service, Python runtime, or API key is required.

## Run

Use Node.js 22.12+ (24 recommended).

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite. Build with `npm.cmd run build`; serve `dist`
with any static host supporting `.wasm` assets. Sites hosting identity is in
`.openai/hosting.json`.

## GitHub Pages

This is a Vite/React app. The root `index.html` loads source JSX and cannot be
published directly with GitHub's basic static HTML workflow. Publish the built
`dist` folder instead.

1. In the repository's **Settings > Pages**, set **Source** to **GitHub Actions**.
2. Commit and push these files to `main`. The workflow in
   `.github/workflows/static.yml` installs dependencies, runs the Vite build,
   and deploys only `dist`. You can also run it manually from the **Actions** tab.
3. Wait for **Build and deploy to GitHub Pages** to succeed, then open
   <https://Steve2753.github.io/Pully-Generator/>.

`vite.config.js` uses relative asset URLs so the JavaScript, CSS, favicon,
CAD worker, and WebAssembly load under the repository path and on root-level
static hosts. The home and profile-license links also use the configured base.
Do not upload the source tree or `node_modules` as the Pages artifact.

## Features

- HTD 5M and 3M, 12–100 teeth, dimensional validation.
- Toggle inches or millimeters for every length input, result, drawing and CAD
  export. Tooth pitch remains in millimeters in both modes.
- Overall axial width includes toothed face, flanges, and end feature.
- 1/2-inch (12.7 mm) and 3/8-inch (9.525 mm) hex bores, across flats.
- Bore clearance is added to the total across-flat dimension, not each side.
- Fine adjustment of groove width and depth, hex orientation, and which side
  carries a single flange.
- Standard, tube-insert, and bearing-cone variants; zero, one, or two flanges.
- Screen-relative orbit with no pole flips; left drag rotates, Shift-left or
  right/middle drag pans, and scroll zooms. A pan tool also supports left drag.
- Isometric and six orthographic view buttons, plus a projection selector.
- Shaded, shaded with CAD edges, and wireframe display modes.
- Light/dark theme toggle with a remembered preference.
- Front and side drawings at the same scale, using the solid's curved HTD
  outline and actual flange, bore, insert, and cone dimensions. Flanges are
  shown transparent in the front drawing to expose the tooth profile.
- Solid STEP and binary STL exports, generated in a background browser worker.
  STEP declares the selected unit. STL coordinates use the selected unit;
  choose that unit when importing the unitless STL into a slicer.
- STEP import guide for saving an IPT part in Autodesk Inventor. Imported solids
  do not contain an Inventor feature history. Direct native IPT output is not
  implemented; it requires an Inventor automation service.

## Geometry and attribution

Pitch diameter = tooth count × pitch / π. Outside diameter subtracts twice the
pitch-line offset: 0.5715 mm for 5M and 0.381 mm for 3M. Groove outlines are based
on the droftarts community profile, with circular segments fit within 0.002 mm
of the supplied sample coordinates. This is not a certified manufacturing
profile. Test belt fit, shaft fit, and bearing contact against your hardware.

See `public/PROFILE-NOTICE.txt` for attribution and share-alike terms covering
the adapted profile data and generated designs. The reference OpenSCAD source
is retained in `profile-reference.scad`; `scripts/extract-profiles.mjs` extracts
the two profiles without changing their coordinates.

Additional variants can be added in `src/model.mjs` and the parameter/UI modules.

## Verification

```powershell
npm.cmd test
npm.cmd run build
```

CAD checks cover both shafts and all three variants, STEP round-trip volume,
axial dimensions, binary STL integrity, manifold mesh edges, 3M and flange
options, invalid input, and profile arc deviation. Example files are written to
ignored `test-output/`.

WebMCP tools `read_pulley_configuration` and `configure_pulley` are registered
only when the browser supports `document.modelContext`. They use the same UI
state and validation. A supported WebMCP browser was unavailable in the build
session, so live tool registration and UI visual checks remain unverified.
