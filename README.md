# CARS24 Surface Reset Portal — Industrial Digital Twin

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-success?style=for-the-badge&logo=github)](https://laksh718.github.io/cars24/)
[![Three.js](https://img.shields.io/badge/Three.js-r128-black?style=for-the-badge&logo=three.js)](https://threejs.org/)
[![WebGL](https://img.shields.io/badge/WebGL-2.0-red?style=for-the-badge&logo=webgl)](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
[![CARS24](https://img.shields.io/badge/CARS24-MRL%20Automation-orange?style=for-the-badge)](https://www.cars24.com/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

> **Autonomous 6-Station Reconditioning Line & Digital Twin for CARS24 Mega Refurbishment Labs (MRLs).**  
> Collapsing traditional 4-minute sequential detailing into a continuous **22.6-second parallel cleaning line** with **< 2.0 L rinseless polymer fluid** and zero rinse water effluent.

---



## 📋 Executive Summary

At CARS24's Mega Refurbishment Labs (MRLs), outbound vehicles undergo exterior detailing to meet certified quality standards. Traditional manual detailing takes **4 to 6 minutes per vehicle** and relies on high water volumes (~120 L/car), creating bottleneck queues and wastewater disposal challenges.

The **Surface Reset Portal** redesigns this entire process as a continuous automated line powered by **6 specialized, color-coded industrial machines** followed by a spacious **360° Finish & Vehicle Inspection Bay**:

```
[INBOUND QUEUE]
       │
       ▼
[STATION 01]  x = -9.0m  ──►  3D Optical & LiDAR Profiler (Cyan · #38BDF8)
       │                      Dual LiDAR domes, 8 photogrammetry camera pods, PLC cabinet & laser trench.
       ▼
[STATION 02]  x = -4.0m  ──►  25kV Electrostatic De-Ionization (Violet · #A855F7)
       │                      25kV pulsed DC transformer, tungsten coronal discharge needles & ion bar.
       ▼
[STATION 03]  x = +1.0m  ──►  Rinseless Polymer Encapsulation (Mint · #2DD4BF)
       │                      Pressurized chemical tanks, tempered splash glass shields & 12-nozzle mist arch.
       ▼
[STATION 04]  x = +6.0m  ──►  Robotic Conformal Textile Array (CARS24 Orange · #FF6B1A)
       │                      Articulated gantry carriage, dual rotary microfiber drums & 3-tier status stacklight.
       ▼
[STATION 05]  x = +11.0m ──►  Air-Knife Turbine Evaporator (Solar Gold · #F59E0B)
       │                      Twin centrifugal blower turbine motors, overhead aerodynamic wedge & sill slit knives.
       ▼
[STATION 06]  x = +16.0m ──►  Automated SiO₂ Nano-Coating Finisher (Quartz Rose · #EC4899)
       │                      IR curing lamp bank, spectrophotometer sensor heads & ceramic chemical canister rack.
       ▼
[QUALITY GATE] x = +18.8m ──► Automated QC Optical Gate
       │                      Automated triangulation laser scan certifying 100% CQS score.
       ▼
[FINISH BAY]  x = +25.5m ──► Spacious Final Inspection & Handover Bay (360° Clearance)
                              11.5m × 7.2m open deck, perimeter safety demarcations, soft architectural showroom
                              spotlights, permanent staging, and interactive Before / After inspection.
```

---

## ✨ Key Features & Architecture

### 1. Synchronized 22.60s Continuous Overlapped Cycle
- **Precision Timing**: Master process clock, HUD countdown, Gantt tracks, and zone-clearing windows synchronized strictly to **22.60 seconds** (`CYCLE = 22.6`).
- **Instant Jump Controls**: Skip directly to any station milestone (`0s Scan`, `1.9s Ion`, `3.8s Mist`, `5.6s Textile`, `11.3s Knife`, `19.5s Gloss`, `22.6s Done`).

### 2. High-Contrast Machinery with Physical Equipment Details
- High-contrast chassis column framing (`#222731`) with signature color-coded front casing panels.
- Backlit illuminated Station ID plates and perimeter ground safety demarcations.
- Complete physical equipment detailing (LiDAR domes, transformers, spray arches, robotic drums, turbine blowers, IR curing banks).

### 3. Distinct Chromatic Identity per Section
- **01 Scan**: Sky Cyan (`#38BDF8`)
- **02 Ion**: Royal Violet (`#A855F7`)
- **03 Mist**: Aqua Mint (`#2DD4BF`)
- **04 Textile**: CARS24 Brand Orange (`#FF6B1A`)
- **05 Air-Knife**: Solar Gold (`#F59E0B`)
- **06 Gloss**: Quartz Rose (`#EC4899`)
- Applied uniformly across 3D station casings, Gantt tracks, solo control buttons, and telemetry cards.

### 4. Solid Matte Bottom Dock & Zero Shininess
- Matte dark industrial finish (`#0c0e12` / `#0d0f14`) with `#1c2028` borders on `#dock`, `#transport`, and `#ganttWrap`.
- Removed button shine sweep animations and glowing neon box-shadows.
- 3D basalt ground floor material configured with zero specular shininess (`roughness: 0.94`, `metalness: 0.02`).

### 5. Spacious 360° Finish & Inspection Bay
- The conveyor belt, side guide rails, yellow wear bars, and rollers terminate cleanly at $x = 19.5\text{ m}$.
- The vehicle rolls off the belt ramp onto an expansive **$11.5\text{ m} \times 7.2\text{ m}$ inspection deck** centered at $x = 25.5\text{ m}$.
- Complete open clearance (over $2.7\text{ m}$ on sides, over $3.6\text{ m}$ front/rear) with zero overhead obstruction.
- Soft architectural showroom spotlighting illuminates the vehicle's mirror gloss.
- **Permanent Vehicle Staging**: The car stays parked in the finish bay and never disappears.
- Full interactive OrbitControls: rotate 360°, pan, zoom, or toggle the automatic turntable camera orbit (`🔄 360° Orbit`).

### 6. Proper Before & After Inspection System
- **Interactive 3D Before / After Toggle** (`⚡ View BEFORE / AFTER`):
  - Instantly toggles the actual 3D car in real time between its **Inbound Dirty State** (heavy road grime, mud splatters, dried water droplet rings, dull 58 GU paint) and its **Outbound Reset State** (94 GU mirror gloss, deep clearcoat reflections, SiO₂ ceramic protection, 0% dirt).
- **Studio-Grade Split Comparison Slider Modal**:
  - Dynamically renders Before and After frames from the **exact same camera perspective**, ensuring pixel-perfect alignment across the split slider.
  - Interactive split handle, range slider, side labels, and comparative metrics:
    - **Contamination**: `84% → 2%` (97.6% reduction)
    - **Gloss Rating**: `58 GU → 94 GU` (Showroom mirror finish)
    - **Surface Protection**: `98.5% SiO₂ Monolayer`
- **Floating Finish Inspection Toolbar**:
  - Non-intrusive floating HUD bar providing instant access to 3D toggle, split comparison slider, 360° orbit, and replay.

### 7. Solo Module Engine & Web Audio API Synthesis
- **Solo Testing**: Test any of the 6 modules individually with specialized cameras.
- **Auto 6-Step Sequence**: Step the vehicle sequentially through each station.
- **Procedural Audio**: Real-time oscillators, noise buffers, and resonant filters simulating electrical corona, pneumatic cylinders, turbine wind, and high-pressure fluid atomization.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **3D Engine & WebGL** | Three.js (r128), WebGL 2.0, Custom Shaders (GLSL) |
| **Post-Processing & FX** | UnrealBloomPass (fine-tuned threshold 0.88), custom dirty paint shaders |
| **Animation & Easing** | GSAP (GreenSock Animation Platform), RequestAnimationFrame loops |
| **Audio Synthesis** | Web Audio API (procedural real-time sound synthesis) |
| **UI & Styling** | Vanilla CSS3 (CSS Grid & Flexbox), IBM Plex Mono, Clash Display |
| **Deployment** | GitHub Actions & GitHub Pages |

---

## 💻 Running Locally

Clone the repository and run any static HTTP server:

```bash
# Clone repository
git clone git@github.com:Laksh718/cars24.git
cd cars24

# Using Python 3
python3 -m http.server 5500

# Using Node.js (npx)
npx serve .
```

Open `http://localhost:5500` in your web browser.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Start / Pause 22.6s cycle |
| `R` | Reset portal to idle |
| `1` – `6` | Switch camera angles (Hero, Front, Follow, Left, Top, Drone) |
| `J` | Jump to specific cycle milestone |
| `X` | Toggle ⚡ Matrix X-Ray diagnostic wireframe mode |
| `E` | Toggle engineering telemetry tags |
| `P` | Enter full-screen Presenter Mode |
| `Esc` | Exit fullscreen / close modals |

---

