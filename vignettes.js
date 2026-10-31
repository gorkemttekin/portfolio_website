// Small pixel vignettes beside the experience and project entries. One-shot scenes play their
// build-up once when scrolled into view (and again on hover), then hold on the last frame;
// looping scenes run while they are on screen.
(() => {
  const P = {
    walnut: "#1e1812", brown: "#3a2f24", umber: "#6b5640", taupe: "#a8987d", cream: "#f0e6d2",
    mustard: "#e3a82b", ochre: "#a8741c", orange: "#d9622b", rust: "#8f3f1c",
    olive: "#9aa347", moss: "#5f6630", blue: "#6e9bb5", navy: "#3d5d70",
  };
  const SPRITE_COLORS = { o: P.orange, r: P.rust, w: P.walnut, c: P.cream, m: P.mustard, u: P.umber, t: P.taupe, b: P.brown };
  const DURATION = 3.2; // seconds, for one-shot scenes
  const LOOPING = new Set(["racing", "tactile", "multiview"]);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const ease = (p) => 1 - (1 - p) ** 3;

  function px(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function sprite(ctx, rows, x, y) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => SPRITE_COLORS[ch] && px(ctx, x + i, y + j, 1, 1, SPRITE_COLORS[ch])));
  }
  function frame(ctx, x, y, w, h, color) { // 1px rectangle outline
    px(ctx, x, y, w, 1, color);
    px(ctx, x, y + h - 1, w, 1, color);
    px(ctx, x, y, 1, h, color);
    px(ctx, x + w - 1, y, 1, h, color);
  }
  function line(ctx, a, b, color) {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let i = 0; i <= n; i++) px(ctx, a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, 1, 1, color);
  }
  function dotted(ctx, a, b, amount, color) { // a line drawn up to `amount` of its length
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * amount);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    for (let i = 0; i < n; i += 2) px(ctx, a[0] + ((b[0] - a[0]) * i) / len, a[1] + ((b[1] - a[1]) * i) / len, 1, 1, color);
  }

  // Formula Student car seen from behind: rear wing, helmet, sensor on the roll hoop, wide rear tires
  const F1_REAR = [
    "..mmmmmmmmmmmmmmmmmmmm..",
    "..mrrrrrrrrrrrrrrrrrrm..",
    "..m........tt........m..",
    "..........cccc..........",
    "wwww......cccc......wwww",
    "wwww...oooooooooo...wwww",
    "wwwwoooooooooooooooowwww",
    "wwwwoooooooooooooooowwww",
    "wwwwrrrrrroooorrrrrrwwww",
    "wwww......rmmr......wwww",
    "wwww................wwww",
    ".ww..................ww.",
  ];
  const CAR = ["..mmm...", ".mmcmmm.", "mmmmmmmm", ".w....w."];
  // Oculus-style headset, front view: white shell, dark faceplate with tracking cameras, strap
  const HEADSET = [
    ".....tttttttt.....",
    "...tt........tt...",
    "..cccccccccccccc..",
    ".cwwwwwwwwwwwwwwc.",
    "tcwcwwwwwwwwwwcwct",
    "tcwwwwwwwwwwwwwwct",
    ".cwcwwwwwwwwwwcwc.",
    "..cccccccccccccc..",
    "...tt........tt...",
  ];

  // Clownfish point cloud for the tactile scene (+x is the head): an ellipsoid body, tail fan and
  // dorsal fin; `part` marks the tail so it can wiggle
  const FISH = [];
  for (let i = 0; i < 380; i++) {
    const y = 1 - (i / 379) * 2, r = Math.sqrt(1 - y * y), a = i * Math.PI * (3 - Math.sqrt(5));
    FISH.push({ p: [Math.cos(a) * r, y * 0.55, Math.sin(a) * r * 0.32], part: "body" });
  }
  for (let i = 0; i < 70; i++) {
    const f = (i % 10) / 9, x = -1 - f * 0.5, spread = 0.15 + f * 0.6;
    FISH.push({ p: [x, ((Math.floor(i / 10) / 6) * 2 - 1) * spread, 0], part: "tail" });
  }
  for (let i = 0; i < 14; i++) FISH.push({ p: [-0.5 + i * 0.075, 0.55 + Math.sin(i * 0.5) * 0.12, 0], part: "fin" });
  const STRIPES = [0.5, -0.15, -0.85]; // white bands behind the head, mid body and at the tail

  const scenes = {
    // ELBFLORACE: the car's camera feed. A track curves ahead between blue (left) and yellow (right)
    // cones; each cone gets a detection box as it comes into range while the car drives through.
    racing(ctx, t) {
      const L = 4, T = 6, R = 124, B = 78, HOR = 30, CX = 64;
      // The track is a closed loop: the curve repeats every LOOP metres, as do cones (4 m) and grass bands (6 m)
      const LOOP = 96, K = (2 * Math.PI) / LOOP;
      const pathX = (z) => 1.6 * Math.sin(z * K * 2) + 0.8 * Math.sin(z * K * 3 + 2);
      const s = (3 + t * 9) % LOOP; // distance driven along the loop
      const camX = pathX(s);
      const toScreen = (x, z) => { // world (x, distance ahead) -> screen, with p = closeness
        const p = 6 / z;
        return { x: CX + (x - camX) * p * 20, y: HOR + p * (B - HOR), p };
      };
      ctx.save();
      ctx.beginPath();
      ctx.rect(L, T, R - L, B - T);
      ctx.clip();

      // Sky with a dithered fade from blue to cream at the horizon
      for (let y = T; y < HOR; y++) {
        const f = (y - T) / (HOR - T);
        for (let x = L; x < R; x++) px(ctx, x, y, 1, 1, f + ((x + y) % 2 ? 0.12 : -0.12) > 0.55 ? P.cream : P.blue);
      }
      // Ground: grass bands and road, scanline by scanline
      for (let y = HOR; y < B; y++) {
        const p = Math.max(0.02, (y - HOR) / (B - HOR));
        const z = 6 / p, w = s + z;
        px(ctx, L, y, R - L, 1, Math.floor(w / 3) % 2 ? P.moss : P.olive);
        // the curve is only followed up to 40 m ahead so the far road stays a clean vanishing line
        const c = CX + (pathX(s + Math.min(z, 40)) - camX) * p * 20, half = 2.4 * p * 20;
        px(ctx, c - half, y, half * 2, 1, P.brown);
      }

      // Cones along both edges, drawn far to near; detection boxes inside sensor range
      const cones = [];
      for (let z = Math.ceil(s / 4) * 4; z < s + 40; z += 4) {
        cones.push({ x: pathX(z) - 2.1, z, color: P.blue }, { x: pathX(z) + 2.1, z, color: P.mustard });
      }
      cones.sort((a, b) => b.z - a.z);
      for (const cone of cones) {
        const d = cone.z - s;
        if (d < 1.2) continue;
        const { x, y, p } = toScreen(cone.x, d);
        const h = Math.max(2, Math.round(p * 9)), w = Math.max(1, Math.round(p * 6));
        for (let r = 0; r < h; r++) {
          const rw = Math.max(1, Math.round((w * (r + 1)) / h));
          const stripe = h > 4 && r === Math.floor(h * 0.55);
          px(ctx, x - rw / 2, y - h + r, rw, 1, stripe ? P.cream : cone.color);
        }
        if (d < 16 && h > 3) {
          frame(ctx, x - w / 2 - 2, y - h - 2, w + 4, h + 4, P.olive);
          px(ctx, x - w / 2 - 2, y - h - 4, Math.min(6, w + 4), 2, cone.color);
        }
      }

      // The car, swaying slightly with the curve; tires turn and the autonomous status light flashes
      const sway = Math.max(-3, Math.min(3, (pathX(s + 3) - camX) * 3));
      const carX = CX - 12 + sway, carY = B - 15;
      sprite(ctx, F1_REAR, carX, carY);
      const tick = Math.floor(t * 14);
      for (let r = 4; r < 11; r++) {
        if ((r + tick) % 3) continue;
        px(ctx, carX, carY + r, 4, 1, P.umber);
        px(ctx, carX + 20, carY + r, 4, 1, P.umber);
      }
      px(ctx, carX + 11, carY + 9, 2, 1, tick % 4 < 2 ? P.blue : P.cream);

      // Camera viewfinder corners
      for (const [x, y, dx, dy] of [[L + 2, T + 2, 1, 1], [R - 3, T + 2, -1, 1], [L + 2, B - 3, 1, -1], [R - 3, B - 3, -1, -1]]) {
        px(ctx, Math.min(x, x + dx * 4), y, 5, 1, P.cream);
        px(ctx, x, Math.min(y, y + dy * 4), 1, 5, P.cream);
      }
      px(ctx, L + 6, T + 5, 2, 2, Math.floor(t * 2) % 2 ? P.orange : P.rust); // recording dot
      ctx.restore();
    },

    // Fraunhofer IVI: roads grow on a map tile, the OpenDRIVE lane graph is laid over them,
    // the city rises, a car drives through the junction and the map is marked as validated
    map(ctx, t) {
      const TX = 12, TY = 18, TW = 104, TD = 48, JX = 64, JY = 42;
      px(ctx, TX, TY, TW, TD, P.moss);
      for (let y = TY; y < TY + TD; y++) for (let x = TX; x < TX + TW; x++) if ((x * 7 + y * 13) % 11 === 0) px(ctx, x, y, 1, 1, P.olive);
      px(ctx, TX, TY + TD, TW, 5, P.brown);
      px(ctx, TX, TY + TD + 5, TW, 1, P.walnut);

      const r = ease(clamp(t / 0.8));
      const hl = (r * TW) / 2, hv = (r * TD) / 2;
      px(ctx, JX - hl, JY - 4, hl * 2, 8, P.brown);
      px(ctx, JX - 4, JY - hv, 8, hv * 2, P.brown);

      const lanes = clamp((t - 0.8) / 0.6);
      if (lanes > 0) {
        for (const dy of [-2, 2]) px(ctx, TX, JY + dy, TW * lanes, 1, P.blue);
        for (const dx of [-2, 2]) px(ctx, JX + dx, TY, 1, TD * lanes, P.blue);
        if (lanes > 0.5) for (const [x, y] of [[JX - 7, JY - 3], [JX + 6, JY - 3], [JX - 7, JY + 2], [JX + 6, JY + 2], [JX - 3, JY - 7], [JX + 2, JY + 6]]) px(ctx, x, y, 2, 2, P.cream);
      }

      const building = (b, i) => {
        const h = b.h * ease(clamp((t - 1.0 - i * 0.12) / 0.4));
        if (h <= 0) return;
        px(ctx, b.x, b.y - h, b.w, b.d, b.top);
        px(ctx, b.x, b.y + b.d - h, b.w, h, b.front);
      };
      const back = [
        { x: 18, y: 22, w: 16, d: 10, h: 14, top: P.cream, front: P.taupe },
        { x: 38, y: 24, w: 12, d: 8, h: 9, top: P.mustard, front: P.ochre },
        { x: 72, y: 20, w: 14, d: 12, h: 18, top: P.blue, front: P.navy },
        { x: 94, y: 24, w: 16, d: 9, h: 10, top: P.cream, front: P.taupe },
      ];
      const front = [
        { x: 22, y: 50, w: 14, d: 10, h: 8, top: P.orange, front: P.rust },
        { x: 80, y: 50, w: 18, d: 10, h: 12, top: P.cream, front: P.taupe },
      ];
      back.forEach(building);
      if (t > 1.6) for (const [x, y] of [[44, 52], [50, 56], [104, 54]]) { px(ctx, x, y - 4, 4, 4, P.olive); px(ctx, x + 1, y, 2, 2, P.umber); }

      // Traffic light at the junction corner, cycling to green
      px(ctx, JX + 7, JY - 14, 1, 10, P.umber);
      px(ctx, JX + 6, JY - 21, 3, 8, P.walnut);
      const light = t < 2.1 ? 0 : t < 2.4 ? 1 : 2;
      px(ctx, JX + 7, JY - 20 + light * 2, 1, 1, [P.orange, P.mustard, P.olive][light]);

      if (t > 2.0) sprite(ctx, CAR, TX + 2 + ease(clamp((t - 2.0) / 0.9)) * (TW - 14), JY - 1);
      front.forEach((b, i) => building(b, i + back.length));

      if (t > 2.8) { // validation badge
        const bx = 110, by = 12;
        for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (x * x + y * y <= 26) px(ctx, bx + x, by + y, 1, 1, P.olive);
        for (const [x, y] of [[-3, 0], [-2, 1], [-1, 2], [0, 1], [1, 0], [2, -1], [3, -2]]) px(ctx, bx + x, by + y, 1, 1, P.cream);
      }
    },

    // Finding NeMO: a robot hand holds a clownfish whose point cloud is being reconstructed, three
    // fingers over the top and the thumb underneath. DIGIT sensors on the fingertips touch the fish;
    // contact patches glow and each fingertip pulses.
    tactile(ctx, t) {
      const bob = Math.round(Math.sin(t * 1.4) * 1.5); // the whole group floats gently
      const FX = 52, FY = 42 + bob, S = 20;
      const TIPS = [[64, 28], [53, 26], [42, 29], [56, 55]].map(([x, y]) => [x, y + bob]);
      const BASES = [[86, 31], [86, 36], [86, 41], [86, 56]].map(([x, y]) => [x, y + bob]);

      // Wrist leaving the frame at the bottom right, and the palm standing upright, facing the fish
      for (let k = -5; k <= 5; k++) line(ctx, [92 + k, 60 + bob], [112 + k, 84 + bob], k < -3 ? P.umber : P.brown);
      px(ctx, 84, 26 + bob, 14, 36, P.umber);
      px(ctx, 84, 26 + bob, 14, 1, P.taupe);
      px(ctx, 84, 26 + bob, 1, 36, P.taupe);
      px(ctx, 87, 30 + bob, 8, 28, P.brown); // palm pad

      // Fish, facing left: turns a little from side to side, tail wiggling
      const yaw = Math.sin(t * 0.6) * 0.45, cy = Math.cos(yaw), sy = Math.sin(yaw);
      const wiggle = Math.sin(t * 6) * 0.22;
      FISH.map(({ p: [x, y, z], part }) => {
        if (part === "tail") z += wiggle * (-1 - x) * 2;
        const rx = x * cy - z * sy, rz = x * sy + z * cy;
        return { sx: FX - rx * S, sy: FY - y * S, z: rz, x, part };
      })
        .sort((a, b) => a.z - b.z)
        .forEach(({ sx, sy, z, x, part }) => {
          const back = z < -0.12;
          let color = back ? P.rust : P.orange;
          if (part === "body") {
            const d = Math.min(...STRIPES.map((b) => Math.abs(x - b)));
            if (d < 0.1) color = back ? P.taupe : P.cream;
            else if (d < 0.16) color = P.walnut;
          }
          if (!back && TIPS.some((tip) => Math.hypot(sx - tip[0], sy - tip[1]) < 6)) color = P.blue;
          px(ctx, sx, sy, 1, 1, color);
        });
      const eye = [FX - cy * 0.72 * S, FY - 0.12 * S];
      px(ctx, eye[0] - 1, eye[1] - 1, 2, 2, P.walnut);
      px(ctx, eye[0], eye[1] - 1, 1, 1, P.cream);

      // Fingers in front of the fish, bowing outward (fingers up, thumb down); chunky links with joint caps
      TIPS.forEach((tip, i) => {
        const b = BASES[i];
        const dx = tip[0] - b[0], dy = tip[1] - b[1], len = Math.hypot(dx, dy);
        let n = [-dy / len, dx / len];
        if (i < 3 ? n[1] > 0 : n[1] < 0) n = [-n[0], -n[1]];
        const j1 = [b[0] + dx * 0.4 + n[0] * 6, b[1] + dy * 0.4 + n[1] * 6];
        const j2 = [b[0] + dx * 0.75 + n[0] * 4, b[1] + dy * 0.75 + n[1] * 4];
        for (const [p, q] of [[b, j1], [j1, j2], [j2, tip]]) {
          for (const [ox, oy, color] of [[0, 3, P.brown], [2, 2, P.brown], [1, 2, P.umber], [0, 2, P.umber], [2, 1, P.umber], [1, 1, P.umber], [2, 0, P.umber], [0, 1, P.taupe], [1, 0, P.taupe], [0, 0, P.taupe]]) {
            line(ctx, [p[0] + ox - 1, p[1] + oy - 1], [q[0] + ox - 1, q[1] + oy - 1], color);
          }
        }
        for (const j of [j1, j2]) {
          px(ctx, j[0] - 2, j[1] - 2, 4, 4, P.brown);
          px(ctx, j[0] - 2, j[1] - 2, 3, 3, P.cream);
        }

        // DIGIT sensor: white housing, gel lit by red, green and blue LEDs
        px(ctx, tip[0] - 2, tip[1] - 2, 5, 5, P.cream);
        px(ctx, tip[0] - 1, tip[1], 1, 1, P.orange);
        px(ctx, tip[0], tip[1], 1, 1, P.olive);
        px(ctx, tip[0] + 1, tip[1], 1, 1, P.blue);

        const pulse = (t * 0.7 + i * 0.25) % 1;
        if (pulse < 0.6) {
          const r = 3 + pulse * 8;
          for (let k = 0; k < 16; k += 2) {
            const a = (k / 16) * Math.PI * 2;
            px(ctx, tip[0] + Math.cos(a) * r, tip[1] + Math.sin(a) * r, 1, 1, P.blue);
          }
        }
      });
    },

    // Multi-view capture: several headsets at different poses, all registered to one shared
    // coordinate system; each carries the same axes and streams toward the common origin
    multiview(ctx, t) {
      const O = [64, 50];
      for (let i = 0; i < 64; i += 2) {
        const a = (i / 64) * Math.PI * 2;
        px(ctx, O[0] + Math.cos(a) * 34, O[1] + Math.sin(a) * 11, 1, 1, P.umber); // capture volume
      }
      const axes = (o, size) => {
        line(ctx, o, [o[0] + size, o[1]], P.orange);                        // x
        line(ctx, o, [o[0], o[1] - size], P.olive);                         // y
        line(ctx, o, [o[0] - size * 0.6, o[1] + size * 0.45], P.blue);      // z
      };

      [[22, 16], [104, 12], [14, 60], [110, 62]].forEach(([x, y], i) => {
        const hy = y + Math.round(Math.sin(t * 1.2 + i * 1.7) * 1.5);
        const from = [x, hy + 3], len = Math.hypot(O[0] - from[0], O[1] - from[1]);
        for (let d = (t * 10) % 4; d < len - 4; d += 4) { // data streaming toward the origin
          px(ctx, from[0] + ((O[0] - from[0]) * d) / len, from[1] + ((O[1] - from[1]) * d) / len, 1, 1, P.taupe);
        }
        sprite(ctx, HEADSET, x - 9, hy - 5);
        axes([x - 10, hy + 9], 5);
      });

      axes(O, 14);
      px(ctx, O[0] - 1, O[1] - 1, 3, 3, P.cream);
    },
  };

  document.querySelectorAll("canvas.vignette").forEach((canvas) => {
    const ctx = canvas.getContext("2d");
    const draw = (t) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      scenes[canvas.dataset.scene](ctx, t);
    };
    if (reduceMotion) {
      draw(DURATION);
      return;
    }

    if (LOOPING.has(canvas.dataset.scene)) {
      const start = performance.now();
      let visible = false;
      const loop = (now) => {
        if (!visible) return;
        draw((now - start) / 1000);
        requestAnimationFrame(loop);
      };
      draw(0);
      new IntersectionObserver(([entry]) => {
        const was = visible;
        visible = entry.isIntersecting;
        if (visible && !was) requestAnimationFrame(loop);
      }).observe(canvas);
      return;
    }

    let start = 0, raf = 0;
    const step = (now) => {
      const t = Math.min(DURATION, (now - start) / 1000);
      draw(t);
      if (t < DURATION) raf = requestAnimationFrame(step);
    };
    const play = () => {
      cancelAnimationFrame(raf);
      start = performance.now();
      raf = requestAnimationFrame(step);
    };

    draw(0);
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { play(); io.disconnect(); }
    }, { threshold: 0.6 });
    io.observe(canvas);
    canvas.closest(".project").addEventListener("mouseenter", play);
  });
})();
