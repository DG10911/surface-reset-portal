'use strict';
/* Surface Reset Portal — visual FX + sound
   Bloom, particle clouds, dirt/bead shaders, Web Audio. Simulated. */
window.SRP = window.SRP || {};

(function (SRP) {
  const TWO = Math.PI * 2;

  SRP.dirtVert = [
    'varying vec2 vUv;',
    'void main(){',
    '  vUv = uv;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);',
    '}'
  ].join('\n');

  SRP.dirtFrag = [
    'uniform sampler2D uDirt;',
    'uniform float uDirtLevel;',
    'uniform float uWaveX;',
    'uniform vec3 uColor;',
    'varying vec2 vUv;',
    'void main(){',
    '  vec4 dTex = texture2D(uDirt, vUv * 1.8);',
    '  float rawDirt = clamp(dTex.r * 1.5 + dTex.g * 0.8 + dTex.b * 0.5 + dTex.a * 0.7, 0.0, 1.0);',
    '  float wave = clamp(uWaveX, 0.0, 1.0);',
    '  float wipe = step(0.01, wave) * smoothstep(wave - 0.06, wave + 0.06, vUv.x);',
    '  float remain = (1.0 - wipe) * uDirtLevel;',
    '  float edge = smoothstep(0.05, 0.0, abs(vUv.x - wave)) * step(0.02, wave) * step(wave, 0.98);',
    '  vec3 mudTone = mix(vec3(0.26, 0.19, 0.12), vec3(0.38, 0.30, 0.20), dTex.g);',
    '  vec3 finalCol = mix(mudTone, vec3(0.95, 0.92, 0.85), edge * 0.7);',
    '  float alpha = clamp(rawDirt * remain * 1.45 + edge * 0.5, 0.0, 0.96);',
    '  gl_FragColor = vec4(finalCol, alpha);',
    '}'
  ].join('\n');

  SRP.beadVert = SRP.dirtVert;

  SRP.beadFrag = [
    'uniform float uTime;',
    'uniform float uAmount;',
    'varying vec2 vUv;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'void main(){',
    '  vec2 uv = vUv;',
    '  vec2 cell = vec2(16.0, 10.0);',
    '  vec2 gv = fract(uv * cell) - 0.5;',
    '  vec2 id = floor(uv * cell);',
    '  float n = hash(id);',
    '  if (n < 0.38) { gl_FragColor = vec4(0.0); return; }',
    '  vec2 jitter = vec2(hash(id + 1.7), hash(id + 4.3)) - 0.5;',
    '  float drift = sin(uTime * (0.4 + n) + n * 12.0) * 0.08;',
    '  float d = length(gv - jitter * 0.28 - vec2(0.0, drift));',
    '  float r = 0.07 + n * 0.08;',
    '  float bead = smoothstep(r, r * 0.35, d);',
    '  float hl = smoothstep(r * 0.45, 0.0, length(gv - jitter * 0.28 - vec2(-0.02, -0.03 + drift)));',
    '  vec3 col = mix(vec3(0.55, 0.78, 0.95), vec3(1.0), hl);',
    '  gl_FragColor = vec4(col, bead * uAmount * 0.72);',
    '}'
  ].join('\n');

  SRP.dirtMaterial = function (map, level) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uDirt: { value: map },
        uDirtLevel: { value: level == null ? 1 : level },
        uWaveX: { value: 0.0 },
        uColor: { value: new THREE.Color(0x54432c) }
      },
      vertexShader: SRP.dirtVert,
      fragmentShader: SRP.dirtFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
  };

  SRP.beadMaterial = function () {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAmount: { value: 0 }
      },
      vertexShader: SRP.beadVert,
      fragmentShader: SRP.beadFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
  };

  /* Circular additive particles */
  SRP.makeCloud = function (scene, n, color, size) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const life = new Float32Array(n);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      life[i] = 0;
      seed[i] = Math.random();
      pos[i * 3 + 1] = -20;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uSize: { value: size },
        uOpacity: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) }
      },
      vertexShader: [
        'attribute float aLife;',
        'uniform float uSize;',
        'uniform float uPixelRatio;',
        'varying float vLife;',
        'void main(){',
        '  vLife = aLife;',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  gl_PointSize = uSize * uPixelRatio * (120.0 / max(1.0, -mv.z));',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor;',
        'uniform float uOpacity;',
        'varying float vLife;',
        'void main(){',
        '  vec2 p = gl_PointCoord - vec2(0.5);',
        '  float d = length(p);',
        '  if (d > 0.5) discard;',
        '  float a = smoothstep(0.5, 0.12, d) * uOpacity * clamp(vLife, 0.0, 1.0);',
        '  gl_FragColor = vec4(uColor, a);',
        '}'
      ].join('\n'),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.visible = false;
    scene.add(pts);
    return { pts, pos, vel, life, seed, n, geo, mat, mode: '' };
  };

  SRP.tickCloud = function (P, dt, intensity, mode, origin, T, lofx) {
    if (!P) return;
    const n = lofx ? (P.n * 0.38) | 0 : P.n;
    const ox = origin.x, oy = origin.y || 0, oz = origin.z || 0;
    const on = intensity > 0.03;
    P.pts.visible = on;
    if (!on) {
      P.mat.uniforms.uOpacity.value = 0;
      return;
    }
    P.mat.uniforms.uOpacity.value = Math.min(1, intensity * 1.15);
    for (let i = 0; i < n; i++) {
      let L = P.life[i] - dt * (mode === 'air' ? 2.4 : mode === 'mist' ? 1.15 : mode === 'ion' ? 0.85 : 0.7);
      const s = P.seed[i];
      if (L <= 0) {
        if (mode === 'mist') {
          L = 0.55 + s * 0.55;
          P.pos[i * 3] = ox + (s - 0.5) * 3.8;
          P.pos[i * 3 + 1] = 3.85 + s * 0.2;
          P.pos[i * 3 + 2] = (P.seed[(i + 3) % P.n] - 0.5) * 1.9;
          P.vel[i * 3] = (s - 0.5) * 0.35;
          P.vel[i * 3 + 1] = -1.15 - s * 0.85;
          P.vel[i * 3 + 2] = (P.seed[(i + 5) % P.n] - 0.5) * 0.4;
        } else if (mode === 'ion') {
          L = 0.9 + s * 0.7;
          const a = s * TWO;
          P.pos[i * 3] = ox + (s - 0.5) * 3.2;
          P.pos[i * 3 + 1] = 0.55 + s * 2.2;
          P.pos[i * 3 + 2] = Math.sin(a) * 1.05;
          P.vel[i * 3] = 0.15;
          P.vel[i * 3 + 1] = 0.55 + s * 0.4;
          P.vel[i * 3 + 2] = Math.cos(a) * 0.55;
        } else if (mode === 'air') {
          L = 0.28 + s * 0.22;
          const side = s < 0.5 ? -1 : 1;
          P.pos[i * 3] = ox + (s - 0.5) * 3.0;
          P.pos[i * 3 + 1] = 0.55 + P.seed[(i + 2) % P.n] * 1.6;
          P.pos[i * 3 + 2] = side * 0.95;
          P.vel[i * 3] = (s - 0.5) * 0.8;
          P.vel[i * 3 + 1] = -0.4 - s * 0.5;
          P.vel[i * 3 + 2] = side * (4.2 + s * 2.4);
        } else {
          L = 0.8 + s * 0.9;
          P.pos[i * 3] = ox + (s - 0.5) * 3.4;
          P.pos[i * 3 + 1] = 2.4 + s * 0.6;
          P.pos[i * 3 + 2] = (P.seed[(i + 7) % P.n] - 0.5) * 1.6;
          P.vel[i * 3] = (s - 0.5) * 0.15;
          P.vel[i * 3 + 1] = -0.35 - s * 0.25;
          P.vel[i * 3 + 2] = (P.seed[(i + 1) % P.n] - 0.5) * 0.12;
        }
      }
      P.life[i] = L;
      P.pos[i * 3] += P.vel[i * 3] * dt;
      P.pos[i * 3 + 1] += P.vel[i * 3 + 1] * dt;
      P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
      if (mode === 'ion') {
        P.pos[i * 3 + 2] += Math.sin(T * 3.2 + s * 10) * dt * 0.35;
      }
      if (mode === 'mist') {
        P.pos[i * 3] += Math.sin(T * 2 + s * 8) * dt * 0.12;
      }
    }
    for (let i = n; i < P.n; i++) P.life[i] = 0;
    P.geo.attributes.position.needsUpdate = true;
    P.geo.attributes.aLife.needsUpdate = true;
  };

  /* Ion streamlines around the body */
  SRP.makeStreams = function (scene, count, segs, color) {
    const lines = [];
    for (let i = 0; i < count; i++) {
      const g = new THREE.BufferGeometry();
      const p = new Float32Array(segs * 3);
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      const mat = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const line = new THREE.Line(g, mat);
      line.visible = false;
      line.frustumCulled = false;
      scene.add(line);
      lines.push({ line, p, g, segs, seed: Math.random() });
    }
    return lines;
  };

  SRP.tickStreams = function (lines, intensity, origin, T) {
    const on = intensity > 0.04;
    lines.forEach((L, li) => {
      L.line.visible = on;
      L.line.material.opacity = on ? intensity * 0.55 : 0;
      if (!on) return;
      const s = L.seed;
      const side = li % 2 === 0 ? 1 : -1;
      const y0 = 0.45 + (li % 5) * 0.28;
      for (let k = 0; k < L.segs; k++) {
        const u = k / (L.segs - 1);
        const x = origin.x - 2.2 + u * 4.4;
        const y = y0 + Math.sin(u * 4.2 + T * 2.4 + s * 6) * 0.18;
        const z = side * (0.55 + Math.sin(u * Math.PI) * 0.85 + Math.sin(T * 3 + li) * 0.08);
        L.p[k * 3] = x;
        L.p[k * 3 + 1] = y;
        L.p[k * 3 + 2] = z;
      }
      L.g.attributes.position.needsUpdate = true;
    });
  };

  /* Lightweight bloom (no extra three.js examples required) */
  SRP.makeBloom = function (renderer, scene, camera) {
    const pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
    const rtScene = new THREE.WebGLRenderTarget(4, 4, pars);
    if (rtScene.texture) rtScene.texture.encoding = THREE.sRGBEncoding;
    const rtBright = new THREE.WebGLRenderTarget(2, 2, pars);
    const rtBlur = new THREE.WebGLRenderTarget(2, 2, pars);
    const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const fsScene = new THREE.Scene();
    const vsh = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.0); }';
    const brightMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, threshold: { value: 0.88 } },
      vertexShader: vsh,
      fragmentShader: [
        'uniform sampler2D tDiffuse; uniform float threshold; varying vec2 vUv;',
        'void main(){',
        '  vec4 c = texture2D(tDiffuse, vUv);',
        '  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));',
        '  gl_FragColor = vec4(c.rgb * smoothstep(threshold, threshold + 0.20, l), 1.0);',
        '}'
      ].join('\n')
    });
    const blurMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        dir: { value: new THREE.Vector2(1, 0) },
        res: { value: new THREE.Vector2(1, 1) }
      },
      vertexShader: vsh,
      fragmentShader: [
        'uniform sampler2D tDiffuse; uniform vec2 dir; uniform vec2 res; varying vec2 vUv;',
        'void main(){',
        '  vec2 px = dir / res;',
        '  vec4 c = texture2D(tDiffuse, vUv) * 0.227;',
        '  c += texture2D(tDiffuse, vUv + px * 1.384) * 0.316;',
        '  c += texture2D(tDiffuse, vUv - px * 1.384) * 0.316;',
        '  c += texture2D(tDiffuse, vUv + px * 3.230) * 0.070;',
        '  c += texture2D(tDiffuse, vUv - px * 3.230) * 0.070;',
        '  gl_FragColor = c;',
        '}'
      ].join('\n')
    });
    const compMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        strength: { value: 0.22 }
      },
      vertexShader: vsh,
      fragmentShader: [
        'uniform sampler2D tScene; uniform sampler2D tBloom; uniform float strength; varying vec2 vUv;',
        'void main(){',
        '  vec4 s = texture2D(tScene, vUv);',
        '  vec4 b = texture2D(tBloom, vUv);',
        '  gl_FragColor = vec4(s.rgb + b.rgb * strength, 1.0);',
        '}'
      ].join('\n')
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), brightMat);
    fsScene.add(quad);
    let W = 4, H = 4;
    return {
      strength: 0.18,
      enabled: true,
      setSize: function (w, h) {
        W = Math.max(2, w | 0); H = Math.max(2, h | 0);
        rtScene.setSize(W, H);
        const bw = Math.max(2, (W / 2) | 0), bh = Math.max(2, (H / 2) | 0);
        rtBright.setSize(bw, bh);
        rtBlur.setSize(bw, bh);
        blurMat.uniforms.res.value.set(bw, bh);
      },
      render: function () {
        renderer.setRenderTarget(rtScene);
        renderer.render(scene, camera);
        const prevTM = renderer.toneMapping;
        renderer.toneMapping = THREE.NoToneMapping;
        quad.material = brightMat;
        brightMat.uniforms.tDiffuse.value = rtScene.texture;
        renderer.setRenderTarget(rtBright);
        renderer.render(fsScene, fsCam);
        quad.material = blurMat;
        blurMat.uniforms.tDiffuse.value = rtBright.texture;
        blurMat.uniforms.dir.value.set(1, 0);
        renderer.setRenderTarget(rtBlur);
        renderer.render(fsScene, fsCam);
        blurMat.uniforms.tDiffuse.value = rtBlur.texture;
        blurMat.uniforms.dir.value.set(0, 1);
        renderer.setRenderTarget(rtBright);
        renderer.render(fsScene, fsCam);
        quad.material = compMat;
        compMat.uniforms.tScene.value = rtScene.texture;
        compMat.uniforms.tBloom.value = rtBright.texture;
        compMat.uniforms.strength.value = this.strength;
        renderer.setRenderTarget(null);
        renderer.render(fsScene, fsCam);
        renderer.toneMapping = prevTM;
      }
    };
  };

  /* Web Audio — no samples, all synthesized */
  SRP.Audio = function () {
    let ctx = null, master = null, hum = null, muted = false, unlocked = false;
    const analyser = { node: null, data: null };

    function ensure() {
      if (ctx) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.18;
      analyser.node = ctx.createAnalyser();
      analyser.node.fftSize = 64;
      analyser.data = new Uint8Array(analyser.node.frequencyBinCount);
      master.connect(analyser.node);
      analyser.node.connect(ctx.destination);
      return ctx;
    }

    function envGain(dur, peak, attack, release) {
      const g = ctx.createGain();
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      g.connect(master);
      return g;
    }

    function osc(type, freq, dur, peak, slide) {
      if (!ensure() || muted) return;
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), ctx.currentTime + dur);
      o.connect(envGain(dur, peak, 0.02, dur));
      o.start();
      o.stop(ctx.currentTime + dur + 0.05);
    }

    function noise(dur, peak, hpHz, lpHz) {
      if (!ensure() || muted) return;
      const n = Math.max(1, (ctx.sampleRate * dur) | 0);
      const buf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      let node = src;
      if (hpHz) {
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = hpHz;
        node.connect(hp); node = hp;
      }
      if (lpHz) {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = lpHz;
        node.connect(lp); node = lp;
      }
      node.connect(envGain(dur, peak, 0.01, dur));
      src.start();
    }

    return {
      unlock: function () {
        if (!ensure()) return;
        if (ctx.state === 'suspended') ctx.resume();
        unlocked = true;
      },
      setMuted: function (on) {
        muted = !!on;
        if (master) master.gain.value = muted ? 0 : 0.18;
        if (muted) this.stopHum();
      },
      muted: function () { return muted; },
      startHum: function () {
        if (!ensure() || muted || hum) return;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = 62;
        const o2 = ctx.createOscillator();
        o2.type = 'triangle';
        o2.frequency.value = 93;
        const g = ctx.createGain();
        g.gain.value = 0.07;
        o.connect(g); o2.connect(g); g.connect(master);
        o.start(); o2.start();
        hum = { o: o, o2: o2, g: g };
      },
      stopHum: function () {
        if (!hum) return;
        try { hum.o.stop(); hum.o2.stop(); } catch (e) {}
        hum = null;
      },
      scan: function () { osc('sine', 920, 0.55, 0.12, 2400); noise(0.35, 0.04, 1800, 6000); },
      ion: function () { noise(0.9, 0.1, 400, 2400); osc('sine', 180, 0.8, 0.04, 90); },
      mist: function () { noise(1.1, 0.09, 900, 5000); },
      tex: function () { noise(0.28, 0.08, 200, 1800); noise(0.18, 0.05, 80, 600); },
      air: function () { osc('sawtooth', 220, 1.1, 0.08, 70); noise(1.0, 0.12, 300, 2800); },
      gloss: function () {
        osc('sine', 660, 0.7, 0.08, 990);
        osc('sine', 880, 0.85, 0.06, 1320);
      },
      complete: function () {
        osc('sine', 523.25, 0.9, 0.1);
        setTimeout(function () { osc('sine', 659.25, 0.9, 0.09); }, 90);
        setTimeout(function () { osc('sine', 783.99, 1.1, 0.1); }, 180);
      },
      estop: function () { osc('square', 420, 0.35, 0.12); setTimeout(function () { osc('square', 280, 0.4, 0.12); }, 200); },
      fault: function () { osc('square', 190, 0.5, 0.1); noise(0.4, 0.06, 80, 400); },
      bins: function () {
        if (!analyser.node) return null;
        analyser.node.getByteFrequencyData(analyser.data);
        return analyser.data;
      }
    };
  };
})(window.SRP);
