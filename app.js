import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// ---------------------------------------------------------------------------
// Primitive catalogue
// ---------------------------------------------------------------------------
const PRIMS = {
  box:      { label: 'Cube',     icon: '■', make: () => new THREE.BoxGeometry(1, 1, 1) },
  sphere:   { label: 'Sphere',   icon: '●', make: () => new THREE.SphereGeometry(0.5, 32, 16) },
  cylinder: { label: 'Cylinder', icon: '▮', make: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 32) },
  cone:     { label: 'Cone',     icon: '▲', make: () => new THREE.ConeGeometry(0.5, 1, 32) },
  torus:    { label: 'Torus',    icon: '◎', make: () => new THREE.TorusGeometry(0.4, 0.15, 16, 48) },
  capsule:  { label: 'Capsule',  icon: '⬮', make: () => new THREE.CapsuleGeometry(0.3, 0.5, 8, 16) },
  plane:    { label: 'Plane',    icon: '▭', make: () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2) },
  pyramid:  { label: 'Pyramid',  icon: '◭', make: () => new THREE.ConeGeometry(0.6, 1, 4) },
  icosa:    { label: 'Ico',      icon: '⬡', make: () => new THREE.IcosahedronGeometry(0.5, 0) },
  dodeca:   { label: 'Dodeca',   icon: '⬢', make: () => new THREE.DodecahedronGeometry(0.5, 0) },
  knot:     { label: 'Knot',     icon: '∞', make: () => new THREE.TorusKnotGeometry(0.35, 0.12, 96, 16) },
  ring:     { label: 'Ring',     icon: '○', make: () => new THREE.RingGeometry(0.25, 0.5, 32).rotateX(-Math.PI / 2) },
};

const PALETTE = ['#e8eaee', '#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9',
                 '#4dabf7', '#748ffc', '#da77f2', '#f783ac', '#868e96', '#343a40'];

const STORAGE_KEY = 'm3d-scene-v1';

// ---------------------------------------------------------------------------
// Renderer / scene setup
// ---------------------------------------------------------------------------
const viewport = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x24272e);

const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 500);
camera.position.set(4, 3.5, 5);

scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(5, 10, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
scene.add(sun);

const grid = new THREE.GridHelper(20, 40, 0x5a6070, 0x3a3f4a);
scene.add(grid);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2),
  new THREE.ShadowMaterial({ opacity: 0.25 })
);
ground.receiveShadow = true;
ground.position.y = -0.001;
scene.add(ground);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.target.set(0, 0.5, 0);

const transform = new TransformControls(camera, renderer.domElement);
transform.size = 1.1;
scene.add(transform);

const selectionBox = new THREE.BoxHelper(undefined, 0x4f9dff);
selectionBox.visible = false;
scene.add(selectionBox);

// All user-created meshes live in this group so helpers are never exported.
const modelRoot = new THREE.Group();
scene.add(modelRoot);

function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);
resize();

renderer.setAnimationLoop(() => {
  orbit.update();
  if (selected) selectionBox.update();
  renderer.render(scene, camera);
});

// ---------------------------------------------------------------------------
// Object creation / serialisation
// ---------------------------------------------------------------------------
let selected = null;
const nameCounters = {};

function createObject(d) {
  const prim = PRIMS[d.prim] ? d.prim : 'box';
  const flat = d.flat ?? false;
  const material = new THREE.MeshStandardMaterial({
    color: d.color ?? '#e8eaee',
    metalness: d.metalness ?? 0.1,
    roughness: d.roughness ?? 0.6,
    wireframe: d.wireframe ?? false,
    flatShading: flat,
    side: (prim === 'plane' || prim === 'ring') ? THREE.DoubleSide : THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(PRIMS[prim].make(), material);
  mesh.userData.prim = prim;
  mesh.name = d.name || nextName(prim);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (d.position) mesh.position.fromArray(d.position);
  if (d.rotation) mesh.rotation.set(d.rotation[0], d.rotation[1], d.rotation[2]);
  if (d.scale) mesh.scale.fromArray(d.scale);
  mesh.visible = d.visible ?? true;
  modelRoot.add(mesh);
  return mesh;
}

function nextName(prim) {
  nameCounters[prim] = (nameCounters[prim] || 0) + 1;
  return `${PRIMS[prim].label} ${nameCounters[prim]}`;
}

function serializeObject(o) {
  const r = (n) => Math.round(n * 10000) / 10000;
  return {
    prim: o.userData.prim,
    name: o.name,
    position: o.position.toArray().map(r),
    rotation: [o.rotation.x, o.rotation.y, o.rotation.z].map(r),
    scale: o.scale.toArray().map(r),
    color: '#' + o.material.color.getHexString(),
    metalness: o.material.metalness,
    roughness: o.material.roughness,
    wireframe: o.material.wireframe,
    flat: o.material.flatShading,
    visible: o.visible,
  };
}

function serialize() {
  return {
    app: 'mobile-3d-studio',
    version: 1,
    objects: modelRoot.children.map(serializeObject),
    selected: selected ? modelRoot.children.indexOf(selected) : -1,
  };
}

function clearScene() {
  select(null);
  for (const o of [...modelRoot.children]) {
    o.geometry.dispose();
    o.material.dispose();
    modelRoot.remove(o);
  }
}

function loadScene(data) {
  clearScene();
  for (const k in nameCounters) delete nameCounters[k];
  for (const d of data.objects || []) {
    const o = createObject(d);
    // keep auto-naming from colliding with loaded names like "Cube 3"
    const m = /^(.*) (\d+)$/.exec(o.name);
    if (m) {
      const prim = Object.keys(PRIMS).find((p) => PRIMS[p].label === m[1]);
      if (prim) nameCounters[prim] = Math.max(nameCounters[prim] || 0, +m[2]);
    }
  }
  const idx = data.selected ?? -1;
  if (idx >= 0 && modelRoot.children[idx]) select(modelRoot.children[idx]);
}

// ---------------------------------------------------------------------------
// Undo / redo history (whole-scene snapshots — cheap for small scenes)
// ---------------------------------------------------------------------------
let history = [];
let historyIndex = -1;

function commit() {
  const snap = JSON.stringify(serialize());
  if (history[historyIndex] === snap) return;
  history = history.slice(0, historyIndex + 1);
  history.push(snap);
  if (history.length > 100) history.shift();
  historyIndex = history.length - 1;
  try { localStorage.setItem(STORAGE_KEY, snap); } catch { /* storage unavailable */ }
  updateUI();
}

function undo() {
  if (historyIndex <= 0) return toast('Nothing to undo');
  historyIndex--;
  restoreHistory();
}
function redo() {
  if (historyIndex >= history.length - 1) return toast('Nothing to redo');
  historyIndex++;
  restoreHistory();
}
function restoreHistory() {
  const snap = history[historyIndex];
  loadScene(JSON.parse(snap));
  try { localStorage.setItem(STORAGE_KEY, snap); } catch { /* storage unavailable */ }
  updateUI();
  refreshSheet();
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------
function select(obj) {
  selected = obj;
  if (obj) {
    transform.attach(obj);
    selectionBox.setFromObject(obj);
    selectionBox.visible = true;
  } else {
    transform.detach();
    selectionBox.visible = false;
  }
  updateUI();
}

// Distinguish a tap (select) from a drag (orbit / gizmo).
const raycaster = new THREE.Raycaster();
let downInfo = null;

renderer.domElement.addEventListener('pointerdown', (e) => {
  // TransformControls handles pointerdown first and sets .axis when the gizmo is hit.
  downInfo = { x: e.clientX, y: e.clientY, t: performance.now(), onGizmo: transform.axis !== null };
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downInfo) return;
  const moved = Math.hypot(e.clientX - downInfo.x, e.clientY - downInfo.y);
  const quick = performance.now() - downInfo.t < 400;
  const onGizmo = downInfo.onGizmo;
  downInfo = null;
  if (onGizmo || moved > 8 || !quick) return;

  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(modelRoot.children.filter((o) => o.visible), false);
  select(hits.length ? hits[0].object : null);
  refreshSheet();
});

transform.addEventListener('dragging-changed', (e) => {
  orbit.enabled = !e.value;
  if (!e.value) commit();
});
transform.addEventListener('objectChange', () => {
  if (sheetMode === 'props') syncPropsInputs();
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
function addPrimitive(prim) {
  const t = orbit.target;
  const y = (prim === 'plane' || prim === 'ring') ? 0.001 : 0.5;
  const color = prim === 'plane' ? '#868e96' : PALETTE[1 + Math.floor(Math.random() * 9)];
  const o = createObject({ prim, color, position: [snapOn ? snap(t.x) : t.x, y, snapOn ? snap(t.z) : t.z] });
  // Nudge sideways until it no longer overlaps anything, so new shapes aren't hidden inside old ones.
  const others = modelRoot.children.filter((c) => c !== o && c.visible).map((c) => new THREE.Box3().setFromObject(c));
  const base = o.position.clone();
  for (let i = 0; i < 40; i++) {
    const ring = Math.ceil(i / 8), angle = (i % 8) * Math.PI / 4;
    o.position.set(base.x + Math.cos(angle) * ring * 1.25, base.y, base.z + Math.sin(angle) * ring * 1.25);
    const box = new THREE.Box3().setFromObject(o);
    if (!others.some((b) => b.intersectsBox(box))) break;
  }
  select(o);
  commit();
  toast(`Added ${o.name}`);
}

function duplicateSelected() {
  if (!selected) return toast('Select an object first');
  const d = serializeObject(selected);
  d.name = nextName(d.prim);
  d.position[0] += 0.5;
  d.position[2] += 0.5;
  const o = createObject(d);
  select(o);
  commit();
  refreshSheet();
}

function deleteSelected() {
  if (!selected) return toast('Select an object first');
  const o = selected;
  select(null);
  o.geometry.dispose();
  o.material.dispose();
  modelRoot.remove(o);
  commit();
  refreshSheet();
}

function setMode(mode) {
  transform.setMode(mode);
  document.querySelectorAll('#toolbar .mode').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  if (!selected) toast('Tap an object to select it');
}

let snapOn = false;
const snap = (v) => Math.round(v / 0.25) * 0.25;
function toggleSnap() {
  snapOn = !snapOn;
  transform.setTranslationSnap(snapOn ? 0.25 : null);
  transform.setRotationSnap(snapOn ? THREE.MathUtils.degToRad(15) : null);
  transform.setScaleSnap(snapOn ? 0.25 : null);
  document.getElementById('btn-snap').classList.toggle('active', snapOn);
  toast(snapOn ? 'Snap on (0.25 / 15°)' : 'Snap off');
}

function focusSelected() {
  const box = new THREE.Box3();
  if (selected) box.setFromObject(selected);
  else if (modelRoot.children.length) box.setFromObject(modelRoot);
  else box.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length() || 1;
  const dir = camera.position.clone().sub(orbit.target).normalize();
  orbit.target.copy(center);
  camera.position.copy(center).addScaledVector(dir, Math.max(size * 1.6, 2));
}

const VIEWS = [
  { name: 'Perspective', dir: [0.55, 0.45, 0.7] },
  { name: 'Front', dir: [0, 0, 1] },
  { name: 'Right', dir: [1, 0, 0] },
  { name: 'Top', dir: [0, 1, 0.0001] },
];
let viewIndex = 0;
function cycleView() {
  viewIndex = (viewIndex + 1) % VIEWS.length;
  const v = VIEWS[viewIndex];
  const dist = camera.position.distanceTo(orbit.target);
  camera.position.copy(orbit.target).addScaledVector(new THREE.Vector3(...v.dir).normalize(), dist);
  toast(v.name + ' view');
}

// ---------------------------------------------------------------------------
// Import / export
// ---------------------------------------------------------------------------
function download(data, filename, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportGroup() {
  const g = new THREE.Group();
  for (const o of modelRoot.children) if (o.visible) g.add(o.clone());
  g.updateMatrixWorld(true);
  return g;
}

function exportAs(format) {
  if (!modelRoot.children.length) return toast('Scene is empty');
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'json') {
    download(JSON.stringify(serialize(), null, 2), `scene-${stamp}.json`, 'application/json');
  } else if (format === 'stl') {
    download(new STLExporter().parse(exportGroup(), { binary: true }), `model-${stamp}.stl`, 'model/stl');
  } else if (format === 'obj') {
    download(new OBJExporter().parse(exportGroup()), `model-${stamp}.obj`, 'text/plain');
  } else if (format === 'glb') {
    new GLTFExporter().parse(
      exportGroup(),
      (buf) => download(buf, `model-${stamp}.glb`, 'model/gltf-binary'),
      (err) => toast('GLB export failed: ' + err.message),
      { binary: true }
    );
  } else if (format === 'png') {
    renderer.domElement.toBlob((b) => download(b, `render-${stamp}.png`));
  }
}

const fileInput = document.getElementById('file-input');
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.objects)) throw new Error('not a scene file');
    loadScene(data);
    commit();
    focusSelected();
    closeSheet();
    toast(`Loaded ${data.objects.length} objects`);
  } catch (err) {
    toast('Could not open file: ' + err.message);
  }
});

// ---------------------------------------------------------------------------
// UI: toast, status, bottom sheet
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
}

function updateUI() {
  $('status').textContent = selected
    ? selected.name
    : `${modelRoot.children.length} object${modelRoot.children.length === 1 ? '' : 's'}`;
  $('btn-undo').disabled = historyIndex <= 0;
  $('btn-redo').disabled = historyIndex >= history.length - 1;
  for (const id of ['btn-props', 'btn-dup', 'btn-del']) $(id).disabled = !selected;
}

const sheet = $('sheet');
const sheetBody = $('sheet-body');
let sheetMode = null;

function openSheet(mode) {
  if (sheetMode === mode) return closeSheet();
  sheetMode = mode;
  sheet.hidden = false;
  refreshSheet();
}
function closeSheet() {
  sheetMode = null;
  sheet.hidden = true;
}

function refreshSheet() {
  if (!sheetMode) return;
  const builders = { add: buildAddSheet, props: buildPropsSheet, objects: buildObjectsSheet, file: buildFileSheet };
  sheetBody.replaceChildren();
  builders[sheetMode]();
}

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v);
  }
  e.append(...children);
  return e;
}

function buildAddSheet() {
  $('sheet-title').textContent = 'Add shape';
  const grid = el('div', { class: 'grid' });
  for (const [key, p] of Object.entries(PRIMS)) {
    grid.append(el('button', { onclick: () => addPrimitive(key) },
      el('span', { class: 'ico' }, p.icon), p.label));
  }
  sheetBody.append(grid);
}

function buildObjectsSheet() {
  $('sheet-title').textContent = 'Objects';
  if (!modelRoot.children.length) {
    sheetBody.append(el('div', { class: 'empty' }, 'No objects yet — tap “Add”.'));
    return;
  }
  const list = el('div', { class: 'list' });
  for (const o of modelRoot.children) {
    const nameBtn = el('button', {
      class: 'name' + (o === selected ? ' active' : ''),
      onclick: () => { select(o); refreshSheet(); },
    }, el('span', { class: 'swatch', style: `background:#${o.material.color.getHexString()}` }), o.name);
    const visBtn = el('button', {
      class: 'vis',
      title: 'Toggle visibility',
      onclick: () => { o.visible = !o.visible; if (!o.visible && o === selected) select(null); commit(); refreshSheet(); },
    }, o.visible ? '👁' : '—');
    list.append(el('div', { class: 'row' }, nameBtn, visBtn));
  }
  sheetBody.append(list);
}

function buildFileSheet() {
  $('sheet-title').textContent = 'File';
  const grid = el('div', { class: 'grid' });
  const item = (icon, label, fn, cls = '') =>
    grid.append(el('button', { onclick: fn, class: cls }, el('span', { class: 'ico' }, icon), label));
  item('📂', 'Open .json', () => fileInput.click());
  item('💾', 'Save .json', () => exportAs('json'));
  item('📦', 'Export GLB', () => exportAs('glb'));
  item('🖨', 'Export STL', () => exportAs('stl'));
  item('📐', 'Export OBJ', () => exportAs('obj'));
  item('📷', 'Screenshot', () => exportAs('png'));
  item('✨', 'New scene', () => {
    if (!confirm('Start a new scene? (You can still undo.)')) return;
    clearScene();
    commit();
    closeSheet();
  }, 'danger');
  sheetBody.append(grid);
  sheetBody.append(el('p', { class: 'empty' }, 'Your work auto-saves in this browser.'));
}

// Props sheet keeps references to its inputs so gizmo drags can update them live.
let propInputs = null;

function buildPropsSheet() {
  $('sheet-title').textContent = 'Edit object';
  propInputs = null;
  if (!selected) {
    sheetBody.append(el('div', { class: 'empty' }, 'Tap an object to edit it.'));
    return;
  }
  const o = selected;
  const wrap = el('div', { class: 'props' });

  const nameInput = el('input', { type: 'text', value: o.name });
  nameInput.addEventListener('change', () => { o.name = nameInput.value.trim() || o.name; commit(); });
  wrap.append(el('div', {}, el('label', {}, 'Name'), nameInput));

  const vecRow = (label, key, toUI, fromUI, step) => {
    const inputs = [0, 1, 2].map(() => el('input', { type: 'number', step, inputmode: 'decimal' }));
    inputs.forEach((inp, i) => inp.addEventListener('change', () => {
      const v = parseFloat(inp.value);
      if (Number.isNaN(v)) return syncPropsInputs();
      const axis = 'xyz'[i];
      o[key][axis] = fromUI(v);
      commit();
    }));
    wrap.append(el('div', {}, el('label', {}, label), el('div', { class: 'xyz' }, ...inputs)));
    return { inputs, key, toUI };
  };
  const rad = THREE.MathUtils.radToDeg, deg = THREE.MathUtils.degToRad;
  const vecs = [
    vecRow('Position', 'position', (v) => v, (v) => v, '0.1'),
    vecRow('Rotation (°)', 'rotation', rad, deg, '5'),
    vecRow('Scale', 'scale', (v) => v, (v) => (v === 0 ? 0.001 : v), '0.1'),
  ];

  const color = el('input', { type: 'color', value: '#' + o.material.color.getHexString() });
  color.addEventListener('input', () => o.material.color.set(color.value));
  color.addEventListener('change', commit);
  const palette = el('div', { class: 'palette' });
  for (const c of PALETTE) {
    palette.append(el('button', {
      style: `background:${c}`,
      title: c,
      onclick: () => { o.material.color.set(c); color.value = c; commit(); },
    }));
  }
  wrap.append(el('div', {}, el('label', {}, 'Color'), color, palette));

  const slider = (label, prop) => {
    const s = el('input', { type: 'range', min: '0', max: '1', step: '0.01', value: String(o.material[prop]) });
    s.addEventListener('input', () => { o.material[prop] = parseFloat(s.value); });
    s.addEventListener('change', commit);
    wrap.append(el('div', {}, el('label', {}, label), s));
  };
  slider('Metalness', 'metalness');
  slider('Roughness', 'roughness');

  const check = (label, prop) => {
    const c = el('input', { type: 'checkbox' });
    c.checked = o.material[prop];
    c.addEventListener('change', () => {
      o.material[prop] = c.checked;
      o.material.needsUpdate = true;
      commit();
    });
    return el('label', {}, c, label);
  };
  wrap.append(el('div', { class: 'checks' }, check('Wireframe', 'wireframe'), check('Flat shading', 'flatShading')));

  sheetBody.append(wrap);
  propInputs = vecs;
  syncPropsInputs();
}

function syncPropsInputs() {
  if (!propInputs || !selected) return;
  const fmt = (n) => String(Math.round(n * 1000) / 1000);
  for (const { inputs, key, toUI } of propInputs) {
    ['x', 'y', 'z'].forEach((a, i) => {
      if (document.activeElement !== inputs[i]) inputs[i].value = fmt(toUI(selected[key][a]));
    });
  }
}

// ---------------------------------------------------------------------------
// Wire up controls
// ---------------------------------------------------------------------------
$('btn-add').onclick = () => openSheet('add');
$('btn-props').onclick = () => openSheet('props');
$('btn-objects').onclick = () => openSheet('objects');
$('btn-file').onclick = () => openSheet('file');
$('sheet-close').onclick = closeSheet;
$('btn-dup').onclick = duplicateSelected;
$('btn-del').onclick = deleteSelected;
$('btn-undo').onclick = undo;
$('btn-redo').onclick = redo;
$('btn-snap').onclick = toggleSnap;
$('btn-focus').onclick = focusSelected;
$('btn-view').onclick = cycleView;
document.querySelectorAll('#toolbar .mode').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));

// Keyboard shortcuts for desktop / tablets with keyboards
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
  else if (e.key === 'w') setMode('translate');
  else if (e.key === 'e') setMode('rotate');
  else if (e.key === 'r') setMode('scale');
  else if (e.key === 'f') focusSelected();
  else if (e.key === 'Escape') { select(null); refreshSheet(); }
});

// ---------------------------------------------------------------------------
// Boot: restore autosave or build a starter scene
// ---------------------------------------------------------------------------
let restored = false;
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) { loadScene(JSON.parse(saved)); restored = true; }
} catch { /* corrupt or unavailable storage — start fresh */ }

if (!restored) {
  createObject({ prim: 'box', color: '#4dabf7', position: [0, 0.5, 0] });
}
commit();
updateUI();
