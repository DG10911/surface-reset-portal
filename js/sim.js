'use strict';
/* Surface Reset Portal — digital twin
   Software simulation. Telemetry is modelled, not measured. */
if (typeof THREE === 'undefined') {
  document.getElementById('offline').style.display = 'flex';
} else {
  try { APP(); }
  catch (err) {
    const o = document.getElementById('offline');
    o.style.display = 'flex';
    o.innerHTML = '<b>Simulation error</b><span>' + String(err).slice(0, 240) + '</span>';
    console.error(err);
  }
}

function APP() {
  const $ = (id) => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const seg = (t, s, e) => clamp((t - s) / (e - s), 0, 1);
  const lerp = (a, b, u) => a + (b - a) * u;
  const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
  const tri = (t, s, e) => Math.sin(seg(t, s, e) * Math.PI);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pad = (n, w) => String(n).padStart(w, '0');
  /* Unity/camera-controls SmoothDamp analogue — frame-rate independent (drei damp) */
  const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
  function dampV3(v, x, y, z, lambda, dt) {
    const k = 1 - Math.exp(-lambda * dt);
    v.x += (x - v.x) * k; v.y += (y - v.y) * k; v.z += (z - v.z) * k;
  }
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const G = window.gsap;
  let camTweening = false;
  let camDt = 1 / 60;

  const MODS = [
    {
      k: 'scan', s: 0, e: 1.9, nm: 'Vehicle scan', short: 'Scan', col: '#38BDF8',
      ds: 'IR presence, scanning cameras, panel map. Heavy soil is triaged to a 60s pre-cycle so the 22.6s promise never breaks.'
    },
    {
      k: 'ion', s: 1.9, e: 4.7, nm: 'Ionized air curtain', short: 'Ionized air', col: '#A855F7',
      ds: 'Static neutralized so dust releases before contact. Air curtain active 1.9–4.7 s.'
    },
    {
      k: 'mist', s: 3.8, e: 7.5, nm: 'Polymer mist', short: 'Polymer mist', col: '#2DD4BF',
      ds: 'Rinseless polymer encapsulates soil. Under 2 L total liquid, zero rinse water.'
    },
    {
      k: 'tex', s: 5.6, e: 15.1, nm: 'Textile contact', short: 'Textile', col: '#FF6B1A',
      ds: 'Hero module — segmented microfiber from roof and sides, spring compliance, whole field at once.'
    },
    {
      k: 'air', s: 11.3, e: 18.8, nm: 'Air-knife extraction', short: 'Air-knife', col: '#F59E0B',
      ds: 'High-velocity air sheets strip residual moisture. No drying tunnel.'
    },
    {
      k: 'bottom', s: 8.0, e: 14.5, nm: 'Underbody hydro wash', short: 'Bottom', col: '#06B6D4',
      ds: 'High-pressure upward jets clean underbody, wheel wells, and sills through conveyor gaps. Zero pooling — integrated drain tray recirculates.'
    },
    {
      k: 'gloss', s: 19.5, e: 22.6, nm: 'Gloss + protect', short: 'Gloss', col: '#EC4899',
      ds: 'Ultra-thin SiO₂ hydrophobic layer. Gloss, uniformity, hydrophobicity are simulation estimates.'
    }
  ];
  const CYCLE = 22.6;
  const LANE = { qStart: -32, portalIn: -11.5, portalOut: 18.0, qc: 18.8, finish: 25.5, done: 31 };
  const BELT = (18.0 - (-11.5)) / 22.6; /* one conveyor speed end-to-end (no wheel slip) */
  const ZONE_CLEAR = { roof: [5.6, 9.4], hood: [7.0, 10.8], front: [6.1, 9.9], left: [8.0, 12.7], right: [8.0, 12.7], rear: [9.9, 14.1], wheels: [10.4, 15.1], underbody: [8.0, 14.0] };
  const QZONES = ['ROOF', 'HOOD', 'LEFT', 'RIGHT', 'REAR', 'WHEELS', 'UNDERBODY'];
  const VEHICLES = {
    A: { type: 'sedan', color: 0xf0f2f4, label: 'CAR24-A-001' },
    B: { type: 'hatchback', color: 0xb02430, label: 'CAR24-B-002' },
    C: { type: 'suv', color: 0x1f4f9a, label: 'CAR24-C-003' }
  };

  /* ---------- state ---------- */
  let page = 'simulation';
  let flow = 'idle', flowT = 0, cycleT = 0, preT = 0;
  let paused = false, estop = false, simSpeed = 1, mode = 'auto';
  let heavyNext = false, heavyCar = false, lofx = false;
  let vehPick = 'A', carsToday = 0, waterToday = 0;
  let T = 0, lastMs = performance.now();
  let camMode = 'hero', cctvId = 1;
  let engineering = false, convOverlay = false;
  let convRun = false, convSpd = 1, convDir = 1;
  let introT = 0, introOn = true;
  let presOn = false, quoteOn = false;
  let qcT = 0, qcScores = [];
  let lastReport = null;
  let cineOn = false, cineTl = null, wakeT = -1;
  let snapBefore = null, snapAfter = null, wantSnap = null;
  let bloom = null, bloomStr = 0.08;
  let sfxOn = true;
  const sfx = (window.SRP && SRP.Audio) ? SRP.Audio() : null;
  function fireSfx(name) {
    if (!sfx || !sfxOn) return;
    if (typeof sfx[name] === 'function') sfx[name]();
  }
  function setDirt(mat, v) {
    if (!mat) return;
    mat.opacity = v;
    if (mat.uniforms && mat.uniforms.uDirtLevel) mat.uniforms.uDirtLevel.value = v;
  }
  function getDirt(mat) {
    if (!mat) return 0;
    if (mat.uniforms && mat.uniforms.uDirtLevel) return mat.uniforms.uDirtLevel.value;
    return mat.opacity;
  }
  const cqsHist = [];
  const logs = [];
  const manualOn = { scan: false, ion: false, mist: false, tex: false, air: false, bottom: false, gloss: false };
  let hero = null;
  let conveyorForced = false;

  /* ---------- log ---------- */
  function log(msg, lv) {
    lv = lv || 'info';
    const d = new Date();
    const ts = pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2);
    logs.unshift({ ts, msg, lv });
    if (logs.length > 120) logs.pop();
    renderLog();
    const tape = $('liveTape');
    if (tape) { tape.textContent = ts + '  ' + msg; tape.style.opacity = '1'; }
  }
  function renderLog() {
    const el = $('logFull');
    if (!el) return;
    el.innerHTML = logs.map(l =>
      '<div><span class="ts">' + l.ts + '</span><span class="lv ' + l.lv + '">' + l.lv + '</span><span>' + l.msg + '</span></div>'
    ).join('');
  }
  log('Twin online · hub simulation ready', 'ok');

  /* ---------- clock ---------- */
  function tickClock() {
    const d = new Date();
    $('clock').textContent = pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2);
    $('camTs').textContent = $('clock').textContent;
  }
  setInterval(tickClock, 1000); tickClock();

  /* ---------- gantt + module cards ---------- */
  const grows = $('grows');
  MODS.forEach((m, i) => {
    const r = document.createElement('div');
    r.className = 'grow';
    r.innerHTML =
      '<div class="gl" id="gl_' + m.k + '" style="--sec-col:' + m.col + '">' + m.short + '</div>' +
      '<div class="gtrack"><div class="gspan" id="gs_' + m.k + '" style="left:' + (m.s / CYCLE * 100) + '%;width:' + ((m.e - m.s) / CYCLE * 100) + '%;--sec-col:' + m.col + ';background:' + m.col + '22;border:1px solid ' + m.col + '44"></div>' +
      '<div class="gfill" id="gf_' + m.k + '" style="left:' + (m.s / CYCLE * 100) + '%;background:' + m.col + '"></div></div>';
    grows.appendChild(r);
  });
  const modCards = $('modCards');
  MODS.forEach((m, i) => {
    const d = document.createElement('div');
    d.className = 'mod';
    d.id = 'mod_' + m.k;
    d.style.color = m.col;
    d.innerHTML =
      '<div class="n">' + pad(i + 1, 2) + '</div>' +
      '<div class="nm">' + m.short + '</div>' +
      '<div class="st" id="mst_' + m.k + '">PENDING</div>' +
      '<div class="bar"><i id="mb_' + m.k + '" style="background:' + m.col + '"></i></div>' +
      '<button class="btn tog" data-mod="' + m.k + '">Force ' + m.short + '</button>';
    modCards.appendChild(d);
    const tn = document.createElement('span');
    tn.id = 'tnm_' + m.k;
    tn.style.color = m.col;
    tn.textContent = m.short;
    $('tnMods').appendChild(tn);
  });
  (function buildField() {
    const host = $('fvLanes'); if (!host) return;
    MODS.forEach(m => {
      const d = document.createElement('div');
      d.className = 'fv-lane';
      d.id = 'fv_' + m.k;
      d.innerHTML = '<span style="color:' + m.col + '">' + m.short + '</span>' +
        '<div class="fv-track"><div class="fv-span" style="left:' + (m.s / CYCLE * 100) + '%;width:' + ((m.e - m.s) / CYCLE * 100) + '%;background:' + m.col + '"></div>' +
        '<div class="fv-fill" id="fvf_' + m.k + '" style="left:' + (m.s / CYCLE * 100) + '%;background:' + m.col + '66"></div></div>';
      host.appendChild(d);
    });
  })();
  const qzWrap = $('qzWrap');
  QZONES.forEach((z, i) => {
    const d = document.createElement('div');
    d.className = 'qz';
    d.innerHTML = '<span>' + z + '</span><div class="zb"><div class="zf" id="zf' + i + '"></div></div><span class="zv" id="zv' + i + '">—</span>';
    qzWrap.appendChild(d);
  });

  /* ---------- cameras ---------- */
  const CAMS = [
    { id: 'hero', name: 'Hero camera', fov: 42, kind: 'cine' },
    { id: 'front', name: 'Front camera', fov: 50, kind: 'fixed' },
    { id: 'rear', name: 'Rear camera', fov: 50, kind: 'fixed' },
    { id: 'left', name: 'Left side camera', fov: 48, kind: 'fixed' },
    { id: 'right', name: 'Right side camera', fov: 48, kind: 'fixed' },
    { id: 'top', name: 'Top camera', fov: 50, kind: 'ortho' },
    { id: 'drone', name: 'Drone camera', fov: 40, kind: 'drone' },
    { id: 'fpv', name: 'FPV camera', fov: 72, kind: 'fpv' },
    { id: 'follow', name: 'Vehicle follow', fov: 48, kind: 'cine' },
    { id: 'hood', name: 'Driver / hood camera', fov: 65, kind: 'fpv' },
    { id: 'portal', name: 'Portal internal', fov: 70, kind: 'cine' },
    { id: 'cctv', name: 'CCTV bank', fov: 52, kind: 'cctv' },
    { id: 'factory', name: 'Overhead factory', fov: 55, kind: 'cine' },
    { id: 'exit', name: 'Exit inspection', fov: 48, kind: 'cine' },
    { id: 'inspect', name: 'Finish bay 360°', fov: 44, kind: 'cine' }
  ];
  const camList = $('camList');
  CAMS.forEach(c => {
    const b = document.createElement('button');
    b.className = 'cam-btn' + (c.id === 'hero' ? ' on' : '');
    b.dataset.cam = c.id;
    b.innerHTML = '<b>' + c.name + '</b><span>' + c.fov + '°</span>';
    b.onclick = () => setCam(c.id);
    camList.appendChild(b);
  });
  const cctvBtns = $('cctvBtns');
  [1, 2, 3, 4].forEach(n => {
    const b = document.createElement('button');
    b.className = 'btn' + (n === 1 ? ' on' : '');
    b.textContent = 'CAM 0' + n;
    b.onclick = () => { cctvId = n; setCam('cctv');[...cctvBtns.children].forEach((x, i) => x.classList.toggle('on', i === n - 1)); };
    cctvBtns.appendChild(b);
  });

  function setCam(id) {
    const changed = camMode !== id;
    camMode = id;
    document.querySelectorAll('.cam-btn').forEach(b => b.classList.toggle('on', b.dataset.cam === id));
    const spec = CAMS.find(c => c.id === id);
    $('camName').innerHTML = '<b>' + (id === 'cctv' ? ('CCTV · CAM 0' + cctvId) : spec.name.toUpperCase()) + '</b>';
    $('camMeta').textContent = (id === 'drone' ? 'ALT 22 m · SPEED 0.4 m/s · ' : '') + 'FOV ' + spec.fov + '° · HUB-01';
    $('camRec').hidden = spec.kind !== 'cctv';
    $('stage').classList.toggle('cctv', spec.kind === 'cctv');
    $('stage').classList.toggle('fpv', spec.kind === 'fpv');
    $('stage').classList.toggle('drone', spec.kind === 'drone');
    camera.fov = spec.fov;
    camera.updateProjectionMatrix();
    if (id !== 'drone' && id !== 'hero') orbit.manual = false;
    if (changed) {
      const flash = $('flash');
      if (flash && G && !reducedMotion) {
        G.fromTo(flash, { opacity: 0.14 }, { opacity: 0, duration: 0.28, ease: 'power2.out', overwrite: true });
      }
      const dest = camDest();
      if (dest && G && !reducedMotion && spec.kind !== 'fpv') {
        camTweening = true;
        G.to(camera.position, { x: dest.p.x, y: dest.p.y, z: dest.p.z, duration: 0.75, ease: 'power3.inOut', overwrite: true });
        G.to(orbit.target, {
          x: dest.g.x, y: dest.g.y, z: dest.g.z, duration: 0.75, ease: 'power3.inOut', overwrite: true,
          onUpdate: () => camera.lookAt(orbit.target),
          onComplete: () => { camTweening = false; }
        });
      }
    }
  }

  /* ---------- three.js ---------- */
  const canvas = $('c3d');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1017);
  scene.fog = new THREE.Fog(0x0d1017, 50, 120);
  const camera = new THREE.PerspectiveCamera(42, 2, 0.1, 280);
  camera.position.set(16, 9, 18);
  try {
    if (window.SRP && SRP.makeBloom) bloom = SRP.makeBloom(renderer, scene, camera);
  } catch (err) { bloom = null; console.warn('Bloom unavailable', err); }

  (function env() {
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x181c22);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(40, 16, 12), new THREE.MeshBasicMaterial({ color: 0x22272e, side: THREE.BackSide }));
    envScene.add(sky);
    for (let i = 0; i < 12; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(1.0, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffe8c0 }));
      l.position.set((i % 4) * 10 - 15, 12 + (i % 3) * 2, (i < 6 ? -8 : 8));
      envScene.add(l);
    }
    const gnd = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshBasicMaterial({ color: 0x22262c }));
    gnd.rotation.x = -Math.PI / 2; gnd.position.y = -4; envScene.add(gnd);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(envScene, 0.04).texture;
  })();

  scene.add(new THREE.HemisphereLight(0xfff4e4, 0x181c22, 0.55));
  const sun = new THREE.DirectionalLight(0xffecd0, 1.5);
  sun.position.set(18, 28, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sd = 40; sun.shadow.camera.left = -sd; sun.shadow.camera.right = sd;
  sun.shadow.camera.top = sd; sun.shadow.camera.bottom = -sd; sun.shadow.bias = -0.0005;
  scene.add(sun);
  /* subtle warm rim light from behind to add depth */
  const rim = new THREE.DirectionalLight(0xffa040, 0.3);
  rim.position.set(-14, 12, -18); scene.add(rim);

  const orbit = { theta: 0.85, phi: 1.05, r: 24, target: new THREE.Vector3(0, 1.4, 0), manual: false };
  let dragging = false, px = 0, py = 0;
  canvas.addEventListener('pointerdown', e => { dragging = true; px = e.clientX; py = e.clientY; if (camMode === 'hero' || camMode === 'drone' || camMode === 'inspect') orbit.manual = true; autoOrbit360 = false; });
  $('stage').addEventListener('pointermove', e => {
    const r = $('stage').getBoundingClientRect();
    $('stage').style.setProperty('--sx', ((e.clientX - r.left) / r.width * 100).toFixed(2) + '%');
    $('stage').style.setProperty('--sy', ((e.clientY - r.top) / r.height * 100).toFixed(2) + '%');
  });
  addEventListener('pointerup', () => dragging = false);
  addEventListener('pointermove', e => {
    if (!dragging) return;
    orbit.theta -= (e.clientX - px) * 0.005;
    orbit.phi = clamp(orbit.phi - (e.clientY - py) * 0.005, 0.2, 1.45);
    px = e.clientX; py = e.clientY;
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    orbit.r = clamp(orbit.r + e.deltaY * 0.02, 6, 70);
    if (camMode === 'hero' || camMode === 'drone' || camMode === 'inspect') orbit.manual = true;
  }, { passive: false });

  /* ---------- materials / textures ---------- */
  function concreteTex() {
    const S = 1024;
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const x = c.getContext('2d');
    /* Polished dark industrial epoxy resin floor */
    x.fillStyle = '#15181d'; x.fillRect(0, 0, S, S);
    /* Subtle 2.5m x 2.5m grid tiles with fine expansion caulking */
    x.strokeStyle = 'rgba(40,46,56,0.7)'; x.lineWidth = 2;
    const step = S / 8;
    for (let i = 0; i <= S; i += step) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke();
    }
    /* Fine epoxy surface speckle & aggregate */
    for (let i = 0; i < 4000; i++) {
      x.fillStyle = 'rgba(' + (35 + rnd(-8, 12) | 0) + ',' + (40 + rnd(-8, 12) | 0) + ',' + (48 + rnd(-8, 12) | 0) + ',' + rnd(0.04, 0.18) + ')';
      x.fillRect(rnd(0, S), rnd(0, S), rnd(1, 3), rnd(1, 3));
    }
    /* Drainage trench grating simulation in center lane */
    x.fillStyle = '#0f1115'; x.fillRect(0, S * 0.47, S, S * 0.06);
    x.strokeStyle = '#222730'; x.lineWidth = 1.5;
    for (let i = 0; i < S; i += 12) {
      x.beginPath(); x.moveTo(i, S * 0.47); x.lineTo(i, S * 0.53); x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(16, 10);
    t.encoding = THREE.sRGBEncoding; return t;
  }

  function hazardStripeTex() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 32;
    const x = c.getContext('2d');
    x.fillStyle = '#D4A017'; x.fillRect(0, 0, 128, 32);
    x.fillStyle = '#14171C';
    for (let i = -32; i < 160; i += 24) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 14, 0); x.lineTo(i - 4, 32); x.lineTo(i - 18, 32); x.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping; t.repeat.set(48, 1);
    t.encoding = THREE.sRGBEncoding; return t;
  }

  function wallCorrugateTex() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#1c2027'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i += 16) {
      const g = x.createLinearGradient(i, 0, i + 16, 0);
      g.addColorStop(0, '#161920'); g.addColorStop(0.5, '#262c36'); g.addColorStop(1, '#161920');
      x.fillStyle = g; x.fillRect(i, 0, 16, 256);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 2);
    t.encoding = THREE.sRGBEncoding; return t;
  }

  function textTex(txt, bg, fg, w, h, fs) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.fillStyle = fg; x.font = '700 ' + fs + 'px Barlow Condensed, Arial';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.letterSpacing = '2px'; x.fillText(txt, w / 2, h / 2 + 2);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }

  const steel = () => new THREE.MeshStandardMaterial({ color: 0x424a56, metalness: 0.9, roughness: 0.28 });
  const darkMatte = () => new THREE.MeshStandardMaterial({ color: 0x14171d, metalness: 0.55, roughness: 0.65 });
  const yellowMark = () => new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.45, metalness: 0.15 });
  const brushedAlum = () => new THREE.MeshStandardMaterial({ color: 0xc8d0dc, metalness: 0.95, roughness: 0.2 });

  /* ---------- HIGH-FIDELITY INDUSTRIAL FACTORY HUB ---------- */
  const floorMat = new THREE.MeshStandardMaterial({
    map: concreteTex(), roughness: 0.94, metalness: 0.02, color: 0x1c2027
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 100), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  function stripe(x, z, w, l, rot, col) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshStandardMaterial({ color: col || 0xd4a017, roughness: 0.6 }));
    s.rotation.x = -Math.PI / 2; s.rotation.z = rot || 0; s.position.set(x, 0.012, z); scene.add(s); return s;
  }
  for (let x = -36; x <= 36; x += 3.2) { stripe(x, 1.45, 1.4, 0.1, Math.PI / 2); stripe(x, -1.45, 1.4, 0.1, Math.PI / 2); }

  /* Continuous OSHA Hazard Chevron borders flanking conveyor track */
  const hzMat = new THREE.MeshBasicMaterial({ map: hazardStripeTex() });
  [-1.95, 1.95].forEach(z => {
    const hz = new THREE.Mesh(new THREE.PlaneGeometry(76, 0.24), hzMat);
    hz.rotation.x = -Math.PI / 2; hz.position.set(0, 0.014, z); scene.add(hz);
  });

  /* Safety staging perimeter boxes */
  [[-18, 8, 8, 6], [22, -12, 12, 8]].forEach(b => {
    stripe(b[0], b[1] + b[3] / 2, b[2], 0.1, 0, 0xd4a017);
    stripe(b[0], b[1] - b[3] / 2, b[2], 0.1, 0, 0xd4a017);
  });

  /* ---------- 3D STRUCTURAL ROOF TRUSSES & INDUSTRIAL CEILING ---------- */
  const trussGroup = new THREE.Group(); scene.add(trussGroup);
  for (let x = -36; x <= 36; x += 12) {
    /* Main vertical structural factory columns */
    [-22, 22].forEach(z => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.85, 12, 0.85), darkMatte());
      col.position.set(x, 6, z); col.castShadow = true; trussGroup.add(col);
      const colBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 1.4), steel());
      colBase.position.set(x, 0.2, z); trussGroup.add(colBase);
      /* Yellow safety column guards */
      const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.7, 1.2, 8), yellowMark());
      guard.position.set(x, 0.6, z); trussGroup.add(guard);
    });

    /* Warren roof truss spanning overhead */
    const topChord = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 45), steel());
    topChord.position.set(x, 11.8, 0); trussGroup.add(topChord);
    const botChord = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 45), steel());
    botChord.position.set(x, 10.4, 0); trussGroup.add(botChord);

    /* Diagonal web truss members */
    for (let z = -21; z < 21; z += 3.5) {
      const diagLen = Math.hypot(3.5, 1.4);
      const diag = new THREE.Mesh(new THREE.BoxGeometry(0.18, diagLen, 0.18), steel());
      diag.position.set(x, 11.1, z + 1.75);
      diag.rotation.x = Math.atan2(3.5, 1.4) * ((z / 3.5) % 2 === 0 ? 1 : -1);
      trussGroup.add(diag);
    }
  }

  /* Suspended Galvanized Spiral HVAC Ductwork running overhead */
  [-8, 8].forEach(z => {
    const duct = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 78, 16), brushedAlum());
    duct.rotation.z = Math.PI / 2; duct.position.set(0, 9.8, z); trussGroup.add(duct);
    /* Suspension cables */
    for (let x = -30; x <= 30; x += 12) {
      const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.6, 6), steel());
      drop.position.set(x, 10.6, z); trussGroup.add(drop);
    }
  });

  /* High-bay linear LED pendant luminaires */
  for (let x = -30; x <= 30; x += 10) {
    for (let z of [-5, 5]) {
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 0.7), new THREE.MeshStandardMaterial({
        color: 0xf6f0e4, emissive: 0xfff0d0, emissiveIntensity: 0.95
      }));
      fixture.position.set(x, 10.1, z); trussGroup.add(fixture);
    }
  }

  /* Key task spotlights illuminating each process station along the conveyor */
  [-9.0, -4.0, 1.0, 6.0, 11.0, 16.0].forEach(sx => {
    const sl = new THREE.SpotLight(0xfff3e0, 0.85, 24, 0.65, 0.35, 1);
    sl.position.set(sx, 9.8, 0); sl.target.position.set(sx, 0, 0);
    scene.add(sl); scene.add(sl.target);
  });

  /* ---------- ARCHITECTURAL HANGAR BACK WALL & BAY DOORS ---------- */
  const wallMat = new THREE.MeshStandardMaterial({ map: wallCorrugateTex(), roughness: 0.85, metalness: 0.3 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(96, 12, 0.45), wallMat);
  wall.position.set(0, 6, -24); scene.add(wall);

  /* 3 High-speed automated roll-up bay doors */
  const bayDoors = [
    { x: -26, name: 'BAY 01 · VEHICLE INTAKE', code: 'INTAKE' },
    { x: 4, name: 'BAY 02 · SURFACE RESET LINE 01', code: 'RESET' },
    { x: 26, name: 'BAY 03 · QC & PHOTOGRAMMETRY', code: 'QC PASS' }
  ];
  bayDoors.forEach(b => {
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(7.6, 6.2, 0.6), darkMatte());
    doorFrame.position.set(b.x, 3.1, -23.7); scene.add(doorFrame);
    const rollSlat = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 5.4), new THREE.MeshStandardMaterial({
      color: 0x242830, metalness: 0.7, roughness: 0.4
    }));
    rollSlat.position.set(b.x, 2.7, -23.38); scene.add(rollSlat);
    const doorSign = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 0.7), new THREE.MeshBasicMaterial({
      map: textTex(b.name, '#0B0C0E', '#FF6B1A', 1000, 120, 52)
    }));
    doorSign.position.set(b.x, 5.8, -23.36); scene.add(doorSign);
  });

  /* Backlit architectural Cars24 facility mural */
  const mural = new THREE.Mesh(new THREE.PlaneGeometry(16, 1.5), new THREE.MeshBasicMaterial({
    map: textTex('CARS24 MEGA REFURBISHMENT LAB', '#101318', '#FF6B1A', 2200, 200, 84)
  }));
  mural.position.set(-6, 9.4, -23.7); scene.add(mural);
  const mural2 = new THREE.Mesh(new THREE.PlaneGeometry(18, 0.7), new THREE.MeshBasicMaterial({
    map: textTex('AUTOMATED SURFACE RESET LINE  ·  22.6-SECOND PARALLEL CLEANING FIELD', '#101318', '#A0A6B2', 2400, 100, 48)
  }));
  mural2.position.set(-6, 8.2, -23.7); scene.add(mural2);

  /* Upper Mezzanine Walkway with industrial yellow safety railing */
  const mezFloor = new THREE.Mesh(new THREE.BoxGeometry(90, 0.25, 2.8), steel());
  mezFloor.position.set(0, 5.8, -22.4); scene.add(mezFloor);
  const mezRailing = new THREE.Mesh(new THREE.BoxGeometry(90, 1.1, 0.08), yellowMark());
  mezRailing.position.set(0, 6.45, -21.05); scene.add(mezRailing);

  /* Operator control room booth */
  (function () {
    const b = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 4.2), new THREE.MeshStandardMaterial({ color: 0x242830, roughness: 0.6, metalness: 0.4 }));
    b.position.set(-22, 1.6, -14); b.castShadow = true; scene.add(b);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.6), new THREE.MeshPhysicalMaterial({ color: 0x88aacc, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.4 }));
    glass.position.set(-22, 2.1, -11.88); scene.add(glass);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.5), new THREE.MeshBasicMaterial({ map: textTex('CONTROL ROOM // HUB-01', '#0B0C0E', '#FF6B1A', 700, 100, 56) }));
    s.position.set(-22, 3.5, -11.86); scene.add(s);
  })();

  /* Photo / QC building */
  (function () {
    const b = new THREE.Mesh(new THREE.BoxGeometry(14, 5.5, 9), new THREE.MeshStandardMaterial({ color: 0xd8d4ca, roughness: 0.85 }));
    b.position.set(26, 2.75, -13); b.castShadow = true; scene.add(b);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.3, 9.5), darkMatte()); roof.position.set(26, 5.65, -13); scene.add(roof);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.2), new THREE.MeshBasicMaterial({ map: textTex('QUALITY & PHOTO INSPECTION BAY', '#0B0C0E', '#2EE59D', 1200, 140, 60) }));
    sign.position.set(26, 4.4, -8.48); scene.add(sign);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.2), new THREE.MeshStandardMaterial({ color: 0x1a1d22, metalness: 0.4, roughness: 0.5 }));
    door.position.set(26, 1.6, -8.48); scene.add(door);
  })();

  /* Equipment cabinets & CCTV poles */
  for (let i = 0; i < 4; i++) {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.7), steel());
    cab.position.set(8 + i * 1.4, 1.05, 8.4); cab.castShadow = true; scene.add(cab);
  }
  const cctvMeshes = [];
  [[-24, 7.2, 12], [0, 8, 11], [16, 7, -10], [10, 6.4, 12]].forEach((p, i) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, p[1], 8), steel());
    pole.position.set(p[0], p[1] / 2, p[2]); scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.36), darkMatte());
    head.position.set(p[0], p[1], p[2]); scene.add(head); cctvMeshes.push(head);
  });

  function makePerson(x, z, rot) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.85, 8), new THREE.MeshStandardMaterial({ color: 0x242832, roughness: 0.8 }));
    body.position.y = 1.0; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), new THREE.MeshStandardMaterial({ color: 0xc4a882 }));
    head.position.y = 1.62; g.add(head);
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.22), new THREE.MeshStandardMaterial({ color: 0xd4a017 }));
    vest.position.y = 1.15; g.add(vest);
    g.position.set(x, 0, z); g.rotation.y = rot || 0; scene.add(g); return g;
  }
  makePerson(-20, -10, 0.4); makePerson(6, 7.2, -0.6); makePerson(18, 5, Math.PI);

  /* ---------- HEAVY-DUTY INDUSTRIAL CONVEYOR CHAIN SYSTEM (ENDS AT x = 19.5) ---------- */
  const conveyorTrack = new THREE.Group(); scene.add(conveyorTrack);
  /* Recessed bed structure: runs from x = -35.0 to x = 19.5 */
  const belt = new THREE.Mesh(new THREE.BoxGeometry(54.5, 0.18, 2.7), new THREE.MeshStandardMaterial({
    color: 0x14161a, metalness: 0.7, roughness: 0.45
  }));
  belt.position.set(-7.75, 0.09, 0); belt.receiveShadow = true; conveyorTrack.add(belt);

  /* Dual structural C-channel steel guide rails (end at x = 19.5) */
  [-1.38, 1.38].forEach(z => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(54.5, 0.28, 0.18), steel());
    rail.position.set(-7.75, 0.2, z); rail.castShadow = true; conveyorTrack.add(rail);
    /* High-vis yellow wear bar on rail top */
    const wearStrip = new THREE.Mesh(new THREE.BoxGeometry(54.5, 0.04, 0.12), yellowMark());
    wearStrip.position.set(-7.75, 0.35, z); conveyorTrack.add(wearStrip);
  });

  /* Articulated heavy-duty steel roller slats up to x = 18.2 */
  const beltStrips = [];
  for (let i = 0; i < 37; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 2.45), steel());
    s.position.set(-34 + i * 1.45, 0.21, 0); conveyorTrack.add(s); beltStrips.push(s);
  }

  /* Polyurethane wheel-guide centering rollers up to x = 18.0 */
  for (let x = -32; x <= 18.0; x += 3.6) {
    [-1.22, 1.22].forEach(z => {
      const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 12), yellowMark());
      roller.position.set(x, 0.26, z); conveyorTrack.add(roller);
    });
  }

  /* Conveyor drive head motor unit at line exit (x = 19.2) */
  const driveUnit = new THREE.Group(); driveUnit.position.set(19.2, 0.55, 1.95); conveyorTrack.add(driveUnit);
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.9, 14), new THREE.MeshStandardMaterial({ color: 0x1f3458, metalness: 0.7, roughness: 0.35 }));
  motor.rotation.z = Math.PI / 2; driveUnit.add(motor);
  const gearbox = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.65), steel());
  gearbox.position.set(0.6, 0, 0); driveUnit.add(gearbox);
  const sprocketGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.18, 14), yellowMark());
  sprocketGuard.position.set(0.6, 0, -0.42); driveUnit.add(sprocketGuard);

  /* Transition ramp plate bridging conveyor off-ramp to open floor */
  const rampPlate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 2.7), steel());
  rampPlate.position.set(19.65, 0.05, 0); conveyorTrack.add(rampPlate);

  /* ---------- SPACIOUS FINISH & VEHICLE INSPECTION BAY (x = 20.0 to 32.5) ---------- */
  const finishBay = new THREE.Group(); scene.add(finishBay);
  finishBay.position.set(25.5, 0, 0);

  // 1. Sleek, solid matte inspection deck pad (11.5m long x 7.2m wide) - NO rails, 360° open clearance
  const padMat = new THREE.MeshStandardMaterial({ color: 0x171a21, roughness: 0.94, metalness: 0.03 });
  const padMesh = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.024, 7.2), padMat);
  padMesh.position.set(0, 0.012, 0); padMesh.receiveShadow = true; finishBay.add(padMesh);

  // 2. High-contrast perimeter safety lines in Cars24 orange and clean corner L-markers
  const perimMat = new THREE.MeshBasicMaterial({ color: 0xFF6B1A });
  const cornerMat = new THREE.MeshBasicMaterial({ color: 0xF3F0E8 });
  [-3.6, 3.6].forEach(z => {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.03, 0.08), perimMat);
    edge.position.set(0, 0.026, z); finishBay.add(edge);
  });
  const endEdge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 7.2), perimMat);
  endEdge.position.set(5.75, 0.026, 0); finishBay.add(endEdge);

  // 4 Corner demarcation brackets & display bollards
  [[-5.5, -3.4], [-5.5, 3.4], [5.5, -3.4], [5.5, 3.4]].forEach(([bx, bz]) => {
    const cl1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.03, 0.12), cornerMat);
    cl1.position.set(bx + (bx < 0 ? 0.6 : -0.6), 0.028, bz); finishBay.add(cl1);
    const cl2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 1.2), cornerMat);
    cl2.position.set(bx, 0.028, bz + (bz < 0 ? 0.6 : -0.6)); finishBay.add(cl2);

    const bol = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 12), steel());
    bol.position.set(bx, 0.22, bz); finishBay.add(bol);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 12), new THREE.MeshBasicMaterial({ color: 0xFF6B1A }));
    cap.position.set(bx, 0.46, bz); finishBay.add(cap);
  });

  // Floor lettering plaque
  const deckPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 0.62),
    new THREE.MeshBasicMaterial({ map: textTex('CARS24 · FINISH & VEHICLE HANDOVER BAY', '#0B0C0E', '#FF6B1A', 1024, 128, 54) })
  );
  deckPlate.rotation.x = -Math.PI / 2;
  deckPlate.position.set(0, 0.028, 3.05);
  finishBay.add(deckPlate);

  // Soft architectural showroom spotlight illuminating the clean vehicle
  const finishSpot = new THREE.SpotLight(0xfff8ee, 1.2, 18, Math.PI / 3.4, 0.6, 1.2);
  finishSpot.position.set(25.5, 6.2, 0);
  finishSpot.target.position.set(25.5, 0.8, 0);
  scene.add(finishSpot);
  scene.add(finishSpot.target);

  /* Proximity sensor pedestals at each station with status indicator LEDs */
  const proxSensors = [];
  [-9.0, -4.0, 1.0, 6.0, 11.0, 16.0].forEach(sx => {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 8), steel());
    ped.position.set(sx - 0.4, 0.38, 1.6); conveyorTrack.add(ped);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshStandardMaterial({
      color: 0x2ee59d, emissive: 0x2ee59d, emissiveIntensity: 0.8
    }));
    eye.position.set(sx - 0.4, 0.75, 1.6); conveyorTrack.add(eye); proxSensors.push(eye);
  });

  /* Tow loop overlay & pusher */
  const convGroup = new THREE.Group(); convGroup.visible = false; scene.add(convGroup);
  const towLoop = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.05, 6, 18), new THREE.MeshStandardMaterial({ color: 0xff6b1a, metalness: 0.6, roughness: 0.4 }));
  towLoop.rotation.z = Math.PI / 2; towLoop.position.set(-30, 0.4, 1.6); convGroup.add(towLoop);
  const drive = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.8), steel());
  drive.position.set(-30, 0.4, 2.2); convGroup.add(drive);
  const pusher = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.5), new THREE.MeshStandardMaterial({ color: 0xff6b1a }));
  pusher.position.set(-8, 0.22, 0); convGroup.add(pusher);

  /* Pre-cycle pad */
  const triPad = new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, 4.2), new THREE.MeshStandardMaterial({ color: 0x242830, roughness: 0.75 }));
  triPad.position.set(-14, 0.05, 7); triPad.receiveShadow = true; scene.add(triPad);
  const triSign = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 0.7), new THREE.MeshBasicMaterial({ map: textTex('PRE-CYCLE PAD · 60s HEAVY SOIL', '#0B0C0E', '#E8B931', 800, 110, 52) }));
  triSign.position.set(-14, 2.1, 9.1); scene.add(triSign);

  /* ---------- 6 REFINED PRECISION INDUSTRIAL MACHINES (COLOR-CODED BY SECTION) ---------- */
  const STATIONS = {
    scan: { k: 'scan', x: -9.0, name: 'STATION 01 · 3D LiDAR PROFILER', col: '#38BDF8', cam: 'front' },
    ion: { k: 'ion', x: -4.0, name: 'STATION 02 · 25kV ION DE-STATIC', col: '#A855F7', cam: 'portal' },
    mist: { k: 'mist', x: 1.0, name: 'STATION 03 · POLYMER ENCAPSULATOR', col: '#2DD4BF', cam: 'portal' },
    tex: { k: 'tex', x: 6.0, name: 'STATION 04 · ROBOTIC TEXTILE ARRAY', col: '#FF6B1A', cam: 'follow' },
    air: { k: 'air', x: 11.0, name: 'STATION 05 · AIR-KNIFE TURBINE DRYER', col: '#F59E0B', cam: 'left' },
    bottom: { k: 'bottom', x: 8.5, name: 'STATION 07 · UNDERBODY HYDRO WASH', col: '#06B6D4', cam: 'portal' },
    gloss: { k: 'gloss', x: 16.0, name: 'STATION 06 · SiO₂ CERAMIC NANO-COATER', col: '#EC4899', cam: 'hero' }
  };

  const MACHINES = new THREE.Group(); scene.add(MACHINES);
  const portal = MACHINES;
  const ledStates = [];

  function makeStationArch(x, name, colHex, w, h, addOn) {
    const g = new THREE.Group();
    g.position.x = x;
    /* High-contrast industrial chassis column framework */
    const colMat = new THREE.MeshStandardMaterial({ color: 0x222731, metalness: 0.5, roughness: 0.55 });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x181c24, metalness: 0.6, roughness: 0.5 });
    const accentMat = new THREE.MeshStandardMaterial({ color: colHex, metalness: 0.3, roughness: 0.45 });
    const ledMat = new THREE.MeshStandardMaterial({ color: colHex, emissive: colHex, emissiveIntensity: 0.38 });
    const colG = new THREE.BoxGeometry(0.72, h, 0.75);

    [-w / 2, w / 2].forEach(z => {
      const col = new THREE.Mesh(colG, colMat);
      col.position.set(0, h / 2, z); col.castShadow = true; g.add(col);

      /* Structural steel mounting base with anchor bolts */
      const foot = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.25, 1.25), steel());
      foot.position.set(0, 0.125, z); g.add(foot);

      /* Section-colored front casing panel */
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.76, h * 0.48, 0.12), accentMat);
      plate.position.set(0.38, h * 0.58, z); g.add(plate);

      /* Linear vertical status beacon with controlled emissive */
      const ledStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, h * 0.88, 0.08),
        ledMat
      );
      ledStrip.position.set(0.44, h / 2, z); g.add(ledStrip);
    });

    /* Heavy cross-beam */
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, w + 0.9), beamMat);
    beam.position.set(0, h + 0.15, 0); beam.castShadow = true; g.add(beam);

    /* Section-colored beam trim bar */
    const beamTrim = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.12, w + 0.92), accentMat);
    beamTrim.position.set(0, h + 0.38, 0); g.add(beamTrim);

    /* Anti-glare OLED digital telemetry display panel in section color */
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(4.0, 0.62),
      new THREE.MeshBasicMaterial({ map: textTex(name, '#0A0C10', colHex, 1050, 160, 56) })
    );
    sign.position.set(0, h + 0.68, 0); g.add(sign);

    /* Framing plate behind sign in station accent color */
    const signFrame = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.72, 0.05), accentMat);
    signFrame.position.set(0, h + 0.68, -0.03); g.add(signFrame);

    /* Solid Floor Safety Zone Demarcation in Station Color (100% matte, no shininess) */
    const floorStripeMat = new THREE.MeshStandardMaterial({ color: colHex, roughness: 0.95, metalness: 0.0 });
    [-w / 2 - 0.25, w / 2 + 0.25].forEach(fz => {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.12), floorStripeMat);
      s.rotation.x = -Math.PI / 2; s.position.set(0, 0.016, fz); g.add(s);
    });
    [-2.3, 2.3].forEach(fx => {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.12, w + 0.62), floorStripeMat);
      s.rotation.x = -Math.PI / 2; s.position.set(fx, 0.016, 0); g.add(s);
    });

    if (addOn) addOn(g, w, h);
    MACHINES.add(g);
    return g;
  }

  /* Station 01: 3D Optical Profiler & LiDAR Arch (x = -9.0) — SECTION CYAN */
  makeStationArch(-9.0, 'STATION 01 · 3D LiDAR PROFILER', '#38BDF8', 4.8, 4.6, (g, w, h) => {
    /* Dual overhead spinning LiDAR pods */
    [-0.8, 0.8].forEach(lz => {
      const domeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.26, 18), steel());
      domeBase.position.set(0, h + 0.5, lz); g.add(domeBase);
      const domeCap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4 }));
      domeCap.position.set(0, h + 0.68, lz); g.add(domeCap);
    });

    /* 8 Multi-angle photogrammetry camera pods with anti-reflective glass lenses */
    [-w / 2 + 0.45, w / 2 - 0.45].forEach(z => {
      [1.8, 2.6, 3.4].forEach(y => {
        const pod = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.38), darkMatte());
        pod.position.set(0, y, z);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.12, 16), brushedAlum());
        lens.rotation.x = Math.PI / 2; lens.position.set(0, y, z + (z < 0 ? 0.22 : -0.22));
        const optic = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), new THREE.MeshStandardMaterial({
          color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.45
        }));
        optic.position.set(0, y, z + (z < 0 ? 0.28 : -0.28));
        g.add(pod); g.add(lens); g.add(optic);
      });
    });
    /* Downward laser projection slit in cyan */
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 3.6), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 }));
    slot.position.set(0, 0.02, 0); slot.rotation.x = -Math.PI / 2; g.add(slot);

    /* Side PLC diagnostic terminal pedestal with cyan OLED panel */
    const plc = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.4, 0.45), darkMatte());
    plc.position.set(0.6, 0.7, -w / 2 - 0.6); g.add(plc);
    const plcScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), new THREE.MeshBasicMaterial({
      map: textTex('LiDAR OK\n0.02mm', '#081018', '#38BDF8', 240, 160, 48)
    }));
    plcScreen.position.set(0.88, 1.05, -w / 2 - 0.6); plcScreen.rotation.y = Math.PI / 2; g.add(plcScreen);
  });

  /* Station 02: High-Voltage Ion De-Static Blade Gantry (x = -4.0) — SECTION VIOLET */
  makeStationArch(-4.0, 'STATION 02 · 25kV ION DE-STATIC', '#A855F7', 5.0, 4.8, (g, w, h) => {
    /* High-voltage step-up transformer cabinet with hazard markings */
    const trans = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.6, 0.9), new THREE.MeshStandardMaterial({ color: 0x271e36, roughness: 0.5 }));
    trans.position.set(0, 1.8, -w / 2 - 0.7); g.add(trans);
    const dangerSign = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), new THREE.MeshBasicMaterial({
      map: textTex('DANGER · 25kV', '#0B0C0E', '#A855F7', 280, 140, 52)
    }));
    dangerSign.position.set(0.44, 1.8, -w / 2 - 0.7); dangerSign.rotation.y = Math.PI / 2; g.add(dangerSign);

    /* Dual stainless steel ionized air distribution manifolds */
    [-w / 2 + 0.35, w / 2 - 0.35].forEach(z => {
      const manifold = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.2, 14), brushedAlum());
      manifold.position.set(0, 2.7, z); g.add(manifold);
      /* Tungsten ionizing emitter needles with controlled violet glow */
      const needleBar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.8, 0.04), new THREE.MeshStandardMaterial({
        color: 0xA855F7, emissive: 0x9333ea, emissiveIntensity: 0.45
      }));
      needleBar.position.set(0.14, 2.7, z); g.add(needleBar);
    });

    /* Overhead de-static ionization canopy bar */
    const canopyBar = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, w - 0.8), steel());
    canopyBar.position.set(0, h - 0.4, 0); g.add(canopyBar);
    for (let iz = -w / 2 + 0.8; iz <= w / 2 - 0.8; iz += 0.5) {
      const emitter = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0xA855F7, emissive: 0xA855F7, emissiveIntensity: 0.4 }));
      emitter.rotation.x = Math.PI; emitter.position.set(0, h - 0.52, iz); g.add(emitter);
    }
  });

  /* Station 03: Precision Ultrasonic Polymer Encapsulation Chamber (x = 1.0) — SECTION AQUA */
  makeStationArch(1.0, 'STATION 03 · POLYMER ENCAPSULATOR', '#2DD4BF', 5.2, 5.0, (g, w, h) => {
    /* Tempered glass isolation side shields with aqua frame */
    [-w / 2 + 0.22, w / 2 - 0.22].forEach(z => {
      const shield = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8), new THREE.MeshPhysicalMaterial({
        color: 0x2dd4bf, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.22
      }));
      shield.position.set(0, 2.3, z); g.add(shield);
      const shieldBorder = new THREE.Mesh(new THREE.BoxGeometry(3.84, 0.08, 0.06), new THREE.MeshStandardMaterial({ color: 0x2dd4bf, roughness: 0.4 }));
      shieldBorder.position.set(0, 4.2, z); g.add(shieldBorder);
    });
    /* Dual translucent polymer chemical storage tanks with fluid level indicators */
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.4, 16), new THREE.MeshStandardMaterial({
      color: 0x0f766e, metalness: 0.3, roughness: 0.35
    }));
    tank.position.set(0, 0.75, -w / 2 - 0.8); g.add(tank);
    const sightGlass = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.08), new THREE.MeshStandardMaterial({
      color: 0x2dd4bf, emissive: 0x14b8a6, emissiveIntensity: 0.45
    }));
    sightGlass.position.set(0.46, 0.75, -w / 2 - 0.8); g.add(sightGlass);

    /* Overhead arched stainless spray manifold with atomizing nozzles */
    const sprayArch = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.06, 8, 24, Math.PI), brushedAlum());
    sprayArch.position.set(0, 2.5, 0); sprayArch.rotation.y = Math.PI / 2; g.add(sprayArch);
  });

  /* Station 04: Robotic Multi-Axis Microfiber Detailing Array (x = 6.0) — SECTION CARS24 ORANGE */
  const station4 = makeStationArch(6.0, 'STATION 04 · ROBOTIC TEXTILE ARRAY', '#FF6B1A', 5.6, 6.0, (g, w, h) => {
    /* Overhead heavy articulated robotic carriage in signature orange */
    const carriage = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.45, 2.6), new THREE.MeshStandardMaterial({ color: 0x261608, roughness: 0.6 }));
    carriage.position.set(0, h - 0.45, 0); g.add(carriage);

    /* Telescoping pneumatic actuator cylinders */
    [-1.3, 1.3].forEach(z => {
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 12), steel());
      cyl.position.set(0, h - 0.95, z); g.add(cyl);
    });

    /* Rotating lateral microfiber drums on sides */
    [-w / 2 + 0.6, w / 2 - 0.6].forEach(z => {
      const brushArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.8), steel());
      brushArm.position.set(0, 2.4, z + (z < 0 ? 0.4 : -0.4)); g.add(brushArm);
      const brush = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 2.2, 16), new THREE.MeshStandardMaterial({
        color: 0xff6b1a, roughness: 0.8, metalness: 0.1
      }));
      brush.position.set(0, 2.4, z); g.add(brush);
    });

    /* Industrial 3-Tier Status Stacklight Tower (Red, Amber, Green) */
    const tower = new THREE.Group();
    ['#E5484D', '#E8B931', '#2EE59D'].forEach((col, i) => {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), new THREE.MeshStandardMaterial({
        color: col, emissive: col, emissiveIntensity: i === 2 ? 0.6 : 0.15
      }));
      l.position.y = i * 0.34; tower.add(l);
    });
    tower.position.set(0.5, h + 0.9, 2.7); g.add(tower);
    portal.userData.tower = tower;
  });

  /* Station 05: High-Velocity Aerodynamic Air-Knife Drying Gantry (x = 11.0) — SECTION SOLAR GOLD */
  makeStationArch(11.0, 'STATION 05 · AIR-KNIFE TURBINE DRYER', '#F59E0B', 5.0, 5.2, (g, w, h) => {
    /* Dual massive centrifugal turbine blowers mounted on gantry shoulders */
    [-w / 2 - 0.45, w / 2 + 0.45].forEach(z => {
      const volute = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.0, 18), new THREE.MeshStandardMaterial({
        color: 0xf59e0b, metalness: 0.5, roughness: 0.4
      }));
      volute.rotation.x = Math.PI / 2; volute.position.set(0, 3.4, z); g.add(volute);
      const grille = new THREE.Mesh(new THREE.CircleGeometry(0.54, 16), darkMatte());
      grille.position.set(0, 3.4, z + (z < 0 ? -0.51 : 0.51));
      if (z > 0) grille.rotation.y = Math.PI;
      g.add(grille);
    });

    /* Aerodynamic contoured air-knife wedge spanning overhead */
    const overheadKnife = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.35, w - 0.4), brushedAlum());
    overheadKnife.position.set(0, 3.6, 0); g.add(overheadKnife);

    /* Vertical side air-knife slit columns */
    [-w / 2 + 0.4, w / 2 - 0.4].forEach(z => {
      const sideKnife = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 0.18), brushedAlum());
      sideKnife.position.set(0, 2.0, z); g.add(sideKnife);
    });
  });

  /* Station 06: Automated Nano-Ceramic SiO2 Quartz Coater & IR Curing (x = 16.0) — SECTION QUARTZ ROSE */
  makeStationArch(16.0, 'STATION 06 · SiO₂ CERAMIC NANO-COATER', '#EC4899', 4.8, 4.8, (g, w, h) => {
    /* Overhead Radiant Quartz Infrared (IR) curing lamp bank */
    [-1.2, 0, 1.2].forEach(z => {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.8, 8), new THREE.MeshStandardMaterial({
        color: 0xf43f5e, emissive: 0xe11d48, emissiveIntensity: 0.45
      }));
      lamp.position.set(0, h - 0.5, z); lamp.rotation.z = Math.PI / 2; g.add(lamp);
    });

    /* Dual spectrophotometer gloss sensor heads on vertical masts */
    [-w / 2 + 0.35, w / 2 - 0.35].forEach(z => {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 12), steel());
      mast.position.set(0, 1.8, z); g.add(mast);
      const sensor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.32), new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.4 }));
      sensor.position.set(0, 2.4, z); g.add(sensor);
    });

    /* Ceramic fluid canister rack */
    const rack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.7), darkMatte());
    rack.position.set(0, 1.2, w / 2 + 0.65); g.add(rack);
    const canister = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.8, 12), brushedAlum());
    canister.position.set(0, 1.3, w / 2 + 0.65); g.add(canister);
  });

  /* Station 07: High-Pressure Underbody Hydro Wash System (x = 8.5) — SECTION OCEAN CYAN */
  makeStationArch(8.5, 'STATION 07 · UNDERBODY HYDRO WASH', '#06B6D4', 5.2, 4.6, (g, w, h) => {
    /* Recessed drain tray with perforated steel grate */
    const drainTray = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.15, w - 0.6), new THREE.MeshStandardMaterial({
      color: 0x1a2832, metalness: 0.7, roughness: 0.35
    }));
    drainTray.position.set(0, -0.05, 0); g.add(drainTray);
    /* Grate lines */
    for (let gz = -w/2 + 0.6; gz <= w/2 - 0.6; gz += 0.4) {
      const gLine = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.03, 0.05), new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.6, metalness: 0.4 }));
      gLine.position.set(0, 0.06, gz); g.add(gLine);
    }

    /* Floor-mounted high-pressure spray nozzle array — upward facing */
    const nozzlePositions = [[-1.8, 0], [-0.9, -0.8], [-0.9, 0.8], [0, 0], [0.9, -0.8], [0.9, 0.8], [1.8, 0]];
    nozzlePositions.forEach(([nx, nz]) => {
      const nozzleBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.2, 12), steel());
      nozzleBase.position.set(nx, 0.12, nz); g.add(nozzleBase);
      const nozzleTip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 8), new THREE.MeshStandardMaterial({
        color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.5
      }));
      nozzleTip.position.set(nx, 0.28, nz); g.add(nozzleTip);
    });

    /* Recirculation pump enclosure */
    const pumpBox = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.6), darkMatte());
    pumpBox.position.set(0, 0.5, -w/2 - 0.7); g.add(pumpBox);
    const pumpLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.28), new THREE.MeshBasicMaterial({
      map: textTex('RECIRC PUMP', '#0B0C0E', '#06B6D4', 280, 140, 52)
    }));
    pumpLabel.position.set(0.37, 0.55, -w/2 - 0.7); pumpLabel.rotation.y = Math.PI / 2; g.add(pumpLabel);

    /* Side-mounted pressure gauge */
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 16), new THREE.MeshStandardMaterial({
      color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 0.3
    }));
    gauge.rotation.x = Math.PI / 2; gauge.position.set(0, 1.2, -w/2 - 0.35); g.add(gauge);

    /* Overhead splash guard canopy */
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, w - 1.0), new THREE.MeshStandardMaterial({
      color: 0x0e7490, metalness: 0.5, roughness: 0.4, transparent: true, opacity: 0.65
    }));
    canopy.position.set(0, 1.6, 0); g.add(canopy);
  });

  /* Bottom cleaner spray visuals (upward jets) */
  const bottomJets = new THREE.Group(); scene.add(bottomJets); bottomJets.visible = false;
  const jetMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let j = 0; j < 7; j++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.2, 8), jetMat.clone());
    const jx = [-1.8, -0.9, -0.9, 0, 0.9, 0.9, 1.8][j];
    const jz = [0, -0.8, 0.8, 0, -0.8, 0.8, 0][j];
    cone.position.set(jx, 0.7, jz);
    bottomJets.add(cone);
  }

  const portalLight = new THREE.PointLight(0xff6b1a, 0, 24); portalLight.position.set(6.0, 3.2, 0); scene.add(portalLight);

  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.18), new THREE.MeshStandardMaterial({ color: 0x1a1d22, emissive: 0x000000 }));
    m.position.set(6.0, 6.05, -2.4 + i * 0.53); scene.add(m); ledStates.push(m);
  }

  const curtains = [];
  [-12.5, 18.5].forEach(x => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 2.6), new THREE.MeshBasicMaterial({ color: 0xe5484d, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
    p.position.set(x, 1.4, 0); p.rotation.y = Math.PI / 2; scene.add(p); curtains.push(p);
  });
  /* module labels as sprites along gantry */
  function makeLabel(text, y) {
    const t = textTex(text, 'rgba(11,12,14,0.85)', '#FF6B1A', 512, 96, 48);
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, opacity: 0.9, depthWrite: false }));
    m.scale.set(1.6, 0.3, 1); m.position.set(-2.6, y, 3.15); engGroup.add(m); return m;
  }

  /* QC inspection arch */
  const qcArch = new THREE.Group(); scene.add(qcArch); qcArch.position.x = LANE.qc;
  [-2.2, 2.2].forEach(z => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.36, 4.2, 0.38), steel()); c.position.set(0, 2.1, z); c.castShadow = true; qcArch.add(c);
  });
  const qcb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.38, 4.9), steel()); qcb.position.set(0, 4.2, 0); qcArch.add(qcb);
  const qcs = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.55), new THREE.MeshBasicMaterial({ map: textTex('QC · AUTOMATED SCAN', '#0B0C0E', '#2EE59D', 700, 140, 68) }));
  qcs.position.set(0, 4.75, 0); qcArch.add(qcs);
  const qcBeam = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.4), new THREE.MeshBasicMaterial({ color: 0x2ee59d, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  qcBeam.rotation.y = Math.PI / 2; qcBeam.position.set(LANE.qc, 1.8, 0); scene.add(qcBeam);

  /* ---------- cars ---------- */
  const CAR_TYPES = {
    hatchback: { len: 3.6, cabL: 1.7, cabH: 0.62, cabX: -0.32, h: 0.82 },
    sedan: { len: 4.3, cabL: 1.9, cabH: 0.60, cabX: -0.15, h: 0.85 },
    suv: { len: 4.2, cabL: 2.2, cabH: 0.78, cabX: -0.10, h: 1.00 }
  };
  const PALETTE = [0xf0f2f4, 0xc9ced6, 0x8a929e, 0xb02430, 0x1f4f9a];
  function dirtCanvas(intensity) {
    const S = 512;
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const x = c.getContext('2d'); x.clearRect(0, 0, S, S);

    /* Heavy road grime & mud baseline — heavier at bottom for rocker panels */
    const dustGrad = x.createLinearGradient(0, 0, 0, S);
    dustGrad.addColorStop(0, 'rgba(54,40,26,' + (0.55 * intensity) + ')');
    dustGrad.addColorStop(0.45, 'rgba(68,50,32,' + (0.75 * intensity) + ')');
    dustGrad.addColorStop(1, 'rgba(38,26,16,' + (0.95 * intensity) + ')');
    x.fillStyle = dustGrad; x.fillRect(0, 0, S, S);

    /* Coarse road mud splatters and thick grit clusters */
    const nClusters = Math.floor(45 * intensity);
    for (let i = 0; i < nClusters; i++) {
      const cx = rnd(10, S - 10), cy = rnd(20, S - 10), r = rnd(5, 18);
      x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2);
      x.fillStyle = 'rgba(' + (32 + rnd(-6, 8) | 0) + ',' + (22 + rnd(-5, 6) | 0) + ',' + (14 + rnd(-4, 5) | 0) + ',' + rnd(0.85, 0.98) + ')';
      x.fill();
      /* Satellite droplet splash arcs */
      for (let j = 0; j < 6; j++) {
        const a = rnd(0, Math.PI * 2), d = r + rnd(3, 14);
        x.beginPath(); x.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rnd(1.2, 3.5), 0, Math.PI * 2);
        x.fillStyle = 'rgba(28,18,10,' + rnd(0.75, 0.95) + ')'; x.fill();
      }
    }

    /* Fine abrasive grit and road dust speckles */
    const nSpeckle = Math.floor(750 * intensity);
    for (let i = 0; i < nSpeckle; i++) {
      x.beginPath(); x.arc(rnd(0, S), rnd(0, S), rnd(0.8, 3.0), 0, Math.PI * 2);
      x.fillStyle = 'rgba(' + (48 + rnd(-10, 12) | 0) + ',' + (36 + rnd(-8, 10) | 0) + ',' + (22 + rnd(-6, 8) | 0) + ',' + rnd(0.65, 0.95) + ')';
      x.fill();
    }

    /* Dried water droplet spots with dark mineral salt perimeter rings */
    const nWater = Math.floor(36 * intensity);
    for (let i = 0; i < nWater; i++) {
      const wx = rnd(12, S - 12), wy = rnd(12, S - 12), wr = rnd(3.5, 9);
      x.beginPath(); x.arc(wx, wy, wr, 0, Math.PI * 2);
      x.strokeStyle = 'rgba(34,24,14,' + rnd(0.75, 0.95) + ')'; x.lineWidth = 1.8; x.stroke();
      x.beginPath(); x.arc(wx, wy, wr * 0.7, 0, Math.PI * 2);
      x.fillStyle = 'rgba(54,42,26,' + rnd(0.28, 0.5) + ')'; x.fill();
    }

    /* Wiper blade arc streak patterns across windshield area */
    x.strokeStyle = 'rgba(28,18,10,' + (0.7 * intensity) + ')'; x.lineWidth = 4;
    x.beginPath(); x.arc(S * 0.5, S * 0.8, S * 0.45, Math.PI * 1.15, Math.PI * 1.85); x.stroke();

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function makeWheelP(isDirty) {
    const w = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.13, 10, 22), new THREE.MeshStandardMaterial({
      color: isDirty ? 0x181512 : 0x0c0e14, roughness: 0.92
    }));
    w.add(tyre);
    const rimMat = new THREE.MeshStandardMaterial({
      color: isDirty ? 0x726c62 : 0xd8dde8,
      metalness: isDirty ? 0.45 : 1.0,
      roughness: isDirty ? 0.65 : 0.22
    });
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.2, 18), rimMat);
    rim.rotation.x = Math.PI / 2; w.add(rim);
    const sp = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.05), rimMat);
      b.rotation.z = i * Math.PI * 2 / 5; b.position.z = 0.09; sp.add(b);
    }
    w.add(sp); w.userData.sp = sp; w.userData.rimMat = rimMat; return w;
  }

  function makeCarP(type, color, dirtLevel) {
    const cfg = CAR_TYPES[type]; const car = new THREE.Group(); car.userData.type = type;
    const isDirty = dirtLevel > 0.45;
    const paint = new THREE.MeshPhysicalMaterial({
      color,
      metalness: isDirty ? 0.35 : 0.85,
      roughness: isDirty ? 0.68 : 0.16,
      clearcoat: isDirty ? 0.08 : 0.95,
      clearcoatRoughness: isDirty ? 0.45 : 0.05,
      envMapIntensity: isDirty ? 0.65 : 1.45
    });
    car.userData.paint = paint;
    car.userData.baseColor = color;
    const L = cfg.len, H = cfg.h;
    const body = new THREE.Mesh(new THREE.BoxGeometry(L, H * 0.62, 1.72), paint); body.position.y = 0.36 + H * 0.31; body.castShadow = true; car.add(body);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(L * 0.24, H * 0.16, 1.66), paint); hood.position.set(L * 0.36, 0.36 + H * 0.66, 0); hood.rotation.z = -0.06; car.add(hood);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(L * 0.2, H * 0.16, 1.66), paint); boot.position.set(-L * 0.38, 0.36 + H * 0.63, 0); boot.rotation.z = 0.05; car.add(boot);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(cfg.cabL, cfg.cabH, 1.58), paint); cab.position.set(cfg.cabX, 0.36 + H * 0.62 + cfg.cabH * 0.52, 0); cab.castShadow = true; car.add(cab);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x121e2c,
      metalness: 0.2,
      roughness: isDirty ? 0.18 : 0.04,
      transmission: 0.55,
      transparent: true,
      opacity: 0.88,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      side: THREE.DoubleSide
    });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(cfg.cabL * 0.94, cfg.cabH * 0.60, 1.60), glassMat);
    glass.position.copy(cab.position); glass.position.y += cfg.cabH * 0.06; car.add(glass);

    function makeQuad(x1, y1, z1, x2, y2, z2) {
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array([
        x1, y1, z1,
        x1, y1, -z1,
        x2, y2, z2,
        x2, y2, -z2
      ]);
      const idx = [1, 3, 2, 1, 2, 0];
      const uvs = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    }

    /* Front Windshield */
    const xTop = cfg.cabX + cfg.cabL * 0.48;
    const yTop = cab.position.y + cfg.cabH * 0.48;
    const xBot = cfg.cabX + cfg.cabL * 0.5 + 0.42;
    const yBot = 0.36 + H * 0.70;
    const zTop = 0.72;
    const zBot = 0.77;

    const wsGeom = makeQuad(xTop, yTop, zTop, xBot, yBot, zBot);
    const ws = new THREE.Mesh(wsGeom, glassMat);
    car.add(ws);

    /* A-Pillars */
    [-1, 1].forEach(zs => {
      const pLen = Math.hypot(xTop - xBot, yTop - yBot);
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, pLen, 0.08), paint);
      pillar.position.set((xTop + xBot) / 2, (yTop + yBot) / 2, zs * (zTop + zBot) / 2);
      pillar.rotation.z = Math.atan2(xBot - xTop, yTop - yBot);
      car.add(pillar);
    });

    /* Windshield wiper cowl */
    const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, zBot * 2), new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.9 }));
    cowl.position.set(xBot + 0.03, yBot - 0.01, 0);
    car.add(cowl);

    /* Rear Window */
    const xrTop = cfg.cabX - cfg.cabL * 0.48;
    const yrTop = cab.position.y + cfg.cabH * 0.48;
    const xrBot = cfg.cabX - cfg.cabL * 0.5 - (type === 'hatchback' ? 0.16 : 0.40);
    const yrBot = 0.36 + H * (type === 'hatchback' ? 0.62 : 0.68);
    const rearGeom = makeQuad(xrBot, yrBot, zBot, xrTop, yrTop, zTop);
    const rearGlass = new THREE.Mesh(rearGeom, glassMat);
    car.add(rearGlass);

    const bmat = new THREE.MeshStandardMaterial({ color: 0x232733, roughness: 0.7 });
    const fb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 1.76), bmat); fb.position.set(L / 2 + 0.04, 0.42, 0); car.add(fb);
    const rb = fb.clone(); rb.position.x = -L / 2 - 0.04; car.add(rb);
    [1, -1].forEach(zs => { const mr = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.09), paint); mr.position.set(cfg.cabX + cfg.cabL / 2 + 0.05, 0.36 + H * 0.66, zs * 0.92); car.add(mr); });
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.4), new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffedb0, emissiveIntensity: 0.7 }));
    [1, -1].forEach(zs => { const h = hl.clone(); h.position.set(L / 2 + 0.05, 0.36 + H * 0.5, zs * 0.55); car.add(h); });
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.42), new THREE.MeshStandardMaterial({ color: 0xd23a3a, emissive: 0xb32020, emissiveIntensity: 0.6 }));
    [1, -1].forEach(zs => { const t = tl.clone(); t.position.set(-L / 2 - 0.05, 0.36 + H * 0.52, zs * 0.52); car.add(t); });

    /* Wheels with dirt support */
    const wheels = []; const wx = L * 0.34;
    [[wx, 0.9], [wx, -0.9], [-wx, 0.9], [-wx, -0.9]].forEach(([x, z]) => {
      const w = makeWheelP(isDirty); w.position.set(x, 0.34, z); car.add(w); wheels.push(w);
    });
    car.userData.wheels = wheels;

    /* Distinct dirt overlay meshes for comprehensive coverage */
    const zones = {};
    function dz(name, mesh) {
      const map = dirtCanvas(1);
      mesh.material = (window.SRP && SRP.dirtMaterial)
        ? SRP.dirtMaterial(map, dirtLevel)
        : new THREE.MeshStandardMaterial({ color: 0x4a3722, roughness: 1, transparent: true, opacity: dirtLevel, alphaMap: map, depthWrite: false });
      mesh.material.opacity = dirtLevel;
      car.add(mesh); zones[name] = mesh.material; return mesh;
    }
    dz('roof', (() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(cfg.cabL * 0.95, 1.5), null); m.position.set(cfg.cabX, cab.position.y + cfg.cabH / 2 + 0.012, 0); m.rotation.x = -Math.PI / 2; return m; })());
    dz('hood', (() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.3, 1.58), null); m.position.set(L * 0.34, 0.36 + H * 0.76, 0); m.rotation.x = -Math.PI / 2; return m; })());
    dz('front', (() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.68, H * 0.6), null); m.position.set(L / 2 + 0.065, 0.36 + H * 0.34, 0); m.rotation.y = Math.PI / 2; return m; })());
    dz('left', (() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.94, H * 0.6), null); m.position.set(0, 0.36 + H * 0.3, 0.875); return m; })());
    dz('right', (() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.94, H * 0.6), null); m.position.set(0, 0.36 + H * 0.3, -0.875); m.rotation.y = Math.PI; return m; })());
    dz('rear', (() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.7, H * 0.62), null); m.position.set(-L / 2 - 0.065, 0.36 + H * 0.36, 0); m.rotation.y = -Math.PI / 2; return m; })());
    dz('wheels', (() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.9, 0.34), null); m.position.set(0, 0.22, 0.885); return m; })());

    car.userData.zones = zones; car.userData.dirt = dirtLevel;

    /* Clean industrial plate */
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.14), new THREE.MeshBasicMaterial({ map: textTex('· RESET ·', '#F3F0E8', '#0B0C0E', 256, 80, 48) }));
    plate.position.set(L / 2 + 0.12, 0.42, 0); plate.rotation.y = Math.PI / 2; car.add(plate);

    /* Contact shadow blob */
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(L * 0.95, 1.55),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })
    );
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; car.add(blob);

    if (window.SRP && SRP.beadMaterial) {
      const bm = SRP.beadMaterial();
      const planes = [];
      function beadPlane(w, h, x, y, z, rx, ry) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), bm);
        m.position.set(x, y, z);
        if (rx) m.rotation.x = rx;
        if (ry) m.rotation.y = ry;
        m.visible = false;
        car.add(m); planes.push(m);
      }
      beadPlane(L * 0.3, 1.5, L * 0.34, 0.36 + H * 0.77, 0, -Math.PI / 2, 0);
      beadPlane(cfg.cabL * 0.9, 1.4, cfg.cabX, cab.position.y + cfg.cabH / 2 + 0.014, 0, -Math.PI / 2, 0);
      car.userData.beadMat = bm;
      car.userData.beadPlanes = planes;
    }
    car.userData.lastX = 0;
    return car;
  }

  const queueCars = [];
  const heroTypes = ['sedan', 'hatchback', 'suv', 'sedan', 'hatchback'];
  for (let i = 0; i < 4; i++) {
    const c = makeCarP(heroTypes[i % 3], PALETTE[i % PALETTE.length], rnd(0.88, 0.99));
    c.position.set(LANE.qStart - i * 5.6, 0, 0); scene.add(c); queueCars.push(c);
  }
  for (let i = 0; i < 3; i++) {
    const c = makeCarP(['hatchback', 'suv', 'sedan'][i], PALETTE[(i + 2) % PALETTE.length], rnd(0.90, 0.99));
    c.position.set(-26 + i * 6, 0, 11); c.rotation.y = Math.PI / 2; scene.add(c);
  }

  /* ---------- portal FX hardware ---------- */
  const scanPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.2), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  scanPlane.rotation.y = Math.PI / 2; scanPlane.visible = false; scene.add(scanPlane);
  const scanBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(4.6, 2.1, 2.1)), new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.5 }));
  scanBox.visible = false; scene.add(scanBox);
  const heatPatches = [];
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), new THREE.MeshBasicMaterial({ color: 0xff6b1a, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(p); heatPatches.push(p);
  }
  const ionBar = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.14, 0.14), new THREE.MeshStandardMaterial({ color: 0x1a1d22, emissive: 0x9B8FD4, emissiveIntensity: 0 }));
  ionBar.position.set(-4.0, 3.6, 0); scene.add(ionBar);
  for (let i = 0; i < 11; i++) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.11, 6), new THREE.MeshStandardMaterial({ color: 0xc4b5fd, emissive: 0x9B8FD4, emissiveIntensity: 0.5 }));
    t.position.set(-2 + i * 0.4, -0.1, 0); t.rotation.x = Math.PI; ionBar.add(t);
  }
  const mistPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.4, 10), steel());
  mistPipe.rotation.z = Math.PI / 2; mistPipe.position.set(1.0, 3.95, 0); scene.add(mistPipe);
  const mistCones = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.9, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0x8ed3fb, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    c.position.set(-1.8 + i * 0.6, 2.95, 0); c.rotation.x = Math.PI; mistCones.add(c);
  }
  mistCones.position.set(1.0, 0, 0);
  scene.add(mistCones);
  const texMat = new THREE.MeshStandardMaterial({ color: 0xff6b1a, roughness: 0.92, emissive: 0x76340c, emissiveIntensity: 0.25 });
  const roofArray = new THREE.Group();
  (function () {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.16, 2.0), darkMatte()); roofArray.add(frame);
    const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.4, 10), steel()); piston.position.y = 1.3; roofArray.add(piston);
    roofArray.userData.pads = [];
    for (let ix = 0; ix < 6; ix++) for (let iz = 0; iz < 3; iz++) {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.1, 0.58), texMat);
      pad.position.set(-1.7 + ix * 0.66, -0.16, -0.62 + iz * 0.62);
      roofArray.add(pad); roofArray.userData.pads.push(pad);
    }
  })();
  roofArray.position.set(6.0, 5.1, 0); roofArray.visible = false; scene.add(roofArray);
  const sideArrays = [];
  [1, -1].forEach(zs => {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.5, 0.14), darkMatte()); frame.position.y = 1.05; g.add(frame);
    g.userData.pads = [];
    for (let ix = 0; ix < 6; ix++) for (let iy = 0; iy < 2; iy++) {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.1), texMat);
      pad.position.set(-1.6 + ix * 0.64, 0.72 + iy * 0.68, zs * -0.12); g.add(pad); g.userData.pads.push(pad);
    }
    g.position.set(6.0, 0, zs * 3.0); g.visible = false; scene.add(g); sideArrays.push({ g, zs });
  });
  const airUnits = [];
  [1, -1].forEach(zs => {
    const u = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.26, 1.5), steel()); u.add(body);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.6), new THREE.MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    sheet.position.y = -0.95; sheet.rotation.x = 0.25; u.add(sheet);
    u.position.set(11.0, 3.15, zs * 2.15); u.rotation.z = zs * 0.5; u.visible = false; scene.add(u); airUnits.push({ u, zs, sheet });
  });
  const glossRing = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.05, 8, 36), new THREE.MeshBasicMaterial({ color: 0xD478A0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  glossRing.rotation.y = Math.PI / 2; glossRing.position.set(16.0, 1.2, 0); glossRing.visible = false; scene.add(glossRing);

  function mkPts(n, color, size) {
    if (window.SRP && SRP.makeCloud) return SRP.makeCloud(scene, n, color, size);
    const g = new THREE.BufferGeometry(); const p = new Float32Array(n * 3);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(pts); return { pts, p, g, n };
  }
  const P_ion = mkPts(720, 0xc4b5fd, 0.07), P_mist = mkPts(1800, 0x8ed3fb, 0.055), P_air = mkPts(2200, 0xfde68a, 0.05), P_spark = mkPts(480, 0xf4d48a, 0.06);
  [P_ion, P_mist, P_air, P_spark].forEach(p => p.pts.visible = false);
  const ionStreams = (window.SRP && SRP.makeStreams) ? SRP.makeStreams(scene, 12, 28, 0xc4b5fd) : [];
  const SEED = []; for (let i = 0; i < 220; i++) SEED.push({ a: Math.random(), b: Math.random(), c: Math.random(), d: Math.random() });
  function drawPts(P, vis, fn, op) {
    if (lofx) vis *= 0.45;
    P.pts.visible = vis > 0.02; if (vis <= 0.02) return;
    for (let i = 0; i < P.n; i++) { const s = SEED[i % SEED.length]; const v = fn(i, s); P.p[i * 3] = v[0]; P.p[i * 3 + 1] = v[1]; P.p[i * 3 + 2] = v[2]; }
    P.g.attributes.position.needsUpdate = true; P.pts.material.opacity = clamp(op, 0, 1);
  }

  /* engineering helpers */
  const engGroup = new THREE.Group(); scene.add(engGroup);
  function dimLine(x1, y1, z1, x2, y2, z2) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)]);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffd200, transparent: true, opacity: 0.7 }));
    engGroup.add(l); return l;
  }
  ['M1 SCAN', 'M2 ION', 'M3 MIST', 'M4 TEXTILE', 'M5 AIR-KNIFE', 'M6 GLOSS'].forEach((t, i) => makeLabel(t, 4.8 - i * 0.38));
  dimLine(-1.3, 0.04, -1.3, 1.3, 0.04, -1.3);
  dimLine(0, 0.04, 0, 0, 5.9, 0);
  dimLine(-2.4, 3, 0, 2.4, 3, 0);
  const centerLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-36, 0.03, 0), new THREE.Vector3(36, 0.03, 0)]),
    new THREE.LineDashedMaterial({ color: 0xffd200, dashSize: 0.4, gapSize: 0.25, transparent: true, opacity: 0.5 })
  );
  centerLine.computeLineDistances(); engGroup.add(centerLine);

  function projectTag(text, world, id) {
    const v = world.clone().project(camera);
    let el = document.getElementById(id);
    if (!el) { el = document.createElement('div'); el.className = 'eng-tag'; el.id = id; $('engLabels').appendChild(el); }
    el.textContent = text;
    const x = (v.x * 0.5 + 0.5) * canvas.clientWidth;
    const y = (-v.y * 0.5 + 0.5) * canvas.clientHeight;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.style.display = (v.z > 1 || v.z < -1) ? 'none' : 'block';
  }

  /* ---------- narrator / HUD ---------- */
  function setNarr(no, noBg, nm, ds, edge) {
    $('nNo').textContent = no; $('nNo').style.background = noBg;
    $('nNm').textContent = nm; $('nDs').textContent = ds;
    $('narr').style.borderLeftColor = edge || noBg;
  }
  function fmtT(t) { return (t < 10 ? '0' : '') + t.toFixed(2); }

  /* ---------- flow ---------- */
  const PRE_VISUAL = 6;
  let logged = {};
  function fireLogOnce(key, msg, lv) { if (logged[key]) return; logged[key] = true; log(msg, lv); }

  function nextHero() {
    if (queueCars.length === 0) {
      for (let i = 0; i < 3; i++) {
        const c = makeCarP(heroTypes[i % 3], PALETTE[(carsToday + i) % PALETTE.length], rnd(0.82, 0.97));
        c.position.set(LANE.qStart - (i + 1) * 5.6, 0, 0); scene.add(c); queueCars.push(c);
      }
    }
    hero = queueCars.shift();
    const spec = VEHICLES[vehPick];
    /* tint hero toward selected vehicle if idle spawn */
    hero.userData.id = spec.label;
    $('stVeh').textContent = spec.label;
    heavyCar = heavyNext; heavyNext = false; $('heavyBtn').classList.remove('on'); $('heavyBtn').setAttribute('aria-pressed', 'false');
    if (heavyCar) { Object.values(hero.userData.zones).forEach(m => setDirt(m, 0.97)); hero.userData.dirt = 0.97; }
    log('Vehicle detected · ' + spec.label + (heavyCar ? ' · heavy soil' : ''), 'ok');
  }

  function startFlow() {
    if (estop) return;
    if (activeFault && activeFault.id === 'oversize') {
      $('faultBanner').hidden = false;
      log('Cycle blocked · oversize vehicle', 'fault');
      setNarr('REJECT', '#E5484D', 'Oversize — will not enter', 'Scan envelope exceeds portal gauge. Divert to manual bay. The 22.6s line stays clear.', '#E5484D');
      return;
    }
    introOn = false; $('intro').classList.add('hide');
    if (cineOn) endCine(false);
    if (sfx) { sfx.unlock(); if (sfxOn) sfx.startHum(); }
    if (G) { G.killTweensOf(camera.position); G.killTweensOf('#intro'); camTweening = false; }
    if (flow === 'idle') { nextHero(); flow = 'queueAdv'; flowT = 0; logged = {}; convRun = true; log('Cycle start · auto conveyor', 'ok'); }
    paused = false; updatePauseBtn();
  }
  function resetFlow(keepQueue) {
    soloMod = null;
    soloTimer = 0;
    soloAutoStep = false;
    soloStepIdx = -1;
    const sh = $('soloHud');
    if (sh) sh.hidden = true;
    document.querySelectorAll('.btn-solo-tab').forEach(b => b.classList.remove('on'));
    paused = false; estop = false; document.body.classList.remove('estop');
    $('estopBtn').classList.remove('armed'); $('stSystem').className = 'v live'; $('stSystem').innerHTML = '<i class="dot"></i>ONLINE';
    autoOrbit360 = false;
    inspectDirtyState = false;
    if ($('inspectBar')) $('inspectBar').style.display = 'none';
    $('splitReveal').classList.remove('on');
    updateInspectUI();
    flow = 'idle'; flowT = 0; cycleT = 0; preT = 0; logged = {}; convRun = false; conveyorForced = false;
    $('doneCard').classList.remove('on'); $('quote').classList.remove('on'); quoteOn = false;
    if (hero) { scene.remove(hero); hero = null; }
    $('stVeh').textContent = '—'; $('stCycle').textContent = 'IDLE';
    $('passBadge').style.display = 'none';
    $('cqsBig').textContent = '—';
    QZONES.forEach((_, i) => { $('zf' + i).style.width = '0'; $('zv' + i).textContent = '—'; });
    setNarr('READY', '#FF6B1A', 'Surface Reset Portal', 'The bottleneck was not speed. It was sequence. Press START CYCLE — seven modules fire as one overlapped field for 22.6 seconds.');
    updatePauseBtn();
    log('Reset · twin returned to idle', 'warn');
  }
  function togglePause() {
    if (flow === 'idle' || estop) return;
    paused = !paused; updatePauseBtn();
    log(paused ? 'Paused' : 'Resumed', 'info');
  }
  function updatePauseBtn() { $('pauseBtn').textContent = paused ? 'Resume' : 'Pause'; $('pauseBtn').classList.toggle('on', paused); }
  function doEstop() {
    estop = true; paused = true; convRun = false; document.body.classList.add('estop');
    $('estopBtn').classList.add('armed');
    $('stSystem').className = 'v fault'; $('stSystem').textContent = 'E-STOP';
    log('EMERGENCY STOP', 'fault');
    fireSfx('estop');
  }

  $('intro').style.pointerEvents = 'auto';
  $('intro').onclick = () => { introOn = false; $('intro').classList.add('hide'); };
  $('runBtn').onclick = () => startFlow();
  $('pauseBtn').onclick = () => togglePause();
  $('resetBtn').onclick = () => resetFlow();
  $('replayBtn').onclick = () => { resetFlow(); startFlow(); };
  $('doneReplay').onclick = () => { $('doneCard').classList.remove('on'); if ($('inspectBar')) $('inspectBar').style.display = 'none'; resetFlow(); startFlow(); };
  if ($('doneDismiss')) $('doneDismiss').onclick = () => { $('doneCard').classList.remove('on'); };
  if ($('doneCloseBtn')) $('doneCloseBtn').onclick = () => { $('doneCard').classList.remove('on'); };
  if ($('doneInspect')) $('doneInspect').onclick = () => { $('doneCard').classList.remove('on'); };
  if ($('doneToggle3D')) $('doneToggle3D').onclick = () => { setInspectState(!inspectDirtyState); };
  if ($('doneCompare')) $('doneCompare').onclick = () => { $('doneCard').classList.remove('on'); openSplit(); };

  if ($('ibToggle')) $('ibToggle').onclick = () => { setInspectState(!inspectDirtyState); };
  if ($('ibSlider')) $('ibSlider').onclick = () => { openSplit(); };
  if ($('ibOrbit')) $('ibOrbit').onclick = () => { autoOrbit360 = !autoOrbit360; log(autoOrbit360 ? '360° Inspection orbit active' : 'Inspection orbit paused', 'info'); };
  if ($('ibReplay')) $('ibReplay').onclick = () => { $('doneCard').classList.remove('on'); if ($('inspectBar')) $('inspectBar').style.display = 'none'; resetFlow(); startFlow(); };
  if ($('split3D')) $('split3D').onclick = () => { $('splitReveal').classList.remove('on'); };

  /* mode / speed / vehicle */
  $('modeSeg').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    mode = b.dataset.mode;
    [...$('modeSeg').children].forEach(x => x.classList.toggle('on', x === b));
    document.body.classList.toggle('manual', mode === 'manual');
    log('Mode · ' + mode, 'info');
  };
  $('spdSeg').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    simSpeed = +b.dataset.s;
    [...$('spdSeg').children].forEach(x => x.classList.toggle('on', x === b));
  };
  $('vehSeg').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    vehPick = b.dataset.v;
    [...$('vehSeg').children].forEach(x => x.classList.toggle('on', x === b));
  };
  modCards.addEventListener('click', e => {
    const b = e.target.closest('[data-mod]'); if (!b) return;
    const k = b.dataset.mod; manualOn[k] = !manualOn[k];
    b.classList.toggle('on', manualOn[k]);
    log('Manual force ' + k + ' · ' + (manualOn[k] ? 'ON' : 'OFF'), 'warn');
  });

  $('cvStart').onclick = () => { convRun = true; conveyorForced = true; };
  $('cvStop').onclick = () => { convRun = false; conveyorForced = true; };
  $('cvSpd').oninput = () => { convSpd = +$('cvSpd').value; };
  $('cvFwd').onclick = () => { convDir = 1; $('cvFwd').classList.add('on'); $('cvRev').classList.remove('on'); };
  $('cvRev').onclick = () => { convDir = -1; $('cvRev').classList.add('on'); $('cvFwd').classList.remove('on'); };

  function setToggle(el, on) { el.classList.toggle('on', on); el.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  $('engTog').onclick = () => { engineering = !engineering; setToggle($('engTog'), engineering); $('engLabels').hidden = !engineering; engGroup.visible = engineering; };
  $('convTog').onclick = () => { convOverlay = !convOverlay; setToggle($('convTog'), convOverlay); convGroup.visible = convOverlay; };
  engGroup.visible = engineering; $('engLabels').hidden = !engineering;

  $('heavyBtn').onclick = () => { heavyNext = !heavyNext; setToggle($('heavyBtn'), heavyNext); };
  $('lofxBtn').onclick = () => { lofx = !lofx; setToggle($('lofxBtn'), lofx); };

  /* pages */
  function setPage(p) {
    page = p;
    /* close overlays that belong to the sim stage */
    if (p !== 'simulation') {
      $('splitReveal').classList.remove('on');
      $('doneCard').classList.remove('on');
    }
    document.querySelectorAll('#nav .nv').forEach(b => b.classList.toggle('on', b.dataset.page === p));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'view-' + p));
    const pane = { simulation: 'paneSim', cameras: 'paneCam', twin: 'paneTwin', engineering: 'paneEng' }[p] || 'paneSim';
    document.querySelectorAll('.rail-pane').forEach(x => x.classList.toggle('on', x.id === pane));
    $('railTitle').textContent = ({ simulation: 'Live modules', cameras: 'Camera bank', twin: 'Digital twin', engineering: 'Engineering' }[p] || 'Live modules');
    $('railSub').textContent = p === 'twin' ? 'controller graph' : p === 'cameras' ? (CAMS.length + ' viewpoints') : p === 'engineering' ? 'envelope' : p === 'modules' ? '6 cleaning stages' : 'overlapped';
    if (p === 'engineering') { engineering = true; setToggle($('engTog'), true); $('engLabels').hidden = false; engGroup.visible = true; }
    if (p === 'analytics') drawAllCharts();
    if (p === 'quality') renderQcFull();
    if (p === 'dashboard') drawThru();
    if (p === 'fleet') showFleetPhase(fleetPhase);
    if (p === 'roi') pay();
    history.replaceState(null, '', '#' + p);
    const onBtn = document.querySelector('#nav .nv.on');
    const ind = $('navInd');
    if (onBtn && ind) ind.style.transform = 'translateY(' + (onBtn.offsetTop + 10) + 'px)';
    const view = document.getElementById('view-' + p);
    if (view && view.classList.contains('on') && G && !reducedMotion) {
      G.fromTo(view, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.28, ease: 'power3.out', overwrite: true });
    }
  }
  document.querySelectorAll('#nav .nv').forEach(b => b.onclick = () => setPage(b.dataset.page));

  /* ===== jury: hubs / fleet / ROI / faults / before-after ===== */
  const HUB_NET = {
    'HUB-01': { name: 'Gurugram', short: 'GGN' },
    'HUB-02': { name: 'Delhi NCR', short: 'DEL' },
    'HUB-03': { name: 'Mumbai', short: 'BOM' }
  };
  let currentHub = 'HUB-01';
  const hubStore = { 'HUB-01': { cars: 0 }, 'HUB-02': { cars: 0 }, 'HUB-03': { cars: 0 } };
  $('hubSel').onchange = () => {
    hubStore[currentHub].cars = carsToday;
    currentHub = $('hubSel').value;
    carsToday = hubStore[currentHub].cars;
    $('stCount').textContent = pad(carsToday, 3);
    $('kCars').textContent = carsToday;
    const h = HUB_NET[currentHub];
    document.querySelector('.brand-copy span').textContent = currentHub + ' · ' + h.name + ' · digital twin';
    log('Hub switch · ' + currentHub + ' ' + h.name, 'ok');
    if (flow !== 'idle') resetFlow();
  };

  let fleetPhase = 1;
  const CITY_XY = [
    [210, 92, 'Gurugram', 1], [218, 86, 'Delhi NCR', 1], [128, 248, 'Mumbai', 1],
    [198, 338, 'Bengaluru', 2], [230, 355, 'Chennai', 2], [208, 285, 'Hyderabad', 2],
    [305, 205, 'Kolkata', 2], [155, 268, 'Pune', 2], [138, 198, 'Ahmedabad', 2],
    [175, 138, 'Jaipur', 2], [255, 168, 'Lucknow', 2], [118, 175, 'Surat', 2],
    [188, 175, 'Indore', 2], [240, 230, 'Nagpur', 2], [165, 318, 'Kochi', 2],
    [280, 255, 'Bhubaneswar', 2], [95, 155, 'Jodhpur', 2], [250, 120, 'Chandigarh', 2],
    [330, 145, 'Guwahati', 2], [200, 230, 'Bhopal', 2], [145, 300, 'Goa', 2],
    [270, 95, 'Dehradun', 2], [310, 240, 'Ranchi', 2], [185, 365, 'Coimbatore', 2]
  ];
  function makeFleetDots() {
    const dots = CITY_XY.map(([x, y, n, p]) => ({ x, y, n, p }));
    let i = 0;
    while (dots.length < 50) {
      const b = CITY_XY[i % CITY_XY.length];
      dots.push({ x: b[0] + (Math.random() - 0.5) * 36, y: b[1] + (Math.random() - 0.5) * 28, n: 'Metro ' + dots.length, p: 2 });
      i++;
    }
    while (dots.length < 200) {
      const b = CITY_XY[i % CITY_XY.length];
      dots.push({ x: b[0] + (Math.random() - 0.5) * 70, y: b[1] + (Math.random() - 0.5) * 55, n: 'Hub ' + dots.length, p: 3 });
      i++;
    }
    return dots;
  }
  const FLEET = makeFleetDots();
  (function buildIndia() {
    const host = $('indiaMap'); if (!host) return;
    host.innerHTML = '<div class="hub-tip" id="hubTip"></div><svg viewBox="0 0 400 480" id="indiaSvg">' +
      '<path class="india-land" d="M200 30 L220 40 235 55 250 50 255 70 270 85 290 95 310 100 325 115 340 125 350 140 335 155 320 165 310 185 305 210 315 230 300 250 290 280 280 320 270 360 255 400 240 430 220 450 205 455 195 440 185 400 175 360 165 320 150 290 130 270 110 255 95 245 80 235 70 220 85 205 100 195 115 180 125 155 140 130 155 105 170 80 185 55 200 30 Z"/>' +
      '</svg>';
    const svg = $('indiaSvg');
    FLEET.forEach((d, i) => {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', d.x); c.setAttribute('cy', d.y); c.setAttribute('r', d.p === 1 ? 5 : d.p === 2 ? 3.2 : 2.2);
      c.setAttribute('class', 'hub-dot' + (d.p === 1 ? ' flag' : d.p === 2 ? ' metro' : ' net'));
      c.dataset.i = i; c.dataset.p = d.p; c.dataset.n = d.n;
      svg.appendChild(c);
    });
    svg.addEventListener('pointermove', e => {
      if (e.target.tagName !== 'circle') { $('hubTip').style.display = 'none'; return; }
      const t = $('hubTip'); t.style.display = 'block';
      t.textContent = e.target.dataset.n;
      const r = host.getBoundingClientRect();
      t.style.left = (e.clientX - r.left + 10) + 'px'; t.style.top = (e.clientY - r.top - 18) + 'px';
    });
  })();
  function showFleetPhase(ph) {
    fleetPhase = ph;
    document.querySelectorAll('#phaseSeg [data-phase]').forEach(b => b.classList.toggle('on', +b.dataset.phase === ph));
    const n = ph === 1 ? 3 : ph === 2 ? 50 : 200;
    $('indiaSvg').querySelectorAll('.hub-dot').forEach((c, i) => {
      const on = i < n;
      c.classList.toggle('on', on);
      if (G && on && !reducedMotion) G.fromTo(c, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, delay: Math.min(i * 0.012, 1.2), ease: 'power2.out' });
      else if (!on) c.style.opacity = 0;
    });
    $('fkHubs').textContent = n;
    $('fkThru').textContent = (n * 40).toLocaleString('en-IN');
    $('fkCap').textContent = n >= 200 ? '₹15L' : '₹18.5L';
    const cars = n * 36;
    const en = Math.round(n * 0.5 * 40);
    if ($('fkCars')) $('fkCars').textContent = cars.toLocaleString('en-IN');
    if ($('fkEn')) $('fkEn').textContent = en.toLocaleString('en-IN');
    if ($('fkCarsBar')) $('fkCarsBar').style.width = (n / 200 * 100) + '%';
    if ($('fkEnBar')) $('fkEnBar').style.width = (n / 200 * 100) + '%';
  }
  $('phaseSeg').onclick = e => {
    const b = e.target.closest('[data-phase]'); if (!b) return;
    showFleetPhase(+b.dataset.phase);
  };
  $('rollBtn').onclick = () => {
    showFleetPhase(1);
    setTimeout(() => showFleetPhase(2), 1400);
    setTimeout(() => showFleetPhase(3), 3200);
    log('Fleet rollout animation · 3 → 50 → 200', 'ok');
  };
  showFleetPhase(1);

  const roiCpd = $('roiCpd');
  if (roiCpd) {
    roiCpd.oninput = () => { $('cpd').value = roiCpd.value; pay(); };
  }
  const _pay = pay;
  pay = function () {
    _pay();
    if (roiCpd) {
      roiCpd.value = $('cpd').value;
      $('roiCpdV').textContent = $('cpdV').textContent;
      $('roiPay').textContent = $('payV').textContent.replace(' · model', '');
      $('roiPay2').textContent = $('payV').textContent;
    }
  };
  $('cpd').oninput = pay;

  const FAULTS = [
    { id: 'tex', title: 'Textile sensor fault', msg: 'M4 contact pressure out of range · HOLD cycle', k: 'tex' },
    { id: 'nozzle', title: 'Mist nozzle blocked', msg: 'M3 nozzle 4 flow = 0 · isolate bank', k: 'mist' },
    { id: 'oversize', title: 'Oversize vehicle', msg: 'Scan envelope exceed · divert to manual bay', k: 'scan' },
    { id: 'estop', title: 'Emergency stop test', msg: 'E-Stop circuit · line halt', k: 'scan' }
  ];
  let activeFault = null;
  const fHost = $('faultBtns');
  FAULTS.forEach(f => {
    const b = document.createElement('button');
    b.className = 'btn'; b.textContent = f.title; b.dataset.fault = f.id;
    fHost.appendChild(b);
  });
  function fireFault(id) {
    const f = FAULTS.find(x => x.id === id); if (!f) return;
    activeFault = f;
    $('faultTitle').textContent = 'FAULT · ' + f.title;
    $('faultMsg').textContent = f.msg;
    $('faultBanner').hidden = false;
    const card = $('mod_' + f.k);
    if (card) { card.classList.add('FAULT'); const st = $('mst_' + f.k); if (st) { st.textContent = 'FAULT'; st.className = 'st'; } }
    log('FAULT · ' + f.title + ' — ' + f.msg, 'fault');
    fireSfx(f.id === 'estop' ? 'estop' : 'fault');
    if (f.id === 'estop') doEstop();
    if (f.id === 'oversize' && (flow === 'queueAdv' || flow === 'entry' || flow === 'inportal')) {
      paused = true; updatePauseBtn();
      setNarr('REJECT', '#E5484D', 'Oversize — diverted', 'Scan envelope exceeded portal gauge. Vehicle sent to manual bay. 22.6s promise holds for in-spec cars.', '#E5484D');
    } else if (flow !== 'idle' && f.id !== 'estop') {
      paused = true; updatePauseBtn();
    }
  }
  fHost.onclick = e => { const b = e.target.closest('[data-fault]'); if (b) fireFault(b.dataset.fault); };
  $('faultClear').onclick = () => {
    $('faultBanner').hidden = true;
    if (activeFault) { const card = $('mod_' + activeFault.k); if (card) card.classList.remove('FAULT'); }
    activeFault = null;
    log('Fault cleared · reset to idle', 'ok');
    resetFlow();
  };

  function setBa(clean) {
    const pct = clean ? 97 : 35;
    $('baPct').textContent = pct + '%';
    $('baArc').style.strokeDasharray = pct + ' 100';
    $('baArc').style.stroke = clean ? '#2EE59D' : '#FF6B1A';
    $('baBefore').classList.toggle('clean', clean);
    document.querySelector('#baAfter .car-svg').style.filter = clean ? 'saturate(1.15) contrast(1.05)' : 'none';
  }
  setBa(false);
  $('baPlay').onclick = () => {
    setBa(false);
    const start = performance.now();
    (function tick(now) {
      const u = Math.min(1, (now - start) / 2400);
      const pct = Math.round(35 + u * 62);
      $('baPct').textContent = pct + '%';
      $('baArc').style.strokeDasharray = pct + ' 100';
      $('baArc').style.stroke = pct > 80 ? '#2EE59D' : '#FF6B1A';
      $('baBefore').style.setProperty('--dirt', String(1 - u));
      if (u < 1) requestAnimationFrame(tick); else setBa(true);
    })(start);
    log('Before/after · cleanliness 35% → 97% (simulation)', 'ok');
  };

  /* sound */
  function setSfx(on) {
    sfxOn = !!on;
    if ($('sfxBtn')) setToggle($('sfxBtn'), sfxOn);
    if ($('sfxBtn2')) setToggle($('sfxBtn2'), sfxOn);
    if (sfx) {
      sfx.setMuted(!sfxOn);
      if (sfxOn) { sfx.unlock(); sfx.startHum(); }
      else sfx.stopHum();
    }
  }
  if ($('sfxBtn')) $('sfxBtn').onclick = () => setSfx(!sfxOn);
  if ($('sfxBtn2')) $('sfxBtn2').onclick = () => setSfx(!sfxOn);
  addEventListener('pointerdown', () => { if (sfx) sfx.unlock(); }, { once: true });

  /* ---------- PROPER BEFORE & AFTER INSPECTION ENGINE ---------- */
  let inspectDirtyState = false; // false = clean (after), true = dirty (before)
  let autoOrbit360 = false;

  function setInspectState(dirty) {
    inspectDirtyState = !!dirty;
    if (!hero) return;
    const zones = hero.userData.zones;
    const paint = hero.userData.paint;
    if (dirty) {
      // Inbound dirty state: heavy grime, dried water droplet rings, mud splatters, dull paint
      if (zones) Object.values(zones).forEach(m => setDirt(m, 0.95));
      if (paint) {
        paint.roughness = 0.68;
        paint.metalness = 0.35;
        paint.clearcoat = 0.08;
        paint.clearcoatRoughness = 0.45;
        paint.envMapIntensity = 0.65;
      }
      if (hero.userData.wheels) {
        hero.userData.wheels.forEach(w => {
          if (w.userData && w.userData.dustMat) w.userData.dustMat.opacity = 0.85;
        });
      }
    } else {
      // Outbound reset state: 100% clean, 94 GU showroom mirror gloss, SiO2 ceramic clearcoat
      if (zones) Object.values(zones).forEach(m => setDirt(m, 0.0));
      if (paint) {
        paint.roughness = 0.14;
        paint.metalness = 0.85;
        paint.clearcoat = 1.0;
        paint.clearcoatRoughness = 0.03;
        paint.envMapIntensity = 1.5;
      }
      if (hero.userData.wheels) {
        hero.userData.wheels.forEach(w => {
          if (w.userData && w.userData.dustMat) w.userData.dustMat.opacity = 0.0;
        });
      }
    }
    updateInspectUI();
  }

  function updateInspectUI() {
    const isDirty = inspectDirtyState;
    const label = isDirty ? 'BEFORE · 84% ROAD CONTAMINATION · 58 GU DULL' : 'AFTER · 94 GU MIRROR GLOSS · CERAMIC PROTECTED';
    const col = isDirty ? 'var(--warn)' : 'var(--live)';
    const btnTxt = isDirty ? '⚡ View AFTER (Clean)' : '⚡ View BEFORE (Dirty)';
    if ($('ibState')) { $('ibState').textContent = label; $('ibState').style.color = col; }
    if ($('ibToggle')) $('ibToggle').textContent = btnTxt;
    if ($('doneToggle3D')) $('doneToggle3D').textContent = btnTxt;
  }

  function generateSplitSnaps() {
    if (!hero) return;
    const prevCamPos = camera.position.clone();
    const prevOrbitTarget = orbit.target.clone();
    const prevInspect = inspectDirtyState;

    const hx = hero.position.x;
    // Set studio camera angle framing car
    camera.position.set(hx + 5.5, 2.5, 5.0);
    camera.lookAt(hx, 1.1, 0);

    // 1. Snapshot BEFORE (Dirty)
    setInspectState(true);
    renderer.render(scene, camera);
    try { snapBefore = canvas.toDataURL('image/jpeg', 0.88); } catch(e){}

    // 2. Snapshot AFTER (Clean)
    setInspectState(false);
    renderer.render(scene, camera);
    try { snapAfter = canvas.toDataURL('image/jpeg', 0.88); } catch(e){}

    // Restore original view
    camera.position.copy(prevCamPos);
    orbit.target.copy(prevOrbitTarget);
    camera.lookAt(orbit.target);
    setInspectState(prevInspect);
  }

  function captureFrame() {
    try { return canvas.toDataURL('image/jpeg', 0.85); } catch (e) { return null; }
  }

  function applySplit(pct) {
    pct = clamp(pct, 4, 96);
    const wrap = $('splitAfterWrap'), img = $('splitAfter'), handle = $('splitHandle'), range = $('splitRange');
    if (!wrap) return;
    wrap.style.width = pct + '%';
    if (img) img.style.width = (10000 / pct) + '%';
    if (handle) handle.style.left = pct + '%';
    if (range) range.value = String(pct | 0);
  }

  function openSplit() {
    if (!hero) nextHero();
    generateSplitSnaps();
    if (snapBefore) $('splitBefore').src = snapBefore;
    if (snapAfter) $('splitAfter').src = snapAfter;
    $('splitCont').textContent = '84% → 2%';
    $('splitGloss').textContent = '58 GU → ' + (lastReport ? lastReport.gloss : 94) + ' GU';
    $('splitCov').textContent = (lastReport ? lastReport.cov : '98.5% Monolayer');
    $('splitReveal').classList.add('on');
    applySplit(50);
  }

  if ($('splitRange')) $('splitRange').oninput = () => applySplit(+$('splitRange').value);
  if ($('splitClose')) $('splitClose').onclick = () => $('splitReveal').classList.remove('on');
  if ($('splitCloseBtn')) $('splitCloseBtn').onclick = () => $('splitReveal').classList.remove('on');
  if ($('splitReplay')) $('splitReplay').onclick = () => { $('splitReveal').classList.remove('on'); resetFlow(); startFlow(); };
  if ($('splitStage')) {
    $('splitStage').addEventListener('pointerdown', e => {
      const move = (ev) => {
        const r = $('splitStage').getBoundingClientRect();
        applySplit(((ev.clientX - r.left) / r.width) * 100);
      };
      move(e);
      const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
    });
  }

  /* skip-to-moment for jury Q&A */
  function jumpTo(t) {
    t = clamp(+t, 0, CYCLE);
    introOn = false; $('intro').classList.add('hide');
    if (cineOn) endCine(false);
    $('doneCard').classList.remove('on');
    $('splitReveal').classList.remove('on');
    if (estop) { estop = false; document.body.classList.remove('estop'); $('estopBtn').classList.remove('armed'); }
    if (!hero) nextHero();

    if (t >= 22.5) {
      // Finish bay staging with 360 space
      hero.position.set(25.5, 0, 0);
      flow = 'finishBay'; cycleT = 22.6; flowT = 0; paused = false; convRun = false; logged = {};
      setInspectState(false);
      generateSplitSnaps();
      $('doneCard').classList.add('on');
      if ($('inspectBar')) $('inspectBar').style.display = 'flex';
      setNarr('HANDOVER BAY', '#FF6B1A', 'Surface Reset Complete · Vehicle Staged', 'The vehicle is parked in the open finish bay. Toggle Before/After or use the split slider to inspect.', '#FF6B1A');
      log('Skip to Finish Bay · 360° space', 'ok');
      setCam('inspect');
      updatePauseBtn();
      return;
    }

    if ($('inspectBar')) $('inspectBar').style.display = 'none';
    hero.position.set(lerp(LANE.portalIn, LANE.portalOut, t / CYCLE), 0, 0);
    hero.position.z = 0;
    flow = 'inportal'; cycleT = t; flowT = 0; paused = false; convRun = true; logged = {};
    Object.entries(ZONE_CLEAR).forEach(([z, w]) => {
      const u = ease(seg(t, w[0], w[1]));
      if (hero.userData.zones[z]) setDirt(hero.userData.zones[z], (1 - u) * hero.userData.dirt);
      if (hero.userData.zones[z] && hero.userData.zones[z].uniforms && hero.userData.zones[z].uniforms.uWaveX)
        hero.userData.zones[z].uniforms.uWaveX.value = u;
    });
    document.querySelectorAll('#jumpBar [data-jump]').forEach(b => b.classList.toggle('on', +b.dataset.jump === t));
    if (sfx) { sfx.unlock(); if (sfxOn) sfx.startHum(); }
    log('Skip to moment · t=' + t.toFixed(0) + 's', 'info');
    updatePauseBtn();
  }
  if ($('jumpBar')) $('jumpBar').onclick = (e) => {
    const b = e.target.closest('[data-jump]'); if (b) jumpTo(+b.dataset.jump);
  };

  /* ---------- 6-MODULE SEPARATE / SOLO ENGINE ---------- */
  let soloMod = null;
  let soloTimer = 0;
  let soloDuration = 4.5;
  let soloStepIdx = -1;
  let soloAutoStep = false;

  function soloModule(k, autoStep) {
    if (estop) return;
    setPage('simulation');
    introOn = false; $('intro').classList.add('hide');
    if (cineOn) endCine(false);
    $('doneCard').classList.remove('on');
    $('splitReveal').classList.remove('on');

    soloMod = k;
    soloTimer = 0;
    soloAutoStep = !!autoStep;
    soloStepIdx = MODS.findIndex(m => m.k === k);
    if (soloStepIdx === -1) soloStepIdx = 0;
    const m = MODS[soloStepIdx];

    const st = STATIONS[k] || { x: 0 };
    if (!hero) nextHero();
    hero.position.set(st.x, 0, 0);
    hero.position.z = 0;
    flow = 'inportal';
    paused = false;
    convRun = false;
    logged = {};
    cycleT = m.s + 0.05;

    // Reset dirt layer so cleaning visual can be observed
    if (hero.userData && hero.userData.zones) {
      Object.keys(hero.userData.zones).forEach(z => {
        if (hero.userData.zones[z]) setDirt(hero.userData.zones[z], 0.72);
      });
    }

    // Move camera to ideal angle for this module
    const camMap = { scan: 'front', ion: 'portal', mist: 'portal', tex: 'follow', air: 'left', gloss: 'hero' };
    if (camMap[k]) setCam(camMap[k]);

    // SFX & Narrator
    if (sfx) { sfx.unlock(); if (sfxOn) sfx.startHum(); }
    fireSfx(k);
    setNarr('MODULE ' + pad(soloStepIdx + 1, 2) + ' / 07 (ISOLATED)', m.col, m.nm + ' — Isolated run', m.ds, m.col);
    log('Module demo · ' + m.nm + ' (isolated)', 'ok');

    // Update solo HUD
    const sh = $('soloHud');
    if (sh) {
      sh.hidden = false;
      $('shName').textContent = pad(soloStepIdx + 1, 2) + ' · ' + m.nm.toUpperCase();
      $('shName').style.color = m.col;
      $('shSub').textContent = m.ds;
      $('shBarFill').style.background = m.col;
      $('shBarFill').style.width = '0%';
      $('shTime').textContent = '0.0s / ' + soloDuration.toFixed(1) + 's';
    }

    document.querySelectorAll('.btn-solo-tab').forEach(b => b.classList.toggle('on', b.dataset.solo === k));
    document.querySelectorAll('.mod').forEach(mc => mc.classList.toggle('ACTIVE', mc.id === 'mod_' + k));
    updatePauseBtn();
  }

  function stopSolo() {
    soloMod = null;
    soloTimer = 0;
    soloAutoStep = false;
    soloStepIdx = -1;
    const sh = $('soloHud');
    if (sh) sh.hidden = true;
    document.querySelectorAll('.btn-solo-tab').forEach(b => b.classList.remove('on'));
    resetFlow();
    log('Exited separate module mode · twin returned to idle', 'info');
  }

  function nextSoloModule() {
    if (soloStepIdx === -1) soloStepIdx = 0;
    const nextIdx = (soloStepIdx + 1) % MODS.length;
    soloModule(MODS[nextIdx].k, soloAutoStep);
  }

  function prevSoloModule() {
    if (soloStepIdx === -1) soloStepIdx = 0;
    const prevIdx = (soloStepIdx - 1 + MODS.length) % MODS.length;
    soloModule(MODS[prevIdx].k, soloAutoStep);
  }

  function startStepSequence() {
    log('Starting sequential 6-module run (each module separately)', 'ok');
    soloModule(MODS[0].k, true);
  }

  // Bind solo navigation bar & buttons
  if ($('soloBar')) $('soloBar').onclick = (e) => {
    const b = e.target.closest('[data-solo]');
    if (b) soloModule(b.dataset.solo, false);
  };
  if ($('soloStepAllBtn')) $('soloStepAllBtn').onclick = () => startStepSequence();

  if ($('shPrev')) $('shPrev').onclick = () => prevSoloModule();
  if ($('shNext')) $('shNext').onclick = () => nextSoloModule();
  if ($('shReplay')) $('shReplay').onclick = () => { if (soloMod) soloModule(soloMod, soloAutoStep); };
  if ($('shStep')) $('shStep').onclick = () => startStepSequence();
  if ($('shExit')) $('shExit').onclick = () => stopSolo();

  // Bind dedicated modules page buttons
  document.querySelectorAll('#view-modules .mc-demo').forEach(btn => {
    btn.onclick = () => soloModule(btn.dataset.mod, false);
  });
  document.querySelectorAll('#view-modules .mc-jump').forEach(btn => {
    btn.onclick = () => {
      setPage('simulation');
      jumpTo(+btn.dataset.t);
    };
  });

  // Also bind Split close
  if ($('splitCloseBtn')) $('splitCloseBtn').onclick = () => $('splitReveal').classList.remove('on');
  if ($('splitReveal')) {
    $('splitReveal').onclick = (e) => {
      if (e.target === $('splitReveal')) $('splitReveal').classList.remove('on');
    };
  }

  /* cinematic opening */
  function portalWake() { wakeT = 0; }
  function endCine(autoStart) {
    cineOn = false;
    document.body.classList.remove('cine');
    const el = $('cine');
    if (el) { el.classList.remove('on'); el.style.opacity = ''; el.style.background = ''; }
    if (cineTl && cineTl.kill) cineTl.kill();
    cineTl = null;
    introOn = false; $('intro').classList.add('hide');
    if (autoStart && flow === 'idle' && !estop) {
      setCam('follow');
      startFlow();
    }
  }
  function playCine() {
    if (reducedMotion || !G) { $('intro').classList.remove('hide'); introOn = true; return; }
    cineOn = true;
    introOn = false;
    $('intro').classList.add('hide');
    document.body.classList.add('cine');
    const el = $('cine');
    el.classList.add('on');
    el.style.opacity = '1';
    el.style.background = '#050607';
    setCam('drone');
    const mark = $('cineMark'), q = $('cineQ'), sub = $('cineSub'), kick = $('cineKick');
    mark.style.opacity = '0'; q.style.opacity = '0'; sub.style.opacity = '0'; kick.style.opacity = '0';
    q.textContent = ''; sub.textContent = '';
    if (cineTl) cineTl.kill();
    cineTl = G.timeline({ onComplete: () => endCine(true) });
    cineTl.to(mark, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 0.25)
      .to(kick, { opacity: 1, duration: 0.4 }, 0.55)
      .to([mark, kick], { opacity: 0, duration: 0.35 }, 1.85)
      .add(() => { q.textContent = 'THE BOTTLENECK WAS NOT SPEED.'; }, 2.15)
      .fromTo(q, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }, 2.15)
      .add(() => { sub.textContent = 'IT WAS SEQUENCE.'; }, 3.55)
      .fromTo(sub, { opacity: 0 }, { opacity: 1, duration: 0.45 }, 3.55)
      .to([q, sub], { opacity: 0, duration: 0.4 }, 5.15)
      .add(() => {
        q.textContent = 'SURFACE RESET PORTAL';
        sub.textContent = 'PARALLELIZES THE CLEANING FIELD.';
        G.to(el, { backgroundColor: 'rgba(5,6,7,0.22)', duration: 0.85 });
        portalWake();
      }, 5.55)
      .fromTo(q, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5 }, 5.65)
      .to(sub, { opacity: 1, duration: 0.4 }, 6.15)
      .add(() => { sub.textContent = '22.6-SECOND TARGET.'; }, 7.55)
      .to(el, { opacity: 0, duration: 0.6 }, 9.05);
    if (sfx) sfx.unlock();
  }
  if ($('cineSkip')) $('cineSkip').onclick = () => { if (sfx) sfx.unlock(); endCine(false); setCam('hero'); };
  if ($('cineReplay')) $('cineReplay').onclick = () => { resetFlow(); playCine(); };

  function showFieldHero() {
    // Disabled: User requested no pop up of parallel field viz after wash
    return;
  }

  /* presenter */
  const SHOTS = [
    { t: 0, cam: 'drone', title: 'HUB OVERVIEW' },
    { t: 2.5, cam: 'follow', title: 'VEHICLE APPROACH' },
    { t: 0, phase: 'inportal', cam: 'hero', at: 0, title: 'SCAN' },
    { t: 2, phase: 'inportal', cam: 'portal', title: 'AIR + MIST' },
    { t: 6, phase: 'inportal', cam: 'portal', title: 'TEXTILE CONTACT' },
    { t: 12, phase: 'inportal', cam: 'follow', title: 'AIR-KNIFE' },
    { t: 21, phase: 'inportal', cam: 'hero', title: 'GLOSS + PROTECT' },
    { t: 0, phase: 'qc', cam: 'exit', title: 'QUALITY CHECK' }
  ];
  function enterPresenter() {
    if (cineOn) endCine(false);
    presOn = true; document.body.classList.add('presenter');
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { });
    setCam('drone'); introOn = false; $('intro').classList.add('hide');
    if (flow === 'idle') startFlow();
    log('Jury presenter mode', 'ok');
  }
  function exitPresenter() {
    presOn = false; document.body.classList.remove('presenter'); quoteOn = false; $('quote').classList.remove('on');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
  }
  $('presBtn').onclick = enterPresenter;
  $('exitPres').onclick = exitPresenter;

  function showQuote(text, ms) {
    $('quoteT').textContent = text; $('quote').classList.add('on'); quoteOn = true;
    setTimeout(() => { $('quote').classList.remove('on'); quoteOn = false; }, ms);
  }

  /* payback */
  function pay() {
    const cpd = +$('cpd').value; $('cpdV').textContent = cpd + ' cars/day';
    const months = 1850000 / (120 * cpd * 30); $('payV').textContent = clamp(months, 8, 15).toFixed(1) + ' months · model';
  }
  $('cpd').oninput = pay; pay();
  let dataRange = 'live';
  $('rangeSeg').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    dataRange = b.dataset.r;
    [...$('rangeSeg').children].forEach(x => x.classList.toggle('on', x === b));
    drawAllCharts();
  };

  /* charts */
  function spark(canvas, data, color) {
    const x = canvas.getContext('2d'); const w = canvas.width, h = canvas.height;
    x.clearRect(0, 0, w, h);
    x.strokeStyle = 'rgba(243,240,232,.08)'; x.beginPath();
    for (let i = 0; i < 5; i++) { const y = 16 + i * (h - 32) / 4; x.moveTo(0, y); x.lineTo(w, y); } x.stroke();
    if (!data.length) return;
    const mn = Math.min(...data), mx = Math.max(...data); const sp = mx - mn || 1;
    x.strokeStyle = color; x.lineWidth = 2; x.beginPath();
    data.forEach((v, i) => {
      const px = (i / (data.length - 1 || 1)) * w; const py = h - 16 - ((v - mn) / sp) * (h - 32);
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }); x.stroke();
  }
  function bars(canvas, labels, data, color) {
    const x = canvas.getContext('2d'); const w = canvas.width, h = canvas.height;
    x.clearRect(0, 0, w, h);
    const mx = Math.max(1, ...data); const bw = w / data.length;
    data.forEach((v, i) => {
      const bh = (v / mx) * (h - 28);
      x.fillStyle = color; x.globalAlpha = 0.35 + 0.65 * (i / data.length);
      x.fillRect(i * bw + 8, h - 18 - bh, bw - 16, bh);
      x.globalAlpha = 1; x.fillStyle = '#7C7870'; x.font = '10px IBM Plex Mono'; x.fillText(labels[i], i * bw + 10, h - 6);
    });
  }
  function drawThru() {
    const n = dataRange === 'week' ? 7 : dataRange === 'today' ? 12 : 24;
    const data = Array.from({ length: n }, (_, i) => 28 + Math.sin(i / 3) * 6 + carsToday * 0.3 + (dataRange === 'live' ? Math.sin(T + i) : 0));
    spark($('chThru'), data, '#FF6B1A');
    $('kCars').textContent = carsToday;
    $('aWat').textContent = Math.round(waterToday) + ' L';
  }
  function drawAllCharts() {
    drawThru();
    const scale = dataRange === 'week' ? 7 : dataRange === 'today' ? 3 : 1;
    bars($('chCyc'), ['22', '23', '24', '25', '26'], [2, 6, 40, 4, 1].map(v => v * scale), '#5BA8D4');
    bars($('chUtil'), MODS.map(m => m.short.slice(0, 4)), [8, 12, 16, 42, 33, 12], '#FF6B1A');
    const hist = cqsHist.length ? cqsHist : [100, 101, 99.5, 102, 100.4, 100.8, 99.9];
    spark($('chCqs'), hist, '#2EE59D');
    if ($('chLive')) {
      const live = Array.from({ length: 32 }, (_, i) => 22 + Math.sin(T * 0.4 + i / 4) * 3 + carsToday * 0.15);
      spark($('chLive'), live, '#FF6B1A');
    }
  }

  /* QC */
  function qcBegin() {
    qcT = 0; qcScores = [99.4, 99.0, 99.2, 99.1, 98.6, 98.3, 97.9];
    $('passBadge').style.display = 'none'; $('gAfter').textContent = '— GU';
    $('gBefore').textContent = (55 + Math.floor(Math.random() * 10)) + ' GU';
  }
  function qcUpdate(dt) {
    qcT += dt;
    QZONES.forEach((z, i) => {
      const u = ease(seg(qcT, 0.2 + i * 0.25, 1.4 + i * 0.25)); const v = u * qcScores[i];
      $('zf' + i).style.width = v + '%'; $('zv' + i).textContent = v > 1 ? v.toFixed(0) : '—';
    });
    const cu = ease(seg(qcT, 0.5, 2.4)); $('cqsBig').textContent = Math.round(cu * 102); $('tCqs').textContent = $('cqsBig').textContent;
    if (qcT > 2.0) $('gAfter').textContent = (88 + Math.floor((qcT * 7) % 6)) + ' GU';
    if (qcT > 2.6) $('passBadge').style.display = 'flex';
    const bc = $('beadCanvas'), bx = bc.getContext('2d'); bx.clearRect(0, 0, bc.width, bc.height);
    bx.fillStyle = '#1a1d22'; bx.fillRect(0, 24, bc.width, 10);
    for (let i = 0; i < 9; i++) {
      const x = (i * 30 + qcT * 46) % bc.width; const r = 4 + Math.sin(qcT * 3 + i) * 1.4;
      bx.beginPath(); bx.arc(x, 20 - Math.abs(Math.sin(qcT * 2 + i)) * 7, r, 0, 7); bx.fillStyle = 'rgba(141,211,251,0.85)'; bx.fill();
    }
  }
  function renderQcFull() {
    const el = $('qcFull');
    if (!lastReport) { el.innerHTML = '<p style="color:var(--muted)">No cycle yet. Run the simulation.</p>'; return; }
    el.innerHTML = '<span class="sim-tag">Simulation result</span>' +
      QZONES.map((z, i) => '<div class="qz"><span>' + z + '</span><div class="zb"><div class="zf" style="width:' + lastReport.zones[i] + '%"></div></div><span class="zv">' + lastReport.zones[i].toFixed(0) + '</span></div>').join('') +
      '<p style="margin:12px 0 0;font-family:var(--font-m)">CQS ' + lastReport.cqs + ' · gloss ' + lastReport.gloss + ' GU · coverage ' + lastReport.cov + '</p>';
  }

  /* QC Sensor Diagnostics */
  const QC_SENSORS = [
    { id: 'glossmeter', name: 'Glossmeter', unit: 'GU', target: 92, range: [85, 98], icon: '◈' },
    { id: 'spectro', name: 'Spectrophotometer ΔE', unit: 'ΔE', target: 0.8, range: [0.3, 1.5], icon: '◉' },
    { id: 'hydro', name: 'Hydrophobicity', unit: '°', target: 108, range: [95, 115], icon: '◆' },
    { id: 'thickness', name: 'SiO₂ Thickness', unit: 'nm', target: 120, range: [90, 150], icon: '▣' },
    { id: 'roughness', name: 'Surface Ra', unit: 'µm', target: 0.02, range: [0.01, 0.04], icon: '▤' }
  ];
  const sensorHistory = {};
  QC_SENSORS.forEach(s => { sensorHistory[s.id] = []; });

  function qcSensorsUpdate(dt) {
    const progress = clamp(qcT / 3.0, 0, 1);
    QC_SENSORS.forEach(s => {
      const el = $('qcSensor_' + s.id);
      if (!el) return;
      const valEl = el.querySelector('.qs-val');
      const statusEl = el.querySelector('.qs-status');
      const sparkCanvas = el.querySelector('.qs-spark');
      if (!valEl) return;

      const noise = Math.sin(T * 4.5 + QC_SENSORS.indexOf(s) * 2.1) * 0.02 * (s.range[1] - s.range[0]);
      const rawVal = lerp(s.range[0], s.target, ease(progress)) + noise;
      const val = s.id === 'spectro' || s.id === 'roughness' ? rawVal.toFixed(2) : rawVal.toFixed(1);
      valEl.textContent = progress > 0.05 ? val + ' ' + s.unit : '— ' + s.unit;

      if (statusEl) {
        const pass = s.id === 'spectro' ? rawVal <= 1.2 : (s.id === 'roughness' ? rawVal <= 0.035 : rawVal >= s.target * 0.9);
        statusEl.textContent = progress < 0.3 ? 'SCANNING' : (pass ? 'PASS' : 'WARN');
        statusEl.className = 'qs-status ' + (progress < 0.3 ? 'scanning' : (pass ? 'pass' : 'warn'));
      }

      /* spark line */
      if (sparkCanvas && progress > 0.05) {
        const hist = sensorHistory[s.id];
        hist.push(rawVal);
        if (hist.length > 40) hist.shift();
        const ctx = sparkCanvas.getContext('2d');
        ctx.clearRect(0, 0, sparkCanvas.width, sparkCanvas.height);
        const min = s.range[0] * 0.95, max = s.range[1] * 1.05;
        ctx.strokeStyle = '#06B6D4';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        hist.forEach((v, i) => {
          const x = (i / 39) * sparkCanvas.width;
          const y = sparkCanvas.height - ((v - min) / (max - min)) * sparkCanvas.height;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
        /* target line */
        ctx.strokeStyle = 'rgba(46,229,157,0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        const ty = sparkCanvas.height - ((s.target - min) / (max - min)) * sparkCanvas.height;
        ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(sparkCanvas.width, ty); ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }

  /* scan demo */
  const gridOv = $('gridOv'); const gridCells = [];
  function buildGrid() {
    if (gridCells.length) return;
    for (let i = 0; i < 24; i++) { const d = document.createElement('div'); d.className = 'cell'; d.innerHTML = '<span>—</span>'; gridOv.appendChild(d); gridCells.push(d); }
  }
  buildGrid();
  $('camStart').onclick = async () => {
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      $('vid').srcObject = st; $('vid').style.display = 'block'; $('scanImg').hidden = true;
      $('verdict').textContent = 'Webcam live — press Analyze frame.';
    } catch (e) { $('verdict').textContent = 'Webcam unavailable — use Upload photo instead.'; }
  };
  $('upBtn').onclick = () => $('upFile').click();
  $('upFile').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    $('scanImg').src = URL.createObjectURL(f); $('scanImg').hidden = false; $('vid').style.display = 'none';
    $('verdict').textContent = 'Photo loaded — press Analyze frame.';
  };
  $('analyzeBtn').onclick = () => {
    const c = document.createElement('canvas'); c.width = 360; c.height = 240; const x = c.getContext('2d');
    const src = !$('scanImg').hidden ? $('scanImg') : $('vid');
    try { x.drawImage(src, 0, 0, 360, 240); } catch (e) { $('verdict').textContent = 'No frame available yet.'; return; }
    const img = x.getImageData(0, 0, 360, 240).data;
    let gsum = 0; for (let i = 0; i < img.length; i += 4) gsum += 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2];
    const gmean = gsum / (img.length / 4); let heavy = 0;
    for (let cy = 0; cy < 4; cy++) for (let cxi = 0; cxi < 6; cxi++) {
      let sum = 0, sq = 0, n = 0;
      for (let y = cy * 60; y < (cy + 1) * 60; y += 2) for (let xx = cxi * 60; xx < (cxi + 1) * 60; xx += 2) {
        const o = (y * 360 + xx) * 4; const l = 0.299 * img[o] + 0.587 * img[o + 1] + 0.114 * img[o + 2]; sum += l; sq += l * l; n++;
      }
      const mean = sum / n, dev = Math.sqrt(Math.max(0, sq / n - mean * mean)), drop = gmean - mean;
      let cls = 'CLEAN';
      if (drop > 52 || (drop > 34 && dev > 34)) cls = 'BONDED';
      else if (drop > 30 || dev > 30) cls = 'GRIME';
      else if (drop > 13 || dev > 18) cls = 'DUST';
      if (cls === 'GRIME' || cls === 'BONDED') heavy++;
      const cell = gridCells[cy * 6 + cxi]; cell.className = 'cell ' + cls; cell.querySelector('span').textContent = cls;
    }
    $('verdict').textContent = heavy >= 5 ? 'HEAVY SOIL → 60s PRE-CYCLE + 22.6s PROGRAM' : 'STANDARD LOAD → 22.6s PROGRAM';
    $('verdict').style.borderLeftColor = heavy >= 5 ? '#E8B931' : '#2EE59D';
    log('Scan demo · ' + (heavy >= 5 ? 'heavy soil' : 'standard'), heavy >= 5 ? 'warn' : 'ok');
  };

  /* maintenance */
  (function () {
    const rows = $('maintRows');
    const items = [
      ['Textile array', 82, '124 h'], ['Ionizer bars', 91, '210 h'], ['Mist nozzles', 74, '88 h'],
      ['Air-knife blowers', 88, '156 h'], ['Scan cameras', 95, '40 h'], ['Gloss applicator', 79, '67 h'],
      ['Underbody jets', 86, '140 h']
    ];
    items.forEach(([n, p, h]) => {
      const d = document.createElement('div'); d.className = 'row';
      d.innerHTML = '<span>' + n + '</span><div class="track' + (p < 80 ? ' warn' : '') + '"><i style="width:' + p + '%"></i></div><b>' + h + '</b>';
      rows.appendChild(d);
    });
  })();

  /* keyboard */
  addEventListener('keydown', e => {
    if (e.target instanceof Element && e.target.matches('input,textarea,select,button')) return;
    if (e.code === 'Space') { e.preventDefault(); if (flow === 'idle') startFlow(); else togglePause(); }
    if (e.key === 'r' || e.key === 'R') resetFlow();
    if (e.key === 'e' || e.key === 'E') $('engTog').click();
    if (e.key === 'p' || e.key === 'P') enterPresenter();
    if (e.key === 'j' || e.key === 'J') showFieldHero();
    if (e.key === 'Escape') { if (presOn) exitPresenter(); if (cineOn) endCine(false); }
    const map = { '1': 'hero', '2': 'follow', '3': 'portal', '4': 'fpv', '5': 'drone', '6': 'cctv' };
    if (map[e.key]) setCam(map[e.key]);
  });

  /* hash */
  if (location.hash) { const p = location.hash.slice(1); if (document.querySelector('[data-page="' + p + '"]')) setPage(p); }

  /* ---------- main update ---------- */
  function moduleActive(k, tc) {
    if (soloMod) return soloMod === k;
    if (mode === 'manual' && manualOn[k]) return true;
    const m = MODS.find(x => x.k === k);
    return tc >= m.s && tc <= m.e;
  }
  function cleanNow() {
    if (!hero) return 0;
    const vals = Object.values(hero.userData.zones).map(m => getDirt(m));
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return 1 - avg / Math.max(0.0001, hero.userData.dirt);
  }

  function update(dt) {
    T += dt;
    if (introOn) {
      introT += dt;
      if (introT > 3.6) { introOn = false; $('intro').classList.add('hide'); }
    }
    $('narr').style.opacity = introOn ? '0' : '1';

    const beltOn = convRun && !paused && !estop && (flow === 'queueAdv' || flow === 'entry' || flow === 'exit' || flow === 'qc' || flow === 'inportal' || conveyorForced);
    if (beltOn) beltStrips.forEach(s => { s.position.x += dt * BELT * convSpd * convDir; if (s.position.x > 32) s.position.x = -34; if (s.position.x < -34) s.position.x = 32; });
    [-9.0, -4.0, 1.0, 6.0, 11.0, 16.0].forEach((sx, idx) => {
      if (proxSensors[idx] && hero) {
        const near = Math.abs(hero.position.x - sx) < 2.5;
        proxSensors[idx].material.color.setHex(near ? 0xff6b1a : 0x2ee59d);
        proxSensors[idx].material.emissive.setHex(near ? 0xff6b1a : 0x2ee59d);
      }
    });
    if (hero && convOverlay) pusher.position.x = hero.position.x - 2.1;

    /* flow machine */
    if (!paused && !estop) {
      if (flow === 'queueAdv') {
        flowT += dt;
        hero.position.x = damp(hero.position.x, LANE.qStart + 6, 3.2, dt);
        queueCars.forEach((c, i) => { c.position.x = damp(c.position.x, LANE.qStart - i * 5.6, 2.4, dt); });
        if (flowT > 1.6) {
          flow = heavyCar ? 'precycle' : 'entry'; flowT = 0;
          if (heavyCar) {
            setNarr('TRIAGE', '#E8B931', 'Heavy soil · 60s pre-cycle', 'Scan routed this car to the pre-cycle pad. Standard cars go straight to 22.6s. (Shown accelerated 10×.)', '#E8B931');
            log('Heavy soil · pre-cycle', 'warn');
          }
        }
      } else if (flow === 'precycle') {
        flowT += dt; preT = flowT;
        if (flowT < 1.6) { hero.position.x = damp(hero.position.x, -14, 4, dt); hero.position.z = damp(hero.position.z, 7, 4, dt); }
        else if (flowT < PRE_VISUAL - 1.2) {
          drawPts(P_mist, 1, (i, s) => [-14 + lerp(-2, 2, s.c), 2.4 - ((T * (1 + s.a) + s.b) % 1) * 1.8, 7 + lerp(-1, 1, s.d)], 0.8);
          Object.values(hero.userData.zones).forEach(m => setDirt(m, Math.max(0.6, getDirt(m) - dt * 0.06)));
        } else {
          hero.position.z = damp(hero.position.z, 0, 4, dt); hero.position.x = damp(hero.position.x, -9, 4, dt);
          if (Math.abs(hero.position.z) < 0.05) { flow = 'entry'; flowT = 0; P_mist.pts.visible = false; }
        }
      } else if (flow === 'entry') {
        flowT += dt;
        hero.position.x += dt * BELT * convSpd;
        curtains.forEach(c => c.material.opacity = 0.35);
        fireLogOnce('entry', 'Vehicle at portal threshold', 'info');
        setNarr('ENTRY', '#2EE59D', 'Conveyor: transport, not process', 'The car rides the conveyor into the portal. All processing happens inside — seven modules, one 22.6-second overlapped cycle.', '#2EE59D');
        if (hero.position.x >= LANE.portalIn) { flow = 'inportal'; cycleT = 0; wantSnap = 'before'; log('Scan initiated', 'ok'); }
      } else if (flow === 'inportal') {
        if (soloMod) {
          soloTimer += dt;
          const u = clamp(soloTimer / soloDuration, 0, 1);
          const m = MODS[soloStepIdx] || MODS.find(x => x.k === soloMod) || MODS[0];
          const st = STATIONS[soloMod] || { x: 0 };
          cycleT = lerp(m.s, m.e, u);
          if (hero) {
            hero.position.x = lerp(st.x - 0.35, st.x + 0.35, u);
            hero.position.z = 0;
          }
          const shFill = $('shBarFill');
          if (shFill) shFill.style.width = (u * 100) + '%';
          const shTime = $('shTime');
          if (shTime) shTime.textContent = soloTimer.toFixed(1) + 's / ' + soloDuration.toFixed(1) + 's';

          if (soloTimer >= soloDuration) {
            if (soloAutoStep) {
              if (soloStepIdx < MODS.length - 1) {
                nextSoloModule();
              } else {
                stopSolo();
                log('7-Module Step sequence finished', 'ok');
                setNarr('7 MODULES COMPLETE', '#2EE59D', 'All 7 Cleaning Modules Finished', 'Each module was executed independently. Press START to run the 22.6s parallel cycle.', '#2EE59D');
              }
            } else {
              soloTimer = 0;
            }
          }
        } else {
          cycleT += dt;
          /* crawl through portal */
          const u = clamp(cycleT / CYCLE, 0, 1);
          hero.position.x = lerp(LANE.portalIn, LANE.portalOut, u);
          MODS.forEach(m => {
            if (cycleT >= m.s && cycleT < m.s + dt + 0.02) {
              fireLogOnce('m' + m.k, m.nm + ' activated', 'ok');
              fireSfx(m.k);
            }
          });
          /* live QC fill — each panel score rises as the field reaches it (staggered) */
          {
            const QCFIN = [99.4, 99.0, 99.2, 99.1, 98.6, 98.3, 97.9];
            QZONES.forEach((z, i) => {
              const uu = clamp((cycleT - (3 + i * 2)) / 4.5, 0, 1);
              const zf = $('zf' + i), zv = $('zv' + i);
              if (zf) { zf.style.width = (uu * 100) + '%'; zv.textContent = uu > 0.03 ? Math.round(uu * QCFIN[i]) : '—'; }
            });
            if ($('tCqs')) $('tCqs').textContent = cycleT > 4 ? Math.round(clamp((cycleT - 4) / 15, 0, 1) * 100) : '—';
            if ($('tCov')) $('tCov').textContent = Math.round(u * 98.5) + '%';
          }
          if (cycleT >= CYCLE) {
            flow = 'exit'; flowT = 0; carsToday++; if (hubStore[currentHub]) hubStore[currentHub].cars = carsToday; waterToday += 118;
            fireSfx('complete');
            if ($('baPct')) setBa(true);
            cqsHist.push(100 + rnd(0, 2.4));
            $('stCount').textContent = pad(carsToday, 3);
            lastReport = {
              zones: [99.4, 99.0, 99.2, 99.1, 98.6, 98.3, 97.9].slice(0, QZONES.length),
              cqs: Math.round(100 + rnd(0, 2.4)),
              gloss: 94,
              cov: '98.5%'
            };
            $('dCov').textContent = lastReport.cov;
            $('dCont').textContent = '84% → 2%';
            $('dGloss').textContent = lastReport.gloss + ' GU';
            $('dProt').textContent = '98.5%';
            /* lock QC rail bars to final panel scores */
            QZONES.forEach((z, i) => { if ($('zf' + i)) { $('zf' + i).style.width = lastReport.zones[i] + '%'; $('zv' + i).textContent = Math.round(lastReport.zones[i]); } });
            if ($('tCqs')) $('tCqs').textContent = lastReport.cqs;
            if ($('tCov')) $('tCov').textContent = '98.5%';
            log('Cycle complete · 22.60 s', 'ok');
            if (presOn) {
              setTimeout(() => showQuote('The bottleneck was not speed. It was sequence.', 3200), 3600);
              setTimeout(() => showQuote('Surface Reset Portal parallelizes the cleaning field. 22.6-second target.', 3200), 7000);
            }
          }
        }
      } else if (flow === 'exit') {
        flowT += dt;
        hero.position.x += dt * BELT * convSpd;
        // As car glides past qcArch at 18.8:
        if (hero.position.x >= 18.0 && hero.position.x <= 19.8) {
          qcBeam.material.opacity = 0.35 + 0.15 * Math.sin(T * 8);
          if (qcT === 0) qcBegin();
          qcUpdate(dt);
          qcSensorsUpdate(dt);
        } else {
          qcBeam.material.opacity = Math.max(0, qcBeam.material.opacity - dt * 2);
        }
        // Smoothly roll into Spacious Finish & Inspection Bay at x = 25.5:
        if (hero.position.x >= 25.5) {
          hero.position.x = 25.5;
          flow = 'finishBay';
          flowT = 0;
          convRun = false;
          setInspectState(false); // Clean showroom state
          generateSplitSnaps();   // Guaranteed studio-grade Before & After images
          $('doneCard').classList.add('on');
          if (G && !reducedMotion) G.fromTo('#doneCard .inner', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.32, ease: 'power3.out' });
          if ($('inspectBar')) $('inspectBar').style.display = 'flex';
          setNarr('FINISH BAY', '#FF6B1A', 'Surface Reset Complete · Final Inspection', 'The vehicle is parked in the open finish bay. Toggle Before/After or use the split slider to inspect.', '#FF6B1A');
          log('Vehicle staged in Final Inspection Bay · 360° space', 'ok');
          setCam('inspect');
        }
      } else if (flow === 'finishBay') {
        // Car stays parked on display with 360° clearance!
        hero.position.x = 25.5;
        convRun = false;
        qcBeam.material.opacity = 0;
        if (autoOrbit360) {
          orbit.manual = true;
          orbit.theta += dt * 0.35;
        }
      }
    }

    if (hero) {
      let dx = hero.position.x - (hero.userData.lastX || hero.position.x);
      hero.userData.lastX = hero.position.x;
      if (Math.abs(dx) > 2) dx = 0; /* teleport/jump: no violent spin */
      const rot = dx / 0.47; /* true tyre outer radius (roll without slip) */
      hero.userData.wheels.forEach(w => {
        w.rotation.z -= rot;
        if (w.userData.sp) w.userData.sp.rotation.z -= rot;
      });
    }

    /* portal FX */
    const inP = flow === 'inportal';
    const tc = inP ? cycleT : 0;
    if (!inP && flow !== 'precycle' && wakeT < 0) {
      scanPlane.visible = false; scanBox.visible = false; glossRing.visible = false;
      roofArray.visible = false; sideArrays.forEach(sa => sa.g.visible = false);
      airUnits.forEach(a => a.u.visible = false); mistCones.visible = false; bottomJets.visible = false;
      ionBar.material.emissiveIntensity = 0;
      [P_ion, P_mist, P_air, P_spark].forEach(p => { if (flow !== 'precycle') p.pts.visible = false; });
      ionStreams.forEach(L => { L.line.visible = false; });
      curtains.forEach(c => { if (flow !== 'entry') c.material.opacity = Math.max(0, c.material.opacity - dt); });
    }
    if (wakeT >= 0 && !inP) {
      wakeT += Math.max(dt, 1 / 60);
      const w = wakeT;
      scanPlane.visible = w > 0.15 && w < 1.35;
      scanPlane.position.set(Math.sin(w * 2) * 1.2, 1.25, 0);
      ionBar.material.emissiveIntensity = (w > 0.5 && w < 2.3) ? 1.35 : 0;
      const mistOn = w > 0.95 && w < 2.6;
      mistCones.visible = mistOn;
      mistCones.position.x = 0;
      mistCones.children.forEach(c => { c.material.opacity = mistOn ? 0.3 : 0; });
      roofArray.visible = w > 1.45 && w < 3.15;
      if (roofArray.visible) roofArray.position.set(0, 3.15, 0);
      airUnits.forEach(a => {
        a.u.visible = w > 2.15 && w < 3.55;
        a.u.position.x = a.zs * 1.0;
        a.sheet.material.opacity = a.u.visible ? 0.32 : 0;
      });
      glossRing.visible = w > 2.7 && w < 4.05;
      if (glossRing.visible) { glossRing.position.set(0, 1.2, 0); glossRing.material.opacity = 0.55; }
      portalLight.intensity = 0.55 + 0.4 * Math.sin(w * 5);
      if (window.SRP && SRP.tickCloud) {
        SRP.tickCloud(P_mist, dt, mistOn ? 0.7 : 0, 'mist', { x: 0 }, T, lofx);
        SRP.tickCloud(P_ion, dt, (w > 0.5 && w < 2.3) ? 0.8 : 0, 'ion', { x: 0 }, T, lofx);
      }
      if (w > 4.2) {
        wakeT = -1;
        scanPlane.visible = false; mistCones.visible = false; roofArray.visible = false;
        airUnits.forEach(a => a.u.visible = false); glossRing.visible = false;
        ionBar.material.emissiveIntensity = 0;
      }
    }
    portalLight.intensity = inP ? 0.85 + 0.35 * Math.sin(T * 4) : 0;
    portalLight.color.set(inP && moduleActive('tex', tc) ? 0xff6b1a : 0x5ba8d4);
    ledStates.forEach((m, i) => {
      const on = inP && ((Math.floor(T * 3) + i) % 3 === 0);
      m.material.emissive.setHex(on ? 0xff6b1a : 0x000000);
    });
    /* tower: green idle, amber run, red estop */
    const tower = portal.userData.tower;
    if (tower) {
      tower.children[0].material.emissiveIntensity = estop ? 1.2 : 0.12;
      tower.children[1].material.emissiveIntensity = inP ? 1.1 : 0.12;
      tower.children[2].material.emissiveIntensity = (!estop && flow === 'idle') ? 1.0 : 0.12;
    }

    if (hero && inP) {
      const cx = hero.position.x;
      const sOn = moduleActive('scan', tc);
      scanPlane.visible = sOn; scanBox.visible = sOn;
      if (sOn) {
        scanPlane.position.set(cx - 2.2 + seg(tc, 0, 1.9) * 4.4, 1.25, 0); scanBox.position.set(cx, 1.15, 0);
        heatPatches.forEach((p, i) => {
          const zn = [[0, 2.05, 0], [1.4, 1.35, 0], [0, 0.8, 0.9], [0, 0.8, -0.9], [-2.1, 0.85, 0], [0.6, 1.6, 0]][i];
          p.position.set(cx + zn[0], zn[1], zn[2]);
          if (i < 2 || i === 4) p.rotation.set(-Math.PI / 2, 0, 0); else p.rotation.set(0, i === 3 ? Math.PI : 0, 0);
          p.material.opacity = seg(tc, 0.3 + i * 0.11, 1.1 + i * 0.11) * 0.35;
        });
      } else heatPatches.forEach(p => p.material.opacity = Math.max(0, p.material.opacity - dt));

      const ionI = moduleActive('ion', tc) ? tri(tc, 1.9, 4.7) || (mode === 'manual' ? 0.8 : 0) : 0;
      ionBar.material.emissiveIntensity = ionI * 0.75;
      if (activeFault && activeFault.id === 'tex') ionBar.material.emissiveIntensity *= 0.3;

      const mistI = moduleActive('mist', tc) ? (tri(tc, 3.8, 7.5) || (mode === 'manual' ? 0.7 : 0)) : 0;
      mistCones.children.forEach((c, ci) => {
        const blocked = activeFault && activeFault.id === 'nozzle' && ci === 3;
        c.material.opacity = blocked ? 0 : mistI * 0.26;
        c.material.color.setHex(blocked ? 0xe5484d : 0x2dd4bf);
      });
      mistCones.position.x = cx; mistCones.visible = mistI > 0.02;
      if (hero.userData.paint) {
        const wet = mistI * 0.22;
        const cNow = cleanNow();
        hero.userData.paint.roughness = clamp(lerp(0.68, 0.08, cNow) - wet, 0.06, 0.72);
        hero.userData.paint.metalness = lerp(0.30, 0.90, cNow);
      }

      const texOn = moduleActive('tex', tc);
      const tIn = ease(seg(tc, 5.6, 6.8)), tOut = ease(seg(tc, 14.3, 15.5));
      roofArray.visible = texOn;
      if (texOn) {
        const tin = mode === 'manual' && manualOn.tex ? 1 : tIn;
        const tout = mode === 'manual' && manualOn.tex ? 0 : tOut;
        roofArray.position.x = cx + Math.sin(T * 2.2) * 0.55;
        roofArray.position.y = lerp(5.1, 2.35, tin) + tout * 2.6 + Math.sin(T * 9) * 0.03;
        const freeze = activeFault && activeFault.id === 'tex';
        roofArray.userData.pads.forEach((p, i) => {
          p.position.y = freeze ? -0.16 : -0.16 + Math.sin(T * 10 + i * 1.3) * 0.03;
          p.material.emissiveIntensity = freeze ? 0.6 : 0.18;
        });
        sideArrays.forEach(sa => {
          sa.g.visible = true; sa.g.position.x = cx + Math.sin(T * 2.2 + 1) * 0.4;
          sa.g.position.z = lerp(sa.zs * 3.0, sa.zs * 1.12, tin) + tout * sa.zs * 1.9;
          sa.g.userData.pads.forEach((p, i) => { p.position.z = sa.zs * -0.12 + Math.sin(T * 11 + i) * 0.02 * sa.zs; });
        });
      } else sideArrays.forEach(sa => sa.g.visible = false);

      Object.entries(ZONE_CLEAR).forEach(([z, w]) => {
        const u = ease(seg(tc, w[0], w[1]));
        const mat = hero.userData.zones[z];
        if (!mat) return;
        setDirt(mat, Math.min(getDirt(mat), (1 - u) * hero.userData.dirt));
        if (mat.uniforms && mat.uniforms.uWaveX) mat.uniforms.uWaveX.value = u;
      });

      const airI = moduleActive('air', tc) ? (tri(tc, 11.3, 18.8) || (mode === 'manual' ? 0.7 : 0)) : 0;
      airUnits.forEach(a => {
        a.u.visible = airI > 0.02; a.u.position.x = hero.position.x + a.zs * 1.0;
        a.sheet.material.opacity = airI * (0.28 + 0.18 * Math.abs(Math.sin(T * 11)));
      });
      /* bottom cleaner jets */
      const btmOn = moduleActive('bottom', tc);
      const btmI = btmOn ? (tri(tc, 8.0, 14.5) || (mode === 'manual' ? 0.7 : 0)) : 0;
      bottomJets.visible = btmI > 0.02;
      if (bottomJets.visible) {
        bottomJets.position.x = hero.position.x;
        bottomJets.children.forEach((c, ci) => {
          c.material.opacity = btmI * (0.25 + 0.15 * Math.abs(Math.sin(T * 9 + ci * 1.1)));
          c.position.y = 0.5 + Math.sin(T * 7 + ci * 0.8) * 0.15;
          c.scale.y = 0.8 + Math.sin(T * 12 + ci) * 0.2;
        });
      }
      const gOn = moduleActive('gloss', tc);
      const gI = gOn ? seg(tc, 19.5, 22.6) : 0;
      glossRing.visible = gOn;
      if (glossRing.visible) { glossRing.position.set(hero.position.x - 2.1 + gI * 4.2, 1.2, 0); glossRing.material.opacity = 0.4 * (tri(tc, 19.5, 22.6) || 0.4) + 0.15; }
      if (window.SRP && SRP.tickCloud) {
        SRP.tickCloud(P_ion, dt, ionI, 'ion', { x: cx }, T, lofx);
        SRP.tickCloud(P_mist, dt, mistI, 'mist', { x: cx }, T, lofx);
        SRP.tickCloud(P_air, dt, airI, 'air', { x: hero.position.x }, T, lofx);
        SRP.tickCloud(P_spark, dt, gOn ? (0.25 + gI * 0.65) : 0, 'gloss', { x: hero.position.x }, T, lofx);
        if (ionStreams.length) SRP.tickStreams(ionStreams, ionI, { x: cx }, T);
      } else {
        drawPts(P_ion, ionI, (i, s) => [cx + lerp(-2.1, 2.1, s.c), 0.8 + ((T * (0.5 + s.a) + s.b) % 1) * 1.9, lerp(-1, 1, s.d)], ionI);
        drawPts(P_mist, mistI, (i, s) => [cx + lerp(-2, 2, s.c), 3.8 - ((T * (1.1 + s.a) + s.b) % 1) * 2.6, lerp(-1, 1, s.d)], mistI);
        drawPts(P_air, airI, (i, s) => {
          const f = ((T * (1.4 + s.a) + s.b) % 1); const side = s.c < 0.5 ? -1 : 1;
          return [hero.position.x + lerp(-1.6, 1.6, s.d), lerp(1.9, 0.6, f), side * (1.0 + f * 2.0)];
        }, airI);
        drawPts(P_spark, gOn && tc > 20.5 ? 1 : 0, (i, s) => [hero.position.x + lerp(-2, 2, s.a), lerp(0.6, 1.9, s.b), lerp(-1, 1, s.c)], gOn ? 0.35 + 0.35 * Math.abs(Math.sin(T * 8)) : 0);
      }
      if (hero.userData.paint) {
        const cNow = cleanNow();
        hero.userData.paint.clearcoat = lerp(0.08, 1.0, Math.max(cNow * 0.85, gI));
        hero.userData.paint.clearcoatRoughness = lerp(0.42, 0.02, cNow);
        hero.userData.paint.envMapIntensity = lerp(0.7, 1.8, gI);

        if (hero.userData.wheels) {
          hero.userData.wheels.forEach(w => {
            if (w.userData.rimMat) {
              w.userData.rimMat.roughness = lerp(0.65, 0.18, cNow);
              w.userData.rimMat.metalness = lerp(0.45, 1.0, cNow);
              if (cNow > 0.6) w.userData.rimMat.color.setHex(0xd8dde8);
            }
          });
        }
      }
      if (hero.userData.beadMat) {
        const beads = gOn ? gI : (cleanNow() > 0.82 ? 0.62 : 0);
        hero.userData.beadMat.uniforms.uTime.value = T;
        hero.userData.beadMat.uniforms.uAmount.value = beads;
        (hero.userData.beadPlanes || []).forEach(p => { p.visible = beads > 0.05; });
      }
    }

    /* HUD */
    $('bt').textContent = soloMod ? soloTimer.toFixed(2) : (inP ? fmtT(cycleT) : (flow === 'precycle' ? ('PRE ' + Math.min(60, preT * 10).toFixed(0)) : '00.00'));
    $('stTime').innerHTML = soloMod ? (soloTimer.toFixed(2) + ' <small>/ ' + soloDuration.toFixed(0) + '.00 s SOLO</small>') : ((inP ? fmtT(cycleT) : '00.00') + ' <small>/ ' + CYCLE.toFixed(2) + ' s</small>');
    const activeMods = MODS.filter(m => inP && moduleActive(m.k, tc));
    const phase = soloMod ? ('SOLO · ' + soloMod.toUpperCase()) : (inP ? (activeMods.map(m => m.short).join(' + ') || 'CYCLE') : flow.toUpperCase());
    $('btPh').textContent = phase;
    $('stCycle').textContent = estop ? 'E-STOP' : paused ? 'PAUSED' : soloMod ? 'SOLO MOD' : (flow === 'idle' ? 'IDLE' : 'RUNNING');
    $('stCycle').style.color = estop ? 'var(--fault)' : soloMod ? 'var(--orange)' : (flow === 'idle' ? 'var(--ink)' : 'var(--live)');

    MODS.forEach(m => {
      const on = inP && moduleActive(m.k, tc);
      const done = inP && tc > m.e && !(mode === 'manual' && manualOn[m.k]);
      const st = on ? 'ACTIVE' : done ? 'DONE' : (inP && tc < m.s ? 'STANDBY' : 'PENDING');
      $('gl_' + m.k).classList.toggle('on', on);
      $('gs_' + m.k).classList.toggle('on', on);
      $('gf_' + m.k).style.width = inP ? (seg(tc, m.s, m.e) * (m.e - m.s) / CYCLE * 100) + '%' : '0%';
      $('mst_' + m.k).textContent = st; $('mst_' + m.k).className = 'st ' + st;
      $('mod_' + m.k).classList.toggle('ACTIVE', on);
      $('mb_' + m.k).style.transform = 'scaleX(' + (on || done ? seg(tc, m.s, m.e) : 0) + ')';
      const tn = $('tnm_' + m.k); if (tn) tn.classList.toggle('on', on);
    });
    const gph = $('gph');
    if (inP) {
      gph.style.opacity = 1;
      const w = grows.clientWidth || 800;
      gph.style.transform = 'translate3d(' + (108 + (tc / CYCLE) * (w - 124)) + 'px,0,0)';
    } else gph.style.opacity = 0;
    $('gpct').textContent = inP ? Math.round(tc / CYCLE * 100) + '%' : '0%';
    if ($('fvTime')) $('fvTime').textContent = inP ? fmtT(cycleT) : '00.00';
    if ($('fvActive')) $('fvActive').textContent = activeMods.length + ' / 7 live';
    MODS.forEach(m => {
      const lane = $('fv_' + m.k);
      if (lane) lane.classList.toggle('on', inP && moduleActive(m.k, tc));
      const fill = $('fvf_' + m.k);
      if (fill) fill.style.width = inP ? (seg(tc, m.s, m.e) * (m.e - m.s) / CYCLE * 100) + '%' : '0%';
    });
    document.querySelectorAll('#jumpBar [data-jump]').forEach(b => {
      const j = +b.dataset.jump;
      b.classList.toggle('on', inP && cycleT >= j && cycleT < j + 2.0);
    });
    document.body.classList.toggle('running', flow !== 'idle' && !estop);
    bloomStr = 0.08;
    if (inP) {
      if (moduleActive('scan', tc)) bloomStr = 0.14;
      if (moduleActive('ion', tc)) bloomStr = Math.max(bloomStr, 0.15);
      if (moduleActive('mist', tc)) bloomStr = Math.max(bloomStr, 0.12);
      if (moduleActive('tex', tc)) bloomStr = Math.max(bloomStr, 0.18);
      if (moduleActive('air', tc)) bloomStr = Math.max(bloomStr, 0.12);
      if (moduleActive('bottom', tc)) bloomStr = Math.max(bloomStr, 0.13);
      if (moduleActive('gloss', tc)) bloomStr = Math.max(bloomStr, 0.16);
    } else if (wakeT >= 0) bloomStr = 0.14;
    if ($('opsQ')) $('opsQ').textContent = String(queueCars.length);
    if ($('opsQtxt')) $('opsQtxt').textContent = queueCars.length + ' cars on the inbound lane';
    if ($('alLine')) {
      $('alLine').className = 'alert ' + (estop ? 'fault' : (flow === 'idle' ? 'ok' : 'ok'));
      $('alLine').querySelector('span').textContent = estop ? 'E-STOP · line halt' : (inP ? 'Cycle running · overlapped field' : 'Clear · 22.6s program armed');
    }
    const eq = $('eqMini');
    if (eq && sfx && sfxOn) {
      const bins = sfx.bins();
      if (bins) {
        const x = eq.getContext('2d');
        x.clearRect(0, 0, eq.width, eq.height);
        const n = bins.length, bw = eq.width / n;
        for (let i = 0; i < n; i++) {
          const h = (bins[i] / 255) * eq.height;
          x.fillStyle = 'rgba(255,107,26,' + (0.25 + 0.75 * bins[i] / 255) + ')';
          x.fillRect(i * bw + 1, eq.height - h, bw - 2, h);
        }
      }
    }
    const fill = $('timeFill');
    if (fill) fill.style.transform = 'scaleX(' + (inP ? tc / CYCLE : 0) + ')';
    if (inP && activeMods.length) {
      const a = activeMods[activeMods.length - 1];
      setNarr('MODULE ' + pad(MODS.indexOf(a) + 1, 2) + '/07', a.col, a.nm, a.ds, a.col);
    }

    /* sensors */
    const dirt = hero ? cleanNow() : 0;
    const zones = ['HOOD', 'ROOF', 'LEFT', 'RIGHT', 'REAR', 'GLASS', 'MIRRORS', 'BOTTOM'];
    zones.forEach(z => {
      const el = $('sz' + z); if (!el) return;
      el.setAttribute('class', 'sz');
      if (!hero) return;
      if (inP && moduleActive('scan', tc)) el.classList.add('DETECTED');
      else if (inP && moduleActive('tex', tc)) el.classList.add('ACTIVE');
      else if (z === 'BOTTOM' && inP && moduleActive('bottom', tc)) el.classList.add('ACTIVE');
      else if (dirt > 0.7) el.classList.add('CLEAR');
      else el.classList.add('DIRTY');
    });

    /* telemetry */
    const spd = (!hero || paused) ? 0 : (flow === 'inportal' ? 0.22 : (flow === 'idle' ? 0 : 1.4 * convSpd));
    $('tSpd').textContent = spd.toFixed(2) + ' m/s';
    $('tCyc').textContent = fmtT(inP ? cycleT : 0) + ' s';
    $('tAir').textContent = (inP && moduleActive('ion', tc)) || (inP && moduleActive('air', tc)) ? (18 + Math.sin(T * 3) * 2).toFixed(1) + ' m/s est.' : '—';
    $('tMist').textContent = inP && moduleActive('mist', tc) ? Math.round(tri(tc, 4, 8) * 100) + '%' : '0%';
    $('tTex').textContent = inP && moduleActive('tex', tc) ? Math.round(seg(tc, 6, 16) * 100) + '%' : '0%';
    $('tCov').textContent = Math.round(dirt * 100) + '%';
    $('tQ').textContent = String(queueCars.length);
    $('twPlc').textContent = $('stCycle').textContent;
    $('twSafe').textContent = flow === 'entry' || inP ? 'BEAM' : 'CLEAR';
    $('twConv').textContent = beltOn ? ('RUN ' + convSpd.toFixed(1) + '×') : 'STOPPED';
    $('twAct').textContent = activeMods.length + ' / 7';
    if (camMode === 'fpv' || camMode === 'hood') {
      const dist = hero ? Math.max(0, LANE.done - hero.position.x).toFixed(1) : '—';
      $('camMeta').textContent = 'FPV · ' + spd.toFixed(2) + ' m/s · EXIT ' + dist + ' m · CYCLE ' + fmtT(inP ? cycleT : 0) + ' s';
    } else if (camMode === 'drone') {
      $('camMeta').textContent = 'DRONE CAM · ALT 22.0 m · SPEED 0.4 m/s · FOV 40°';
    }
    $('tnVeh').classList.toggle('on', !!hero);
    $('tnCtl').classList.toggle('on', flow !== 'idle');
    $('tnQc').classList.toggle('on', flow === 'qc');
    $('tnEx').classList.toggle('on', flow === 'done');

    /* presenter cameras */
    if (presOn && inP) {
      if (cycleT < 2) setCam('hero');
      else if (cycleT < 6) setCam('portal');
      else if (cycleT < 12) setCam('follow');
      else if (cycleT < 21) setCam('fpv');
      else setCam('hero');
    } else if (presOn && flow === 'queueAdv') setCam('drone');
    else if (presOn && flow === 'entry') setCam('follow');
    else if (presOn && flow === 'qc') setCam('exit');

    /* engineering tags */
    if (engineering && !$('engLabels').hidden) {
      projectTag('LANE  2.60 m', new THREE.Vector3(0, 0.2, -1.3), 'etLane');
      projectTag('PORTAL  H 5.90 m', new THREE.Vector3(0, 5.9, 2.8), 'etH');
      projectTag('CENTERLINE', new THREE.Vector3(8, 0.2, 0), 'etC');
      projectTag('TEXTILE ARRAY', new THREE.Vector3(0, 3.2, 0), 'etT');
      if (hero) projectTag('VEHICLE', hero.position.clone().setY(2.2), 'etV');
    }

    /* cameras */
    applyCamera(camDt);
  }

  function camDest() {
    const hx = hero ? hero.position.x : LANE.qStart + 4;
    switch (camMode) {
      case 'hero': return { p: new THREE.Vector3(hx + (flow === 'finishBay' ? 6.5 : 7.5), (flow === 'finishBay' ? 3.4 : 4.5), (flow === 'finishBay' ? 6.2 : 9.5)), g: new THREE.Vector3(hx, 1.15, 0), lam: 4.0 };
      case 'inspect': return { p: new THREE.Vector3(25.5 + 6.8, 3.5, 6.2), g: new THREE.Vector3(25.5, 1.15, 0), lam: 4.5 };
      case 'front': return { p: new THREE.Vector3(hx + 6.2, 1.45, 0.15), g: new THREE.Vector3(hx, 1.15, 0), lam: 8 };
      case 'rear': return { p: new THREE.Vector3(hx - 6.5, 1.6, 0.4), g: new THREE.Vector3(hx, 1.2, 0), lam: 8 };
      case 'left': return { p: new THREE.Vector3(hx, 1.8, 7.5), g: new THREE.Vector3(hx, 1.1, 0), lam: 6 };
      case 'right': return { p: new THREE.Vector3(hx, 1.8, -7.5), g: new THREE.Vector3(hx, 1.1, 0), lam: 6 };
      case 'top': return { p: new THREE.Vector3(hx, 26, 0.05), g: new THREE.Vector3(hx, 0, 0), lam: 4 };
      case 'drone': return { p: new THREE.Vector3(hx + 4, 22, 18), g: new THREE.Vector3(hx, 0, 0), lam: 2.6 };
      case 'fpv': return { p: new THREE.Vector3(hx + 1.85, 1.32, 0), g: new THREE.Vector3(hx + 8, 1.15, 0), lam: 12 };
      case 'follow': return { p: new THREE.Vector3(hx - 6.2, 3.1, 4.6), g: new THREE.Vector3(hx + 2.2, 1.0, 0), lam: 6.5 };
      case 'hood': return { p: new THREE.Vector3(hx + 1.35, 1.12, 0), g: new THREE.Vector3(hx + 6, 0.85, 0), lam: 14 };
      case 'portal': return { p: new THREE.Vector3(hx - 2.8, 2.7, 3.6), g: new THREE.Vector3(hx + 0.8, 1.2, 0), lam: 6 };
      case 'cctv': {
        const pos = [[-24, 7.2, 12], [0, 8, 11], [16, 7, -10], [10, 6.4, 12]][cctvId - 1];
        const look = [[-8, 0.5, 0], [0, 1.4, 0], [14, 1, 0], [0, 1, 0]][cctvId - 1];
        return { p: new THREE.Vector3(...pos), g: new THREE.Vector3(...look), lam: 9 };
      }
      case 'factory': return { p: new THREE.Vector3(4, 16, 24), g: new THREE.Vector3(4, 0, 0), lam: 3 };
      case 'exit': return { p: new THREE.Vector3(LANE.qc + 6, 3.4, 7.2), g: new THREE.Vector3(LANE.qc, 1.2, 0), lam: 5 };
      default: return null;
    }
  }

  function applyCamera(dt) {
    dt = dt || camDt || 1 / 60;
    if (introOn && camMode === 'hero' && !G) {
      const u = ease(clamp(introT / 3.2, 0, 1));
      camera.position.lerpVectors(new THREE.Vector3(22, 24, 22), new THREE.Vector3(12, 6.2, 14), u);
      orbit.target.set(0, 1.4, 0); camera.lookAt(orbit.target); return;
    }
    if (introOn && G) { camera.lookAt(orbit.target); return; }
    if (camTweening) { camera.lookAt(orbit.target); return; }
    if ((camMode === 'hero' || camMode === 'drone' || camMode === 'inspect') && orbit.manual) {
      const x = orbit.target.x + orbit.r * Math.sin(orbit.phi) * Math.cos(orbit.theta);
      const y = orbit.target.y + orbit.r * Math.cos(orbit.phi);
      const z = orbit.target.z + orbit.r * Math.sin(orbit.phi) * Math.sin(orbit.theta);
      dampV3(camera.position, x, y, z, 8, dt);
      camera.lookAt(orbit.target); return;
    }
    const dest = camDest();
    if (!dest) return;
    dampV3(camera.position, dest.p.x, dest.p.y, dest.p.z, dest.lam, dt);
    dampV3(orbit.target, dest.g.x, dest.g.y, dest.g.z, dest.lam * 1.15, dt);
    camera.lookAt(orbit.target);
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (bloom) bloom.setSize(w, h);
    }
  }
  function loop(now) {
    requestAnimationFrame(loop);
    const realDt = Math.min(0.05, (now - lastMs) / 1000);
    lastMs = now;
    camDt = realDt;
    const dt = realDt * simSpeed;
    resize();
    try { update(paused || estop ? 0 : dt); }
    catch (err) { console.error(err); }
    if (paused || estop) applyCamera(realDt);
    try {
      if (bloom && bloom.enabled && !lofx) {
        bloom.strength = bloomStr;
        bloom.render();
      } else {
        renderer.render(scene, camera);
      }
    } catch (err) {
      bloom = null;
      renderer.render(scene, camera);
    }
    if (wantSnap === 'before') { snapBefore = captureFrame(); wantSnap = null; }
    if (wantSnap === 'after') { snapAfter = captureFrame(); wantSnap = null; }
  }
  requestAnimationFrame(loop);

  setCam('hero');
  if (!reducedMotion) playCine();
  else {
    camera.position.set(12, 6.2, 14);
    orbit.target.set(0, 1.4, 0);
    camera.lookAt(orbit.target);
  }
  const firstNav = document.querySelector('#nav .nv.on');
  if (firstNav && $('navInd')) $('navInd').style.transform = 'translateY(' + (firstNav.offsetTop + 10) + 'px)';
  log('Hub environment loaded · 7 modules armed', 'ok');
}
