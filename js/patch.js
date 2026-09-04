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
