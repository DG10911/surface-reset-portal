// js/patch.js — robustness fixes for the Surface Reset twin.
// Loads last; only mirrors state and re-fires existing handlers. Does not replace sim.js logic.
(function () {
  'use strict';

  // 1. Header sound toggle (#sfxBtn) and Settings toggle (#sfxBtn2) stay visually in sync.
  function mirror(a, b) {
    if (!a || !b) return;
    new MutationObserver(function () {
      var on = a.classList.contains('on');
      if (b.classList.contains('on') !== on) {
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
      }
    }).observe(a, { attributes: true, attributeFilter: ['class'] });
  }
  var s1 = document.getElementById('sfxBtn'), s2 = document.getElementById('sfxBtn2');
  mirror(s1, s2); mirror(s2, s1);

  // 2. Payback sliders (#cpd on Ops, #roiCpd on Case) — fire once so "— months" fills on load.
  ['cpd', 'roiCpd'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // 3. Link the two sliders so Ops and Case never show different numbers.
  var c1 = document.getElementById('cpd'), c2 = document.getElementById('roiCpd');
  function link(from, to) {
    if (!from || !to) return;
    from.addEventListener('input', function () {
      if (to.value !== from.value) {
        to.value = from.value;
        to.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }
  link(c1, c2); link(c2, c1);

  // 4. Hide the offline banner whenever THREE actually loaded.
  var off = document.getElementById('offline');
  if (off && window.THREE) off.style.display = 'none';
})();

/* a11y: reflect .on state onto aria-pressed for segmented + toggle controls */
(function () {
  function sync() {
    document.querySelectorAll('.seg button, .toggle').forEach(function (b) {
      b.setAttribute('aria-pressed', b.classList.contains('on') ? 'true' : 'false');
    });
  }
  document.addEventListener('click', function () { requestAnimationFrame(sync); }, true);
  requestAnimationFrame(sync);
})();

/* ============ CARS24 Showcase mode — clean single screen, reuses the live engine ============ */
(function () {
  var launch = document.getElementById('scLaunch');
  var sc = document.getElementById('showcase');
  if (!launch || !sc) return;
  var STEPS = [
    ['SCAN', '0–1.9s', '#8fb7ff'], ['IONISE', '1.9–4.7s', '#A78BFA'], ['POLYMER', '3.8–7.5s', '#38BDF8'],
    ['TEXTILE', '5.6–15.1s', '#FF8A3D'], ['AIR-KNIFE', '11.3–18.8s', '#F59E0B'], ['GLOSS', '19.5–22.6s', '#EC4899']
  ];
  var ZONES = ['ROOF', 'HOOD', 'LEFT', 'RIGHT', 'REAR', 'WHEELS'];
  var stepsEl = document.getElementById('scSteps');
  STEPS.forEach(function (s, i) {
    var d = document.createElement('div'); d.className = 'sc-step'; d.id = 'scStep' + i; d.style.color = s[2];
    d.innerHTML = '<span class="dot" style="background:' + s[2] + '"></span><b>' + s[0] + '</b><span>' + s[1] + '</span>';
    stepsEl.appendChild(d);
  });
  var zwrap = document.getElementById('scZones');
  ZONES.forEach(function (z, i) {
    var r = document.createElement('div'); r.className = 'sc-zrow';
    r.innerHTML = '<span class="zt">' + z + '</span><div class="zb"><i id="scZ' + i + '"></i></div><span class="zn" id="scZv' + i + '">—</span>';
    zwrap.appendChild(r);
  });
  function enter() { document.body.classList.add('showcase'); sc.setAttribute('aria-hidden', 'false'); window.dispatchEvent(new Event('resize')); }
  function exit() { document.body.classList.remove('showcase'); sc.setAttribute('aria-hidden', 'true'); window.dispatchEvent(new Event('resize')); }
  launch.onclick = enter;
  document.getElementById('scExit').onclick = exit;
  document.getElementById('scStart').onclick = function () {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
  };
  var $ = function (id) { return document.getElementById(id); };
  setInterval(function () {
    if (!document.body.classList.contains('showcase')) return;
    var bt = $('bt'); if (bt) $('scT').textContent = bt.textContent;
    var nm = $('nNm'); if (nm) $('scStation').textContent = nm.textContent;
    /* active step from narrator "MODULE n/6" */
    var no = $('nNo') ? $('nNo').textContent : '';
    var m = /(\d)\s*\/\s*6/.exec(no); var act = m ? +m[1] - 1 : -1;
    for (var i = 0; i < 6; i++) { var st = $('scStep' + i); if (st) st.classList.toggle('on', i === act); }
    /* quality mirror */
    for (var j = 0; j < 6; j++) {
      var zf = $('zf' + j), zv = $('zv' + j), sz = $('scZ' + j), sv = $('scZv' + j);
      if (zf && sz) sz.style.width = zf.style.width || '0';
      if (zv && sv) sv.textContent = zv.textContent;
    }
    var cq = $('tCqs'); if (cq) $('scCqs').textContent = cq.textContent;
    /* hide Start while a cycle is running */
    var running = bt && bt.textContent !== '00.00' && !/Ready/i.test($('scStation').textContent);
    $('scStart').style.display = running ? 'none' : '';
  }, 120);
  /* Esc exits showcase */
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.classList.contains('showcase')) exit(); });
})();
