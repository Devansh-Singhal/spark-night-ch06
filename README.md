# Nabz

SPARK Night CH-06 · Early warning for repetitive arc welding on legacy equipment.

Nabz is a proposed retrofit that uses a split-core current sensor and phone audio to detect skipped or short welds and warn when the arc deviates from a known-good baseline. The first target is a fixture or fixed-torch station in an auto-component supplier's shop.

## Prototype scope

- Score held-out weld recordings using a baseline fitted on normal audio.
- Replay a staged sequence of normal and faulty recordings to demonstrate the alert.
- Use an expected arc count to flag a missing weld in a sample part sequence.

The hardware, early-warning lead time, and performance on manual welding are pilot questions. Routine teardown inspection remains part of the proposed workflow.

## Simulation (phase 1 of the website)

An interactive, light-themed simulation of one fictional shift segment at Station 02. A 3D CAD model shows the station: a fixture, a four-weld bracket, a cobot torch, the Nabz current clamp on the welding cable and the phone running the Nabz app. A weld still looks normal, Nabz hears the arc change, and you decide what the operator does. The same run then compares the baseline workflow with the Nabz workflow, down to the rupee. A Sandbox tab lets you inject faults yourself: tip wear, a skipped weld, grinder noise, an unplugged clamp, a new wire lot.

```bash
npm start        # → http://localhost:5173
```

```bash
npm test         # determinism, causality, healthy run, figure arithmetic
```

No install step is needed: Node 18+ and no dependencies. The app lives in `sim/`. `engine.js` is the pure, deterministic simulation and detector. `scene3d.js` is the three.js CAD scene. three.js r160 is vendored in `sim/vendor/` (MIT), so the page works offline. `app.js` renders every view from the engine state at the playhead. Scenarios, cost inputs and sources are in [`sim/ASSUMPTIONS.md`](sim/ASSUMPTIONS.md). All telemetry is synthetic and labelled *Simulated run* in the app.

## Sources

- [Public Sound Weld Anomaly Detection project](https://studio.edgeimpulse.com/public/47648/latest/acquisition/training)
- [Intel robotic weld study](https://arxiv.org/abs/2409.02290)
