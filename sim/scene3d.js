// 3D CAD view of Station 02: fixture table, RSB-417 bracket with four weld seams,
// a cobot holding the MIG torch, the welding cable with the Nabz current clamp,
// and the phone running the Nabz app. Units are millimetres, Y up.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const COL = {
  table: 0xa3a9b1, slot: 0x7f868f, plate: 0xd0d4d9, bracket: 0xc5cad1, dark: 0x3a3f47,
  cobot: 0xeef0f2, joint: 0x50565f, copper: 0xb87a4b, bead: 0x8a8276, nabz: 0x2a78d6,
  cable: 0x24272b, edge: 0x2c3138, phone: 0x1d2025,
};

// ------------------------------------------------------------------ geometry helpers
class ArcCurve3 extends THREE.Curve {
  constructor(c, r, a0, a1, y) { super(); this.c = c; this.r = r; this.a0 = a0; this.a1 = a1; this.y = y; }
  getPoint(t, out = new THREE.Vector3()) {
    const a = this.a0 + (this.a1 - this.a0) * t;
    return out.set(this.c.x + this.r * Math.cos(a), this.y, this.c.z + this.r * Math.sin(a));
  }
}
// A rippled weld bead along a curve; drawRange reveals it as the arc travels.
function beadGeometry(curve, seg, radial, r) {
  const frames = curve.computeFrenetFrames(seg, false);
  const pos = [], nor = [], idx = [];
  const n = new THREE.Vector3(), P = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    curve.getPointAt(i / seg, P);
    const ripple = 0.86 + 0.14 * Math.abs(Math.sin(i * 1.15));
    const taper = 0.45 + 0.55 * Math.min(1, Math.min(i, seg - i) / 4);
    const R = r * ripple * taper;
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      n.set(0, 0, 0).addScaledVector(frames.normals[i], Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a));
      pos.push(P.x + n.x * R, P.y + n.y * R * 0.8, P.z + n.z * R);
      nor.push(n.x, n.y, n.z);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = (i + 1) * radial + j, c = (i + 1) * radial + ((j + 1) % radial), d = i * radial + ((j + 1) % radial);
    idx.push(a, d, b, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.userData = { seg, radial };
  return g;
}
function roundedRect(w, h, r, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
const hole = (x, y, r) => { const p = new THREE.Path(); p.absarc(x, y, r, 0, Math.PI * 2, true); return p; };

// ------------------------------------------------------------------ factory
export function createStation(host, overlay) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(28, 1, 5, 20000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 250;
  controls.maxDistance = 3200;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.zoomSpeed = 0.7;
  controls.rotateSpeed = 0.6;

  const VIEWS = {
    station: { pos: V(700, 500, 860), target: V(-30, 40, -40) },
    welds: { pos: V(290, 250, 360), target: V(5, 20, -10) },
    top: { pos: V(0, 1350, 120), target: V(0, 0, 0) },
  };
  camera.position.copy(VIEWS.station.pos);
  controls.target.copy(VIEWS.station.target);
  let tween = null;

  // lights
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe3e8, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(500, 1200, 700);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -900, right: 900, top: 900, bottom: -900, near: 100, far: 3000 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  const edgeMat = new THREE.LineBasicMaterial({ color: COL.edge, transparent: true, opacity: 0.45 });
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.5, ...o });
  const add = (geo, material, parent = scene, edges = true, angle = 28) => {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true; m.receiveShadow = true;
    if (edges) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, angle), edgeMat));
    parent.add(m);
    return m;
  };

  // ---------------- floor
  const floorY = -380;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.ShadowMaterial({ opacity: 0.09 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = floorY; floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(4000, 40, 0xd5d8dc, 0xe4e6e9);
  grid.position.y = floorY + 0.5;
  grid.material.transparent = true; grid.material.opacity = 0.7;
  scene.add(grid);

  // ---------------- fixture table
  const tMat = mat(COL.table, { metalness: 0.25, roughness: 0.65 });
  const top = add(new THREE.BoxGeometry(760, 28, 460), tMat);
  top.position.set(0, -14, 0);
  for (let z = -165; z <= 165; z += 82.5) {
    const s = add(new THREE.BoxGeometry(760, 1.5, 9), mat(COL.slot, { roughness: 0.8 }), scene, false);
    s.position.set(0, 0.3, z);
  }
  for (const [x, z] of [[-345, -195], [345, -195], [-345, 195], [345, 195]]) {
    const leg = add(new THREE.BoxGeometry(40, -floorY - 28, 40), tMat);
    leg.position.set(x, (floorY - 28) / 2, z);
  }
  const rail = add(new THREE.BoxGeometry(690, 30, 20), tMat);
  rail.position.set(0, floorY + 70, 195);

  // ---------------- bracket RSB-417
  const bracket = new THREE.Group();
  scene.add(bracket);
  const bMat = mat(COL.bracket, { metalness: 0.45, roughness: 0.38 });
  {
    const s = roundedRect(320, 170, 12);
    s.holes.push(hole(-132, 60, 8.5), hole(132, 60, 8.5), hole(-132, -60, 8.5), hole(132, -60, 8.5));
    const g = new THREE.ExtrudeGeometry(s, { depth: 8, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.8, bevelSegments: 1, curveSegments: 20 });
    g.rotateX(-Math.PI / 2);
    add(g, mat(COL.plate, { metalness: 0.45, roughness: 0.4 }), bracket);
  }
  { // web
    const w = add(new THREE.BoxGeometry(230, 70, 10), bMat, bracket);
    w.position.set(-25, 8 + 35, -20);
  }
  const gusset = (x0) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(58, 0); s.lineTo(0, 56); s.lineTo(0, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 8, bevelEnabled: false });
    g.rotateY(-Math.PI / 2); // shape x -> world +z, depth -> -x
    const m = add(g, bMat, bracket);
    m.position.set(x0, 8, -15);
  };
  gusset(-96); gusset(44);
  { // tube
    const s = new THREE.Shape(); s.absarc(0, 0, 28, 0, Math.PI * 2, false);
    s.holes.push(hole(0, 0, 21));
    const g = new THREE.ExtrudeGeometry(s, { depth: 78, bevelEnabled: false, curveSegments: 40 });
    g.rotateX(-Math.PI / 2);
    const m = add(g, bMat, bracket, true, 40);
    m.position.set(118, 8, 10);
  }
  { // tab with hole
    const s = roundedRect(60, 40, 0, 0, 20);
    const s2 = new THREE.Shape();
    s2.moveTo(-30, 0); s2.lineTo(30, 0); s2.lineTo(30, 26); s2.absarc(0, 26, 30, 0, Math.PI, false); s2.lineTo(-30, 0);
    s2.holes.push(hole(0, 26, 9));
    const g = new THREE.ExtrudeGeometry(s2, { depth: 8, bevelEnabled: false, curveSegments: 24 });
    const m = add(g, bMat, bracket);
    m.position.set(-30, 8, 18);
    void s;
  }
  // fixture locators and clamps
  for (const [x, z] of [[-132, -60], [132, 60]]) {
    const pin = add(new THREE.CylinderGeometry(8, 8, 18, 24), mat(COL.dark), scene);
    pin.position.set(x, 9, z);
  }
  const toggleClamp = (x, z, rot) => {
    const g = new THREE.Group(); scene.add(g);
    g.position.set(x, 0, z); g.rotation.y = rot;
    const base = add(new THREE.BoxGeometry(46, 22, 40), mat(COL.dark), g); base.position.set(0, 11, -40);
    const arm = add(new THREE.BoxGeometry(14, 10, 70), mat(0x8c939c), g); arm.position.set(0, 30, -14);
    const spindle = add(new THREE.CylinderGeometry(4, 4, 30, 12), mat(0x8c939c), g); spindle.position.set(0, 18, 14);
    const pad = add(new THREE.CylinderGeometry(8, 8, 6, 16), mat(0x2a2d31, { roughness: 0.9 }), g); pad.position.set(0, 11, 14);
    const handle = add(new THREE.CylinderGeometry(6, 6, 60, 12), mat(0x2a2d31, { roughness: 0.9 }), g);
    handle.position.set(0, 46, -62); handle.rotation.x = -0.9;
  };
  toggleClamp(-60, 105, 0); toggleClamp(60, -108, Math.PI);

  // ---------------- weld seams (paths in the fillet corners)
  const seamCurves = [
    new THREE.LineCurve3(V(-93.4, 10.6, -12), V(-93.4, 10.6, 39)),
    new THREE.LineCurve3(V(46.6, 10.6, -12), V(46.6, 10.6, 39)),
    new ArcCurve3(V(118, 0, 10), 30.6, Math.PI * 1.22, Math.PI * 2.78, 10.6),
    new THREE.LineCurve3(V(-58, 10.6, 28.6), V(-2, 10.6, 28.6)),
  ];
  const beadMats = [], beads = [], guides = [];
  const guideMat = new THREE.LineDashedMaterial({ color: 0x7d838c, dashSize: 4, gapSize: 4, transparent: true, opacity: 0.9 });
  const missMat = new THREE.LineDashedMaterial({ color: 0xd03b3b, dashSize: 5, gapSize: 3 });
  seamCurves.forEach((c) => {
    const m = new THREE.MeshStandardMaterial({ color: COL.bead, metalness: 0.55, roughness: 0.45, emissive: 0xff6a1a, emissiveIntensity: 0 });
    beadMats.push(m);
    const geo = beadGeometry(c, c instanceof ArcCurve3 ? 140 : 48, 14, 4.8);
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = true;
    geo.setDrawRange(0, 0);
    scene.add(mesh); beads.push(mesh);
    const lg = new THREE.BufferGeometry().setFromPoints(c.getPoints(80).map((p) => p.clone().add(V(0, 1.2, 0))));
    const line = new THREE.Line(lg, guideMat); line.computeLineDistances();
    scene.add(line); guides.push(line);
  });

  // ---------------- cobot + torch
  const robotBase = V(270, 0, -185);
  const shoulderH = 115, L1 = 235, L2 = 215;
  const cMat = mat(COL.cobot, { metalness: 0.05, roughness: 0.45 });
  const jMat = mat(COL.joint, { roughness: 0.55 });
  const pedestal = add(new THREE.CylinderGeometry(46, 52, 40, 40), cMat); pedestal.position.copy(robotBase).add(V(0, 20, 0));
  const turret = add(new THREE.CylinderGeometry(38, 42, 70, 40), cMat); turret.position.copy(robotBase).add(V(0, 76, 0));
  const ring = add(new THREE.CylinderGeometry(43, 43, 6, 40), jMat); ring.position.copy(robotBase).add(V(0, 42, 0));
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 32, 1);
  const link1 = add(unitCyl, cMat, scene, false), link2 = add(unitCyl, cMat, scene, false);
  const jShoulder = add(new THREE.CylinderGeometry(33, 33, 64, 36), jMat);
  const jElbow = add(new THREE.CylinderGeometry(27, 27, 52, 36), jMat);
  const jWrist = add(new THREE.CylinderGeometry(20, 20, 40, 30), jMat);
  const neck = add(unitCyl, mat(0x2f3339, { roughness: 0.6 }), scene, false);
  const nozzle = add(new THREE.CylinderGeometry(7.5, 11, 1, 28, 1, true), mat(COL.copper, { metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide }), scene, false);
  const ctip = add(new THREE.CylinderGeometry(2.4, 3.2, 1, 16), mat(COL.copper, { metalness: 0.9, roughness: 0.25 }), scene, false);
  const yUp = V(0, 1, 0);
  const placeBetween = (mesh, a, b, r) => {
    const d = b.clone().sub(a), len = d.length();
    mesh.position.copy(a).addScaledVector(d, 0.5);
    mesh.scale.set(r, len, r);
    mesh.quaternion.setFromUnitVectors(yUp, d.normalize());
  };
  const placeJoint = (mesh, at, axis) => { mesh.position.copy(at); mesh.quaternion.setFromUnitVectors(yUp, axis); };

  // arc light
  const arcLight = new THREE.PointLight(0x9fcfff, 0, 520, 1.6);
  scene.add(arcLight);
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.14, 'rgba(190,225,255,1)');
    r.addColorStop(0.32, 'rgba(70,150,240,.55)'); r.addColorStop(1, 'rgba(70,150,240,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: 0 }));
  glow.scale.set(70, 70, 1);
  scene.add(glow);

  // ---------------- welding power source + cable + Nabz clamp
  const ps = new THREE.Group(); scene.add(ps);
  ps.position.set(-305, 0, -170);
  const psBody = add(new THREE.BoxGeometry(140, 170, 180), mat(0xdfe2e6, { metalness: 0.15, roughness: 0.5 }), ps); psBody.position.set(0, 85, 0);
  const psPanel = add(new THREE.BoxGeometry(124, 120, 4), mat(0x3a3f47, { roughness: 0.7 }), ps); psPanel.position.set(0, 92, 91);
  const psScreen = add(new THREE.BoxGeometry(60, 26, 2), mat(0x2a78d6, { emissive: 0x174a8a, emissiveIntensity: 0.4 }), ps, false); psScreen.position.set(-26, 126, 94);
  for (const x of [18, 44]) { const k = add(new THREE.CylinderGeometry(8, 8, 10, 24), mat(0x8c939c), ps); k.rotation.x = Math.PI / 2; k.position.set(x, 126, 95); }
  const handleBar = add(new THREE.TorusGeometry(40, 5, 10, 30, Math.PI), mat(0x3a3f47), ps); handleBar.position.set(0, 170, 0);

  const cableMat = mat(COL.cable, { metalness: 0.05, roughness: 0.75 });
  const staticCable = new THREE.CatmullRomCurve3([
    V(-330, 50, -76), V(-318, 10, -40), V(-230, 6, -95), V(-90, 6, -190), V(90, 6, -210), V(205, 8, -212), V(238, 40, -214),
  ]);
  add(new THREE.TubeGeometry(staticCable, 140, 6.5, 12, false), cableMat, scene, false);
  // clamp on the cable
  const clampT = 0.13;
  const cp = staticCable.getPointAt(clampT), ct = staticCable.getTangentAt(clampT);
  const clamp = new THREE.Group(); scene.add(clamp);
  clamp.position.copy(cp);
  clamp.quaternion.setFromUnitVectors(V(0, 0, 1), ct);
  const nMat = mat(COL.nabz, { metalness: 0.15, roughness: 0.4 });
  add(new THREE.TorusGeometry(19, 8.5, 20, 44), nMat, clamp);
  const hinge = add(new THREE.BoxGeometry(24, 16, 34), nMat, clamp); hinge.position.set(0, 25, 0);
  const split = add(new THREE.BoxGeometry(2.5, 3, 36), mat(0x0f3e78), clamp, false); split.position.set(0, -27.5, 0);
  // signal cord + node
  const nodePos = V(-245, 0, 30);
  const node = add(new THREE.BoxGeometry(66, 26, 46), mat(0xf4f5f6, { roughness: 0.4 }), scene); node.position.copy(nodePos).add(V(0, 13, 0));
  const nodeStripe = add(new THREE.BoxGeometry(66.5, 5, 46.5), nMat, scene, false); nodeStripe.position.copy(nodePos).add(V(0, 24, 0));
  const led = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8), new THREE.MeshStandardMaterial({ color: 0x6fd36f, emissive: 0x2fb52f, emissiveIntensity: 0.6 }));
  led.position.copy(nodePos).add(V(22, 27, 16)); scene.add(led);
  const cordCurve = new THREE.CatmullRomCurve3([cp.clone().add(V(0, 32, 0)), cp.clone().add(V(20, 46, 20)), nodePos.clone().add(V(-10, 40, -20)), nodePos.clone().add(V(-20, 26, -10))]);
  add(new THREE.TubeGeometry(cordCurve, 40, 1.6, 8, false), mat(0x1f2329), scene, false);

  let dynCable = null;
  const updateCable = (pts) => {
    if (dynCable) { scene.remove(dynCable); dynCable.geometry.dispose(); }
    const curve = new THREE.CatmullRomCurve3(pts);
    dynCable = new THREE.Mesh(new THREE.TubeGeometry(curve, 50, 6, 10, false), cableMat);
    dynCable.castShadow = true;
    scene.add(dynCable);
  };

  // ---------------- phone on a stand
  const phoneG = new THREE.Group(); scene.add(phoneG);
  phoneG.position.set(-262, 0, 150);
  const standMat = mat(0x5b616a, { metalness: 0.6, roughness: 0.35 });
  const sBase = add(new THREE.CylinderGeometry(34, 38, 8, 36), standMat, phoneG); sBase.position.y = 4;
  const sPole = add(new THREE.CylinderGeometry(4, 4, 96, 16), standMat, phoneG); sPole.position.y = 52;
  const holder = new THREE.Group(); phoneG.add(holder);
  holder.position.y = 172;
  holder.rotation.set(-0.2, 0.92, 0);
  const pBody = add(new THREE.BoxGeometry(76, 156, 8.5), mat(COL.phone, { metalness: 0.4, roughness: 0.35 }), holder);
  const cradle = add(new THREE.BoxGeometry(84, 10, 14), standMat, holder); cradle.position.set(0, -80, -2);
  const neckJ = add(new THREE.SphereGeometry(7, 16, 10), standMat, holder, false); neckJ.position.set(0, -76, -8);
  void pBody;
  const screenCanvas = document.createElement('canvas'); screenCanvas.width = 380; screenCanvas.height = 780;
  const screenTex = new THREE.CanvasTexture(screenCanvas); screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = 8;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(70, 148), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.position.z = 4.4; holder.add(screen);

  // ---------------- labels (HTML overlay)
  const labels = [
    { id: 'clamp', title: 'Current clamp', sub: 'Clips over the welding cable. Sees every arc start and stop.', get: () => cp.clone().add(V(0, 34, 0)), dx: 30, dy: -120, big: true },
    { id: 'phone', title: 'Phone with the Nabz app', sub: 'Listens only while an arc is on.', get: () => screen.getWorldPosition(new THREE.Vector3()).add(V(0, 70, 0)), dx: -40, dy: -150, big: true },
    ...seamCurves.map((c, i) => ({ id: 'w' + i, title: 'W' + (i + 1), get: () => c.getPointAt(0.5).clone().add(V(0, 6, 0)), dx: [-34, 14, 30, -30][i], dy: [-40, -44, -48, 32][i] })),
  ];
  const svgNS = 'http://www.w3.org/2000/svg';
  const leaderSvg = document.createElementNS(svgNS, 'svg');
  leaderSvg.setAttribute('class', 'leaders');
  overlay.appendChild(leaderSvg);
  labels.forEach((L) => {
    L.el = document.createElement('div');
    L.el.className = 'callout' + (L.big ? ' big' : ' tag');
    L.el.innerHTML = L.big ? `<b>${L.title}</b><span>${L.sub}</span>` : L.title;
    overlay.appendChild(L.el);
    L.line = document.createElementNS(svgNS, 'line');
    L.dot = document.createElementNS(svgNS, 'circle'); L.dot.setAttribute('r', L.big ? 3.5 : 2.5);
    leaderSvg.appendChild(L.line); leaderSvg.appendChild(L.dot);
  });
  let showLabels = true;

  // ---------------- state & animation
  const tip = V(0, 160, 40), tipTarget = V(0, 160, 40);
  const tdir = V(0.45, 0.85, 0.28).normalize(), tdirTarget = tdir.clone();
  const PARK = V(10, 150, 60);
  let arcI = 0;
  const heat = [0, 0, 0, 0];
  let size = { w: 1, h: 1 };

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    size = { w, h };
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  function setView(name) {
    const v = VIEWS[name];
    tween = { t: 0, start: performance.now(), p0: camera.position.clone(), q0: controls.target.clone(), p1: v.pos.clone(), q1: v.target.clone() };
  }

  const tmp = new THREE.Vector3();
  function solveArm(wrist) {
    const S = robotBase.clone().add(V(0, shoulderH, 0));
    const d = wrist.clone().sub(S);
    const yaw = Math.atan2(d.x, d.z);
    const u = V(Math.sin(yaw), 0, Math.cos(yaw));
    const r = Math.hypot(d.x, d.z), h = d.y;
    const D = Math.min(L1 + L2 - 2, Math.max(60, Math.hypot(r, h)));
    const a1 = Math.atan2(h, r) + Math.acos(Math.min(1, (L1 * L1 + D * D - L2 * L2) / (2 * L1 * D)));
    const E = S.clone().addScaledVector(u, Math.cos(a1) * L1).add(V(0, Math.sin(a1) * L1, 0));
    const axis = V(Math.cos(yaw), 0, -Math.sin(yaw));
    return { S, E, axis, yaw };
  }

  // st: { beads:[0..1]x4, missed:[bool]x4, arc:{w,frac}|null, mode:'live'|'lapse', phone:{...} }
  function update(st, dt) {
    // beads
    st.beads.forEach((f, i) => {
      const g = beads[i].geometry, { seg, radial } = g.userData;
      g.setDrawRange(0, Math.floor(Math.max(0, Math.min(1, f)) * seg) * radial * 6);
      guides[i].visible = f < 1 || st.missed[i];
      guides[i].material = st.missed[i] ? missMat : guideMat;
      const target = st.heat ? st.heat[i] : 0;
      heat[i] += (target - heat[i]) * (1 - Math.exp(-dt * 6));
      beadMats[i].emissiveIntensity = heat[i] * 1.4;
    });
    // torch target
    if (st.arc) {
      tipTarget.copy(seamCurves[st.arc.w].getPointAt(Math.min(1, st.arc.frac))).add(V(0, 5, 0));
    } else if (st.next != null) {
      tipTarget.copy(seamCurves[st.next].getPointAt(0)).add(V(0, 40, 0));
    } else tipTarget.copy(PARK);
    const k = st.arc ? 22 : 5;
    tip.lerp(tipTarget, 1 - Math.exp(-dt * k));
    // lean the torch away from the wall it welds against
    const leanFor = [V(0.55, 0.8, 0.25), V(0.55, 0.8, 0.25), V(0.2, 0.85, 0.48), V(0.1, 0.8, 0.6)];
    tdirTarget.copy(st.arc ? leanFor[st.arc.w] : st.next != null ? leanFor[st.next] : V(0.3, 0.9, 0.3)).normalize();
    tdir.lerp(tdirTarget, 1 - Math.exp(-dt * 4)).normalize();
    const nozzleEnd = tip.clone().addScaledVector(tdir, 9);
    const nozzleTop = tip.clone().addScaledVector(tdir, 44);
    const wrist = tip.clone().addScaledVector(tdir, 130);
    placeBetween(nozzle, nozzleEnd, nozzleTop, 1);
    placeBetween(ctip, tip.clone().addScaledVector(tdir, 3), nozzleEnd, 1);
    placeBetween(neck, nozzleTop, wrist, 11);
    const arm = solveArm(wrist);
    placeBetween(link1, arm.S, arm.E, 23);
    placeBetween(link2, arm.E, wrist, 18);
    placeJoint(jShoulder, arm.S, arm.axis);
    placeJoint(jElbow, arm.E, arm.axis);
    placeJoint(jWrist, wrist, arm.axis);
    turret.rotation.y = arm.yaw;
    updateCable([robotBase.clone().add(V(-30, 80, -40)), arm.S.clone().add(V(-30, 50, -30)), arm.E.clone().add(V(0, 46, 0)), wrist.clone().add(V(0, 30, 0)), nozzleTop.clone().addScaledVector(tdir, 40)]);
    // arc glow (smoothed so it never flickers)
    const arcTarget = st.arc ? 1 : 0;
    arcI += (arcTarget - arcI) * (1 - Math.exp(-dt * 14));
    arcLight.position.copy(tip).add(V(0, 6, 0));
    arcLight.intensity = arcI * 26000;
    glow.position.copy(tip).add(V(0, 2, 0));
    glow.material.opacity = arcI;
    const sc = 46 + 10 * arcI;
    glow.scale.set(sc, sc, 1);
    led.material.emissiveIntensity = 0.5 + arcI * 2.2;
    led.material.emissive.setHex(st.dropped ? 0x777777 : arcI > 0.2 ? 0x2a78d6 : 0x2fb52f);
    if (st.phoneKey !== update._pk) { update._pk = st.phoneKey; drawPhone(st.phone); screenTex.needsUpdate = true; }
    // labels: missed weld tag in red
    labels.slice(2).forEach((L, i) => L.el.classList.toggle('miss', !!st.missed[i]));

    // camera tween
    if (tween) {
      tween.t = Math.min(1, (performance.now() - tween.start) / 900);
      const e = tween.t < 0.5 ? 4 * tween.t ** 3 : 1 - Math.pow(-2 * tween.t + 2, 3) / 2;
      camera.position.lerpVectors(tween.p0, tween.p1, e);
      controls.target.lerpVectors(tween.q0, tween.q1, e);
      if (tween.t >= 1) tween = null;
    }
    controls.update();
    renderer.render(scene, camera);
    placeLabels();
  }

  function placeLabels() {
    leaderSvg.setAttribute('viewBox', `0 0 ${size.w} ${size.h}`);
    labels.forEach((L) => {
      const p = L.get();
      tmp.copy(p).project(camera);
      const x = (tmp.x * 0.5 + 0.5) * size.w, y = (-tmp.y * 0.5 + 0.5) * size.h;
      const vis = showLabels && tmp.z < 1 && x > -50 && x < size.w + 50;
      L.el.style.display = vis ? '' : 'none';
      L.line.style.display = L.dot.style.display = vis ? '' : 'none';
      if (!vis) return;
      let lx = x + L.dx, ly = y + L.dy;
      const bw = L.el.offsetWidth, bh = L.el.offsetHeight;
      lx = Math.max(8, Math.min(size.w - bw - 8, lx));
      ly = Math.max(60, Math.min(size.h - bh - 60, ly));
      L.el.style.transform = `translate(${lx}px, ${ly}px)`;
      const ax = lx + (L.dx < 0 ? bw : 0), ay = ly + bh / 2;
      L.line.setAttribute('x1', x); L.line.setAttribute('y1', y);
      L.line.setAttribute('x2', ax); L.line.setAttribute('y2', ay);
      L.dot.setAttribute('cx', x); L.dot.setAttribute('cy', y);
      L.el.classList.toggle('hl', L.id === highlight);
    });
  }
  let highlight = null;

  // phone screen: a small rendition of the Nabz app
  const PHONE_COL = { ok: '#0c8a0c', watch: '#6b6f76', advise: '#d99200', hold: '#d03b3b', unverified: '#8b8e94', idle: '#8b8e94' };
  function drawPhone(ph) {
    const g = screenCanvas.getContext('2d');
    const W = screenCanvas.width, H = screenCanvas.height;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f2f3f5'; g.fillRect(0, 0, W, 70);
    g.fillStyle = '#1b1d21'; g.font = '600 26px Inter, system-ui, sans-serif'; g.fillText('Nabz', 26, 46);
    g.fillStyle = '#6b6f76'; g.font = '20px Inter, system-ui, sans-serif'; g.textAlign = 'right'; g.fillText('Station 02', W - 24, 45); g.textAlign = 'left';
    const c = PHONE_COL[ph.state] || '#8b8e94';
    g.fillStyle = c; g.globalAlpha = 0.12; g.fillRect(20, 96, W - 40, 230); g.globalAlpha = 1;
    g.fillStyle = c; g.fillRect(20, 96, 10, 230);
    g.fillStyle = c; g.beginPath(); g.arc(78, 160, 26, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = '700 30px Inter, system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText(ph.icon || '', 78, 171); g.textAlign = 'left';
    g.fillStyle = '#1b1d21'; g.font = '700 38px Inter, system-ui, sans-serif';
    wrap(g, ph.title, 52, 230, W - 80, 44, 2);
    g.fillStyle = '#4a4d52'; g.font = '22px Inter, system-ui, sans-serif';
    wrap(g, ph.sub || '', 52, 296, W - 80, 28, 1);
    g.fillStyle = '#8b8e94'; g.font = '500 18px Inter, system-ui, sans-serif';
    g.fillText('PART', 26, 384); g.fillText('REASON', 26, 470); g.fillText('NEXT ACTION', 26, 592);
    g.fillStyle = '#1b1d21'; g.font = '600 30px Inter, system-ui, sans-serif'; g.fillText(ph.part || '—', 26, 420);
    g.font = '22px Inter, system-ui, sans-serif';
    wrap(g, ph.reason || '—', 26, 502, W - 52, 30, 3);
    wrap(g, ph.action || '—', 26, 624, W - 52, 30, 4);
  }
  function wrap(g, text, x, y, maxW, lh, maxLines) {
    const words = String(text).split(' ');
    let line = '', n = 0;
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (g.measureText(test).width > maxW && line) {
        g.fillText(line, x, y + n * lh); n++; line = words[i];
        if (n >= maxLines - 1) { line = words.slice(i).join(' '); break; }
      } else line = test;
    }
    if (line) {
      while (g.measureText(line).width > maxW && line.length > 3) line = line.slice(0, -2);
      g.fillText(line, x, y + n * lh);
    }
  }

  return {
    update, setView, resize,
    setLabels: (on) => { showLabels = on; },
    setHighlight: (id) => { highlight = id; },
  };
}
