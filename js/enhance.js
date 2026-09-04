'use strict';
/* Surface Reset Portal — ENHANCE.JS
   Additive polish layer. Zero risk — does not modify sim.js or fx.js.
   Runs after sim.js. All features are self-contained. */
(function () {
  /* ── util ── */
  const qs = (s, p) => (p || document).querySelector(s);
  const qsa = (s, p) => [...(p || document).querySelectorAll(s)];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  /* ───────────────────────────────────────────────────────────────
     1. ANIMATED NUMBER COUNTER
     Usage: animCount(el, target, duration, prefix, suffix, decimals)
  ─────────────────────────────────────────────────────────────── */
  function animCount(el, target, duration, prefix, suffix, decimals) {
    if (!el) return;
    prefix = prefix || '';
    suffix = suffix || '';
    decimals = decimals || 0;
    const start = performance.now();
    const from = parseFloat(el.textContent.replace(/[^0-9.]/g, '')) || 0;
    function tick(now) {
      const u = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - u, 3); // cubic ease-out
      const v = from + (target - from) * ease;
      el.textContent = prefix + (decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString('en-IN')) + suffix;
      if (u < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ───────────────────────────────────────────────────────────────
     2. FLEET KPI ANIMATED COUNTERS on phase change
  ─────────────────────────────────────────────────────────────── */
  const phaseSeg = qs('#phaseSeg');
  const fkHubs = qs('#fkHubs');
  if (phaseSeg && fkHubs) {
    const observer = new MutationObserver(() => {
      const hubs = parseInt(fkHubs.textContent || '0');
      animCount(qs('#fkThru'), hubs * 40, 800, '', '');
      animCount(qs('#fkCars'), hubs * 36, 1000, '', '');
      animCount(qs('#fkEn'), Math.round(hubs * 0.5 * 40), 900, '', '');
    });
    observer.observe(fkHubs, { childList: true, subtree: true, characterData: true });
  }

  /* ───────────────────────────────────────────────────────────────
     3. INDIA MAP — city name labels (SVG text) on large phases
  ─────────────────────────────────────────────────────────────── */
  function addMapLabels() {
    const svg = qs('#indiaSvg');
    if (!svg || svg._labelled) return;
    svg._labelled = true;
    const KEY_CITIES = [
      [210, 92, 'Gurugram'], [218, 86, 'Delhi'], [128, 248, 'Mumbai'],
      [198, 338, 'Bengaluru'], [230, 355, 'Chennai'], [208, 285, 'Hyderabad'],
      [305, 205, 'Kolkata'], [155, 268, 'Pune']
    ];
    KEY_CITIES.forEach(([x, y, name]) => {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', x + 7);
      t.setAttribute('y', y + 4);
      t.setAttribute('font-size', '9');
      t.setAttribute('font-family', 'IBM Plex Mono, monospace');
      t.setAttribute('fill', 'rgba(243,240,232,0.52)');
      t.setAttribute('pointer-events', 'none');
      t.setAttribute('class', 'map-label');
      t.textContent = name;
      svg.appendChild(t);
    });
  }
  // Run when fleet page shown
  const fleetNav = qs('[data-page="fleet"]');
  if (fleetNav) {
    fleetNav.addEventListener('click', () => {
      setTimeout(addMapLabels, 60);
    });
  }

  /* ───────────────────────────────────────────────────────────────
     4. ANALYTICS AUTO-REFRESH while simulation runs
     Redraws every 4 seconds if the analytics page is active
  ─────────────────────────────────────────────────────────────── */
  /* (removed) fake "live feel" jitter on #aSucc and a dead drawAllCharts branch —
     the analytics KPI now shows its modelled value without random drift. */

  /* ───────────────────────────────────────────────────────────────
     5. DONE CARD — 24-second TROPHY CELEBRATION
     Adds a glowing ring animation on cycle complete
  ─────────────────────────────────────────────────────────────── */
  const doneCard = qs('#doneCard');
  if (doneCard) {
    const obs = new MutationObserver(() => {
      if (doneCard.classList.contains('on')) {
        spawnTrophy();
      }
    });
    obs.observe(doneCard, { attributes: true, attributeFilter: ['class'] });
  }
  function spawnTrophy() {
    const inner = qs('#doneCard .inner');
    if (!inner || qs('#trophyRing')) return;
    const ring = document.createElement('div');
    ring.id = 'trophyRing';
    ring.innerHTML = `
      <svg viewBox="0 0 120 120" width="80" height="80" style="margin:0 auto 12px;display:block;animation:trophySpin 3s linear infinite">
        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,107,26,0.18)" stroke-width="3"/>
        <circle cx="60" cy="60" r="50" fill="none" stroke="#FF6B1A" stroke-width="3"
          stroke-dasharray="314" stroke-dashoffset="220"
          style="animation:trophyArc 1.2s cubic-bezier(.16,1,.3,1) forwards;transform-origin:60px 60px;transform:rotate(-90deg)"/>
        <text x="60" y="68" text-anchor="middle" fill="#FF6B1A"
          font-family="Barlow Condensed,sans-serif" font-size="28" font-weight="700">24</text>
        <text x="60" y="82" text-anchor="middle" fill="rgba(243,240,232,0.5)"
          font-family="IBM Plex Mono,monospace" font-size="8" letter-spacing="2">SECONDS</text>
      </svg>`;
    ring.style.cssText = 'text-align:center;margin-bottom:8px;animation:fadeIn .4s ease-out';
    inner.insertBefore(ring, inner.firstChild);
    // Remove after 6s to avoid duplicates on replay
    setTimeout(() => { if (ring.parentNode) ring.parentNode.removeChild(ring); }, 7000);
  }

  /* ───────────────────────────────────────────────────────────────
     6. QUALITY PAGE — car silhouette shimmer after cleaning
  ─────────────────────────────────────────────────────────────── */
  const baPlay = qs('#baPlay');
  if (baPlay) {
    baPlay.addEventListener('click', () => {
      const afterSvg = qs('#baAfter .car-svg');
      if (!afterSvg) return;
      setTimeout(() => {
        afterSvg.style.transition = 'filter 1s ease-out';
        afterSvg.style.filter = 'drop-shadow(0 0 8px rgba(46,229,157,0.6)) saturate(1.3) brightness(1.15)';
        setTimeout(() => {
          afterSvg.style.filter = 'saturate(1.15) brightness(1.05)';
        }, 2200);
      }, 2000);
    });
  }

  /* ───────────────────────────────────────────────────────────────
     7. ROI PAGE — competition table animated reveal
  ─────────────────────────────────────────────────────────────── */
  const compPanel = qs('#compPanel');
  if (compPanel) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          animateCompTable();
          io.disconnect();
        }
      });
    }, { threshold: 0.3 });
    io.observe(compPanel);
  }
  function animateCompTable() {
    const rows = qsa('#compPanel tbody tr');
    rows.forEach((row, i) => {
      row.style.opacity = '0';
      row.style.transform = 'translateX(-10px)';
      setTimeout(() => {
        row.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
        row.style.opacity = '';
        row.style.transform = '';
      }, i * 120 + 200);
    });
    // Highlight the SRP column
    const srpCells = qsa('#compPanel tbody td:last-child');
    srpCells.forEach((cell, i) => {
      setTimeout(() => {
        cell.style.transition = 'color 0.3s ease-out';
        cell.style.color = 'var(--orange)';
        cell.style.fontWeight = '600';
      }, i * 120 + 800);
    });
  }

  /* ───────────────────────────────────────────────────────────────
     8. OPERATOR CONSOLE — shift stats live animation
  ─────────────────────────────────────────────────────────────── */
  const dashNav = qs('[data-page="dashboard"]');
  if (dashNav) {
    dashNav.addEventListener('click', () => {
      setTimeout(() => {
        animCount(qs('#opsShift'), 127, 800, '', '');
        animCount(qs('#opsHeavy'), 3, 600, '', '');
        animCount(qs('#opsQ'), 4, 400, '', '');
      }, 80);
    });
  }

  /* ───────────────────────────────────────────────────────────────
     9. KPI CARDS — pulse animation on first view
  ─────────────────────────────────────────────────────────────── */
  function pulseKpis(viewEl) {
    if (!viewEl) return;
    const kpiVals = qsa('.kpi .v', viewEl);
    kpiVals.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(() => {
        el.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
        el.style.opacity = '';
        el.style.transform = '';
      }, i * 80 + 100);
    });
  }
  document.querySelectorAll('#nav .nv').forEach(btn => {
    btn.addEventListener('click', () => {
      setTimeout(() => {
        const view = qs('#view-' + btn.dataset.page);
        if (view && view.classList.contains('on')) pulseKpis(view);
      }, 60);
    });
  });

  /* ───────────────────────────────────────────────────────────────
     10. KEYBOARD SHORTCUT OVERLAY
     Press ? to show a quick reference overlay
  ─────────────────────────────────────────────────────────────── */
  function buildShortcutOverlay() {
    if (qs('#shortcutOverlay')) return;
    const ov = document.createElement('div');
    ov.id = 'shortcutOverlay';
    ov.style.cssText = `
      position:fixed;inset:0;z-index:999;background:rgba(11,12,14,.88);
      display:none;align-items:center;justify-content:center;
    `;
    ov.innerHTML = `
      <div style="background:#141618;border:1px solid rgba(243,240,232,.14);max-width:480px;width:90%;padding:24px 28px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
          <b style="font-family:'Barlow Condensed',sans-serif;font-size:16px;letter-spacing:.16em;text-transform:uppercase">
            Keyboard shortcuts
          </b>
          <button id="scClose" style="background:transparent;border:1px solid rgba(243,240,232,.14);color:#F3F0E8;padding:4px 8px;font-size:12px;cursor:pointer">ESC</button>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;font-family:'IBM Plex Mono',monospace">
          ${[
            ['Space', 'Start / Pause cycle'],
            ['R', 'Reset simulation'],
            ['E', 'Toggle engineering overlay'],
            ['P', 'Enter jury presenter mode'],
            ['J', 'Show parallel field hero view'],
            ['1', 'Hero camera'],
            ['2', 'Vehicle follow camera'],
            ['3', 'Portal internal camera'],
            ['4', 'FPV camera'],
            ['5', 'Drone camera'],
            ['6', 'CCTV bank'],
            ['Esc', 'Exit presenter / close cinematic'],
            ['?', 'Show this overlay'],
          ].map(([k, d]) => `
            <tr style="border-bottom:1px solid rgba(243,240,232,.06)">
              <td style="padding:7px 0;width:100px">
                <kbd style="background:#22262C;border:1px solid rgba(243,240,232,.18);padding:2px 8px;font-size:11px;border-radius:2px;letter-spacing:.04em">${k}</kbd>
              </td>
              <td style="padding:7px 0;color:#C9C4B8">${d}</td>
            </tr>`).join('')}
        </table>
        <p style="margin:14px 0 0;font-size:11px;color:#7C7870;font-family:'Barlow Condensed',sans-serif;letter-spacing:.12em;text-transform:uppercase">
          Surface Reset Portal · Cars24 Digital Twin · Simulation
        </p>
      </div>`;
    document.body.appendChild(ov);
    qs('#scClose', ov).onclick = () => { ov.style.display = 'none'; };
    ov.addEventListener('click', e => { if (e.target === ov) ov.style.display = 'none'; });
    return ov;
  }
  addEventListener('keydown', e => {
    if (e.target instanceof Element && e.target.matches('input,textarea')) return;
    if (e.key === '?') {
      const ov = buildShortcutOverlay();
      if (ov) ov.style.display = ov.style.display === 'flex' ? 'none' : 'flex';
    }
  });

  /* ───────────────────────────────────────────────────────────────
     11. AMBIENT SCANLINE on CCTV / FPV modes
     Adds a CSS class to body when CCTV cam is active
     (sim.js already toggles stage.cctv — we extend the visual)
  ─────────────────────────────────────────────────────────────── */
  const stageEl = document.getElementById('stage');
  if (stageEl) {
    const camObs = new MutationObserver(() => {
      document.body.classList.toggle('cctv-active', stageEl.classList.contains('cctv'));
    });
    camObs.observe(stageEl, { attributes: true, attributeFilter: ['class'] });
  }

  /* ───────────────────────────────────────────────────────────────
     12. ROI PAYBACK SLIDER — real-time chart update
  ─────────────────────────────────────────────────────────────── */
  const roiCpd = document.getElementById('roiCpd');
  const cpd = document.getElementById('cpd');
  [roiCpd, cpd].forEach(slider => {
    if (!slider) return;
    slider.addEventListener('input', () => {
      const roiPay = qs('#roiPay');
      if (roiPay) {
        roiPay.style.color = 'var(--live)';
        setTimeout(() => { roiPay.style.color = ''; }, 500);
      }
    });
  });

  /* ───────────────────────────────────────────────────────────────
     13. CYCLE COMPLETE CONFETTI-LIKE PARTICLE BURST (CSS only)
  ─────────────────────────────────────────────────────────────── */
  function burstParticles(x, y) {
    const colors = ['#FF6B1A', '#2EE59D', '#FFD200', '#5BA8D4', '#D478A0'];
    for (let i = 0; i < 18; i++) {
      const p = document.createElement('div');
      const angle = (i / 18) * Math.PI * 2;
      const dist = 60 + Math.random() * 80;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const size = 4 + Math.random() * 6;
      p.style.cssText = `
        position:fixed;left:${x}px;top:${y}px;
        width:${size}px;height:${size}px;
        background:${colors[i % colors.length]};
        border-radius:${Math.random() > 0.5 ? '50%' : '0'};
        pointer-events:none;z-index:9999;
        animation:burst 0.9s cubic-bezier(.16,1,.3,1) forwards;
        --dx:${dx}px;--dy:${dy}px;
      `;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 950);
    }
  }
  // Inject keyframes once
  const burstStyle = document.createElement('style');
  burstStyle.textContent = `
    @keyframes burst {
      0%   { transform:translate(0,0) scale(1); opacity:1; }
      80%  { opacity:0.8; }
      100% { transform:translate(var(--dx),var(--dy)) scale(0.2); opacity:0; }
    }
    @keyframes trophySpin { to { transform:rotate(360deg); } }
    @keyframes trophyArc {
      from { stroke-dashoffset:314; }
      to   { stroke-dashoffset:60; }
    }
    @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
    body.cctv-active #stage::after {
      content:'';
      position:absolute;inset:0;pointer-events:none;z-index:8;
      background:repeating-linear-gradient(
        0deg,
        transparent, transparent 2px,
        rgba(0,0,0,.07) 2px, rgba(0,0,0,.07) 4px
      );
    }
    /* Smooth KPI value transitions */
    .kpi .v { transition: color 0.25s ease-out; }

    /* India map label fade */
    .map-label { animation: fadeIn 0.4s ease-out both; }

    /* Enhanced jump bar active state */
    .jump button.on {
      background: rgba(255,107,26,.12);
      box-shadow: 0 0 0 1px var(--orange);
    }

    /* Done card trophy ring container */
    #trophyRing { animation: fadeIn 0.4s ease-out; }

    /* Scrollbar styling for views */
    .view::-webkit-scrollbar { width:4px; }
    .view::-webkit-scrollbar-track { background:transparent; }
    .view::-webkit-scrollbar-thumb { background:rgba(243,240,232,.12); }
    .view::-webkit-scrollbar-thumb:hover { background:rgba(243,240,232,.22); }

    /* Analytics chart area */
    canvas.chart { border:1px solid rgba(243,240,232,.06); }

    /* Comp table last col highlight */
    #compPanel tbody td:last-child {
      color:var(--orange);
      font-weight:600;
    }

    /* Fault banner entrance */
    #faultBanner:not([hidden]) {
      animation:slideDown 0.25s cubic-bezier(.16,1,.3,1);
    }
    @keyframes slideDown {
      from { transform:translate(-50%,-120%); }
      to   { transform:translate(-50%,0); }
    }

    /* Done card entrance */
    #doneCard.on .inner {
      animation:cardIn 0.32s cubic-bezier(.16,1,.3,1);
    }
    @keyframes cardIn {
      from { opacity:0; transform:translateY(14px) scale(0.97); }
      to   { opacity:1; transform:none; }
    }

    /* Parallel field viz — hero mode track glow */
    #fieldViz.hero .fv-lane.on .fv-track {
      box-shadow: 0 0 12px rgba(255,107,26,.25);
    }

    /* Hub dot pulse glow (overrides basic pulse) */
    .hub-dot.flag.on {
      filter: drop-shadow(0 0 6px #FFD200);
      animation: hubPulse 2s ease-in-out infinite;
    }
    .hub-dot.metro.on {
      filter: drop-shadow(0 0 4px #FF6B1A);
    }
  `;
  document.head.appendChild(burstStyle);

  // Trigger burst on cycle complete
  const doneObs = new MutationObserver(() => {
    const dc = document.getElementById('doneCard');
    if (dc && dc.classList.contains('on')) {
      const rect = dc.getBoundingClientRect();
      burstParticles(
        rect.left + rect.width / 2,
        rect.top + rect.height / 3
      );
    }
  });
  const dc = document.getElementById('doneCard');
  if (dc) doneObs.observe(dc, { attributes: true, attributeFilter: ['class'] });

  /* ───────────────────────────────────────────────────────────────
     14. ANALYTICS PAGE — module utilization doughnut accent
     Draws a mini donut on the Util chart showing Textile dominance
  ─────────────────────────────────────────────────────────────── */
  function drawUtilDonut() {
    const canvas = document.getElementById('chUtil');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    // Background grid
    ctx.strokeStyle = 'rgba(243,240,232,.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = 16 + i * (h - 32) / 3;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    const mods = [
      { name: 'Scan', pct: 8, col: '#8B95A1' },
      { name: 'Ion', pct: 12, col: '#9B8FD4' },
      { name: 'Mist', pct: 17, col: '#5BA8D4' },
      { name: 'Text', pct: 41, col: '#FF6B1A' },
      { name: 'Air', pct: 33, col: '#E8C04A' },
      { name: 'Gloss', pct: 12, col: '#D478A0' }
    ];
    const bw = (w - 20) / mods.length;
    const maxH = h - 36;
    const maxPct = 45;
    mods.forEach((m, i) => {
      const bh = (m.pct / maxPct) * maxH;
      const bx = 10 + i * bw;
      // Bar
      ctx.fillStyle = m.col;
      ctx.globalAlpha = 0.18;
      ctx.fillRect(bx + 4, h - 20 - bh, bw - 8, bh);
      ctx.globalAlpha = 1;
      // Top bright cap
      ctx.fillStyle = m.col;
      ctx.fillRect(bx + 4, h - 20 - bh, bw - 8, 3);
      // Label
      ctx.fillStyle = m.col;
      ctx.font = '600 9px IBM Plex Mono';
      ctx.textAlign = 'center';
      ctx.fillText(m.name, bx + bw / 2, h - 7);
      // Percentage
      ctx.fillStyle = 'rgba(243,240,232,0.6)';
      ctx.font = '600 9px IBM Plex Mono';
      ctx.fillText(m.pct + '%', bx + bw / 2, h - 20 - bh - 5);
    });
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  /* ───────────────────────────────────────────────────────────────
     15. CYCLE TIME DISTRIBUTION — bell curve chart
  ─────────────────────────────────────────────────────────────── */
  function drawCycleDistribution() {
    const canvas = document.getElementById('chCyc');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    // Grid
    ctx.strokeStyle = 'rgba(243,240,232,.06)';
    for (let i = 0; i < 4; i++) {
      const y = 16 + i * (h - 32) / 3;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    const bins = [
      { label: '21–22', count: 1 }, { label: '22–23', count: 4 },
      { label: '23–24', count: 38 }, { label: '24–25', count: 6 },
      { label: '25–26', count: 1 }
    ];
    const max = Math.max(...bins.map(b => b.count));
    const bw = (w - 20) / bins.length;
    bins.forEach((b, i) => {
      const bh = (b.count / max) * (h - 40);
      const bx = 10 + i * bw;
      const isTarget = b.label === '23–24';
      ctx.fillStyle = isTarget ? '#5BA8D4' : 'rgba(91,168,212,0.35)';
      ctx.fillRect(bx + 4, h - 24 - bh, bw - 8, bh);
      if (isTarget) {
        ctx.fillStyle = '#5BA8D4';
        ctx.fillRect(bx + 4, h - 24 - bh, bw - 8, 2);
      }
      ctx.fillStyle = 'rgba(243,240,232,0.55)';
      ctx.font = '9px IBM Plex Mono';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, bx + bw / 2, h - 10);
      if (b.count > 1) {
        ctx.fillStyle = '#5BA8D4';
        ctx.fillText(b.count + 'x', bx + bw / 2, h - 24 - bh - 5);
      }
    });
    // Target line
    const targetX = 10 + 2 * bw + bw / 2;
    ctx.strokeStyle = 'rgba(255,107,26,0.5)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(targetX, 12); ctx.lineTo(targetX, h - 24); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#FF6B1A';
    ctx.font = '600 8px Barlow Condensed';
    ctx.textAlign = 'center';
    ctx.fillText('TARGET', targetX, 10);
    ctx.textAlign = 'left';
  }

  /* Hook into page switch to draw enhanced charts */
  const origSetPage = window._srpSetPage;
  document.querySelectorAll('#nav .nv').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.page === 'analytics') {
        setTimeout(() => {
          drawUtilDonut();
          drawCycleDistribution();
        }, 80);
      }
    });
  });

  /* ───────────────────────────────────────────────────────────────
     16. SPLIT REVEAL — drag cursor feedback
  ─────────────────────────────────────────────────────────────── */
  const splitStage = document.getElementById('splitStage');
  if (splitStage) {
    splitStage.style.cursor = 'ew-resize';
  }

  /* ───────────────────────────────────────────────────────────────
     17. MAINTENANCE PAGE — animated health bars on entry
  ─────────────────────────────────────────────────────────────── */
  const maintNav = document.querySelector('[data-page="maintenance"]');
  if (maintNav) {
    maintNav.addEventListener('click', () => {
      setTimeout(() => {
        const bars = document.querySelectorAll('.health .track i');
        bars.forEach(bar => {
          const target = bar.style.width;
          bar.style.width = '0%';
          bar.style.transition = 'none';
          setTimeout(() => {
            bar.style.transition = 'width 0.8s cubic-bezier(.16,1,.3,1)';
            bar.style.width = target;
          }, 30);
        });
      }, 80);
    });
  }

  /* ───────────────────────────────────────────────────────────────
     18. HUB SWITCHER — animate the brand subtitle
  ─────────────────────────────────────────────────────────────── */
  const hubSel = document.getElementById('hubSel');
  const brandSub = document.querySelector('.brand-copy span');
  if (hubSel && brandSub) {
    hubSel.addEventListener('change', () => {
      brandSub.style.opacity = '0';
      brandSub.style.transition = 'opacity 0.2s ease-out';
      setTimeout(() => {
        brandSub.style.opacity = '';
      }, 220);
    });
  }

  /* ───────────────────────────────────────────────────────────────
     19. FLEET ROLLOUT — animated counter while dots appear
  ─────────────────────────────────────────────────────────────── */
  const rollBtn = document.getElementById('rollBtn');
  if (rollBtn) {
    rollBtn.addEventListener('click', () => {
      setTimeout(() => animCount(qs('#fkHubs'), 3, 300, '', ''), 0);
      setTimeout(() => animCount(qs('#fkHubs'), 50, 600, '', ''), 1400);
      setTimeout(() => animCount(qs('#fkHubs'), 200, 900, '', ''), 3200);
    });
  }

  /* ───────────────────────────────────────────────────────────────
     20. JURY MODE — hide cursor after 3s of inactivity
  ─────────────────────────────────────────────────────────────── */
  let cursorTimer = null;
  document.addEventListener('mousemove', () => {
    if (!document.body.classList.contains('presenter')) return;
    document.body.style.cursor = '';
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(() => {
      if (document.body.classList.contains('presenter')) {
        document.body.style.cursor = 'none';
      }
    }, 3000);
  });

  /* ── done ── */
  console.log('[SRP Enhance] v1.0 loaded · 20 features active');
})();
