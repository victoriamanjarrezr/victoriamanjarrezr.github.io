// Source for js/hero.js. To rebuild after editing:
// npm i three@0.160.0 esbuild && npx esbuild js/source/hero.js --bundle --minify --format=iife --loader:.json=json --outfile=js/hero.js
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import fontJSON from 'three/examples/fonts/helvetiker_bold.typeface.json';

(function () {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    document.documentElement.classList.add('no-webgl');
    return;
  }

  const WORD = (canvas.dataset.word || 'VICTORIA').toUpperCase();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 2, 0.1, 100);

  // soft studio reflections so the clear coat reads as real plastic
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8bdc2, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-4, 9, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -10; sc.right = 10; sc.top = 6; sc.bottom = -6; sc.near = 1; sc.far = 30;
  sun.shadow.radius = 6;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(6, 3, 5);
  scene.add(fill);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 30),
    new THREE.ShadowMaterial({ opacity: 0.14 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- materials ----------
  // body color can be changed from the HTML with data-color="#hex" on the canvas
  const BODY = canvas.dataset.color || '#24477a';
  const shell = new THREE.MeshPhysicalMaterial({ color: BODY, roughness: 0.38, metalness: 0.0, clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b3036, roughness: 0.45, metalness: 0.35, envMapIntensity: 0.7 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.9, metalness: 0.0 });
  const visorMat = new THREE.MeshPhysicalMaterial({ color: 0x0c0f13, roughness: 0.12, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff5a1f, emissiveIntensity: 0.9, roughness: 0.4 });

  function shadowed(m) { m.castShadow = true; m.receiveShadow = true; return m; }
  function rbox(w, h, d, r, mat) {
    return shadowed(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat));
  }
  function box(w, h, d, mat) { return shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)); }
  function cyl(r, h, mat, seg = 32) { return shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat)); }

  // ---------- the quadruped ----------
  const L = 0.32; // thigh and shin length
  const HIP_H = 0.52; // standing hip height
  const dog = new THREE.Group();
  const torso = new THREE.Group();
  dog.add(torso);

  // main body shell with a recessed top deck and belly plate
  torso.add(rbox(0.92, 0.19, 0.32, 0.06, shell));
  const deck = rbox(0.58, 0.03, 0.21, 0.012, dark); deck.position.set(-0.04, 0.098, 0); torso.add(deck);
  const belly = rbox(0.72, 0.04, 0.26, 0.015, dark); belly.position.y = -0.095; torso.add(belly);
  // side vents
  for (const z of [-0.161, 0.161]) {
    for (let i = 0; i < 4; i++) {
      const v = box(0.07, 0.012, 0.004, dark); v.position.set(-0.12 + i * 0.075 * 0, 0.035 - i * 0.022, z); v.scale.x = 2.4; torso.add(v);
    }
  }
  // rear battery cap and a small status light
  const cap = rbox(0.04, 0.13, 0.24, 0.015, dark); cap.position.x = -0.465; torso.add(cap);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 12), glow); tip.position.set(-0.3, 0.118, 0); torso.add(tip);

  // hip abduction housings at the four corners
  for (const x of [0.38, -0.38]) for (const z of [-0.15, 0.15]) {
    const hh = cyl(0.058, 0.13, shell); hh.rotation.z = Math.PI / 2; hh.position.set(x, -0.015, z); torso.add(hh);
    const ring = cyl(0.06, 0.012, dark); ring.rotation.z = Math.PI / 2; ring.position.set(x + Math.sign(x) * 0.066, -0.015, z); torso.add(ring);
  }

  // head on a neck pivot so it can yaw and pitch, with a glossy visor and a chin lidar
  const neck = new THREE.Group(); neck.position.set(0.42, 0.02, 0); torso.add(neck);
  const head = new THREE.Group(); neck.add(head);
  const skull = rbox(0.2, 0.15, 0.25, 0.05, shell); skull.position.x = 0.09; head.add(skull);
  const visor = rbox(0.05, 0.1, 0.21, 0.02, visorMat); visor.position.x = 0.175; head.add(visor);
  const eyeL = cyl(0.016, 0.01, glow, 20); eyeL.rotation.z = Math.PI / 2; eyeL.position.set(0.2, 0.012, 0.05); head.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.z = -0.05; head.add(eyeR);
  const lidar = cyl(0.034, 0.045, dark); lidar.position.set(0.12, -0.085, 0); head.add(lidar);
  const lidarLens = cyl(0.036, 0.012, visorMat); lidarLens.position.set(0.12, -0.11, 0); head.add(lidarLens);
  const nozzleTip = new THREE.Object3D(); nozzleTip.position.set(0.12, -0.12, 0); head.add(nozzleTip);

  const legs = [];
  const legDefs = [
    { name: 'FL', x: 0.38, z: -0.245, phase: 0.0 },
    { name: 'FR', x: 0.38, z: 0.245, phase: 0.5 },
    { name: 'BL', x: -0.38, z: -0.245, phase: 0.5 },
    { name: 'BR', x: -0.38, z: 0.245, phase: 0.0 },
  ];
  for (const def of legDefs) {
    const hip = new THREE.Group(); hip.position.set(def.x, -0.02, def.z); torso.add(hip);
    // hip pitch motor
    const motor = cyl(0.062, 0.075, shell); motor.rotation.x = Math.PI / 2; hip.add(motor);
    const motorCap = cyl(0.04, 0.08, dark); motorCap.rotation.x = Math.PI / 2; hip.add(motorCap);
    // thigh: wide flat link, wider at the hip
    const thigh = rbox(0.085, L * 0.92, 0.05, 0.022, shell); thigh.position.y = -L * 0.48; hip.add(thigh);
    const thighInner = box(0.04, L * 0.6, 0.052, dark); thighInner.position.y = -L * 0.5; hip.add(thighInner);
    const knee = new THREE.Group(); knee.position.y = -L; hip.add(knee);
    const kj = cyl(0.033, 0.058, dark); kj.rotation.x = Math.PI / 2; knee.add(kj);
    // shin: slim rod ending in a rubber foot
    const shin = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.019, L * 0.85, 6, 16), dark));
    shin.position.y = -L / 2; knee.add(shin);
    const foot = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.034, 20, 14), rubber));
    foot.position.y = -L; knee.add(foot);
    legs.push({ ...def, hip, knee, fx: 0, fy: -HIP_H });
  }

  // ---------- manipulator arm on the back (like Spot's arm) ----------
  const L1 = 0.5, L2 = 0.48, GRIP = 0.115, SH_Y = 0.05;
  const armBase = new THREE.Group(); armBase.position.set(0.17, 0.112, -0.05); torso.add(armBase);
  const turret = cyl(0.055, 0.05, dark); turret.position.y = 0.02; armBase.add(turret);
  const shoulder = new THREE.Group(); shoulder.position.y = SH_Y; armBase.add(shoulder);
  const shMotor = cyl(0.05, 0.1, shell); shMotor.rotation.x = Math.PI / 2; shoulder.add(shMotor);
  const shCap = cyl(0.032, 0.105, dark); shCap.rotation.x = Math.PI / 2; shoulder.add(shCap);
  const link1 = rbox(L1, 0.065, 0.06, 0.025, shell); link1.position.x = L1 / 2; shoulder.add(link1);
  const elbow = new THREE.Group(); elbow.position.set(L1, 0, 0.045); shoulder.add(elbow);
  const elMotor = cyl(0.038, 0.06, dark); elMotor.rotation.x = Math.PI / 2; elbow.add(elMotor);
  const link2 = rbox(L2, 0.05, 0.045, 0.02, shell); link2.position.x = L2 / 2; elbow.add(link2);
  const wrist = new THREE.Group(); wrist.position.x = L2; elbow.add(wrist);
  const wrMotor = cyl(0.03, 0.055, dark); wrMotor.rotation.x = Math.PI / 2; wrist.add(wrMotor);
  const palm = rbox(0.05, 0.06, 0.07, 0.012, dark); palm.position.x = 0.04; wrist.add(palm);
  const fingerA = rbox(0.08, 0.018, 0.016, 0.006, dark); wrist.add(fingerA);
  const fingerB = fingerA.clone(); wrist.add(fingerB);
  const camLed = cyl(0.008, 0.01, glow, 12); camLed.rotation.z = Math.PI / 2; camLed.position.set(0.066, 0.02, 0); wrist.add(camLed);
  function setFingers(open) {
    const o = 0.012 + 0.03 * open;
    fingerA.position.set(0.1, 0, o); fingerB.position.set(0.1, 0, -o);
  }
  setFingers(1);

  const ARM_REST = { yaw: 0, a1: 2.95, a2: -2.82, a3: -0.45 };
  const armPose = { ...ARM_REST };
  function applyArm(p) {
    armBase.rotation.y = p.yaw;
    shoulder.rotation.z = p.a1;
    elbow.rotation.z = p.a2;
    wrist.rotation.z = p.a3;
  }
  applyArm(ARM_REST);

  // inverse kinematics: put the finger tips on a world point, approaching along a world direction
  const _t = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion();
  function solveArm(target, approach) {
    dog.updateMatrixWorld(true);
    _t.copy(target); torso.worldToLocal(_t);
    const yaw = Math.atan2(-(_t.z - armBase.position.z), _t.x - armBase.position.x);
    armBase.rotation.y = yaw; armBase.updateMatrixWorld(true);
    _t.copy(target); armBase.worldToLocal(_t);
    armBase.getWorldQuaternion(_q).invert();
    _d.copy(approach).applyQuaternion(_q).normalize();
    const wx = _t.x - _d.x * GRIP, wy = _t.y - _d.y * GRIP - SH_Y;
    let dd = Math.hypot(wx, wy);
    dd = THREE.MathUtils.clamp(dd, Math.abs(L1 - L2) + 0.02, (L1 + L2) * 0.999);
    const c2 = THREE.MathUtils.clamp((dd * dd - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
    const a2 = -Math.acos(c2);
    const a1 = Math.atan2(wy, wx) - Math.atan2(L2 * Math.sin(a2), L1 + L2 * Math.cos(a2));
    const phi = Math.atan2(_d.y, _d.x);
    return { yaw, a1, a2, a3: phi - a1 - a2 };
  }
  function blendArm(a, b, w) {
    return { yaw: a.yaw + (b.yaw - a.yaw) * w, a1: a.a1 + (b.a1 - a.a1) * w, a2: a.a2 + (b.a2 - a.a2) * w, a3: a.a3 + (b.a3 - a.a3) * w };
  }
  dog.scale.setScalar(1.7);
  scene.add(dog);

  // two link IK in the sagittal plane, knees bending backward
  function solveLeg(leg, tx, ty) {
    let d = Math.hypot(tx, ty);
    const maxD = 2 * L * 0.995, minD = 0.12;
    if (d > maxD) { tx *= maxD / d; ty *= maxD / d; d = maxD; }
    if (d < minD) d = minD;
    const a = Math.atan2(tx, -ty);
    const b = Math.acos(THREE.MathUtils.clamp((L * L + d * d - L * L) / (2 * L * d), -1, 1));
    const t1 = a - b;
    const kx = L * Math.sin(t1), ky = -L * Math.cos(t1);
    const ts = Math.atan2(tx - kx, -(ty - ky));
    leg.hip.rotation.z = t1;
    leg.knee.rotation.z = ts - t1;
  }

  // ---------- letters ----------
  const font = new FontLoader().parse(fontJSON);
  const SIZE = 1.1, DEPTH = 0.34;
  const letters = [];
  let cursor = 0;
  const gap = 0.12;
  const rand = (i, k) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
  const letterMat = new THREE.MeshStandardMaterial({
    color: canvas.dataset.letterColor || '#d3d6da', roughness: 0.5, metalness: 0.02, envMapIntensity: 0.12,
  });
  WORD.split('').forEach((ch, i) => {
    if (ch === ' ') { cursor += SIZE * 0.5; return; }
    const geo = new TextGeometry(ch, {
      font, size: SIZE, height: DEPTH, curveSegments: 10,
      bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 3,
    });
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const w = bb.max.x - bb.min.x;
    // origin at the middle of the bottom edge, so a letter tips over around its base
    geo.translate(-bb.min.x - w / 2, -bb.min.y, -DEPTH / 2);
    const mesh = new THREE.Mesh(geo, letterMat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.rotation.order = 'YXZ';
    scene.add(mesh);
    const h = bb.max.y - bb.min.y;
    // invisible box around the letter so clicks inside the O's hole still count
    const hitBox = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, h + 0.1, DEPTH + 0.1), new THREE.MeshBasicMaterial({ visible: false }));
    hitBox.position.y = h / 2; mesh.add(hitBox);
    letters.push({
      mesh, hitBox, w, h, cx: cursor + w / 2,
      // where it starts: knocked over backwards, a little crooked
      jx: (rand(i, 1) - 0.5) * 0.3, jz: -0.05 - rand(i, 2) * 0.12, ry0: (rand(i, 3) - 0.5) * 0.6,
      u: 1, st: 'up', f: 0,
    });
    cursor += w + gap;
  });
  const wordW = cursor - gap;
  for (const l of letters) l.cx -= wordW / 2;
  const wordLeft = -wordW / 2, wordRight = wordW / 2;

  const easeIO = (x) => x * x * (3 - 2 * x);
  // pose of a letter along its trip: u = 0 lying on the floor, u = 1 standing in its spot
  function poseLetter(l) {
    if (l.st === 'falling') {
      // tips over backwards, speeding up, with a small bounce when it lands
      const f = THREE.MathUtils.clamp(l.f, 0, 1);
      const tilt = f < 0.78 ? Math.pow(f / 0.78, 2) : 1 - 0.07 * Math.sin(Math.PI * (f - 0.78) / 0.22);
      const e = Math.min(1, f / 0.78);
      l.mesh.position.set(l.cx + l.jx * e, (DEPTH / 2 + 0.03) * tilt, l.jz * e);
      l.mesh.rotation.set(-Math.PI / 2 * tilt, l.ry0 * e, 0);
      return;
    }
    const u = THREE.MathUtils.clamp(l.u, 0, 1);
    const e = easeIO(u);
    const tilt = easeIO(THREE.MathUtils.clamp((u - 0.15) / 0.7, 0, 1));
    const lift = Math.sin(Math.PI * u) * 0.55;
    l.mesh.position.set(
      l.cx + l.jx * (1 - e),
      (DEPTH / 2 + 0.03) * (1 - tilt) + lift,
      l.jz * (1 - e)
    );
    l.mesh.rotation.set(-Math.PI / 2 * (1 - tilt), l.ry0 * (1 - e), 0);
  }
  letters.forEach(poseLetter);
  const graspLocal = (l) => new THREE.Vector3(0, l.h * 0.4, DEPTH / 2 + 0.03);
  function graspWorld(l, out) { l.mesh.updateMatrixWorld(true); return l.mesh.localToWorld(out.copy(graspLocal(l))); }
  function normalWorld(l, out) { return out.set(0, 0, 1).applyQuaternion(l.mesh.quaternion); }

  // ---------- choreography ----------
  // The word stands on its own. Knock letters over with the mouse (or a tap)
  // and the robot walks over and puts each one back.
  const LANE_Z = 0.92;
  const SPEED = 2.8;
  const stops = letters.map((l) => l.cx - 0.62);
  const homeX = wordRight + 1.5;
  const startX = wordLeft - 6;
  const FALL_T = 0.7;

  const state = {
    x: startX, dist: 0, amp: 0, mode: 'idle', goal: homeX, task: -1, t: 0, idleT: 0,
    printing: -1, printT: 0, armW: 0, armWave: 0, sit: 0, wave: 0, headYaw: 0, headPitch: 0,
    lookX: 0, lookY: 0, pointer: false,
  };

  function knock(l, instant) {
    if (l.st !== 'up') return;
    l.jx = (Math.random() - 0.5) * 0.3;
    l.jz = -0.05 - Math.random() * 0.12;
    l.ry0 = (Math.random() - 0.5) * 0.6;
    l.u = 0;
    if (instant) { l.st = 'down'; poseLetter(l); return; }
    l.st = 'falling'; l.f = 0;
  }

  function finishInstantly() {
    for (const l of letters) { l.st = 'up'; l.u = 1; poseLetter(l); }
    Object.assign(state, { x: homeX, mode: 'sit', task: -1, sit: 1, amp: 0, t: 0, armW: 0 });
  }
  function restart() {
    for (const l of letters) { l.st = 'up'; l.u = 1; poseLetter(l); }
    // one letter starts knocked over so the robot has something to fix when it arrives
    knock(letters[Math.min(3, letters.length - 1)], true);
    Object.assign(state, { x: startX, dist: 0, amp: 0, mode: 'idle', task: -1, t: 0, idleT: 0, printing: -1, sit: 0, wave: 0, armW: 0, armWave: 0 });
  }
  if (reduceMotion) finishInstantly(); else restart();

  // ---------- mouse: knock letters over ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function letterAt(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(letters.map((l) => l.hitBox), false)[0];
    return hit ? letters.find((l) => l.hitBox === hit.object) : null;
  }
  let lastMove = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (reduceMotion) return;
    const l = letterAt(e);
    if (l) knock(l);
  });
  canvas.addEventListener('pointermove', (e) => {
    const now = performance.now();
    const l = letterAt(e);
    canvas.style.cursor = l && l.st === 'up' ? 'pointer' : 'default';
    // a quick swipe across a letter also knocks it over
    if (lastMove && l && !reduceMotion) {
      const speed = Math.hypot(e.clientX - lastMove.x, e.clientY - lastMove.y) / Math.max(1, now - lastMove.t);
      if (speed > 1.2) knock(l);
    }
    lastMove = { x: e.clientX, y: e.clientY, t: now };
  });
  window.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    state.lookX = ((e.clientX - r.left) / r.width) * 2 - 1;
    state.lookY = ((e.clientY - r.top) / r.height) * 2 - 1;
    state.pointer = true;
  });

  const STEP = 0.2; // half stride
  function legTarget(leg, p, amp) {
    // p in [0,1): stance first half, swing second half
    p = ((p % 1) + 1) % 1;
    let x, y = -HIP_H;
    if (p < 0.5) {
      x = STEP * (1 - 4 * p);
    } else {
      const u = (p - 0.5) * 2;
      const s = 0.5 - 0.5 * Math.cos(Math.PI * u);
      x = -STEP + 2 * STEP * s;
      y += 0.09 * Math.sin(Math.PI * u);
    }
    return [x * amp, -HIP_H + (y + HIP_H) * amp];
  }

  function update(dt, time) {
    let vx = 0;
    // letters finish falling
    for (const l of letters) if (l.st === 'falling') { l.f += dt / FALL_T; if (l.f >= 1) { l.f = 1; l.st = 'down'; } poseLetter(l); }
    const pending = letters.filter((l) => l.st === 'down' || l.st === 'falling');

    // stand up first if a job appears while sitting
    if (state.mode === 'sit' && pending.length) { state.mode = 'idle'; state.idleT = 0; }
    state.sit += ((state.mode === 'sit' ? 1 : 0) - state.sit) > 0 ? Math.min(dt * 1.8, 1 - state.sit) : -Math.min(dt * 2.2, state.sit);
    const standing = state.sit < 0.05;

    if (state.mode === 'idle' && standing) {
      if (pending.length) {
        // go to the closest knocked over letter
        let best = null, bd = Infinity;
        for (const l of pending) { const d = Math.abs(stops[letters.indexOf(l)] - state.x); if (d < bd) { bd = d; best = l; } }
        state.task = letters.indexOf(best); state.goal = stops[state.task]; state.mode = 'walk';
      } else {
        state.idleT += dt;
        if (state.idleT > 1.2) { state.task = -1; state.goal = homeX; state.mode = 'walk'; }
      }
    }
    if (state.mode === 'walk') {
      const remaining = state.goal - state.x;
      const dir = Math.sign(remaining) || 1;
      const v = Math.min(SPEED * (dir < 0 ? 0.8 : 1), Math.max(0.9, Math.abs(remaining) * 5));
      const step = dir * Math.min(Math.abs(remaining), v * dt);
      state.x += step; vx = dt > 0 ? step / dt : 0;
      state.amp = Math.min(1, state.amp + dt * 4);
      if (Math.abs(remaining) < 0.005) {
        if (state.task >= 0) {
          const l = letters[state.task];
          if (l.st === 'down') { l.st = 'moving'; state.mode = 'print'; state.printing = state.task; state.printT = 0; }
          else if (l.st === 'up') { state.mode = 'idle'; state.idleT = 0; }
          // still falling: wait here a moment
        } else { state.mode = 'sit'; state.t = 0; }
      }
    } else {
      state.amp = Math.max(0, state.amp - dt * 3.5);
    }
    state.dist += vx * dt;
    const phase = state.dist / (4 * STEP);

    // pick and place
    let yawGoal = 0, pitchGoal = 0;
    let armTarget = null;
    if (state.mode === 'print') {
      const l = letters[state.printing];
      state.printT += dt;
      const T = state.printT;
      const REACH = 0.5, GRAB = 0.15, CARRY = 0.9, LET = 0.12, BACK = 0.42;
      const g = new THREE.Vector3(), n = new THREE.Vector3();
      let off = 0, open = 1;
      if (T < REACH) {
        const k = easeIO(T / REACH);
        state.armW = k; off = 0.35 * (1 - k);
      } else if (T < REACH + GRAB) {
        state.armW = 1; open = 1 - (T - REACH) / GRAB;
      } else if (T < REACH + GRAB + CARRY) {
        state.armW = 1; open = 0;
        l.u = (T - REACH - GRAB) / CARRY;
      } else if (T < REACH + GRAB + CARRY + LET) {
        l.u = 1; state.armW = 1; open = (T - REACH - GRAB - CARRY) / LET;
      } else {
        l.u = 1;
        const k = THREE.MathUtils.clamp((T - REACH - GRAB - CARRY - LET) / BACK, 0, 1);
        off = 0.3 * k; state.armW = 1 - easeIO(THREE.MathUtils.clamp(k * 1.3 - 0.3, 0, 1));
        if (k >= 1) { l.st = 'up'; state.mode = 'idle'; state.idleT = 0; state.armW = 0; }
      }
      poseLetter(l);
      graspWorld(l, g); normalWorld(l, n);
      armTarget = { point: g.addScaledVector(n, off), dir: n.clone().negate() };
      setFingers(open);
      // head watches the letter it is handling
      const hx = state.x + 0.5 * dog.scale.x;
      yawGoal = THREE.MathUtils.clamp(Math.atan2(LANE_Z - g.z, g.x - hx), -0.2, 1.3);
      pitchGoal = -0.3;
    } else {
      state.armW = 0; if (state.mode !== 'sit') setFingers(1);
    }

    // sitting and waving at the end
    if (state.mode === 'sit') {
      state.t += dt;
      const wt = (state.t - 0.9) % 9;
      if (!reduceMotion && state.t > 0.9 && wt < 2.6) state.armWave = Math.min(1, state.armWave + dt * 3);
      else state.armWave = Math.max(0, state.armWave - dt * 2.5);
      yawGoal = -1.1; pitchGoal = 0.1;
      if (state.pointer) {
        yawGoal = THREE.MathUtils.clamp(-1.25 + state.lookX * 0.8, -2.1, -0.3);
        pitchGoal = THREE.MathUtils.clamp(-state.lookY * 0.4, -0.35, 0.35);
      }
    } else {
      state.armWave = Math.max(0, state.armWave - dt * 4);
    }

    // head easing
    state.headYaw += (yawGoal - state.headYaw) * Math.min(1, dt * 6);
    state.headPitch += (pitchGoal - state.headPitch) * Math.min(1, dt * 6);
    neck.rotation.set(0, state.headYaw, state.headPitch, 'YXZ');

    // body pose
    const s = state.sit;
    const ease = s * s * (3 - 2 * s);
    const bob = Math.sin(phase * Math.PI * 4) * 0.012 * state.amp;
    const breathe = Math.sin(time * 2.2) * 0.006;
    dog.position.set(state.x, (HIP_H + 0.02 + bob + breathe - ease * 0.18) * dog.scale.y, LANE_Z);
    torso.rotation.z = ease * 0.4;

    // legs
    for (const leg of legs) {
      let [tx, ty] = legTarget(leg, phase + leg.phase, state.amp);
      if (ease > 0) {
        const th = ease * 0.4;
        const rootH = HIP_H + 0.02 - ease * 0.18;
        const front = leg.x > 0;
        // paw targets in the upright root frame, feet on the ground
        const rx = front ? 0.4 : -0.33;
        const ry = -rootH + 0.04;
        const c = Math.cos(th), sn = Math.sin(th);
        let sx = rx * c + ry * sn - leg.x;
        let sy = -rx * sn + ry * c + 0.02;
        if (leg.name === 'FR' && state.wave > 0) {
          const w = state.wave;
          sx = THREE.MathUtils.lerp(sx, 0.34 + 0.06 * Math.sin(time * 11), w);
          sy = THREE.MathUtils.lerp(sy, -0.02 + 0.06 * Math.cos(time * 11), w);
        }
        tx = THREE.MathUtils.lerp(tx, sx, ease);
        ty = THREE.MathUtils.lerp(ty, sy, ease);
      }
      solveLeg(leg, tx, ty);
    }

    // arm: blend between stowed and the IK solution, or wave when sitting
    let pose = ARM_REST;
    if (armTarget && state.armW > 0) {
      dog.updateMatrixWorld(true);
      pose = blendArm(ARM_REST, solveArm(armTarget.point, armTarget.dir), state.armW);
    } else if (state.armWave > 0) {
      const wv = { yaw: -1.35, a1: 1.15, a2: 0.35 + 0.35 * Math.sin(time * 7), a3: 0.25 };
      pose = blendArm(ARM_REST, wv, easeIO(state.armWave));
      setFingers(0.5 + 0.5 * Math.sin(time * 14));
    }
    applyArm(pose);

    glow.emissiveIntensity = 0.6 + 0.4 * Math.sin(time * 4);
  }

  // ---------- layout ----------
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // fit the word plus the robot at both ends
    const span = wordW + 9;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const distW = (span / 2) / Math.tan(hFov / 2);
    const distH = (2.6 / 2) / Math.tan(vFov / 2);
    const dist = Math.max(distW, distH);
    const elev = 0.3;
    const cx = 1.3;
    camera.position.set(cx, 0.75 + Math.sin(elev) * dist, 0.4 + Math.cos(elev) * dist);
    camera.lookAt(cx, 0.75, 0.4);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // only animate while visible
  let visible = true;
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(canvas);

  const clock = new THREE.Clock();
  let time = 0;
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 1 / 30);
    if (!visible || dt <= 0 || canvas.dataset.paused === '1') return;
    time += dt;
    update(dt, time);
    renderer.render(scene, camera);
  }
  canvas.classList.add('ready');
  frame();

})();
