// Pixel monitor: model a race car, build a city map, then drive the car through it.
// Three.js renders the 3D viewport at low resolution, each frame is dithered down to the
// site's mid-century palette, and a 2D canvas draws the editor UI around it.
(() => {
  const screen = document.getElementById("screen");
  const g = screen.getContext("2d", { willReadFrequently: true });
  g.imageSmoothingEnabled = false;
  const W = screen.width, H = screen.height;
  const VP = { x: 10, y: 9, w: W - 40, h: H - 20 }; // 3D viewport
  const PX = VP.x + VP.w; // right panel
  const TY = VP.y + VP.h; // timeline

  const P = {
    walnut: "#1e1812", brown: "#3a2f24", umber: "#6b5640", taupe: "#a8987d", cream: "#f0e6d2",
    mustard: "#e3a82b", ochre: "#a8741c", orange: "#d9622b", rust: "#8f3f1c",
    olive: "#9aa347", moss: "#5f6630", blue: "#6e9bb5", navy: "#3d5d70",
  };
  const UI = { bar: "#231c15", panel: "#2b2219", icon: "#55473a", field: "#3a2f24" };
  const MODEL = 5.5, MAP = 5.5, SIM = 7, CYCLE = MODEL + MAP + SIM; // seconds
  const FRAMES = SIM * 24;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  // --- Editor UI ---

  // 3x5 bitmap font, rows top to bottom
  const FONT = {
    A: "111101111101101", C: "111100100100111", D: "110101101101110", E: "111100110100111",
    F: "111100110100100", G: "111100101101111", I: "111010010010111", L: "100100100100111",
    M: "101111111101101", N: "110101101101101", O: "111101101101111", P: "111101111100100",
    R: "110101110101101", S: "111100111001111", T: "111010010010010", U: "101101101101111",
    0: "111101101101111", 1: "010110010010111", 2: "111001111100111", 3: "111001111001111",
    4: "101101111001001", 5: "111100111001111", 6: "111100111101111", 7: "111001001001001",
    8: "111101111101111", 9: "111101111001111",
  };

  function text(str, x, y, color) {
    g.fillStyle = color;
    for (const ch of str) {
      const glyph = FONT[ch];
      if (glyph) for (let i = 0; i < 15; i++) if (glyph[i] === "1") g.fillRect(x + (i % 3), y + ((i / 3) | 0), 1, 1);
      x += 4;
    }
  }

  const TABS = [{ label: "MODELING", x: 13 }, { label: "MAP", x: 50 }, { label: "SIMULATION", x: 67 }];
  const tabCenter = (i) => [TABS[i].x + TABS[i].label.length * 2, 3];

  function drawUI(tab, pressed, tool, frame) {
    g.fillStyle = UI.bar;
    g.fillRect(0, 0, W, VP.y);
    g.fillStyle = P.orange;
    g.fillRect(4, 2, 3, 1); g.fillRect(3, 3, 5, 3); g.fillRect(4, 6, 3, 1); // logo
    TABS.forEach((t, i) => {
      const w = t.label.length * 4 - 1;
      if (i === tab) {
        g.fillStyle = pressed ? P.umber : P.brown;
        g.fillRect(t.x - 2, 0, w + 4, VP.y);
      }
      text(t.label, t.x, 2, i === tab ? P.cream : P.taupe);
    });

    g.fillStyle = UI.panel;
    g.fillRect(0, VP.y, VP.x, VP.h);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i === tool ? P.taupe : UI.icon;
      g.fillRect(2, VP.y + 4 + i * 9, 6, 6);
    }

    g.fillStyle = UI.panel;
    g.fillRect(PX, VP.y, W - PX, VP.h);
    [16, 11, 14, 10, 12].forEach((w, i) => { // outliner, one object selected
      const y = VP.y + 3 + i * 7;
      const sel = i === tab + 1;
      if (sel) { g.fillStyle = P.brown; g.fillRect(PX, y - 2, W - PX, 7); }
      g.fillStyle = sel ? P.orange : UI.icon;
      g.fillRect(PX + 2, y, 3, 3);
      g.fillStyle = sel ? P.taupe : UI.icon;
      g.fillRect(PX + 8, y + 1, w, 1);
    });
    g.fillStyle = UI.bar;
    g.fillRect(PX, VP.y + 38, W - PX, 1);
    for (let y = VP.y + 45; y < TY - 4; y += 8) { // properties
      g.fillStyle = UI.icon;
      g.fillRect(PX + 2, y + 1, 8, 1);
      g.fillStyle = UI.field;
      g.fillRect(PX + 13, y - 1, 15, 4);
    }
    if (tab === 2) { // simulation progress
      g.fillStyle = P.mustard;
      g.fillRect(PX + 13, VP.y + 44, Math.round((frame / FRAMES) * 15), 4);
    }

    g.fillStyle = UI.bar;
    g.fillRect(0, TY, W, H - TY);
    g.fillStyle = UI.icon;
    for (let x = 12; x < PX - 4; x += 8) g.fillRect(x, H - 3, 1, 2);
    g.fillStyle = P.mustard;
    g.fillRect(Math.round(12 + (frame / FRAMES) * (PX - 20)), TY + 1, 1, H - TY - 1);
    text(String(frame).padStart(3, "0"), PX + 8, TY + 3, P.taupe);
  }

  const CURSOR = ["1....", "11...", "111..", "1111.", "11111", "111..", "1.1.."];
  const cursor = { x: VP.x + VP.w / 2, y: VP.y + VP.h / 2 };
  function moveCursor(target) {
    if (!target) return;
    cursor.x += (target[0] - cursor.x) * 0.3;
    cursor.y += (target[1] - cursor.y) * 0.3;
  }
  function drawCursor() {
    g.fillStyle = P.cream;
    CURSOR.forEach((row, y) => [...row].forEach((c, x) => c === "1" && g.fillRect((cursor.x | 0) + x, (cursor.y | 0) + y, 1, 1)));
  }

  // --- Desk: a pixel keyboard and mouse that react to what happens on screen ---

  const desk = document.getElementById("desk");
  const k = desk.getContext("2d");
  const input = { aim: [0.5, 0.5], click: false, keys: new Set() };
  const mouse = [0.5, 0.5];

  // Rows 0-2 are letter rows (W is "1-1", A/S/D are "2-0".."2-2"); row 3 holds the space bar.
  // Back rows are narrower to suggest perspective; a few keys get mid-century accent colors.
  const KEYS = [];
  for (let r = 0; r < 3; r++) {
    const y = 6 + r * 5, x0 = 52 - r * 2 + (r === 1 ? 3 : 0), x1 = 148 + r * 2;
    for (let x = x0, c = 0; x + 6 <= x1; x += 7, c++) KEYS.push({ id: `${r}-${c}`, x, y, w: 6 });
  }
  KEYS.push({ id: "fn", x: 48, y: 21, w: 13 }, { id: "space", x: 76, y: 21, w: 48 }, { id: "alt", x: 141, y: 21, w: 13 });
  const ACCENT = { "0-0": P.orange, space: P.taupe };
  const lastOf = (r) => KEYS.filter((key) => key.id.startsWith(`${r}-`)).pop().id;
  ACCENT[lastOf(0)] = P.olive;   // backspace
  ACCENT[lastOf(2)] = P.mustard; // enter
  const LETTERS = KEYS.filter((key) => /^[012]-/.test(key.id) && !ACCENT[key.id]).map((key) => key.id);

  // Typing: a different key every 1/rate seconds, released for the last part of each beat
  function typing(t, rate) {
    const n = Math.floor(t * rate);
    if ((t * rate) % 1 > 0.65) return new Set();
    const h = Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1;
    return new Set([LETTERS[Math.floor(h * LETTERS.length)]]);
  }

  function px(x, y, w, h, color) {
    k.fillStyle = color;
    k.fillRect(Math.round(x), Math.round(y), w, h);
  }

  function drawDesk() {
    k.clearRect(0, 0, desk.width, desk.height);

    // Keyboard body: a slab that widens toward the viewer, with a darker front lip
    for (let y = 3; y < 26; y++) {
      const spread = (y - 3) * 0.25;
      px(44 - spread, y, 112 + spread * 2, 1, y < 4 ? P.cream : P.umber);
    }
    px(38, 26, 124, 2, P.brown);
    for (const key of KEYS) {
      const down = input.keys.has(key.id);
      const top = down ? P.mustard : ACCENT[key.id] || P.cream;
      if (!down) px(key.x, key.y + 2, key.w, 1, P.taupe); // key side
      px(key.x, key.y + (down ? 1 : 0), key.w, 2, top);
    }

    // Mouse follows the on-screen cursor; the left button lights up on click
    mouse[0] += (input.aim[0] - mouse[0]) * 0.3;
    mouse[1] += (input.aim[1] - mouse[1]) * 0.3;
    const mx = 178 + (mouse[0] - 0.5) * 16, my = 15 + (mouse[1] - 0.5) * 8;
    for (let i = 0; i <= 12; i++) { // cable
      const f = i / 12;
      px(157 + (mx - 157) * f, 8 + (my - 7 - 8) * f - Math.sin(f * Math.PI) * 4, 1, 1, P.umber);
    }
    for (let y = -6; y <= 6; y++) {
      for (let x = -4; x <= 4; x++) {
        const d = (x * x) / 16 + (y * y) / 36;
        if (d > 1) continue;
        let c = d > 0.7 ? P.taupe : P.cream;
        if (input.click && x < 0 && y < -1 && d <= 0.7) c = P.mustard;
        px(mx + x, my + y, 1, 1, c);
      }
    }
    px(mx, my - 6, 1, 5, P.umber); // button split
  }

  // --- Ordered dithering to the palette ---

  const PALETTE = Object.values(P).map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  const nearestCache = new Uint8Array(32768).fill(255);
  function nearest(r, gr, b) {
    const key = ((r >> 3) << 10) | ((gr >> 3) << 5) | (b >> 3);
    if (nearestCache[key] === 255) {
      let best = 0, bestD = Infinity;
      PALETTE.forEach(([pr, pg, pb], i) => {
        const d = 0.3 * (r - pr) ** 2 + 0.59 * (gr - pg) ** 2 + 0.11 * (b - pb) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      });
      nearestCache[key] = best;
    }
    return PALETTE[nearestCache[key]];
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v / 16 - 0.47) * 34);
  const c255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

  function dither() {
    const img = g.getImageData(VP.x, VP.y, VP.w, VP.h), d = img.data;
    for (let y = 0; y < VP.h; y++) {
      for (let x = 0; x < VP.w; x++) {
        const i = (y * VP.w + x) * 4, o = BAYER[((y & 3) << 2) | (x & 3)];
        const p = nearest(c255(d[i] + o), c255(d[i + 1] + o), c255(d[i + 2] + o));
        d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2];
      }
    }
    g.putImageData(img, VP.x, VP.y);
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  } catch (e) { // no Three.js or no WebGL: show the empty editor
    g.fillStyle = P.brown;
    g.fillRect(VP.x, VP.y, VP.w, VP.h);
    drawUI(0, false, 0, 1);
    drawDesk();
    return;
  }

  // --- Scene ---

  const V3 = THREE.Vector3;
  const lambert = (color) => new THREE.MeshLambertMaterial({ color });
  renderer.setPixelRatio(1);
  renderer.setSize(VP.w, VP.h, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(P.cream, 100, 200);
  const camera = new THREE.PerspectiveCamera(40, VP.w / VP.h, 0.1, 200);

  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = 1; skyCanvas.height = 64;
  const skyCtx = skyCanvas.getContext("2d");
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 64);
  skyGrad.addColorStop(0, P.blue);
  skyGrad.addColorStop(1, P.cream);
  skyCtx.fillStyle = skyGrad;
  skyCtx.fillRect(0, 0, 1, 64);
  const sky = new THREE.CanvasTexture(skyCanvas);
  const editorBg = new THREE.Color(P.brown);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 0.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(512, 512);
  scene.add(sun, sun.target);
  function placeSun(x, z, size) {
    sun.position.set(x + 8, 14, z + 5);
    sun.target.position.set(x, 0, z);
    const cam = sun.shadow.camera;
    if (cam.right !== size) {
      Object.assign(cam, { left: -size, right: size, top: size, bottom: -size, near: 1, far: 50 });
      cam.updateProjectionMatrix();
    }
  }

  // Car: +z is forward. Each part gets an edge overlay for the wireframe build-up.
  const car = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: P.cream, transparent: true });
  const darkMat = new THREE.MeshLambertMaterial({ color: "#2a221a", transparent: true });
  const edgeMat = new THREE.LineBasicMaterial({ color: P.orange, transparent: true });
  const edges = [];

  function part(geo, mat, x, y, z, parent = car) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edgeMat);
    mesh.add(e);
    edges.push(e);
    parent.add(mesh);
    return mesh;
  }

  // Body: side profile (z, y) extruded across the car's width
  const profile = [[-1.25, 0.15], [1.8, 0.15], [1.8, 0.24], [0.7, 0.4], [-0.05, 0.48], [-0.45, 0.64], [-1.0, 0.56], [-1.25, 0.42]];
  const bodyGeo = new THREE.ExtrudeGeometry(new THREE.Shape(profile.map(([z, y]) => new THREE.Vector2(z, y))), { depth: 0.56, bevelEnabled: false });
  bodyGeo.rotateY(-Math.PI / 2);
  bodyGeo.translate(0.28, 0, 0);
  part(bodyGeo, bodyMat, 0, 0, 0);
  part(new THREE.BoxGeometry(1.24, 0.24, 0.95), bodyMat, 0, 0.29, -0.15); // sidepods
  part(new THREE.BoxGeometry(1.6, 0.05, 0.3), bodyMat, 0, 0.1, 1.68);      // front wing
  part(new THREE.BoxGeometry(0.06, 0.36, 0.12), bodyMat, 0, 0.66, -1.2);   // wing pylon
  part(new THREE.BoxGeometry(1.24, 0.08, 0.36), bodyMat, 0, 0.86, -1.38);  // rear wing
  for (const s of [-1, 1]) part(new THREE.BoxGeometry(0.04, 0.42, 0.5), bodyMat, s * 0.62, 0.66, -1.38);
  part(new THREE.SphereGeometry(0.13, 8, 6), darkMat, 0, 0.62, -0.15);    // helmet

  const wheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.3, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [], steering = [];
  for (const [z, front] of [[1.05, true], [-0.85, false]]) {
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.8, 0.25, z);
      car.add(pivot);
      wheels.push(part(wheelGeo, darkMat, 0, 0, 0, pivot));
      if (front) steering.push(pivot);
    }
  }
  const segCounts = edges.map((e) => e.geometry.attributes.position.count / 2);
  const totalSegs = segCounts.reduce((a, b) => a + b, 0);
  scene.add(car);

  // Modeling: editor grid with X / Y axes and a shadow catcher
  const editor = new THREE.Group();
  editor.add(new THREE.GridHelper(10, 10, P.umber, P.umber));
  const axis = (a, b, color) => new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color }));
  editor.add(axis(new V3(-5, 0.005, 0), new V3(5, 0.005, 0), P.rust), axis(new V3(0, 0.005, -5), new V3(0, 0.005, 5), P.olive));
  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.35 }));
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = 0.01;
  shadowCatcher.receiveShadow = true;
  editor.add(shadowCatcher);
  scene.add(editor);

  // Map: a 3x3 road grid with buildings and trees in between
  const city = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), lambert(P.moss));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  city.add(ground);

  const ROADS = [-12, 0, 12];
  const roadMat = lambert(P.brown), dashMat = lambert(P.cream);
  const roads = [];
  for (const alongX of [true, false]) {
    for (const c of ROADS) {
      const road = new THREE.Mesh(alongX ? new THREE.BoxGeometry(40, 0.04, 4) : new THREE.BoxGeometry(4, 0.04, 40), roadMat);
      road.position.set(alongX ? 0 : c, alongX ? 0.02 : 0.03, alongX ? c : 0);
      road.receiveShadow = true;
      for (let k = -18; k <= 18; k += 3) {
        if (ROADS.some((r) => Math.abs(k - r) < 2.5)) continue;
        const dash = new THREE.Mesh(alongX ? new THREE.BoxGeometry(1.2, 0.02, 0.18) : new THREE.BoxGeometry(0.18, 0.02, 1.2), dashMat);
        dash.position.set(alongX ? k : 0, 0.03, alongX ? 0 : k);
        road.add(dash);
      }
      road.userData.alongX = alongX;
      roads.push(road);
      city.add(road);
    }
  }

  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const COLORS = [P.cream, P.mustard, P.orange, P.blue, P.taupe, P.cream];
  const CELLS = [-16, -8, -4, 4, 8, 16]; // 4x4 lots between the roads
  const props = [];
  for (const cx of CELLS) {
    for (const cz of CELLS) {
      const lot = [];
      if (rand() < 0.8) {
        const w = 2.2 + rand(), d = 2.2 + rand();
        const h = 1.2 + rand() * 2.5 + Math.max(0, 3.5 - Math.hypot(cx, cz) / 5);
        const geo = new THREE.BoxGeometry(w, h, d);
        geo.translate(0, h / 2, 0);
        const b = new THREE.Mesh(geo, lambert(COLORS[(rand() * COLORS.length) | 0]));
        b.position.set(cx + (rand() - 0.5) * 0.6, 0, cz + (rand() - 0.5) * 0.6);
        b.userData.h = h;
        lot.push(b);
      } else {
        for (const [ox, oz] of [[-0.9, -0.7], [0.8, 0.6]]) {
          const geo = new THREE.ConeGeometry(0.7, 2, 6);
          geo.translate(0, 1, 0);
          const tree = new THREE.Mesh(geo, lambert(P.olive));
          tree.position.set(cx + ox, 0, cz + oz);
          tree.userData.h = 2;
          lot.push(tree);
        }
      }
      for (const m of lot) {
        m.castShadow = m.receiveShadow = true;
        city.add(m);
        props.push(m);
      }
    }
  }
  props.sort((a, b) => a.position.length() - b.position.length()); // build from the center out
  scene.add(city);

  // Simulation route: a rounded loop along the outer roads, driven in the right lane
  const route = [];
  const A = 12, R = 4;
  [[1, 1, 0], [-1, 1, 1], [-1, -1, 2], [1, -1, 3]].forEach(([sx, sz, q]) => {
    for (let i = 0; i <= 12; i++) {
      const th = (q + i / 12) * (Math.PI / 2);
      route.push([sx * (A - R) + R * Math.cos(th), sz * (A - R) + R * Math.sin(th)]);
    }
  });
  route.push(route[0]);
  const routeLen = [0];
  for (let i = 1; i < route.length; i++) routeLen.push(routeLen[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
  const LOOP = routeLen[routeLen.length - 1];

  function pointAt(s) {
    s = ((s % LOOP) + LOOP) % LOOP;
    let i = 1;
    while (routeLen[i] < s) i++;
    const f = (s - routeLen[i - 1]) / (routeLen[i] - routeLen[i - 1] || 1);
    return [route[i - 1][0] + (route[i][0] - route[i - 1][0]) * f, route[i - 1][1] + (route[i][1] - route[i - 1][1]) * f];
  }
  function laneAt(s) {
    const a = pointAt(s - 0.6), b = pointAt(s + 0.6), c = pointAt(s);
    const h = Math.atan2(b[0] - a[0], b[1] - a[1]);
    return { x: c[0] - Math.cos(h) * 0.9, z: c[1] + Math.sin(h) * 0.9, h };
  }
  const angleDiff = (a, b) => ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;

  const plan = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: P.blue, size: 2, sizeAttenuation: false }));
  plan.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(30), 3));
  scene.add(plan);

  // --- Frames ---

  function toScreen(v) {
    v.project(camera);
    return [VP.x + ((v.x + 1) / 2) * VP.w, VP.y + ((1 - v.y) / 2) * VP.h];
  }

  function show({ inEditor, inCity, carVisible, fog, carColor }) {
    editor.visible = inEditor;
    city.visible = inCity;
    plan.visible = inCity && carVisible;
    car.visible = carVisible;
    scene.background = inEditor ? editorBg : sky;
    [scene.fog.near, scene.fog.far] = fog;
    bodyMat.color.set(carColor);
  }

  function blit() {
    renderer.render(scene, camera);
    g.drawImage(renderer.domElement, VP.x, VP.y);
    dither();
  }

  function frameModel(t) {
    show({ inEditor: true, inCity: false, carVisible: true, fog: [100, 200], carColor: P.cream });
    car.position.set(0, 0, 0);
    car.rotation.y = 0;
    car.scale.setScalar(1);
    steering.forEach((p) => (p.rotation.y = 0));
    placeSun(0, 0, 4);

    const a = 0.7 + t * 0.3, dist = 4.6;
    camera.position.set(-dist * Math.sin(a), 2.1, -dist * Math.cos(a));
    camera.lookAt(0, 0.35, 0);

    // Reveal edges part by part, then fade in the solid mesh
    const shown = Math.floor(clamp(t / 2.8) * totalSegs);
    let left = shown, current = null, currentSeg = 0;
    edges.forEach((e, i) => {
      const n = Math.min(left, segCounts[i]);
      e.geometry.setDrawRange(0, n * 2);
      if (n > 0) { current = e; currentSeg = n - 1; }
      left -= n;
    });
    const solid = clamp((t - 2.9) / 0.7);
    bodyMat.visible = darkMat.visible = solid > 0;
    bodyMat.opacity = darkMat.opacity = solid;
    edgeMat.visible = true;
    edgeMat.opacity = 1 - solid * 0.8;

    blit();
    text("USER PERSP", VP.x + 3, VP.y + 3, P.taupe);

    if (current && shown < totalSegs) {
      moveCursor(toScreen(new V3().fromBufferAttribute(current.geometry.attributes.position, currentSeg * 2 + 1).applyMatrix4(current.matrixWorld)));
    } else if (t > 3.9) {
      moveCursor(tabCenter(1));
    }
    const clicked = t > 4.8;
    Object.assign(input, { aim: [(cursor.x - VP.x) / VP.w, (cursor.y - VP.y) / VP.h], click: clicked && t < 5.1, keys: t < 2.8 ? typing(t, 7) : new Set() });
    drawUI(clicked ? 1 : 0, clicked && t < 5.1, Math.floor(t * 1.5) % 4, 1);
    drawCursor();
  }

  const easeOutBack = (p) => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2;

  function buildCity(t) {
    roads.forEach((road, i) => {
      const p = Math.max(0.001, clamp((t - i * 0.22) / 0.4));
      road.scale.set(road.userData.alongX ? p : 1, 1, road.userData.alongX ? 1 : p);
    });
    let rising = null;
    props.forEach((m, i) => {
      const p = clamp((t - 1.6 - i * (2.6 / props.length)) / 0.35);
      m.visible = p > 0;
      m.scale.set(1, Math.max(0.001, easeOutBack(p)), 1);
      if (p > 0 && p < 1) rising = m;
    });
    return rising;
  }

  function frameMap(t) {
    show({ inEditor: false, inCity: true, carVisible: false, fog: [45, 90], carColor: P.mustard });
    placeSun(0, 0, 22);
    const a = 2.2 + t * 0.12;
    camera.position.set(-36 * Math.sin(a), 30, -36 * Math.cos(a));
    camera.lookAt(0, 0, 0);
    const rising = buildCity(t);

    blit();
    text("MAP EDITOR", VP.x + 3, VP.y + 3, P.brown);

    if (rising) moveCursor(toScreen(rising.position.clone().setY(rising.userData.h * rising.scale.y)));
    else if (t > 4.4) moveCursor(tabCenter(2));
    const clicked = t > 5.0;
    Object.assign(input, { aim: [(cursor.x - VP.x) / VP.w, (cursor.y - VP.y) / VP.h], click: clicked && t < 5.3, keys: t < 4.2 ? typing(t, 5) : new Set() });
    drawUI(clicked ? 2 : 1, clicked && t < 5.3, 4 + (Math.floor(t * 1.5) % 3), 1);
    drawCursor();
  }

  function frameSim(ts) {
    show({ inEditor: false, inCity: true, carVisible: true, fog: [14, 40], carColor: P.mustard });
    buildCity(99);
    bodyMat.visible = darkMat.visible = true;
    bodyMat.opacity = darkMat.opacity = 1;
    edgeMat.visible = false;

    const s = 6 + ts * 7, lane = laneAt(s);
    car.scale.setScalar(0.55);
    car.position.set(lane.x, 0, lane.z);
    car.rotation.y = lane.h;
    const steer = clamp(angleDiff(lane.h, laneAt(s + 1.5).h) * 2, -0.4, 0.4);
    steering.forEach((p) => (p.rotation.y = steer));
    // W held to drive; A/D while the car turns left/right
    const keys = new Set(["1-1"]);
    if (steer > 0.08) keys.add("2-0");
    if (steer < -0.08) keys.add("2-2");
    Object.assign(input, { aim: [0.5, 0.5], click: false, keys });
    wheels.forEach((w) => (w.rotation.x = s / 0.14));
    placeSun(lane.x, lane.z, 12);

    const back = laneAt(s - 1), ahead = laneAt(s + 3);
    camera.position.set(lane.x - 4.2 * Math.sin(back.h), 1.7, lane.z - 4.2 * Math.cos(back.h));
    camera.lookAt(ahead.x, 0.4, ahead.z);

    const pos = plan.geometry.attributes.position;
    for (let k = 0; k < 10; k++) {
      const p = laneAt(s + 1.5 + k * 1.2);
      pos.setXYZ(k, p.x, 0.06, p.z);
    }
    pos.needsUpdate = true;

    blit();
    text("SIM", VP.x + 3, VP.y + 3, P.brown);
    drawUI(2, false, -1, 1 + Math.floor(ts * 24));
  }

  function render(t) {
    if (t < MODEL) frameModel(t);
    else if (t < MODEL + MAP) frameMap(t - MODEL);
    else frameSim(t - MODEL - MAP);
    drawDesk();
  }

  if (reduceMotion) {
    render(MODEL + MAP + 2);
    return;
  }

  let start = performance.now(), last = 0, prevT = 0, visible = true;
  const tick = (now) => {
    if (!visible) return;
    requestAnimationFrame(tick);
    if (now - last < 33) return; // ~30 fps suits the pixel look
    last = now;
    const t = ((now - start) / 1000) % CYCLE;
    if (t < prevT) { cursor.x = VP.x + VP.w / 2; cursor.y = VP.y + VP.h / 2; }
    prevT = t;
    render(t);
  };
  new IntersectionObserver(([entry]) => {
    const was = visible;
    visible = entry.isIntersecting;
    if (visible && !was) requestAnimationFrame(tick);
  }).observe(screen);
  requestAnimationFrame(tick);
})();
