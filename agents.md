# Nabz — React PWA product and implementation handoff

Prepared **17 November 2026** from this repository and the primary sources linked below.

**Read this entire document before building the app.** It is a product brief, research synthesis, interaction specification, and implementation contract for the next agent. It specifies future work; it does not claim that the proposed app or integrations already exist. The requested filename is `agents.md`; tools that discover only `AGENTS.md` must be told to read this file explicitly. Maintain one authoritative copy.

**Navigation:** [Assignment](#1-the-assignment) · [Existing code](#2-what-exists-what-to-reuse-and-what-is-missing) · [Research](#3-research-that-should-shape-the-product) · [Users and industries](#4-users-and-industries) · [Priorities and routes](#5-release-priorities-and-navigation) · [Feature specifications](#6-feature-specifications) · [Decision model](#7-decision-model-preserve-evidence-before-choosing-a-headline) · [UI specification](#8-ui-direction-a-workshop-instrument-with-a-distinct-nabz-identity) · [Architecture](#9-implementation-architecture) · [Data contracts](#10-data-contracts-and-persistence) · [PWA and privacy](#11-pwa-reliability-capture-limits-and-privacy) · [Acceptance checks](#12-concrete-fixtures-and-acceptance-checks) · [Build order](#13-build-sequence-finish-vertical-slices) · [Hackathon demo](#14-hackathon-demonstration-and-defensible-differentiation) · [Pilot and economics](#15-pilot-evaluation-and-economics) · [Open questions](#16-open-questions-and-deliberate-exclusions) · [Sources](#17-source-index-and-reading-order).

## 1. The assignment

Build **Nabz**, an installable React PWA that helps a welding operator notice a missing or short weld, investigate a sustained process change, and leave a usable record for the quality lead.

Nabz means pulse. The product takes the pulse of a welding operation using current and sound, then connects the evidence to a specific workpiece and an action. The website explains the idea; the simulator explains the mechanism; **the app must let someone do the work**.

The broader positioning is:

> Earlier warnings and traceable checks for repeatable arc-welding jobs on the equipment a workshop already owns.

Automotive is the original example, not a restriction on the product. Support a fixture job in general fabrication, agricultural equipment, or metal furniture through the same station, job, weld, workpiece, inspection, and disposition workflow. Broaden by supporting real job differences, not by changing a sector label.

### The experience to optimize

An operator should be able to answer these questions within a few seconds:

1. Which station, job, and workpiece am I monitoring?
2. Are the signals available, fresh, and suitable for this check?
3. How many arc events did the recipe expect, and what was observed?
4. Does this part need attention? Why?
5. What do I do now, and was my action recorded?

A quality lead should be able to reconstruct the answer later, including the recipe and baseline versions in effect at the time.

### Non-negotiable product truths

- **Missing/short arc events are rule checks.** They are not an AI classification of internal weld quality.
- **Unusual sound is a reason to investigate.** It does not establish porosity, lack of fusion, or another specific defect.
- **A matching arc count does not prove every intended joint was welded.** Repeated arcs at the wrong location can fool counting. Position identity requires a validated sequence, fixture signal, or other independent evidence.
- **No signal means an unavailable check.** Never turn missing, stale, clipped, or misaligned data into a green result.
- **Normal monitoring is not inspection acceptance.** Nabz does not replace the customer's inspection plan, qualified welding procedures, or required destructive/nondestructive examination.
- **The app advises people.** It does not stop a welder, unlock a fixture, certify a joint, or authorize shipment.
- **Replay, recorded evidence, and live capture are different modes.** Their provenance stays visible on screens and exports.
- **Keep the first release local and useful.** A working replay, persistent part record, and honest inspection workflow take priority over a cloud diagram.

### Deliverable boundary

This document authorizes a future implementation plan. For the app build, create a separate `app/` project unless the repository has changed by then. Preserve the existing site and simulator. Do not silently rewrite this brief's unmeasured hypotheses into product claims.

## 2. What exists, what to reuse, and what is missing

### Repository inventory

| Existing item | What it actually supplies | How the app should use it |
| --- | --- | --- |
| [docs.md](docs.md) | Original problem, proposed current/audio mechanism, data plan, pricing hypotheses, pilot ask | Preserve the mechanism and evidence boundaries; update positioning beyond the first automotive customer |
| [README.md](README.md) | Run instructions and honest prototype description | Keep its existing commands working; add an app section when an app exists |
| [sim/engine.js](sim/engine.js) | Pure deterministic synthetic telemetry, segmentation, recipe checks, robust audio scores, drift decisions, outcome model | Reuse for the original replay; read its callers before changing any export |
| [sim/engine.test.mjs](sim/engine.test.mjs) | Tests for reproducibility, causal decisions, noise, dropout, staged faults, and modeled costs | Preserve these expectations for the original scenario; add focused tests for new shared logic |
| [sim/ASSUMPTIONS.md](sim/ASSUMPTIONS.md) | Synthetic scenario definitions, thresholds, cost assumptions, sources | Keep the same disclosures in the app's evidence/details view |
| [sim/app.js](sim/app.js) | Browser replay UI and operator decision presentation | Borrow domain language and useful evidence presentation, not its DOM manipulation architecture |
| [sim/scene3d.js](sim/scene3d.js) | `createStation`, the existing bracket, fixture, cable clamp, phone, and torch scene | Link to the simulator; do not make loading 3D a prerequisite for the operator screen |
| [sim/welding.js](sim/welding.js) | `positionTorch`, `createWeldingEffects`, replay-time animation | Leave in the simulator unless a later, explicit app need justifies reuse |
| [sim/fullscreen.js](sim/fullscreen.js) | `bindFullscreen` with browser error handling | Reuse only in a compatible DOM integration; React lifecycle cleanup is required if adapted |
| [site/index.html](site/index.html), [site/style.css](site/style.css) | Public explanation and an existing visual identity | Carry forward the Nabz wordmark, pale industrial paper, teal action color, and technical typography |
| [site/model.js](site/model.js) | `estimateSavings`, `readSimulatorUrl` | Reuse the savings calculation if needed; validate form inputs at the caller; do not invent a second formula with the same name |
| [site/cases.html](site/cases.html) | Failure-case context and source caveats | Keep educational case studies outside the daily operator workflow |
| Root and site package files | Separate Node entry points, no existing React app dependencies | Inspect again before installing; React, routing, a PWA tool, and testing packages are not currently installed here |

`docs.md` contains older status language about a staged screen. The repository now includes executable replay detection on synthetic inputs. That is progress, but it is **not** a trained, validated real-audio detector or a verified sensor integration. Do not describe either extreme incorrectly.

### Simulator facts worth preserving

The original replay has one fictional `RSB-417` bracket at Station 02, a 48-second cycle, four weld slots, and parts 0101–0220. Its current gate uses 40 A on, 20 A off, 0.3 seconds minimum dwell, and simulated 50 Hz samples. Its minimum arc duration is 80% of the nominal recipe duration. These are **replay settings**, not universal welding limits.

The synthetic acoustic baseline uses eight band features, per-position median/MAD scaling, 40 baseline parts and 40 separate normal validation parts. Its derived threshold is 1.38. The part score is the median of the available arc scores. Watching occurs at 2 elevated results in a window of 6 valid scored parts; an advisory occurs at 4 in 6. Those sample counts and thresholds demonstrate code behavior, not statistical sufficiency for deployment.

The worn-tip replay raises an advisory at part 0163. Ignoring it eventually produces a hold on 0184, with W3 absent. The healthy scenario includes a loud one-arc distraction and a clamp dropout; the wire-lot scenario demonstrates a false advisory. Preserve the false-positive and unavailable-data cases, not just the impressive fault case.

### Important reuse limits

- `JOB`, `DETECTOR`, `BASELINE`, recipe matching, and several user strings assume the original four-weld job. A second job needs parameterized data and matching, not a replacement heading.
- `runScenario` computes a complete synthetic run. A replay adapter must reveal only events up to the replay clock. Future events and simulated `truth` must never leak into the operator's evidence or decisions.
- `policy = 'act'` simulates a successful intervention and knows the injected fault. In a real app, an operator action is recorded first; its success is established by subsequent observations and inspection.
- The part median intentionally suppresses a single noisy arc. It can also hide an isolated anomalous weld. Keep per-weld evidence visible and do not advertise comprehensive defect detection.
- Segmentation is currently a batch function. A streaming implementation must handle an arc crossing a sample chunk, an arc open at cycle end, reconnects, and partial coverage. Do not mark an open/truncated pulse complete just because an array ended.
- The illustrative band labels include 16 kHz. A 16 kHz sampled recording cannot contain a 16 kHz band. A real feature extractor needs its own sample-rate-aware specification and baseline; do not treat synthetic feature values as extracted real audio.
- Fixed time-window matching assumes repeatable timing. Manual variation and tack/restart patterns need a separate, validated matching policy.

### Future change scope checklist

Before editing shared code, search all imports and callers. If the engine becomes recipe-aware, update the simulator's `runScenario`, `currentTrace`, `segmentArcs`, baseline fitting, outcome calculations, UI strings, tests, assumptions, and app adapter together. Preserve the original defaults. If URL integration changes, update the site build configuration, README, launcher, validation, and tests. If a record schema changes, update persistence migrations, seed fixtures, imports, exports, and selectors together.

For this handoff itself, the change scope is only `agents.md`. Existing working-tree changes belong to their author.

## 3. Research that should shape the product

The observations below come from the linked sources. **Nabz product decisions are inferences**, not results measured by those sources. No customer interviews, factory visits, hardware trials, market-size studies, or Nabz model evaluations were performed for this document.

### 3.1 Weld sound is useful evidence, with transfer limits

Stemmer et al.'s robotic-welding study reports an average ROC AUC of 0.92 for combined audio/video across its evaluated defect types. It also discusses deliberately induced defects and the need to validate on naturally occurring production faults. This supports researching acoustic anomaly signals; it does not establish a cheap phone microphone's performance, a warning lead time, or current-plus-audio performance for Nabz. AUC is not a percentage of welds correctly classified. [Intel research paper](https://arxiv.org/html/2409.02290v1)

Rohe et al. studied acoustic detection of shielding-gas process anomalies in GMAW with an automated, housed experimental setup. The distinction between a changed process and an established bead defect matters. Nabz should say “The arc sound changed; check the setup,” and test nearby grinders, other welders, microphone movement, and phone processing before interpreting scores. [GMAW acoustic study](https://www.mdpi.com/2504-4494/5/4/135)

### 3.2 Public data can bootstrap experiments, not prove the product

The public Sound Weld Anomaly Detection project currently lists 109 training examples, 21 test examples, 24m 34s total, and channels named `mic`, `ac ch1`, and `ac ch2` at 50 kHz. Start by documenting the microphone data and labels. Verify what the other channels measure rather than naming them current or voltage. Public visibility does not by itself establish redistribution or commercial-use rights. [Edge Impulse acquisition page](https://studio.edgeimpulse.com/public/47648/latest/acquisition/training)

Intel's dataset card describes over 4,000 annotated multimodal samples and a research-only access/license arrangement. It notes intended-defect label noise and possible sensor misalignment. Keep it optional and out of the app bundle; a hackathon must not depend on access approval. Do not redistribute its clips, models, or derived artifacts without checking the applicable terms. [Intel dataset card](https://huggingface.co/datasets/IntelLabs/Intel_Robotic_Welding_Multimodal_Dataset)

### 3.3 The workflow extends beyond automotive; the calibration does not

TWI describes MIG/MAG as used across numerous industry sectors. That supports a broader welding-workflow product. It does not show that a detector fitted to one material, transfer mode, joint, fixture, microphone, or station transfers to another. **Industry is organizational metadata; recipe and baseline compatibility control the detector.** [TWI MIG/MAG overview](https://www.twi-global.com/what-we-do/research-and-technology/technologies/welding-joining-and-cutting/arc-processes-and-welding-engineering/metal-inert-active-gas-mig-mag-welding)

### 3.4 Competitors establish useful expectations

| Primary source | Capability described by its maker | Consequence for Nabz |
| --- | --- | --- |
| [Fronius WeldCube](https://www.fronius.com/en-us/usa/welding-technology/world-of-welding/welding-data-collection) | Welding-data documentation, component/seam traceability, analysis, and different local/central storage offerings | A traceable part record and readable evidence are basic product requirements, not a unique invention |
| [Fronius WeldCube Connector](https://manuals.fronius.com/html/4204260363/en-US.html) | A separate connector with measuring, configuration, and identification facilities | Do not claim incumbent systems cannot retrofit existing equipment; Nabz's installation and cost advantages need measured comparisons |
| [WeldEye Quality Management](https://www.weldeye.com/solutions/quality-management) | WPS-oriented parameter monitoring, deviation alerts, weld-level records, mobile workflows, and multibrand options | Borrow the seriousness of job versions and inspection records; avoid claiming compliance from current and sound alone |
| [Lincoln CheckPoint](https://promotions.lincolnelectric.com/checkpoint/) | Weld monitoring for cost, quality, and performance visibility | A generic factory dashboard will not differentiate this project |

**Differentiation hypothesis:** affordable current-plus-phone-audio sensing, operator-readable missing/short-arc evidence, and local records that work without internet, aimed at small workshops with repeat jobs. Validate installation effort, signal quality, false-alert cost, pricing, and actual alternatives before claiming an advantage. Do not invent competitor prices or say “first,” “only,” or “works with any welder.”

### 3.5 A PWA is a good interface, with an explicit capture boundary

Web Bluetooth has limited browser availability, requires a secure context, and device selection requires user interaction. Start any experimental direct sensor pairing with a tested Android/Chrome combination, feature-detect it, and provide replay/import fallback. Do not promise equivalent direct Bluetooth capture on every platform. [MDN Web Bluetooth](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)

Browsers may freeze or discard pages. A screen wake lock can be released, including when the document is inactive. Installing the PWA is not evidence of uninterrupted acquisition. Therefore the hackathon uses foreground replay; real monitoring needs capture-gap handling, and a production deployment may need an independently buffering gateway. [Chrome page lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api), [MDN wake lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)

Microphone access requires permission and a secure context. Requested audio constraints are not a substitute for checking actual track settings. Record sample rate and processing configuration; a microphone or processing change can invalidate the baseline. [MDN microphone capture](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [MDN track settings](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getSettings)

IndexedDB is suitable for structured local records, but browser storage has quotas and eviction behavior. Local persistence needs quota-error handling and export; it is not a factory backup strategy. Background Sync is not universally available, so eventual cloud upload must also retry while the app is open. [MDN storage](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), [MDN Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)

## 4. Users and industries

### Roles: design for different decisions

| Person | Main task | Default view | Must not be forced to do |
| --- | --- | --- | --- |
| Welding operator | Run the selected job, confirm a part boundary, respond to an instruction | Current station, current part, weld progress, one primary action | Interpret model metrics, navigate billing, or type a paragraph every cycle |
| Quality lead / supervisor | Investigate a held/unverified part, document inspection and disposition, manage recipe/baseline versions | Attention queue and part evidence | Guess what threshold was active or lose the original alert after acknowledging it |
| Workshop owner / production lead | Review shift coverage, unresolved work, interruptions, and pilot economics | Shift report | Read an unexplained AI score or mistake modeled savings for accounting |
| Installer / technical team | Check capture, calibration, synchronization, and baseline compatibility | Station setup and diagnostics | Hide acquisition failure behind “Connected” |

For a local demonstration, a role switch may present these views. Label it **Demo role**; it is not authentication or a security boundary. Real permissions belong on a trusted backend before shared production use.

### Expansion matrix

These are proposed use cases to validate, not a list of sectors where Nabz has proven performance.

| Segment | Example workpiece | Why it may fit | What differs | Delivery decision |
| --- | --- | --- | --- | --- |
| Automotive components | Repeated bracket on a fixture | Existing scenario; known expected arcs | Existing four-slot recipe and synthetic baseline | Preserve as the reference replay |
| General fabrication | Repeated mounting frame or support assembly | Discrete repeat welds and identifiable workpieces | Joint map, fixture timing, permitted restarts, material and consumables | First non-automotive template and demo |
| Agricultural equipment | Implement mounting assembly or guard frame | Repeated assemblies with several seams | Thickness, work position, cycle variability, inspection plan | Same app model; pilot after job-specific calibration |
| Metal furniture | Mild-steel stool frame or rack assembly | High repetition and understandable seam map | Short tacks, thin material, re-ignitions, distortion concerns | Strong illustrative second demo; do not count every tack as a finished joint |
| Construction equipment | Repeated fabricated subassembly | Potential repeat fixtures | Longer/multipass welds and pass identity | Later extension with pass-aware recipes |
| Rail, shipbuilding, structural fabrication | Identified assembly and weld map | Traceability is useful | Long jobs, multiple operators, passes, demanding inspection obligations | Workflow exploration only until independently validated |
| Pressure equipment, pipelines, aerospace | Critical welds | Documentation relevance alone | Different failure consequences, process controls, qualification and inspection needs | Outside the first monitoring claim; never pitch the prototype as acceptance equipment |
| Spot/resistance, TIG, MMA/stick, laser, friction welding | Different welding process | Possible future research | Different sensing physics, event meaning, and baseline | Explicitly unsupported in the first detector |
| Casting, machining, other manufacturing | Not an arc-welding job | Challenge-level future possibility | Different sensors, features, labels, and validation | Do not add to this app build |

### Initial product boundary

**One workshop, one actively monitored station on a device, one active versioned job at a time, and repeat single-pass MIG/MAG/GMAW jobs.** Support several saved recipes and historical station records. Do not fake a live factory fleet. Make the underlying workpiece model sector-neutral so later stations and pass-aware jobs do not require replacing the core records.

Use “workpiece” in the data model and “part” in short operator copy. Accept alphanumeric identifiers; leading zeros matter. Do not call all parts brackets or require a vehicle model.

## 5. Release priorities and navigation

### Priority definitions

- **P0 — hackathon product:** must work end to end on local synthetic replay, with persistent records, a non-automotive recipe, honest states, and an installable offline shell.
- **P1 — evidence/pilot:** real recorded-data import/scoring and experimental foreground capture, only after their input format and scorer exist.
- **P2 — expansion:** cloud sync, authenticated roles, more stations/processes, and integrations after field evidence.

P0 may contain a device diagnostics screen, but its unimplemented live connection must say “Live capture not configured.” Do not implement a connect animation that manufactures a device.

### Information architecture

| Route, proposed | Purpose | Main action |
| --- | --- | --- |
| `/` | Open last selected station, or first-run setup | Resume station / Open demo |
| `/station/:stationId` | Operator work surface | Start part / Finish part / Follow current instruction |
| `/parts` | Search and filter recorded workpieces | Open part |
| `/parts/:partId` | Evidence and complete history for one internal part ID | Record inspection / Record disposition |
| `/alerts` | Unresolved holds, advisories, and verification problems | Review evidence |
| `/jobs` | Saved recipes and their readiness | Open / Create recipe |
| `/jobs/:jobId` | Recipe details, versions, baseline reference | Save draft / Activate version |
| `/reports` | Shift summary and export | Export CSV / Print report |
| `/setup` | Station identity, capabilities, storage, install, diagnostics | Save station / Export backup |
| `/demo` | Replay scenarios and guided demonstration | Run scenario / Reset demo |

Use browser navigation and deep links. If deploying under `/app/`, configure the build base, router, manifest, service-worker scope, and host fallback consistently. A direct refresh of a part detail must work. Prefer routes over a maze of modal windows.

On desktop/tablet, the main navigation is **Station, Parts, Attention, Jobs, Reports**, with Setup and Demo secondary. On a phone, use four labeled bottom destinations: **Station, Parts, Attention, More**. More contains Jobs, Reports, Setup, and Demo. The active station and current source mode stay visible.

## 6. Feature specifications

Every feature below describes behavior, important states, and a completion check. Screens should derive from shared records; do not hand-author different numbers in different panels.

### F01. First run and station setup — P0

**Purpose:** move a new user into an understandable station without pretending a sensor is already connected.

1. First screen offers **Open demo station** and **Set up a station**. Demo must be available without an account or device permission.
2. Setup asks for workshop label, station label, sector for organization, timezone, and a saved job/template. Workshop/station names are required; sector is optional.
3. Show a capability checklist: offline shell ready, local storage available, microphone permission/capability, Bluetooth capability, and whether a live adapter exists. “Supported” and “connected” are separate.
4. Select input mode explicitly. P0 supports Synthetic replay. Recorded data and Live remain explanatory unavailable options until implemented.
5. A recipe preview shows workpiece, material/process, expected weld slots, boundary method, and baseline status before selection.
6. Save locally. Refresh returns to that station and mode, without starting capture or replay automatically.

**States:** unconfigured; saving; locally saved; storage unavailable; invalid station/job selection. Show errors beside fields and retain typed values.

**Done when:** a fresh browser can reach a functioning demo station in two deliberate actions, and a configured station survives reload. No permission prompt occurs simply from landing on the app.

### F02. Job recipes and sector-neutral templates — P0

**Purpose:** tell Nabz what operation was intended, without embedding automotive assumptions in the UI.

Recipe fields:

| Field | Requirement and behavior |
| --- | --- |
| Job ID, workpiece name, drawing/revision reference | Job ID/name required; drawing reference optional; preserve user-entered string identifiers |
| Sector | Optional classification; does not set detection thresholds |
| Process, material, thickness | Explicit recipe context; unsupported process cannot activate this detector |
| Wire and gas identifiers | Record configuration; do not guess composition from the sector |
| Weld slots | Ordered IDs/names, nominal/minimum duration, optional planned time window, and simple schematic coordinates |
| Boundary method | P0 manual Start/Finish or replay markers; fixture input is a future integration |
| Sequence assumption | Fixed ordered slots or explicitly unsupported flexible matching; do not silently switch semantics |
| Restart/tack policy | What events are excluded or require review; approved by the supervisor for the real job |
| Detector configuration | Versioned thresholds and data coverage requirements; demo values clearly marked |
| Baseline compatibility | Link to an approved baseline for that exact configuration, or show audio scoring unavailable |
| Inspection reference | Short reference to the workshop's existing plan; app does not generate a qualified WPS |

Use a table of weld slots with Add/Remove controls. A small 2D SVG seam map is enough; editing a CAD drawing is outside scope. A template is a starting draft, not an approved procedure.

Ship two complete illustrative recipes: the existing four-weld automotive bracket and a six-weld mild-steel frame. They must actually have different expected weld arrays and simulated intervals. Additional industry templates can be drafts without fake measurements.

**Validation:** unique nonempty weld IDs, finite positive durations, minimum no greater than nominal, valid ordered windows when used, valid hysteresis (`on > off`), and supported process. Show units. Prevent saving an empty active recipe. Reject nonfinite values rather than coercing them to zero.

**Versioning:** edit as a draft; activate only between parts; keep the old immutable version for historical records. Changing weld count, sequence, consumables, capture profile, or material makes baseline compatibility need review. New parts reference the new version; old parts retain the old one.

**Done when:** switching from four to six welds changes the schematic, expected count, progress, replay data, detail table, and report consistently. A reload cannot rewrite the recipe used by an old record.

### F03. Start, identify, and finish a part — P0

**Purpose:** create trustworthy workpiece boundaries. Silence between arcs is not sufficient evidence that a new part was loaded.

- Before Start, show station, recipe/version, source, capture readiness, and next display ID.
- Manual mode uses a clear **Start part** button. Allocate a stable internal UUID at start; generate a separate readable ID such as `FAB-000184`. Allow a user-supplied batch or work order.
- Start locks the recipe and source for that part. Only one part may be active at a station.
- During an active arc, Finish is disabled with “Arc still active.” After arc end, **Finish part** confirms the boundary and finalizes checks.
- In replay, source markers define boundaries; show “Boundary: replay marker.” Never imply a hardware fixture input was received.
- No automatic final verdict based on elapsed cycle time. A watchdog may ask the operator to check an overdue part; it cannot confirm the boundary.
- **Cancel part** requires a short reason, preserves the record as cancelled, and does not reuse its ID. A cancelled part is not checks-clear.
- On interrupted session recovery, show the unfinished record and ask to reconcile it; do not silently create a normal completed part.

**Done when:** double-tapping Start cannot create two parts, refresh preserves an unfinished part, and no missed-weld hold is issued before the part boundary is known. Any observed short-arc finding can be recorded earlier, but the part summary remains provisional until closure.

### F04. Operator station and weld progress — P0

**Purpose:** give a physical, immediate picture of the current job.

The station screen contains:

1. Persistent station/job/version and source strip, including signal age.
2. One large instruction block: **Monitoring**, **Checks clear**, **Check setup**, **Hold part**, or **Verification incomplete**.
3. Workpiece ID and a plain-language reason immediately underneath.
4. A schematic with labeled weld slots and states: expected, active, observed, short, absent at confirmed boundary, or unknown. Include shapes/text, not color alone.
5. A current trace with measured units and time axis, expected interval shading, and the observed intervals. In replay, label it synthetic.
6. A compact sound trend with a visible threshold and number of valid scored parts. Unavailable audio has a reason, not a zero-valued line.
7. One primary task action and secondary **View evidence**.
8. A recent-parts strip/list, not an unrelated analytics grid.

The trace and seam map are linked: selecting W3 highlights its expected interval and its row in the evidence table. If position is inferred by schedule, label “Expected W3 interval”; do not imply physical localization was measured. Provide a table alternative to any chart.

**During part:** “3 arc events observed · part in progress” is appropriate. “Missing W4” before the boundary is not. **After part:** report exact rule evidence, e.g. “3 of 4 expected arc events observed.”

**Done when:** an observer can identify the part, reason, and next action without opening a tooltip or reading a chart. The mobile primary action remains reachable without obscuring evidence.

### F05. Missing, short, extra, and uncertain arc checks — P0

**Purpose:** make deterministic checks explainable and bounded by data quality.

- At confirmed end, match segmented intervals to the recipe using an explicitly supported method. Use one-to-one matching: one observed interval cannot satisfy two weld slots.
- Required interval absent under complete, valid current coverage: **Hold part**. List observed/expected count and the affected expected slots.
- Interval below its configured minimum under valid coverage: **Hold part**, with measured duration and configured minimum.
- Extra intervals or ambiguous restarts: **Verification incomplete — review arc sequence** unless the recipe has an explicit, validated policy. More arcs do not compensate for a missing required slot.
- Unknown boundary, stale current, saturation, unresolved gap, or ambiguous matching: the affected checks are **Unverified**. Do not infer a missing weld from a missing packet.
- A confirmed failure already observed is preserved if a later signal drops. Display the hold reason plus the additional verification limitation.
- On a completed part with valid evidence and no rule failure, say **Count and duration checks clear**. This is separate from inspection status and audio availability.

Evidence includes expected slot, observed interval, measured duration, minimum duration, coverage, matching method, rule version, and source event references. The original demo minimums are W1 2.56 s, W2 2.56 s, W3 3.52 s, W4 1.92 s; display rounding must not change the comparison value.

**Done when:** normal, missing, short, extra-arc, and dropout fixtures produce distinct reasons. A dropout never masquerades as zero welds, and a known hold cannot disappear after reconnection.

### F06. Sound baseline and drift advisory — P0 replay; P1 real features

**Purpose:** show a sustained process change as an advisory while retaining the underlying evidence.

For P0, reuse the synthetic baseline and its known scoring behavior for the original job. A separate synthetic baseline is needed for the six-weld example; it must be declared illustrative. Do not score microphone samples with synthetic band-energy statistics.

The UI shows a part-score trend, threshold, baseline version, per-weld details, and a rolling-window strip. Clearly label whether the window contains valid scored parts rather than consecutive manufactured parts. Incomplete or held parts should be excluded from the new app's drift window; keep legacy replay behavior documented if an adapter reproduces it exactly. Tests must state which policy is active.

For a new shared app detector, a capture gap, uncertain boundary, boundary-method change, or recipe/capture configuration change breaks the evidence run and clears the pending window. An ordinary confirmed part boundary does not clear it. After a check, start a fresh monitoring window. Keep the baseline frozen; clearing a window does not retrain it. Require enough eligible observations to satisfy the configured rule and display warm-up progress.

**Operator wording:** “4 of 6 valid scored parts sounded different. All required arc intervals were observed. Check the setup at the next safe part change.” Suggested checks can include tip/nozzle condition, gas delivery, wire feed, microphone position, and nearby noise. Present them as a checklist, not an inferred diagnosis.

An advisory stays open until acknowledged and reviewed. Acknowledgment records awareness, not resolution. “Checked, nothing found” is a useful outcome and must remain visible. Do not repeat a toast or sound for every elevated part in the same open episode.

**Done when:** the healthy distraction does not trigger a stop, sustained synthetic drift produces an advisory, and the harmless wire-lot scenario can be recorded as a false advisory. No display converts the anomaly score into “defect probability” or a quality percentage.

### F07. Attention queue and operator response — P0

**Purpose:** connect detection to accountable action.

Use one queue with grouped labels **Held parts**, **Needs verification**, and **Setup checks**. Sort urgent holds first, then oldest unresolved items in each group. Each row shows station, part/job, age, source, exact reason, and current owner/action state when known.

| Action | Required input | Effect | Must not do |
| --- | --- | --- | --- |
| Acknowledge | Actor identity or named demo actor | Adds timestamped acknowledgment | Clear a hold or fabricate an inspection |
| Start setup check | Selected checklist items, optional note | Records start and changes advisory workflow state | Alter the previous score or baseline |
| Complete setup check | Outcome: issue found / nothing found / inconclusive; work performed | Records result; allows a fresh observation window | Claim the fault was fixed before subsequent evidence |
| Send to inspection | Actor and inspection reason | Places the part in the inspection queue | Say the part passed |
| Continue under normal inspection workflow | Actor and reason for an advisory/unverified case | Records the decision and retains the limitation | Release a held part or erase the advisory history |
| Record disposition | Quality-lead flow with inspection reference/reason | Marks rework, scrap, or authorized release as a separate business action | Overwrite the original detector finding |

The PWA uses instructions such as “Segregate this part and follow the shop's inspection process.” A red block is a software instruction, not a machine interlock. No automatic external email, WhatsApp, or other messages in P0.

**Done when:** acknowledging an alert leaves it in the correct unresolved workflow, completing a check records its outcome, and every resolution is visible from the affected part. Duplicate detection events do not create duplicate queue entries.

### F08. Part passport, search, and traceability — P0

**Purpose:** make one workpiece's evidence retrievable, including after refresh and offline.

List columns: display ID, job/version, station, completion time, rule finding, verification state, advisory, disposition. Search by exact/prefix part ID, job, batch, or work order; filter by time, station, source, and status. Return “No matching parts” separately from an empty database. Preserve leading zeros and distinguish internal ID from display ID.

The detail view is a **part passport**, meaning an evidence record, not a certification:

- Header: identity, source, lifecycle, inspection/disposition, station and job version.
- Findings: the decision and the exact inputs that caused it.
- Weld table: each slot, expected/minimum duration, measured duration, matching and verification result.
- Time trace: expected versus observed intervals, plus gaps and unavailable regions.
- Acoustic section: available scores, baseline/configuration, threshold, and limitations.
- Timeline: start/end, alerts, acknowledgments, checks, inspections, rework, and disposition.
- Attachments/references: inspection report reference or short note; actual file attachments can wait until P1.
- Export/print action with the same provenance and caveat as the on-screen record.

Simulated ground truth belongs in an explicitly labeled **Demo explanation** after the event. It must not appear in the operator passport as if it was measured inspection evidence.

**Done when:** a held part can be found by ID, its evidence remains identical after a recipe change, and print/export contains the reason, source, versions, and unresolved limitations.

### F09. Inspection feedback and rework — P0

**Purpose:** close the product loop and create useful labeled pilot data.

An inspection entry records actor, time, inspection method/reference, result (**accepted, rejected, inconclusive**), and notes. Defect type is optional and entered only when inspection establishes it. Never populate defect type from a sound alert.

A disposition records **awaiting review, rework, scrap, released**, its author, time, and reason/reference. Rework creates a linked attempt against the same physical workpiece; keep the original attempt and its hold. A later good-looking score does not erase the original problem. Release requires an explicit quality decision and the appropriate inspection reference; a demo role can demonstrate this but is not a production authorization control.

Training eligibility is separate from “accepted”: the quality lead must confirm whether that inspection actually verifies the relevant welds, whether capture was valid, and whether the configuration matches. A sampled teardown passing does not individually verify all parts made before it.

**Done when:** “alert → inspection → disposition” is demonstrable, an inconclusive result is supported, and feedback does not automatically retrain the baseline.

### F10. Shift report and exports — P0

**Purpose:** give the quality lead a compact, defensible handover.

Report a chosen station and time range using one timezone label. Include parts started/completed/cancelled; count/duration checks clear; parts held; parts with incomplete verification; advisory episodes; unresolved items; recorded inspections and dispositions; and coverage. Counts may overlap where explicitly labeled (a held part can also have incomplete audio). Do not force orthogonal states into a misleading pie chart.

Show numerator/denominator for rates. “No inspection outcome yet” is not a rejected or accepted result. Avoid a headline “quality score.” A pilot lead-time metric is shown only when an independently established fault onset or inspection event supports it; replay lead time remains labeled simulated.

Provide **CSV part summary**, **JSON backup**, and **printable shift report**. CSV contains stable IDs, timestamps, source, recipe/baseline/detector versions, findings, verification state, and disposition. Escape quotes/newlines correctly and neutralize spreadsheet-formula prefixes in user-entered cells. JSON contains a schema version and the relationships needed for recovery. A human-readable report must not claim to be a formal certificate.

**Done when:** visible totals match stored records, export works offline, identifiers retain leading zeros in the JSON source of truth, and an unresolved hold appears in the report. Warn that spreadsheet software may reinterpret CSV IDs; do not mutate the canonical ID to accommodate it.

### F11. Offline persistence, installation, and recovery — P0

**Purpose:** make the product continue to be useful on an unreliable connection.

Persist station configuration, recipe/baseline metadata, completed parts, alerts/actions, inspection/disposition records, active-part checkpoint, and demo session state in IndexedDB. Cache the app shell, icons, self-hosted fonts if used, and bundled synthetic fixtures. A service worker caches resources; it does not perform continuous sensor capture. [Service worker guidance](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)

Show **Saved on this device** in P0, not “Synced.” Only display pending/synced/failed upload states when a real server acknowledgment exists. Internet status and sensor status are independent. Offline internet can coexist with valid local sensor capture; online internet does not establish sensor freshness.

On reload, restore the last station and history. An interrupted active part becomes **Needs reconciliation** with its last capture time. Never finalize it with invented missing arcs. If local saving fails, surface a persistent error, preserve what is still in memory for export, and stop presenting monitoring as reliably logged.

Offer install only when supported, with manual browser instructions when appropriate. Installation is optional; core workflows also work in a tab. Provide an offline readiness indicator only after required resources are cached. Follow current platform behavior rather than promising a universal install prompt. [PWA installation guidance](https://web.dev/learn/pwa/installation)

**Done when:** after one successful online load, airplane mode permits reopening the app, running a bundled replay, recording an action, and exporting it. No application update reloads a live/active part automatically.

### F12. Replay and judge mode — P0

**Purpose:** demonstrate actual app behavior predictably without needing an arc, network, sensor, or account on stage.

Use an unmistakable **Synthetic replay** strip in the station, part passport, queue, and exports. Controls: Play/Pause, Next event, Reset scenario, and scenario selection. Fault injection belongs on `/demo`, away from the operator's primary controls.

Include normal operation; original worn-tip drift; missed weld on 0184; an explicit short arc; grinder distraction; clamp dropout; harmless configuration shift; and the non-automotive six-weld recipe. Exact expected results are specified later.

Reset deletes only records for the selected demo session, with a clear confirmation. It must not clear workshop configuration or imported/live records. Scenario switching is blocked during an active part or requires an explicit, logged cancellation. A replay run gets its own namespace so running it twice does not collide with old part IDs.

Keep a link to the existing simulator for the hardware/3D explanation. The app's station workflow remains useful if the simulator is unavailable. No remote fonts, CDNs, AI calls, or dataset downloads are needed for the stage path.

A replay setup action may select a scripted intervention branch, after its action record is saved. Change only subsequent events and label the outcome simulated. Do not retroactively replace already shown/stored parts with the engine's complete `act` branch, or manufacture an operator acknowledgment from that branch's automatic intervention.

**Done when:** a judge can trigger a missed weld, see its evidence, record inspection/disposition, and retrieve the part after refresh. The same scenario yields the same result, and replay time cannot reveal the future.

### F13. Device and baseline diagnostics — P0 visibility; P1 acquisition

**Purpose:** explain why a check is available or unavailable.

Show individual statuses for current stream, microphone/recorded audio, clock alignment, boundary source, baseline compatibility, local storage, and foreground/wake-lock state. Include last packet time/age, capture profile, gaps, clipping/saturation flags, and relevant version IDs where they actually exist. Do not decorate unknown battery, RSSI, or sample rate with fabricated numbers.

P0 shows synthetic stream metadata as synthetic. Live setup remains unavailable until a real adapter is implemented and tested. P1 adds permission requests from explicit user actions, signal preview, actual sample settings, and a capture test. If current is reliable but audio is unavailable, count/duration checks may continue while audio drift says unavailable. If current is unavailable, sound alone cannot establish weld count.

Baseline screen lists job/configuration, status (**demo, draft, approved, incompatible, retired**), training and validation provenance/counts, feature/scorer version, threshold, approver, and activation time. P0 can inspect seeded demo baseline metadata. A fake “Train AI” progress bar is forbidden.

**Done when:** a missing prerequisite produces a specific disabled check and actionable explanation, not an unexplained red dot or empty chart.

### F14. Recorded-data analysis and real baseline work — P1

**Purpose:** earn evidence for the detection claim after the app workflow exists.

Implement only against a documented input schema and a working feature extractor/scorer. First support a narrow format: a versioned manifest referencing supported WAV/PCM audio and current events with explicit units/timestamps/part boundaries. Validate actual codec, channel mapping, sample rate, finite values, monotonicity, and declared duration. Do not try to infer arbitrary vendor formats.

Use a preflight preview: filename, bytes, channel labels, time range, missing fields, provenance/license declaration, and planned import count. Imports are atomic or explicitly partial with a report; invalid input never half-overwrites valid records. Suggested demo limits: 10 MB structured manifest and 60 seconds of decoded audio per clip; enforce decoded-size limits too. These are product limits, not browser guarantees.

Fit a normal-only baseline with grouped train/validation/test splits by original weld/run/session. Store split manifest, feature version, compatible capture configuration, threshold procedure, and evaluation counts. Evaluate current-only, audio-only, and combined action policies separately. Expose real results only after artifacts reproduce them. Do not retrain on unreviewed production data.

**Done when:** another teammate can recreate the same split, score a held-out clip without label leakage, see the actual result, and trace it to the saved artifact. Until then, show “Recorded-data scoring not implemented.”

## 7. Decision model: preserve evidence before choosing a headline

### 7.1 Use independent state dimensions

Do not implement one `status = green | amber | red` field as the source of truth. A part may have a confirmed short arc, missing audio, an acknowledged advisory, and pending inspection at the same time.

| Dimension | Values, illustrative | Meaning |
| --- | --- | --- |
| Part lifecycle | idle, active, completed, cancelled, interrupted | Whether an identified workpiece cycle exists and is closed |
| Current verification | valid, partial, unavailable, ambiguous | Whether count/duration evidence can support a conclusion |
| Audio verification | valid, unavailable, clipped, incompatible, misaligned | Whether acoustic scoring is meaningful |
| Rule finding | pending, clear, missing, short, sequence-review | Deterministic process observation; store individual findings as well |
| Drift episode | warming-up, normal, watching, advisory-open, under-review | Acoustic process monitoring state |
| Inspection | not-recorded, accepted, rejected, inconclusive | Human inspection result, including method/reference |
| Disposition | pending, rework, scrap, released | Human business decision about the physical workpiece |
| Save/upload state | saved-local, save-error; later queued, synced, sync-error | Record durability, separate from weld evidence |

Store findings and actions; derive the headline. Do not derive inspection acceptance from a rule finding.

### 7.2 Headline and action precedence

1. **Unresolved hold from a known rule failure:** “Hold part [ID].” Retain any additional verification warning. A later dropout or acknowledgment does not clear it.
2. **Incomplete required current/boundary evidence, no confirmed hold:** “Verification incomplete.” Send to the established inspection workflow; no guess about weld count.
3. **Active part without a final finding:** “Monitoring part [ID].” Show provisional observations.
4. **Open acoustic advisory on otherwise valid completed monitoring:** “Check setup.” Keep all existing part holds in the queue.
5. **Completed count/duration checks clear:** “Count and duration checks clear.” Audio may independently say unavailable or watching.
6. **No active part:** “Ready for next part,” with any station advisory still visible.

Local save failure is a persistent reliability banner in every applicable state. It must not replace or hide a hold. P0 may prevent starting another part until logging is restored or the user explicitly exits the monitoring workflow.

An explicit quality disposition can close the queue item. An archived passport may then say “Released after recorded inspection,” “Sent for rework,” or “Scrapped,” while retaining the original hold and evidence. Closing a workflow item never changes its original rule finding to clear.

### 7.3 Decision table

| Evidence at confirmed boundary | Rule result | Acoustic result | Operator instruction |
| --- | --- | --- | --- |
| All required intervals valid and long enough | Checks clear | Normal / warming up | Continue the normal inspection workflow |
| Required interval absent, coverage complete, matching unambiguous | Missing-arc finding / hold | Independent; never needed to prove the rule | Segregate this part and review evidence |
| Measured interval shorter than minimum, coverage valid | Short-arc finding / hold | Independent | Segregate this part and review evidence |
| Extra intervals, uncertain slot assignment, or undocumented restart | Sequence needs review | Exclude from the new app's drift window | Check the arc sequence; route the part for verification |
| Current gap intersects a required interval | Affected checks unverified | Do not use ungated audio to invent those intervals | Follow normal inspection; check the sensor |
| Microphone denied but current/boundary valid | Current rules still available | Audio unavailable | Show current result with limited monitoring coverage |
| Baseline incompatible after job/configuration change | Current rules available if configured | Scoring unavailable | Continue only the supported checks; review baseline setup |
| Sustained valid elevated acoustic scores | No automatic defect finding | Advisory | Check setup at a safe part change |
| Single loud acoustic event | No change to count/duration | Per-weld evidence; may be suppressed by aggregate | No automatic hold from sound alone |
| Boundary not confirmed or arc still open | Pending/incomplete | Provisional | Complete/reconcile the part boundary |
| Confirmed missing interval followed by a capture failure elsewhere | Hold remains | Additional limitation recorded | Keep the hold and investigate the capture failure |

### 7.4 Evidence timing and acquisition rules

- Distinguish **source time**, **received time**, and **display/replay time**. Persist UTC event timestamps and the station timezone; use monotonic time for within-session durations.
- Count and duration must come from sample/event time, not React renders, `setInterval` ticks, or chart pixels.
- Do not concatenate packets across a known gap and call the intervening current zero. Preserve the gap explicitly.
- A source sequence reset or reconnect starts a new capture session. Deduplicate with source/session/sequence identity, not timestamps alone.
- An interval open at a confirmed boundary is incomplete unless its end is independently known. At chunk boundaries, preserve segmentation state rather than splitting one arc into several.
- Validate range, timestamp order, finite values, units, and sample count before applying a rule. Reject malformed replay fixtures too.
- Configure freshness from the tested stream cadence. A starting demo policy can mark a 50 Hz replay stream stale after 1 second without an expected heartbeat; record it as a demo assumption. Pausing replay is a deliberate playback state, not simulated equipment failure.
- Audio/current alignment uses source timestamps and a measured/declared offset. Arrival time is not a synchronization method. If offset uncertainty is too large for an arc window, make that score unavailable.
- Audio should cover the actual detected arc interval. No unrelated background segment may be used to fill a missing window.
- Current indicates an arc event; the microphone does not establish where on the workpiece the torch was. The schematic is a job reference unless independent position evidence exists.

### 7.5 Baseline lifecycle for the real-data phase

Use **draft → evaluated → approved → active → retired**, with explicit incompatible status when configuration changes. Activation occurs between parts and records an approver/time. Keep old artifacts for historical explanation.

Compatibility includes process/transfer mode, material/thickness, wire/gas, joint/position, recipe revision, station/fixture, microphone identity/placement, sample rate, audio processing, current calibration, synchronization method, and feature/scorer version. Record the subset actually controlled in the pilot and flag unknowns.

Collect training examples only from a defined, reviewed population. Make validation/test groups independent of training groups. A baseline approval should show inspected example coverage and limitations, not a “100% trained” meter. Sample sufficiency is an empirical question; the original 40-part example is not a production minimum.

Freeze the baseline during evaluation and monitoring. Do not learn a deteriorating process as the new normal. A completed setup check clears only the current drift window; it does not approve a changed consumable or capture profile.

## 8. UI direction: a workshop instrument, with a distinct Nabz identity

### 8.1 Visual concept

**A field notebook meets a measurement instrument.** Pale neutral workspace, graphite text, strong teal actions, a dark trace surface where it improves signal legibility, and amber/red reserved for actual attention states. The recognizable design asset is the expected-versus-observed weld sequence, connected to a physical seam map.

Carry forward the website's identity rather than introducing a new startup theme. Use the existing wordmark treatment in a compact masthead. The simulator's visual effects can stay in the simulator. The app earns its visual interest through accurate traces, restrained technical labeling, and excellent spacing.

Project-specific calibration: predictable layout, low motion, moderate density. Industrial task clarity overrides decorative asymmetry, perpetual motion, magnetic buttons, and giant rounded marketing tiles. Do not reproduce the website's hero heading scale inside the app.

### 8.2 Starting design tokens

These are proposed app tokens informed by the existing site. Verify actual component combinations for contrast after implementation.

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#F0F2F0` | Main application background |
| `--surface` | `#FFFFFF` | Forms, evidence panels, menus |
| `--ink` | `#19212C` | Primary text |
| `--muted` | `#485662` | Secondary text that remains readable |
| `--line` | `#BCC5C5` | Quiet separators; not the sole boundary of a control |
| `--control-line` | `#667785` | Control outlines where contrast is needed |
| `--action` | `#114957` | Primary action, selected state, links |
| `--action-soft` | `#DEECEC` | Selected row/background |
| `--trace-panel` | `#1D2734` | Current trace surface |
| `--signal` | `#9CE4E5` | Current trace on the dark surface only |
| `--ok-ink` / `--ok-bg` | `#216149` / `#E9F3ED` | Checks-clear text/background |
| `--warn-ink` / `--warn-bg` | `#805000` / `#FFF3D6` | Setup advisory text/background |
| `--hold-ink` / `--hold-bg` | `#A12E2A` / `#FBEAE7` | Held-part text/background |
| `--unknown-ink` / `--unknown-bg` | `#485662` / `#E7EBED` | Unverified/paused text/background |

Use white text on the dark action fill. Use dark status ink on the light status backgrounds; pale signal cyan is not body text on white. Status colors are semantic exceptions to the one primary brand accent. Give every status an icon/shape and text.

Typography:

- **Instrument Sans** or the existing system sans fallback for body, navigation, buttons, and tables.
- **IBM Plex Mono** or the existing mono fallback for IDs, timestamps, units, thresholds, and tabular readings.
- **Barlow Condensed** only for a compact Nabz wordmark or small section accent; do not use condensed type for dense evidence or instructions.
- Self-host licensed font files if introduced; otherwise system fallbacks are acceptable. Do not make the demo depend on Google Fonts or a CDN.
- Body/operator controls 16 px; secondary text 14 px; page title 24–28 px; the main instruction 28–36 px on tablet. Avoid a blanket 11 px dashboard aesthetic.
- Tabular numerals for changing values; stable widths prevent layout shifts. Keep units next to values and distinguish A, s, Hz, and score.

Geometry and layout:

- 4 px spacing base; use 8/12/16/24/32 px consistently.
- Controls 6–8 px radius; panels 10–12 px; chips can be smaller. Avoid pill-shaped everything.
- Desktop shell maximum about 1440 px, 208–224 px navigation rail, 24–32 px content gutter.
- Main station area about two-thirds width; right-hand action/evidence summary about one-third when space permits.
- Use borders and shared section structure for groups. A recent-parts table is one region, not twelve separate cards.
- Use shadows only for layered menus/dialogs and subtle separation. No glowing controls, glass blur, noisy backgrounds, or decorative grids.

### 8.3 Desktop/tablet station composition

```text
NABZ     Station 02 / FAB-206 r1                  SYNTHETIC REPLAY
         Current: fresh · Audio: demo · Saved on this device

Station  [ Hold part FAB-000184                                      ]
Parts    [ 5 of 6 expected arc events observed. Expected W4 absent.   ]
Attention
Jobs     Workpiece / seam reference             Next action
Reports  +---------------------------------+    Segregate this part.
         |     W1        W2        W3      |    Follow the inspection plan.
         |     W4        W5        W6      |    [Record inspection]
         +---------------------------------+    [View complete evidence]

         Current / A vs seconds                 Job and evidence
         +---------------------------------+    Recipe FAB-206 r1
         | expected intervals + trace      |    Boundary confirmed
         | unknown regions explicitly shown|    Current coverage complete
         +---------------------------------+    Rule version / source

         Recent parts — ID | result | verification | disposition
```

The sketch illustrates an additional synthetic scenario, not a result from the existing four-weld engine. A hold is persistent content. A toast can confirm “Inspection saved,” but cannot be the only place a hold appears.

The action area changes with state. During a part, show progress and Finish when appropriate. During a hold, prioritize inspection/segregation instructions. A job switch stays out of easy accidental reach during an active part.

### 8.4 Mobile and shop-floor use

- At 360–430 px, use one column: identity/source, instruction, part/weld progress, primary action, then evidence. Charts remain readable with a compact summary; detailed rows can open a dedicated section.
- At tablet landscape sizes, keep the instruction, schematic, trace, and action visible together. Test 768 px portrait and roughly 1024 px landscape.
- Bottom navigation has labels, safe-area padding, and room for a 48–56 px primary action above it. Sticky elements must not cover focused controls or the last table row.
- Use `min-height: 100dvh` where appropriate, responsive grid, and `min-width: 0` for trace containers. Contain horizontal scrolling inside a labeled data table, not the whole page.
- Main touch targets should be at least 48 × 48 CSS px, with larger separation for hold/finish actions. This is a product target for practical use, not a claim that touchscreens work through every welding glove. Operators interact at safe cycle boundaries.
- No gesture-only action, hover-only explanation, precision slider, or drag-only workflow. Next event and table controls offer alternatives to scrubbing.
- Start with a strong light theme suited to ambient light. A separate theme switch is unnecessary for P0; the dark trace region supplies instrument contrast.

### 8.5 Accessibility is part of the design

Use semantic headings, landmarks, real buttons, labeled fields, field-specific errors, a skip link, keyboard navigation, visible focus, and correct dialog focus/return behavior. Use a labeled region and textual data alternative for charts and SVG seam maps.

Target WCAG 2.2 AA. Normal text needs at least 4.5:1 contrast; large text at least 3:1. Check rendered chart labels and disabled-state explanations, not just the palette. The WCAG minimum pointer target criterion is 24 CSS px with exceptions; Nabz deliberately uses larger practical controls. [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

Announce new urgent findings through an appropriate live region, once per event, with readable part ID and reason. Keep rapidly changing telemetry out of live regions. Do not move keyboard focus on every sample or steal it when a new part arrives.

Respect reduced motion. Use 120–180 ms opacity/transform transitions for state changes; no celebratory particles, looping pulses, moving chart axes, or auto-reordering rows while someone is reading. Audible/haptic feedback is optional enhancement with user control; the visible instruction always works independently.

P0 copy is simple English. Keep strings centralized so Hindi/local-language support can be added after terminology is reviewed with operators. Do not ship a few translated navigation labels while all operational warnings remain English and call the product fully multilingual.

### 8.6 Microcopy examples

| Situation | Use | Avoid |
| --- | --- | --- |
| Normal completed observation | “Count and duration checks clear” | “Perfect weld,” “AI approved,” “Safe to ship” |
| Missing interval | “Hold part 0184. 3 of 4 expected arc events observed.” | “Critical anomaly detected!” without evidence |
| Short interval | “W2: 1.8 s observed; minimum 2.56 s.” | “Bad welding detected” |
| Drift | “The arc sound changed across 4 of 6 valid scored parts.” | “Porosity predicted with 97% confidence” |
| Audio unavailable | “Microphone unavailable. Sound checks are off.” | A zero score or an empty success chart |
| Current dropout | “Current signal missing. This part needs verification.” | “0 welds completed” |
| Locally saved | “Saved on this device” | “Synced” without a server |
| False advisory outcome | “Setup checked. Nothing found. Continue observing.” | Deleting the alert because it was inconvenient |
| Empty history | “No parts recorded yet. Open a demo or start a part.” | Fake historical rows |
| Unbuilt integration | “Live capture is not configured for this station.” | “Connecting…” forever |

### 8.7 Visual rejection checklist

Reject a design if it has a centered SaaS hero inside the app, purple/blue gradient wallpaper, a row of unexplained KPI cards, arbitrary sparklines, a chatbot as the primary workflow, decorative 3D above the operator action, huge rounded containers everywhere, random avatars, fake customer logos, or a meaningless “AI health 98%” gauge.

Also reject a design that is merely plain: poor spacing, weak hierarchy, tiny text, inconsistent units, washed-out status labels, cramped mobile tables, and missing empty/error states are not acceptable substitutes for visual restraint.

The visual review should pass this test: remove the wordmark and the product still looks like it belongs to a welding evidence workflow, because the seam map, current trace, part identity, and action are specific and coherent.

## 9. Implementation architecture

### 9.1 Stack and dependency decisions

Use a client-side **React + TypeScript + Vite** app. The project is an interactive station tool with local/offline state; server rendering is not required for its first release. This is a deliberate project choice, not a claim that React universally recommends this architecture. Read current official setup guidance and match Node requirements to the selected Vite release. [React setup](https://react.dev/learn/creating-a-react-app), [Vite guide](https://vite.dev/guide/)

Use plain CSS/CSS modules with the tokens above. Existing code uses CSS, so introducing a utility framework is unnecessary. Use React state/reducer/context for a modest app; no global state library is needed until an actual problem appears. Use React Router for the listed routes if a router is introduced; keep URL navigation functional.

For persistence, use IndexedDB; a small established helper such as `idb` is reasonable if it reduces transaction/error-handling code. For PWA asset generation and update handling, a maintained Vite PWA integration is reasonable; verify current documentation and include it only when implementing those features. Do not hand-write a complex caching framework. Every introduced package must be declared and locked in `app/`; inspect package files before imports. No dependency is preinstalled merely because this document names it.

Use small SVG traces and seam diagrams. Do not add a chart package for a line, threshold, and interval overlays. If a later evidence view needs substantial chart interaction, choose one library after confirming its accessibility/performance fit. Native print CSS and browser file download cover P0 reports; no PDF generation service is required.

Do not add Next.js, a database server, Redis, MQTT infrastructure, a vector database, an LLM, a payment system, or a component suite to complete the local replay. There is no natural-language AI dependency in the core product.

### 9.2 Proposed file organization

This is a guide to responsibilities, not a demand to create an empty file for every line:

```text
app/
  package.json / lockfile / tsconfig / vite config
  index.html
  public/                 icons, local static assets
  src/
    main.tsx
    App.tsx               routes and application shell
    styles/               tokens, layout, component and print styles
    components/           shared status, trace, seam map, form/table primitives
    pages/                Station, Parts, PartDetail, Attention, Jobs, Reports, Setup, Demo
    domain/               record types, decisions/selectors, validation
    data/                 IndexedDB access and schema migration
    replay/               adapter, clock, original and non-auto fixtures
    features/             only where a screen's workflow merits grouping
    tests/                rule, persistence, and critical workflow checks
```

Existing `site/` and `sim/` remain separate runnable products. Keep app assets and service-worker scope from intercepting their routes. Share pure domain functions only where there is actual reuse; do not move the simulator's 3D code into a new shared package for architectural tidiness.

### 9.3 Data flow

```text
Synthetic replay (P0) / recorded importer (P1) / actual sensor adapter (P1)
    -> validated events with source identity, timestamps, units, and gaps
    -> segmentation + recipe matching + eligible acoustic observations
    -> findings and operator instructions
    -> transactional local record updates
    -> React selectors for Station / Attention / Part passport / Reports

Operator actions and inspection results
    -> validated action records
    -> the same local record store
    -> updated workflow and report views
```

All screens use the same stored part/findings/actions. A chart, queue, and report cannot each generate their own random data. Keep detection functions pure and independent of DOM/React, so fixtures can exercise them directly.

### 9.4 Reusing the existing engine without a rewrite

1. Start by adapting `runScenario` output for the reference automotive replay. Preserve its documented behavior and synthetic provenance. Do not expose its complete future result list to an unconstrained UI selector.
2. For another recipe, extract/parameterize only the small segmentation/recipe-checking functions needed by both consumers. Keep the old job/settings as defaults so simulator behavior stays stable. Move the shared logic once; do not copy the four-weld rule into React components.
3. Generate the six-weld fixture from its own recipe. Reuse the same shared matcher/check evaluator. Its acoustic values can be a separately labeled synthetic fixture until an actual baseline is available.
4. Keep scenario truth, intervention physics, and cost counterfactuals in replay/demo code. They do not belong to real detector input.
5. Add streaming state only for the real-input phase. Do not build a generic plugin framework for sources that do not exist.

Before refactoring, search for `JOB`, `DETECTOR`, `BASELINE`, `runScenario`, `currentTrace`, `segmentArcs`, `outcomes`, and their imports across `sim/`, `site/`, and the new app. Re-run the original simulation tests after any engine change. A build that makes six-weld screens work but breaks original scenario assumptions is incomplete.

### 9.5 Rendering and performance

- Keep samples in a bounded buffer outside general React state; update display snapshots at a measured, modest cadence, such as 5–10 Hz. Part completion and urgent findings update immediately.
- Use original-resolution data for detection. Display downsampling is not permission to discard samples used for duration checks.
- Do not append a new full trace array to every rendered row. Store a compact part summary plus bounded/reference evidence.
- Heavy real-audio feature extraction belongs in a worker or appropriate audio processing path when implemented. AudioWorklet can provide custom processing off the main UI thread; its existence does not solve capture continuity, synchronization, or model validity. [MDN AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
- Clean up every subscription, timer, media track, audio context, worker, and connection on source change/unmount. React development lifecycle behavior must not double-subscribe or create duplicate records.
- Charts do not redraw while paused unless their view changes. Backgrounding a replay pauses its presentation; resuming does not skip user actions silently.
- Starting engineering targets: initial app JavaScript under about 350 KB gzip excluding optional simulator/real model assets; the common station screen interactive within 3 seconds on the actual demo phone after cold load; primary actions visibly respond within 100 ms under replay. These are goals to measure, not achieved results.
- Seed a few thousand historical summaries in a development-only performance fixture if needed. Paginate the parts list rather than rendering every raw trace.

## 10. Data contracts and persistence

### 10.1 Canonical records

Use stable internal IDs and immutable version IDs. Store units in field names or explicit schema definitions; do not pass a number named `duration` without a unit.

| Record | Minimum useful fields | Important invariant |
| --- | --- | --- |
| Station | ID, label, workshop label, timezone, optional sector, selected recipe version | Sector cannot silently change detector behavior |
| RecipeVersion | ID, job ID, revision, process/material/configuration, weld slots, boundary/matching policy, detector config, baseline reference, activation time | Historical versions are immutable |
| BaselineVersion | ID, status/provenance, compatible recipe/capture profile, feature/scorer version, artifact reference, threshold method/value, training/validation groups/counts, approval | A demo baseline cannot become a live baseline through relabeling |
| CaptureSession | ID, source kind, device/source identity, start/end, clock mapping/uncertainty, sample settings, calibration reference | Reconnects and processing changes are traceable |
| PartAttempt | Internal ID, display ID, physical workpiece reference, attempt number, batch/work order, station, recipe/baseline/detector versions, source/session, start/end, boundary method, lifecycle | A rework attempt does not replace the earlier attempt |
| WeldObservation | Part attempt ID, slot ID when justified, interval times, duration seconds, current summary, coverage, audio score/availability, matching evidence | Unknown position/coverage is represented explicitly |
| Finding | ID, part/station, kind/reason code, measured vs configured evidence, versions, first-seen time, source event references | Original evidence survives acknowledgment and disposition |
| Action | ID, target finding/part, action type, actor, time, reason/outcome | Repeated UI submissions are idempotent |
| Inspection | ID, attempt ID, actor, time, method/reference, result, optional established defect label, notes | Human inspection is separate from inferred anomaly |
| Disposition | ID, attempt/workpiece, actor, time, decision, reason/inspection reference, previous disposition reference | Release does not overwrite a detector finding |
| DemoSession | ID, scenario/recipe/seed, clock/checkpoint, source namespace | Reset is scoped to this session |

P0's action history is append-only by application convention. Local browser data is editable by the device owner and is not a tamper-proof audit trail. Do not call it certified, immutable, or secure manufacturing evidence without additional controls.

Prefer explicit absent values with a reason (`not-recorded`, `unavailable`, `incompatible`) over ambiguous zeroes. A score of zero and no score are different. Keep raw findings available even after disposition; derive current attention from actions and disposition.

### 10.2 Source event envelope

The replay adapter should emit a small documented event shape. An example envelope, not existing firmware:

```json
{
  "schemaVersion": 1,
  "eventId": "demo-frame-a:session-01:000083",
  "sourceKind": "synthetic",
  "sourceId": "demo-frame-a",
  "sessionId": "session-01",
  "stationId": "station-02",
  "sequence": 83,
  "sourceTimeMs": 12940,
  "receivedAt": "2026-11-17T08:30:12.940Z",
  "type": "current-samples",
  "payload": {
    "startTimeMs": 12900,
    "sampleRateHz": 50,
    "unit": "A",
    "values": [161.2, 165.7, 162.9]
  }
}
```

`sourceTimeMs` here is the source's last-sample monotonic timestamp. `startTimeMs` is the first sample. The event schema must specify these conventions; do not mix “packet sent at” with “sample captured at.” `receivedAt` is receipt metadata, not the origin of the duration measurement. Real sources need a recorded mapping from source monotonic time to UTC plus uncertainty.

Minimal event types: `part-start`, `current-samples`, `audio-observation`, `capture-gap`, `part-end`, and `source-status`. `audio-observation` includes its actual feature/scorer version, arc window, baseline version, and provenance. If it is a precomputed synthetic score, label it as such; never pretend it was PCM captured by the phone.

Validate each payload by type. A complete fixture can use measured interval events instead of dense samples only if it explicitly declares that representation and does not claim to demonstrate raw-current segmentation. Include at least one raw-current path in P0 so segmentation is actually exercised.

### 10.3 Reason codes and operator language

Use stable codes such as `MISSING_REQUIRED_ARC`, `SHORT_REQUIRED_ARC`, `EXTRA_OR_AMBIGUOUS_ARCS`, `CURRENT_GAP`, `BOUNDARY_UNCONFIRMED`, `AUDIO_UNAVAILABLE`, `BASELINE_INCOMPATIBLE`, `SUSTAINED_AUDIO_SHIFT`, and `LOCAL_SAVE_FAILED`. Keep human-readable copy separate so wording/localization can improve without breaking reports or tests.

Persist the evidence operands, not only the rendered sentence. For a short arc, store measured seconds, configured minimum seconds, slot reference, matching method, coverage, and detector version. Rebuilding a report should not apply today's thresholds to yesterday's part.

### 10.4 Write safety and recovery

- Finalize part summary, findings, and queue-relevant records in one transaction. Show saved success only after commit.
- Actions have a client-generated unique ID. Disable repeated submission while saving and deduplicate in storage.
- Allocate internal part IDs independently of readable numbering; different devices/imports can share display IDs without colliding internally.
- Add a schema version. A failed migration leaves old data accessible/exportable rather than deleting it to make the app boot.
- Recover active-part checkpoints as interrupted records. Do not reconstruct absent samples from nominal recipe timing.
- Keep demo, imported research, and future live records separable by provenance and source/session namespace.
- P0 performs no silent historical deletion. Offer scoped demo reset and explicit backup/export. If storage is approaching its tested limit, ask the operator to export/resolve it; do not silently remove unresolved evidence.
- For real audio later, default to retaining derived features and short opt-in evidence clips, with a documented bounded retention policy. Continuous raw audio is not a required P0 feature.
- JSON backup restore must validate schema and relationships in a staging transaction, show a preview, and reject collisions or require an explicit namespace. A backup cannot inject released states into unrelated existing records.

### 10.5 Future network boundary — P2, not a P0 dependency

Do not invent a server in the UI. When a pilot actually needs cross-device records, implement a small authenticated API with server-enforced workspace/station access, idempotent event/action writes, conflict handling, and explicit acknowledgments. Keep active acquisition and local decisions independent of WAN availability.

A practical first API can accept batches of completed records/actions and return acknowledgment IDs, plus provide scoped read access. Real-time supervisor streaming is optional; do not build both polling and multiple competing socket protocols preemptively. A gateway protocol is a separate integration with documented timestamps, buffering, authentication, and reconnect semantics.

Concurrent disposition/recipe edits must not be resolved through blind last-write-wins. Display a conflict for review or use server version preconditions. Replaying old events cannot retrigger old actions or replace a newer approved recipe.

## 11. PWA reliability, capture limits, and privacy

### 11.1 Service-worker policy

- Cache versioned shell assets and bundled synthetic data. Keep the app under its own scope, preferably `/app/` when hosted alongside the site.
- Use an explicit manifest with Nabz name, short name, start URL, standalone display, theme/background colors, and appropriate regular/maskable icons. Verify the installed launch route and icon on the actual demo phone.
- An SPA navigation fallback applies only inside app routes. Do not return the app HTML for dataset files, API errors, or `sim/` assets.
- Show “Update available” and apply only at an idle boundary after saving. No unconditional `skipWaiting`/reload while a part is active.
- Avoid caching sensitive API responses by default in a future authenticated version. The service worker is not a place to store credentials.
- Keep development worker behavior predictable so old caches do not disguise a broken build. Test the production preview with its real worker before the demo.

### 11.2 What offline means

Offline readiness means this device can reopen the cached app and access its locally stored records and bundled fixtures. It does not mean a not-yet-visited external page, dataset, or uncached model can load. It does not make two devices share records. It does not mean a current sensor is still delivering packets.

A fresh first visit without network may fail; say so in the runbook. Rehearse installation/caching ahead of time and verify the readiness state. No loading spinner should continue forever when a prerequisite cannot load.

### 11.3 Foreground live capture — P1 constraints

Before enabling Live, verify hardware current range/isolation and placement with the responsible technical team. A clamp suitable for arc-presence measurement is not automatically suitable for high-frequency waveform diagnosis. The demo's 50 Hz simulated display/segmentation rate does not establish hardware sampling requirements. Do not publish wiring instructions or treat a generic sensor part as approved for an industrial cable.

For microphone acquisition, ask only on an explicit user action, handle denial/missing device/busy device/unsupported constraints, inspect actual settings, and show capture status continuously. Request unprocessed audio settings where supported, but record the actual result. Use sample-rate-aware features and an explicit resampling/filtering path if required by the model.

For a live source, maintain heartbeat/gap detection independent of the rendering loop. On page hidden, wake-lock release, audio interruption, device disconnect, or a sequence gap, mark local capture unverified until continuity is established. A hidden-page timestamp alone cannot prove capture stopped or continued; validate source coverage on return. Never backfill missing observations with a recipe-shaped trace.

If a gateway captures/buffers independently, the phone may later receive complete evidence for the gap. Preserve that late-data provenance; do not imply an alert was delivered at the original sample time. For continuous unattended operation, field-test a gateway/native capture approach rather than relying on PWA install status.

### 11.4 Privacy and trust boundaries

- Default to local synthetic data. No automatic factory audio upload or third-party analytics in P0.
- Audio can contain speech and commercially sensitive process information. A real pilot needs an agreed capture/retention policy and informed access to recordings. Make capture visible and stop tracks when monitoring ends.
- Never put API keys, service-role tokens, or privileged credentials in the frontend, source fixtures, exports, or `VITE_*` variables. Public build-time variables are public.
- Render imported/operator text as text. Do not use raw HTML injection for inspection notes, file names, or job descriptions.
- Enforce file/decoded-size limits and schema validation. Do not load executable JavaScript, dynamic modules, or remote model URLs from an imported manifest.
- Use HTTPS for deployed capture features. Do not promise that a phone opening a plain HTTP LAN IP has the same privileges as desktop localhost.
- Keep local demo actor labels honest. A role dropdown or PIN stored on the same device does not enforce production access control.
- Exports should contain the minimum useful workshop/operator information. Opening an external simulator/source link should not automatically include factory record data in the URL.

## 12. Concrete fixtures and acceptance checks

### 12.1 Replay fixture set

Every fixture includes recipe version, source kind, explicit part boundaries, current coverage/gaps, expected result, and acoustic provenance. Synthetic “inspection truth” is stored separately from inputs visible to the detector.

| Fixture | Input | Required observed behavior |
| --- | --- | --- |
| `bracket-normal` | Original four expected arcs, correct durations | Count/duration clear; no inspection acceptance implied |
| `bracket-0184-missing` | Original fault replay, policy ignores earlier advisory | Part 0184 held; 3 of 4 expected arcs; expected W3 absent |
| `bracket-short-w2` | W2 interval 1.80 s against original 2.56 s minimum; otherwise valid | Hold with measured/minimum duration; do not report only a generic count failure |
| `bracket-grinder` | Existing healthy replay's single noisy arc | Per-arc evidence visible; no acoustic-only hold and no sustained advisory from that isolated noise |
| `bracket-current-gap` | Gap overlapping a planned interval | Verification incomplete, not a missing-weld assertion |
| `bracket-audio-missing` | Complete current and boundary, unavailable audio | Current rules clear or fail normally; sound checks unavailable |
| `bracket-wire-lot` | Existing harmless shift replay | Advisory can occur; inspection/setup outcome can be “nothing found”; retain false-alert cost |
| `bracket-open-arc` | Arc starts in one chunk and remains open at boundary | No invented end or valid final duration; reconciliation/verification required |
| `bracket-extra-arc` | Valid required intervals plus one unexplained extra interval | Sequence review; no automatic acceptance from a larger count |
| `frame-six-normal` | Six-slot frame recipe and six actual intervals | Six-slot progress, valid rules, frame-specific metadata in passport/report |
| `frame-six-missing-w4` | Same frame recipe, W4 omitted with complete coverage | Hold with 5 of 6 and expected W4 absent; no four-weld strings |
| `reconnect-duplicate` | Duplicate packets/action submission and new session after reconnect | No double-counted arcs, parts, or acknowledgments; gap/session provenance retained |

Proposed fictional six-weld template: `FAB-206 r1`, “Equipment mounting frame,” mild steel, single-pass MIG/MAG. Use nominal slot durations `[3.0, 3.0, 4.0, 3.0, 3.0, 4.0]` seconds, minimums at 80% **for this demo only**, and nonoverlapping example starts `[8, 14, 21, 30, 36, 43]` seconds in a 60-second cycle. Those are authored fixture values, not recommended welding parameters. No current, wire/gas, or material-thickness setting should be sold as validated from this template.

Keep source-mode labels in screenshots, screen recordings, CSV, JSON, and print output. A screenshot should not require a spoken disclaimer to reveal it is synthetic.

### 12.2 Automated checks worth writing

Use small, behavior-focused tests. Reuse Node's existing test approach for plain shared JS where sensible; use an appropriate React/TypeScript runner only when implementing app code. Do not create tests that merely snapshot every CSS class.

Required meaningful checks:

1. Segmentation: hysteresis, minimum dwell, chunk continuity, and open/truncated arc behavior.
2. Recipe matching: one-to-one slots, variable weld count, short/missing/extra arcs, exact duration boundary, and coverage uncertainty.
3. Decisions: hold preserved through dropout/acknowledgment; microphone failure does not disable valid current rules; no data does not become normal.
4. Causality: later replay events/faults cannot change earlier displayed evidence or decisions.
5. Drift: window eligibility/warm-up/reset policy, isolated noise, persistent shift, no cross-recipe scoring, no automatic baseline update.
6. Persistence: atomic completion/action writes, duplicate-action handling, interrupted-part recovery, recipe-version preservation, scoped demo reset.
7. Export/import: quotes/newlines, dangerous CSV cell prefixes, leading-zero canonical IDs, schema validation, size limits, and invalid backups leaving old records intact.
8. Core UI workflow: open demo → finish a faulty part → inspect evidence → record result/disposition → reload → retrieve the same record.

When a new branch or parser is introduced, include its smallest useful check. Trivial text/spacing changes need no extra test. If test infrastructure is not yet present, a short assert-based self-check for pure logic is better than an unverified rule engine.

### 12.3 Manual product checks

- Phone 360 px, tablet portrait/landscape, desktop: no whole-page horizontal scrolling; primary action and source labels remain visible.
- Keyboard only: all primary workflows, dialogs, navigation, table links, and trace alternatives are usable.
- Zoom to 200%, check focus visibility, test reduced motion, and verify actual rendered contrast combinations.
- Deny microphone; use an unsupported Bluetooth browser; block local storage; simulate quota/save failure. Each explains the unavailable feature.
- Open the production build, cache/install it, enter airplane mode, reopen, run a replay, record inspection, export, refresh, and verify persistence.
- Background/foreground during an active part and simulate reload. The result is interrupted/unverified until reconciled, not green.
- Make an app update available during an active part. It must wait for a safe idle point.
- Switch jobs between parts, then open an old part. It still shows its original recipe/baseline evidence.
- Run the six-weld job and search for stray four-weld, automotive-only, or “bracket” text.
- Reset one demo run. Other runs, configuration, and non-demo records remain present.
- Review printed output: source, exact reason, versions, timezone, and limitations survive; navigation and buttons do not pollute the report.

### 12.4 Completion checklist for the implementing agent

- [ ] There is an actual runnable React PWA in `app/`, with reproducible install/build/test instructions and a lockfile.
- [ ] Site and simulator still run with their existing commands; required original tests pass after shared-code changes.
- [ ] An automotive and a genuinely different non-automotive recipe run through the same app workflow.
- [ ] Every P0 feature above has working behavior or its explicitly specified unavailable state.
- [ ] Part IDs, findings, actions, inspections, and dispositions persist and remain mutually consistent.
- [ ] Every active control does something reviewable; no fake connections, training, sync, or loading states.
- [ ] Missing, short, drift, noisy, unverified, and false-advisory cases are demonstrated.
- [ ] Hold/verification/inspection states remain distinct and traceable.
- [ ] Offline readiness and installed behavior are checked on the actual demonstration device.
- [ ] The main workflow is accessible and visually reviewed at phone and tablet sizes.
- [ ] README identifies synthetic scope, known limitations, commands, and the current unbuilt integrations.
- [ ] Final implementation report states what works, what was tested, and what remains unverified.

## 13. Build sequence: finish vertical slices

Do not start with all routes, a fake analytics dashboard, or a backend. Complete these gates in order. Time available can determine how much P1 work follows; it must not erase evidence boundaries from P0.

| Gate | Build | Exit condition |
| --- | --- | --- |
| 1. Working station slice | React shell, Nabz tokens, reference replay adapter, station instruction, part trace | A normal and missing-arc part render from actual detector output; source is visible |
| 2. Durable response loop | Stored parts/findings/actions, attention queue, passport, inspection/disposition | A hold can be reviewed, acted on, refreshed, and retrieved without data mismatch |
| 3. Real recipe variation | Parameterized shared checking, six-weld frame fixture, job activation/versioning | The non-automotive scenario changes actual inputs/results and leaves old records intact |
| 4. Honest edge cases | Short arc, noise, dropout, extra arcs, interrupted part, false advisory | All expected states pass the fixture checks; no fake green state |
| 5. PWA and handover | Offline shell, icons/install, safe update flow, reports/export, scoped reset | Airplane-mode rehearsal succeeds on the demo phone |
| 6. Visual and stage polish | Responsive review, accessibility, microcopy, deterministic judge path, fallback recording | A teammate runs the full demo without developer intervention |
| 7. Recorded-data evidence, P1 | Narrow importer, real feature/scorer artifact, reproducible split/evaluation | A held-out clip result can be explained and reproduced |
| 8. Sensor pilot, P1 | Tested foreground sensor adapter, synchronization, continuity checks | Actual station signals support the promised checks under a documented trial |

Jobs, reports, and diagnostics can begin with compact, complete screens. Do not split them into separate suites. Keep interfaces small enough that one teammate can understand the flow from event to action.

If time is tight, stop adding P1/P2 features. Preserve a coherent P0; do not substitute placeholder ML metrics or an empty device-pairing wizard for working replay, evidence, and persistence.

## 14. Hackathon demonstration and defensible differentiation

### 14.1 A three-minute stage path

This is a proposed pitch flow. The official judging rubric/deadline must be confirmed with organizers; neither is established by this document.

| Approximate time | Show | Say / prove |
| --- | --- | --- |
| 0:00–0:20 | Station screen at the missing-arc event, source visible | “This fixture expected four arc events. It observed three. This part needs to be segregated.” Start with the action, not a company overview |
| 0:20–0:45 | Highlight expected W3 interval and the part passport | Show the exact evidence, boundary, ID, and rule. Explain that current proves an arc event, not internal joint integrity |
| 0:45–1:10 | Record inspection/disposition; refresh the record | Demonstrate the actual product loop and traceability, not just a changing color |
| 1:10–1:35 | Preloaded drift sequence and setup checklist | Sound supports a sustained advisory. Do not call the score a diagnosed defect or measured early-warning lead time |
| 1:35–1:55 | Dropout and harmless shift examples | Show that lost signal becomes unverified and a false advisory has a real workflow/cost |
| 1:55–2:20 | Six-weld general-fabrication job | Demonstrate broader applicability through a different recipe, not an industry dropdown |
| 2:20–2:40 | Offline saved passport/report | Show local operation and durable actions; identify what remains a prototype |
| 2:40–3:00 | Evidence/status summary and pilot ask | Ask for one repeat-fixture workshop, a quality lead, and a two-week shadow trial |

Rehearse the path with Next event controls so it does not require waiting through a shift. Keep a local screen recording of the working app and a locally cached demo. A recording is a fallback, not a live sensor claim.

Optional P1 demonstration: a judge chooses a genuinely held-out clip and sees its score and source label. Only include this after the scorer and artifacts work. Show the actual outcome, including a miss; a prerecorded verdict animation is not an experiment.

### 14.2 What should make the entry memorable

- The screen identifies a specific part and an action, rather than announcing an abstract anomaly.
- The expected-versus-observed trace and seam map make the rule understandable immediately.
- An unavailable sensor produces an honest operational state.
- The operator can record what happened, and the quality lead can retrieve it.
- A false advisory is visible and measurable, demonstrating understanding of adoption cost.
- One sector-neutral model supports an actual second recipe.
- The product works offline with disclosed synthetic inputs.
- The team has a concrete experiment to earn its acoustic and low-cost claims.

These are strategic recommendations, not a guarantee of winning or an invented official scorecard.

### 14.3 Claims ledger for the deck and app

| Claim | Acceptable evidence/status |
| --- | --- |
| “The app detects this missing/short arc in replay” | Running deterministic rule, named fixture, passing checks, synthetic label |
| “Audio may provide useful process-change evidence” | Attributed research plus the planned Nabz experiment |
| “Nabz predicts defects N minutes early” | Not established; replay timing cannot support it |
| “This weld is safe / certified / ready to ship” | Outside the prototype's authority |
| “Works across these industries” | App workflow and illustrative templates only until each deployment is validated |
| “Works with any welding machine” | Unsupported; qualify process, hardware range, and installation constraints |
| “Costs ₹10,000–₹15,000 per station” | Existing hardware target/hypothesis; needs an itemized, available, tested bill of materials |
| “₹1,000/month subscription” | Pricing hypothesis to test, not customer willingness to pay |
| “Saves ₹25,050” | Existing replay's modeled counterfactual only, with editable assumptions and simulated provenance |
| “0.92 AUC” | Attributed Intel audio/video research result, never a Nabz result |

Do not build app badges suggesting standards compliance merely because a recipe has a WPS reference. Do not put an “AI accuracy” metric in the header before a measured evaluation exists.

## 15. Pilot, evaluation, and economics

### 15.1 First pilot design

Start with one repeated single-pass MIG/MAG part on a fixture in a workshop willing to share normal inspection outcomes. The workshop can be an auto supplier or a non-automotive fabricator; repeatability, boundaries, signal capture, and quality-lead participation matter more than the sector label.

Run in shadow mode alongside the existing inspection process. Do not let an experimental score change shipment authorization. Agree on workpiece identification and what inspection can establish before collecting data.

Suggested two-week structure, subject to workshop agreement:

1. Document the station, process, boundary source, microphone placement, current calibration, and inspection plan; check capture continuity in real shop noise.
2. Collect reviewed normal examples and a grouped baseline/validation dataset. Record which welds were actually inspected.
3. Freeze a candidate baseline and threshold; observe later work without silently adapting it.
4. Review every alert and a planned sample of unalerted parts with the quality lead. Log sensor failures and inconclusive cases as well as confirmed faults.
5. Report what was observable, what was missed, what was not inspected, and what operator action cost.

Do not deliberately produce defective production parts for a demo. Controlled fault experiments belong in an approved test setup with the workshop's responsible team.

### 15.2 Evaluation outputs

| Area | Report | Important qualification |
| --- | --- | --- |
| Count/duration rules | Confusion counts by missing/short/normal case; boundary errors; latency after confirmed end | Use independent event labels, not the detector's own output as ground truth |
| Acoustic anomaly experiment | ROC AUC where labels support it; precision/recall and confusion matrix at a frozen threshold; sample/group counts | AUC is not deployed accuracy; small or artificial samples limit conclusions |
| Operator burden | Advisory episodes/shift, false advisories per eligible part/shift, review time, inconclusive outcomes | Count episodes, not every repeated elevated score as a new alert |
| Coverage | Parts with verified current/boundaries/audio, unavailable minutes, gap/reconnect counts | Do not inflate success by dropping unverified cases from all reports |
| Warning usefulness | Time and parts from first actionable warning to independently established fault/inspection event | Fault onset may be unknown; report unavailable instead of inventing lead time |
| Action outcomes | Confirmed issues, nothing found, rework/scrap/release, follow-up observations | Improvement after intervention does not by itself prove causation |
| Deployment | Installation time, supported device/browser, capture settings, hardware/support cost | One station does not establish general compatibility |

Group dataset splits by original weld/run/session and, for transfer experiments, hold out stations or jobs. Keep labels and future events out of features and causal decisions. Report audio-only, current-only, and the combined action policy so “multimodal” has a measurable meaning.

### 15.3 Economics that can be defended

Keep two concepts separate: **recorded operational cost** and **modeled avoided loss**. Real operators can record a three-minute setup check; avoided customer loss is a counterfactual unless a defensible comparison exists.

For the replay, preserve the existing model and label every assumption. If bringing the site calculator into the app, use `estimateSavings` with validated finite, nonnegative inputs and bounded percentage values. Its low/high scenarios are assumed avoidable-loss shares, not confidence intervals. Do not annualize the single staged fault run as if it were an observed event frequency.

For a pilot, estimate value from observed rejection/containment frequency and actual local costs, then subtract installation, hardware, false-alert interruptions, maintenance, training, support, and subscription costs. Show no-data and negative-value cases. Avoid double-counting the same part as both a fully scrapped item and a fully recovered sale.

Do not add checkout/billing to the hackathon app. A credible pilot-cost worksheet and clear target customer are more useful than a subscription page.

## 16. Open questions and deliberate exclusions

These questions should be resolved through experiments or workshop discussion. They do not block implementing the local P0 workflow.

| Question | Why it matters | Smallest useful next step |
| --- | --- | --- |
| How does the workshop establish a part boundary? | Prevents assigning arcs to the wrong workpiece | Observe one fixture cycle; compare operator Start/Finish with an available fixture signal |
| Do restarts and tacks correspond to distinct intended joints? | Arc count can differ from weld count | Label a sample of real cycles with the quality lead |
| Can a budget phone hear the target arc reliably? | Noise, placement, clipping, and audio processing can swamp the feature | Record approved normal cycles with settings/placement logged; compare nearby-noise conditions |
| Which current clamp is rated, available, and appropriate? | Range, safety, calibration, isolation, and cost remain unverified | Obtain actual technical specifications/quotes and a supervised bench test |
| How stable is audio/current alignment? | Misaligned windows can create false scores | Measure clock offset/drift and mark uncertain windows unavailable |
| What constitutes a trusted normal example? | Baseline quality limits every later comparison | Document inspection linkage and coverage, not just a passed sample teardown |
| How much manual timing variation is acceptable? | Fixed-window slot matching may fail in general fabrication | Compare labeled cycle timing before extending matching policy |
| What is the real false-alert burden? | Determines whether an operator keeps using it | Log advisory episodes and check time in shadow mode |
| Does the buyer need cross-device sync immediately? | Determines when a backend is justified | Test a local operator/quality-lead handover before adding cloud scope |
| What are the actual hackathon deadline and rubric? | Dictates rehearsal/submission priorities | Confirm with the organizers; do not infer from an old brief |

Deliberately excluded from the first app: generic chat assistant, automatic defect diagnosis, machine control, customer shipment approval, native app wrappers, billing, ERP/MES integration, predictive remaining-tip life, heat-input calculations without the required measurements, energy/carbon savings without measurements, augmented reality, CAD editing, a production fleet map, and other manufacturing processes.

Add one of these only when the core loop works and a specific validated requirement justifies it. Do not turn the prototype into a collection of disconnected screens.

## 17. Source index and reading order

External sources were consulted on **17 November 2026**. Availability, product offerings, browser behavior, and license terms can change; recheck them when implementing the relevant integration. This is an engineering/product synthesis, not certification or a market-size report.

### Project sources — read first

1. [docs.md](docs.md): mechanism, hypotheses, baseline/pilot intent, original positioning.
2. [sim/engine.js](sim/engine.js), [its tests](sim/engine.test.mjs), and [simulation assumptions](sim/ASSUMPTIONS.md): executable synthetic behavior and its limits.
3. [site/index.html](site/index.html), [site/style.css](site/style.css), [site/model.js](site/model.js): identity, explanatory language, existing helper behavior.
4. [README.md](README.md) and [site/README.md](site/README.md): commands and integration conventions.

### Welding and data research

5. [Stemmer et al., Unsupervised Welding Defect Detection Using Audio and Video](https://arxiv.org/html/2409.02290v1): research precedent and generalization caveats.
6. [Rohe et al., Detecting Process Anomalies in the GMAW Process by Acoustic Sensing](https://www.mdpi.com/2504-4494/5/4/135): controlled acoustic process-anomaly experiment.
7. [Intel Robotic Welding Multimodal Dataset card](https://huggingface.co/datasets/IntelLabs/Intel_Robotic_Welding_Multimodal_Dataset): access, provenance, label/alignment limits, and terms.
8. [Sound Weld Anomaly Detection public acquisition page](https://studio.edgeimpulse.com/public/47648/latest/acquisition/training): available clip counts, channels, and lengths; verify provenance/rights before use.
9. [TWI MIG/MAG overview](https://www.twi-global.com/what-we-do/research-and-technology/technologies/welding-joining-and-cutting/arc-processes-and-welding-engineering/metal-inert-active-gas-mig-mag-welding): cross-sector process context.

### Existing products — inspect, do not copy their claims

10. [Fronius welding-data collection / WeldCube](https://www.fronius.com/en-us/usa/welding-technology/world-of-welding/welding-data-collection).
11. [Fronius WeldCube Connector manual](https://manuals.fronius.com/html/4204260363/en-US.html).
12. [WeldEye Quality Management](https://www.weldeye.com/solutions/quality-management).
13. [Lincoln CheckPoint](https://promotions.lincolnelectric.com/checkpoint/).

### Implementation and accessibility references

14. [React app setup](https://react.dev/learn/creating-a-react-app), [Vite getting started](https://vite.dev/guide/).
15. [MDN Web Bluetooth](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API).
16. [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [track settings](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/getSettings), [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet).
17. [Chrome Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api), [MDN Screen Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).
18. [MDN storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria), [Background Sync](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API).
19. [MDN service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers), [web.dev PWA installation](https://web.dev/learn/pwa/installation).
20. [W3C WCAG 2.2 contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

## 18. Final instruction to the implementing agent

Build the smallest complete product that turns **identified workpiece → trustworthy observations → explainable action → recorded inspection/disposition** into a polished offline-capable workflow. Make the recipe genuinely independent of automotive. Preserve the distinction between observation, anomaly, inspection, and authorization. Show the work in a working app before expanding the scope.
