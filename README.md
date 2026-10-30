# Mobile 3D Studio

A rudimentary, touch-friendly 3D modelling studio that runs entirely in the browser.
No build step, no install — it's a static site built on [three.js](https://threejs.org),
so it can be hosted for free on GitHub Pages and opened on any phone.

## Features

- **12 primitives**: cube, sphere, cylinder, cone, torus, capsule, plane, pyramid,
  icosahedron, dodecahedron, torus knot, ring
- **Tap to select**, then **Move / Rotate / Scale** with an on-screen gizmo
- **Edit panel**: name, exact position / rotation / scale, colour (picker + palette),
  metalness, roughness, wireframe, flat shading
- **Duplicate**, **delete**, **undo / redo** (100 steps)
- **Object list** with show/hide
- **Snap** to a 0.25 grid / 15° rotation steps
- **Camera**: one-finger orbit, two-finger pinch zoom & pan, Focus, and
  Perspective / Front / Right / Top views
- **Auto-saves** to your browser; save/open scenes as `.json`
- **Export** to **GLB**, **STL** (3D printing), **OBJ**, or a PNG screenshot
- Can be added to your home screen ("Add to Home Screen") to launch full-screen

## Using it on your phone (GitHub Pages)

1. On GitHub, open this repository → **Settings** → **Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Pick the branch that holds these files (e.g. `main`) and the **/ (root)** folder, then **Save**.
4. After a minute the site is live at
   `https://<your-username>.github.io/Mobile-3D-studio/` — open that on your phone.

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Orbit camera | 1-finger drag | mouse drag |
| Zoom / pan | 2-finger pinch / drag | wheel / right-drag |
| Select | tap object (tap empty space to deselect) | click / Esc |
| Move / Rotate / Scale | toolbar | W / E / R |
| Duplicate / Delete | toolbar | Ctrl+D / Del |
| Undo / Redo | ↶ ↷ | Ctrl+Z / Ctrl+Shift+Z |
| Focus selection | Focus | F |

## Running locally

Any static file server works, e.g.:

```bash
python3 -m http.server 8000
```

then open <http://localhost:8000>. (Opening `index.html` directly via `file://`
won't work because ES modules need to be served over HTTP.)

## Files

- `index.html` – layout and the import map that loads three.js from a CDN
- `style.css` – mobile-first styling
- `app.js` – the whole app: scene, selection, gizmo, history, UI panels, import/export
