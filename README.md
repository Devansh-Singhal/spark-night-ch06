# Nabz

SPARK Night CH-06 · Early warning for repetitive arc welding on legacy equipment.

Nabz is a proposed retrofit that uses a split-core current sensor and phone audio to detect skipped or short welds and warn when the arc deviates from a known-good baseline. The first target is a fixture or fixed-torch station in an auto-component supplier's shop.

## Prototype scope

- Score held-out weld recordings using a baseline fitted on normal audio.
- Replay a staged sequence of normal and faulty recordings to demonstrate the alert.
- Use an expected arc count to flag a missing weld in a sample part sequence.

The hardware, early-warning lead time, and performance on manual welding are pilot questions. Routine teardown inspection remains part of the proposed workflow.

## Run locally

Use Git and Node.js 22 or later (with npm) to run both apps. The replay alone works on Node.js 18 or later. Neither app requires `npm install`.

```sh
git clone https://github.com/Devansh-Singhal/spark-night-ch06.git
cd spark-night-ch06
```

### Browser replay

From the repository root, run:

```sh
npm start
```

Open <http://localhost:5173/>. The replay follows a fictional shift at Station 02 and lets you compare what happens when the operator keeps running or stops to check the setup.

- A 3D CAD view shows the station: the fixture, a four-weld bracket, a cobot torch, the Nabz current clamp on the welding cable, and the phone running the Nabz app. Drag to orbit.
- Press **Play** to watch the four seams in **Slow**: the torch approaches each joint, lays a cooling bead under a blue arc, and throws sparks with a light smoke trail. **Welds** gives a close view. Pause freezes the effects; scrubbing reconstructs them. Reduced-motion preferences hide sparks and smoke. **Normal** and **Fast** show finished parts in time-lapse.
- **Full screen** expands the simulation while keeping playback controls and operator decisions available. Use **Exit full screen** or **Esc** to return.
- **Next event** jumps to the next thing Nabz reports. Drag the charts to scrub back.
- The **Sandbox** tab lets you inject faults: a worn tip, a skipped weld, grinder noise, an unplugged clamp, or a new wire lot.

All telemetry is synthetic. three.js r160 is vendored in `sim/vendor/` (MIT), so the replay works offline. See the [simulation assumptions](sim/ASSUMPTIONS.md) for scenarios, costs, and sources.

### Judge site

From the repository root, run:

```sh
cd site
npm run dev
```

Open <http://127.0.0.1:4179/>. By default, **Run the simulation** opens the judge site’s built-in trace walkthrough.

To launch the full browser replay from the judge site, keep the replay running in a separate terminal and create `site/.env.local` with this line:

```dotenv
NABZ_SIMULATOR_URL=http://localhost:5173/
```

If you change the replay’s port using the `PORT` environment variable, use that port in the URL. Restart the judge site with `npm run dev` after changing the file so the build picks up the new URL.

### Run tests

From the repository root:

```sh
npm test
npm --prefix site test
```

### Build the judge site

From the repository root, run `npm --prefix site run build` to generate `site/dist/` for static hosting. To preview an existing build locally, run `npm --prefix site start` and open <http://127.0.0.1:4179/>. For a hosted replay, set `NABZ_SIMULATOR_URL` to the hosted URL before building. See the [judge site README](site/README.md) for more details.

## Sources

- [Public Sound Weld Anomaly Detection project](https://studio.edgeimpulse.com/public/47648/latest/acquisition/training)
- [Intel robotic weld study](https://arxiv.org/abs/2409.02290)
