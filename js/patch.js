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

/* ============ CARS24 Showcase — morphing cockpit panel + one-click jury report ============ */
(function () {
  var launch = document.getElementById('scLaunch');
  var sc = document.getElementById('showcase');
  var panel = document.getElementById('scPanel');
  if (!launch || !sc || !panel) return;
  var $ = function (id) { return document.getElementById(id); };
  var STEPS = [
    ['SCAN', '0–1.9s', '#8fb7ff'], ['IONISE', '1.9–4.7s', '#A78BFA'], ['POLYMER', '3.8–7.5s', '#38BDF8'],
    ['TEXTILE', '5.6–15.1s', '#FF8A3D'], ['AIR-KNIFE', '11.3–18.8s', '#F59E0B'], ['GLOSS', '19.5–22.6s', '#EC4899']
  ];
  var ZONES = ['ROOF', 'HOOD', 'LEFT', 'RIGHT', 'REAR', 'WHEELS'];
  var stepsEl = $('scSteps');
  STEPS.forEach(function (s, i) {
    var d = document.createElement('div'); d.className = 'sc-step'; d.id = 'scStep' + i; d.style.color = s[2];
    d.innerHTML = '<span class="dot" style="background:' + s[2] + '"></span><b>' + s[0] + '</b><span>' + s[1] + '</span>';
    stepsEl.appendChild(d);
  });

  function enter() { document.body.classList.add('showcase'); sc.setAttribute('aria-hidden', 'false'); panel.innerHTML = skeleton('idle'); lastPhase = 'idle'; window.dispatchEvent(new Event('resize')); }
  function exit() { document.body.classList.remove('showcase'); sc.setAttribute('aria-hidden', 'true'); window.dispatchEvent(new Event('resize')); }
  launch.onclick = enter;
  $('scExit').onclick = exit;
  $('scStart').onclick = function () { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true })); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.classList.contains('showcase')) exit(); });

  /* helpers to read live engine state (mirror, no coupling) */
  function secs() { var b = $('bt'); if (!b) return 0; var p = b.textContent.split('.'); return (+p[0] || 0) + (+('0.' + (p[1] || 0)) || 0); }
  function txt(id, d) { var e = $(id); return e ? e.textContent : (d || '—'); }
  function zoneRows() {
    return ZONES.map(function (z, i) {
      var w = $('zf' + i) ? ($('zf' + i).style.width || '0') : '0';
      var v = txt('zv' + i, '—');
      return '<div class="sc-zrow"><span class="zt">' + z + '</span><div class="zb"><i style="width:' + w + '"></i></div><span class="zn">' + v + '</span></div>';
    }).join('');
  }
  function bar(label, from, to, u, unit) {
    return '<div class="sc-mbar"><span>' + label + '</span><div class="t"><i style="width:' + Math.round(u * 100) + '%"></i></div>' +
      '<b>' + Math.round(from + (to - from) * u) + (unit || '') + '</b></div>';
  }
  var JURY = 'SURFACE RESET · HUB-01 Gurugram · 22.60s ✓ · Coverage 98.5% · 84→2% soil · 58→94 GU · SiO₂ 98.5% · 0 L rinse/<2 L total · 0.5 kWh · 40/hr · ~90s door-to-door · ₹18.5L / ₹120 per car / 8.0-mo payback @60/day — MODEL (pilot to validate)';

  var lastPhase = '';
  function phaseOf(t, station) {
    if (/complete|photo|handover|reset complete|done/i.test(station)) return 'done';
    if (t <= 0.02) return 'idle';
    if (t < 2) return 'scan';
    if (t < 15.1) return 'field';
    return 'finish';
  }
  function skeleton(phase) {
    if (phase === 'idle') return '<div class="sc-qhead">Ready</div><p class="sc-lede">“The bottleneck was not speed. It was sequence.”</p><p class="sc-sub">Six modules fire as one overlapped field. Press Start.</p>';
    if (phase === 'scan') return '<div class="sc-qhead">Scan · 0–1.9s</div><ul class="sc-bul">' +
      ['Envelope gate — fits the portal, else divert', 'Soil triage — standard vs +60s pre-cycle', 'Panel map — textile knows where to press', 'Dose map — mist volume per zone (<2 L)', 'QC baseline — before-% for after-proof', 'Traceability — scan ID on the report'].map(function (b) { return '<li>' + b + '</li>'; }).join('') +
      '</ul><div class="sc-verdict" id="scVerdict">STANDARD → 22.6s program</div>';
    if (phase === 'field') return '<div class="sc-qhead">Parallel field · live</div><div class="sc-big" id="scBig"></div>' + '<div class="sc-cqs"><b id="scCqs">—</b><span>CQS<br/>≥100</span></div>' + zoneRows() + '<div class="sc-modeltag">Simulation estimate</div>';
    if (phase === 'finish') return '<div class="sc-qhead">Finish · gloss + protect</div><div id="scFin"></div>' + '<div class="sc-cqs"><b id="scCqs">—</b><span>CQS<br/>≥100</span></div>' + zoneRows() + '<div class="sc-modeltag">Simulation estimate</div>';
    /* done */
    return '<div class="sc-qhead">Jury report · one slip</div><div class="sc-slip">' +
      '<b>SURFACE RESET ✓ 22.60s</b>' +
      '<div>HUB-01 Gurugram · A-sedan</div>' +
      '<div>Coverage 98.5% · soil 84→2% · gloss 58→94 GU</div>' +
      '<div>SiO₂ 98.5% · 0 L rinse / <2 L total · 0.5 kWh</div>' +
      '<div>40/hr · ~90s door-to-door · ₹18.5L · ₹120/car · 8.0-mo</div>' +
      '<span class="sc-model2">MODEL — pilot to validate</span>' +
      '</div><button class="sc-copy" id="scCopy">⧉ Copy jury line</button>';
  }
  function bindDone() {
    var c = $('scCopy'); if (!c) return;
    c.onclick = function () {
      if (navigator.clipboard) navigator.clipboard.writeText(JURY).then(function () { c.textContent = '✓ Copied'; setTimeout(function () { c.textContent = '⧉ Copy jury line'; }, 1600); });
    };
  }

  setInterval(function () {
    if (!document.body.classList.contains('showcase')) return;
    var t = secs();
    var station = txt('nNm', 'Ready — press Start');
    $('scT').textContent = txt('bt', '0.0');
    $('scStation').textContent = station;
    /* stepper active from narrator "MODULE n/6" */
    var mm = /(\d)\s*\/\s*6/.exec(txt('nNo', '')); var act = mm ? +mm[1] - 1 : -1;
    for (var i = 0; i < 6; i++) { var st = $('scStep' + i); if (st) st.classList.toggle('on', i === act); }
    /* countdown heartbeat under 5s to finish */
    sc.classList.toggle('pulse', t > 17.6 && t < 22.6);

    var phase = phaseOf(t, station);
    if (phase !== lastPhase) { panel.innerHTML = skeleton(phase); lastPhase = phase; if (phase === 'done') bindDone(); }
    /* live value updates within the phase */
    if (phase === 'field') {
      var active = 0; for (var k = 0; k < 6; k++) { if ($('scStep' + k) && $('scStep' + k).classList.contains('on')) active++; }
      var big = $('scBig');
      if (big) big.innerHTML =
        '<div><b>' + Math.max(1, active) + '/6</b><span>modules live</span></div>' +
        '<div><b>' + txt('tTex', '0%') + '</b><span>textile coverage</span></div>' +
        '<div><b>' + txt('tAir', '—') + '</b><span>air velocity</span></div>';
      if ($('scCqs')) $('scCqs').textContent = txt('tCqs', '—');
      panel.querySelectorAll('.sc-zrow').forEach(function (r, j) {
        var w = $('zf' + j) ? ($('zf' + j).style.width || '0') : '0';
        r.querySelector('.zb i').style.width = w; r.querySelector('.zn').textContent = txt('zv' + j, '—');
      });
    } else if (phase === 'finish') {
      var u = Math.max(0, Math.min(1, (t - 15.1) / 7.5));
      var fin = $('scFin');
      if (fin) fin.innerHTML = bar('Gloss', 58, 94, u, ' GU') + bar('Soil cleared', 84, 2, u, '%');
      if ($('scCqs')) $('scCqs').textContent = txt('tCqs', '—');
      panel.querySelectorAll('.sc-zrow').forEach(function (r, j) {
        var w = $('zf' + j) ? ($('zf' + j).style.width || '0') : '0';
        r.querySelector('.zb i').style.width = w; r.querySelector('.zn').textContent = txt('zv' + j, '—');
      });
    }
    var running = t > 0.02 && phase !== 'done';
    $('scStart').style.display = running ? 'none' : '';
  }, 120);
})();
