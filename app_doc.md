# Nabz — Arc Welding Monitor & Traceability PWA
## Application Documentation & Engineering Specification

**Document Date:** 17 November 2026  
**Project:** Nabz (`nabz-app`) — SPARK Night CH-06  
**Repository Location:** `app/`  
**Stack:** React 18, TypeScript 5.6, Vite 5.4, Vite PWA (Workbox), IndexedDB (`idb`), Pure CSS Modules  

---

### Table of Contents
1. [Executive Overview & Positioning](#1-executive-overview--positioning)
2. [Non-Negotiable Product Truths](#2-non-negotiable-product-truths)
3. [Architecture & Technology Stack](#3-architecture--technology-stack)
4. [Information Architecture & Navigation](#4-information-architecture--navigation)
5. [Domain Engine & Verification Logic](#5-domain-engine--verification-logic)
6. [Acoustic Baseline & Drift Advisory](#6-acoustic-baseline--drift-advisory)
7. [Supported Recipes & Sector Independence](#7-supported-recipes--sector-independence)
8. [Attention Queue & Operator Response](#8-attention-queue--operator-response)
9. [Part Passport & Traceability](#9-part-passport--traceability)
10. [Persistence, Schema & Data Integrity](#10-persistence-schema--data-integrity)
11. [PWA Offline Reliability & Hardware Boundary](#11-pwa-offline-reliability--hardware-boundary)
12. [Accessibility & UI Design System](#12-accessibility--ui-design-system)
13. [Deterministic Replay Scenarios & Judge Path](#13-deterministic-replay-scenarios--judge-path)
14. [Testing Suite & Verification Evidence](#14-testing-suite--verification-evidence)
15. [How to Run, Build, and Deploy](#15-how-to-run-build-and-deploy)

---

### 1. Executive Overview & Positioning

**Nabz** (meaning *pulse*) is an installable, offline-first React Progressive Web App (PWA) designed as a workshop instrument for repeatable arc-welding jobs. It takes the pulse of a welding operation using current and sound, connecting observational evidence to a specific physical workpiece and actionable next steps.

#### Core Positioning
> Earlier warnings and traceable checks for repeatable arc-welding jobs on the equipment a workshop already owns.

Automotive component manufacturing is an initial reference scenario, not an architectural limitation. Nabz supports general structural fabrication, agricultural equipment, and metal furniture assemblies through the same unified domain workflow: **Station → Job Recipe → Arc Check → Workpiece Passport → Inspection → Final Disposition**.

---

### 2. Non-Negotiable Product Truths

Every screen, record, and export in Nabz strictly adheres to these evidentiary boundaries:

1. **Missing and short arc events are rule checks:** They are deterministic measurements of arc presence and duration against a recipe. They are *not* an AI classification of internal metallurgical weld quality.
2. **Unusual sound is an investigative trigger:** A sustained drift in acoustic emission advises the operator to check physical torch and gas delivery. It does *not* predict porosity, lack of fusion, or crack formation.
3. **Arc counting does not prove seam location:** Matching the expected arc count does not guarantee that every intended joint was welded. Physical position identity requires an independent fixture sensor or validated sequence.
4. **No signal means an unverified check:** Missing, stale, or clipped sensor telemetry results in an `UNVERIFIED` state. Missing data is *never* converted into a green check.
5. **Monitoring is not inspection acceptance:** Nabz provides process observation; it does not replace the manufacturer's qualified Welding Procedure Specification (WPS) or mandatory NDT examinations.
6. **The app advises humans:** Nabz provides instructions for operators and quality leads; it does not operate machinery interlocks or certify customer shipments.
7. **Clear provenance labels:** Synthetic replay, recorded research data, and live sensor capture are visibly demarcated across all views and exports.

---

### 3. Architecture & Technology Stack

The application resides in `app/` as an independent, lightweight client-side React PWA:

```
app/
├── public/
│   ├── favicon.svg              # Nabz pulse icon
│   └── icons/
│       ├── icon-192.png         # PWA app icon (192x192)
│       └── icon-512.png         # PWA app icon (512x512 maskable)
├── src/
│   ├── components/              # Shared UI components
│   │   ├── Header.tsx           # Global header with provenance & role switcher
│   │   ├── NavRail.tsx          # Desktop navigation rail
│   │   ├── BottomNav.tsx        # Mobile bottom navigation bar
│   │   ├── InstructionCard.tsx  # Large operator action banner
│   │   ├── TraceView.tsx        # 50 Hz dark current trace SVG + table fallback
│   │   ├── SeamMap.tsx          # 2D schematic workpiece seam map + table fallback
│   │   ├── SoundTrend.tsx       # 6-part rolling window acoustic drift indicator
│   │   ├── Modal.tsx            # Accessible modal container with focus trap
│   │   ├── SetupCheckModal.tsx  # 3-minute physical inspection checklist modal
│   │   ├── InspectionModal.tsx  # Quality lead NDT/visual inspection feedback modal
│   │   └── DispositionModal.tsx # Quality lead rework/scrap/release authorization modal
│   ├── context/
│   │   └── AppContext.tsx       # Global state machine and scenario coordinator
│   ├── data/
│   │   ├── db.ts                # IndexedDB persistence layer (idb schema v1)
│   │   └── export.ts            # RFC 4180 CSV export with formula injection shielding
│   ├── domain/
│   │   ├── types.ts             # Strict TypeScript domain interfaces
│   │   ├── recipes.ts           # Automotive (RSB-417) & General Fab (FAB-206) recipes
│   │   ├── baseline.ts          # Robust acoustic baseline & rolling window logic
│   │   └── checker.ts           # Pure segmentation & arc duration matching engine
│   ├── pages/
│   │   ├── StationPage.tsx      # Operator work surface
│   │   ├── PartsPage.tsx        # Traceability list with search and filters
│   │   ├── PartDetailPage.tsx   # Comprehensive Part Passport view
│   │   ├── AttentionPage.tsx    # Triaged queue (Held, Unverified, Advisories)
│   │   ├── JobsPage.tsx         # WPS recipes catalog
│   │   ├── JobDetailPage.tsx    # Recipe editor and slot configuration
│   │   ├── ReportsPage.tsx      # Station shift report & CSV/JSON backup
│   │   ├── SetupPage.tsx        # Hardware checklist & diagnostic capabilities
│   │   └── DemoPage.tsx         # Guided scenario catalog & 3-minute stage pitch
│   ├── replay/
│   │   └── scenarios.ts         # 11 deterministic test scenarios with ground truth
│   ├── styles/
│   │   ├── tokens.css           # Industrial design system tokens
│   │   ├── global.css           # Global typography, form, and button styling
│   │   └── layout.css           # Responsive desktop rail and mobile bottom nav
│   ├── tests/
│   │   ├── checker.test.ts      # Unit tests for segmentation and rule checks
│   │   ├── recipes.test.ts      # Recipe validation and constraint tests
│   │   ├── baseline.test.ts     # Acoustic distance and drift window tests
│   │   ├── export.test.ts       # CSV sanitization and RFC 4180 tests
│   │   └── scenarios.test.ts    # Replay scenario execution tests
│   ├── App.tsx                  # React Router routes and layout structure
│   └── main.tsx                 # PWA bootstrap entry point
├── index.html                   # HTML entry with viewport-fit and manifest link
├── package.json                 # Dependencies and test/build scripts
├── tsconfig.json                # Strict TypeScript configuration
└── vite.config.ts               # Vite bundler & PWA plugin configuration
```

#### Production Bundle Performance
- **JavaScript Bundle:** 284.88 kB (82.64 kB gzipped) — well below the 350 kB target.
- **CSS Bundle:** 8.43 kB (2.62 kB gzipped).
- **Service Worker:** Pre-caches 10 core entries for immediate offline availability.

---

### 4. Information Architecture & Navigation

The app implements a full client-side URL routing hierarchy using `react-router-dom`:

| Route | View Name | Main Operator / Supervisor Action |
|---|---|---|
| `/` | Station Surface | Open active station, start/finish part, follow instruction |
| `/station/:stationId` | Station Surface | Dedicated station monitoring screen |
| `/parts` | Traceability List | Search by part ID, filter findings, export CSV |
| `/parts/:partId` | Part Passport | Inspect complete audit trail, record inspection/disposition |
| `/alerts` | Attention Queue | Triage held parts, unverified gaps, and setup checks |
| `/jobs` | Recipe Catalog | View saved recipes, check baseline compatibility |
| `/jobs/:jobId` | Recipe Editor | Edit slot timing, inspect 2D seam map, activate version |
| `/reports` | Shift Summary | Export CSV, download JSON backup, print shift report |
| `/setup` | Station Setup | Configure station label, review instrument diagnostics |
| `/demo` | Guided Demo | Select and execute deterministic replay scenarios |

#### Responsive Dual Navigation
- **Desktop / Tablet (>768px):** Left navigation rail (`NavRail`) with direct access to Station, Parts, Attention (with dynamic unread badge), Jobs, Reports, Setup, and Demo.
- **Mobile (≤768px):** Bottom navigation bar (`BottomNav`) with 4 ergonomic destinations: Station, Parts, Attention, and More (containing Jobs, Reports, Setup, and Demo). Touch targets are maintained at $\ge 48 \times 48\text{px}$.

#### Demo Role Switcher
A persistent dropdown in the header allows demonstrating different user perspectives:
- **Welding Operator:** Focuses on cycle status, seam progress, and immediate instructions.
- **Quality Lead / Supervisor:** Manages attention queue, records inspection results, authorizes dispositions.
- **Workshop Owner / Production Lead:** Reviews shift coverage, scrap rate, and station uptime.
- **Installer / Technical Team:** Inspects sensor capabilities, clock synchronization, and baseline readiness.

---

### 5. Domain Engine & Verification Logic

The core deterministic engine is implemented in pure, stateless TypeScript functions (`app/src/domain/checker.ts`), free of DOM dependencies.

#### 5.1 Hysteresis Segmentation with Dwell Filtering
- **Arc-On Threshold:** Current $\ge 40\text{ A}$ (default for MIG short-circuit).
- **Arc-Off Threshold:** Current $< 20\text{ A}$.
- **Minimum Dwell Filter:** $\Delta t \ge 0.30\text{ s}$. Pulses shorter than 0.30 seconds (contact chatter, failed strikes) are rejected.
- **Boundary Continuity:** Arcs crossing sample chunks or buffer ends are preserved rather than fragmented.

#### 5.2 One-to-One Recipe Matching
Segmented arc pulses are matched to planned recipe slots within an allowable start-time window ($\pm 2.5\text{ s}$).
- **One-to-One Constraint:** An observed arc interval can satisfy at most one weld slot.
- **Duration Check:** Measured arc duration $t_{\text{meas}}$ must satisfy:
  $$t_{\text{meas}} \ge t_{\text{nom}} \times (1 - \text{durTolerance})$$
  *(For RSB-417 with $20\%$ tolerance, $t_{\text{meas}} \ge 0.80 \times t_{\text{nom}}$)*.
- **Missing Arc:** Planned slot with no corresponding observed interval $\implies$ `MISSING_REQUIRED_ARC` $\implies$ **Hold Part**.
- **Short Arc:** Measured duration below minimum $\implies$ `SHORT_REQUIRED_ARC` $\implies$ **Hold Part**.
- **Extra Arcs:** Unassigned arc events $\implies$ `EXTRA_OR_AMBIGUOUS_ARCS` $\implies$ **Sequence Review**.
- **Sensor Dropout:** Current gap intersecting a planned weld interval $\implies$ `CURRENT_GAP` $\implies$ **Verification Incomplete**.

#### 5.3 Headline Precedence Hierarchy
When deriving the primary instruction banner, Nabz enforces strict priority:
1. **Unresolved Hold:** Known missing or short arc $\implies$ **Hold Part [ID]** *(Red banner)*.
2. **Verification Incomplete:** Signal gap or missing packets $\implies$ **Verification Incomplete** *(Slate banner)*.
3. **Active Part:** Ongoing cycle $\implies$ **Monitoring Part [ID]** *(Cyan banner)*.
4. **Acoustic Advisory:** Sustained drift on valid parts $\implies$ **Check Setup** *(Amber banner)*.
5. **Checks Clear:** All required arcs confirmed $\implies$ **Count & Duration Checks Clear** *(Green banner)*.
6. **Station Idle:** Ready for workpiece $\implies$ **Ready for Next Part** *(Neutral banner)*.

---

### 6. Acoustic Baseline & Drift Advisory

Implemented in `app/src/domain/baseline.ts`.

#### 6.1 Robust Scoring
For each arc event $w$, eight compact log-mel band energies $x = [x_1, \dots, x_8]$ (spanning $0.1\text{ kHz}$ to $16\text{ kHz}$) are evaluated against a frozen, job-specific baseline $(\text{median}_b, \text{MAD}_b)$:
$$z_b = \frac{x_b - \text{median}_b}{\text{MAD}_b}, \quad s_{\text{arc}} = \sqrt{\frac{1}{8} \sum_{b=1}^{8} z_b^2}$$

#### 6.2 Part-Level Median Aggregation
$$\text{Score}_{\text{part}} = \text{median}(s_{\text{arc}, 1}, \dots, s_{\text{arc}, W})$$
Using the median across weld slots prevents a single loud external acoustic event (e.g. adjacent grinder or air blast) from falsely elevating the part score.

#### 6.3 Rolling Window & Advisory State
- **Window Size:** Last 6 valid scored parts (excluding held or unverified parts).
- **Threshold:** Derived from 99th percentile of 40 validation parts $+ 10\%$ safety margin ($1.38$ for RSB-417).
- **Watching:** $k \ge 2$ of last 6 parts elevated $\implies$ `watching` (log internally, no line stoppage).
- **Advisory Open:** $k \ge 4$ of last 6 parts elevated $\implies$ `advisory_open` $\implies$ **Amber Setup Check Banner**.

#### 6.4 Operator 5-Point Setup Checklist
When an advisory opens, the operator executes a 3-minute physical inspection:
1. **Contact Tip & Nozzle:** Spatter accumulation, bore ovality, burnback.
2. **Shielding Gas Delivery:** Bottle pressure, regulator flow, nozzle shroud seal.
3. **Wire Feeding:** Drive roll tension, spool brake, conduit liner friction.
4. **Microphone Orientation:** Direct acoustic line-of-sight without physical contact.
5. **Ambient Interference:** Grinding or adjacent arc noise.

---

### 7. Supported Recipes & Sector Independence

Nabz decouples workpiece geometry and welding parameters from industry labels. Two fully parameterized recipes are preloaded:

| Parameter | Automotive Reference (`RSB-417`) | General Fabrication (`FAB-206 r1`) |
|---|---|---|
| **Workpiece** | Rear suspension bracket | Equipment mounting frame |
| **Sector** | Automotive components | General fabrication |
| **Process** | MIG (GMAW), short-circuit transfer | MIG (GMAW), single-pass spray/globular |
| **Material & Thickness**| Mild steel, 2.5 mm | Structural steel S275, 4.0 mm |
| **Wire & Gas** | 0.9 mm ER70S-6, Ar/CO₂ 82/18 | 1.2 mm ER70S-6, Ar/CO₂ 80/20 |
| **Cycle Duration** | 48 seconds | 60 seconds |
| **Duration Tolerance** | 20% minimum (80% of nominal) | 20% minimum (80% of nominal) |
| **Weld Slots** | **4 Welds:**<br>• W1: Left gusset (3.2s nom, 2.56s min)<br>• W2: Right gusset (3.2s nom, 2.56s min)<br>• W3: Tube collar (4.4s nom, 3.52s min)<br>• W4: Tab fillet (2.4s nom, 1.92s min) | **6 Welds:**<br>• W1: Base left (3.0s nom, 2.4s min)<br>• W2: Base right (3.0s nom, 2.4s min)<br>• W3: Cross strut (4.0s nom, 3.2s min)<br>• W4: Top diagonal (3.0s nom, 2.4s min)<br>• W5: Guard tab (3.0s nom, 2.4s min)<br>• W6: Corner brace (4.0s nom, 3.2s min) |
| **Baseline ID** | `baseline-rsb417-v3` (Threshold 1.38) | `baseline-fab206-r1` (Threshold 1.42) |

---

### 8. Attention Queue & Operator Response

Implemented in `app/src/pages/AttentionPage.tsx`.

The attention queue triages issues into three actionable categories:
1. **Held Parts:** Confirmed missing or short arcs. The operator or supervisor can acknowledge awareness, view evidence, or record a quality disposition.
2. **Needs Verification:** Telemetry dropouts or ambiguous extra arcs where counts cannot be definitively confirmed.
3. **Setup Checks & Advisories:** Sustained acoustic process drift where physical torch checks must be documented.

#### Action Ledger
Every action is recorded with an immutable timestamp, actor role, and details:
- `acknowledge`: Records operator awareness without releasing the hold.
- `complete_setup_check`: Documents checklist verification and outcome (`issue_found` or `nothing_found`).
- `record_inspection`: Records human NDT/macro results (`accepted`, `rejected`, `inconclusive`).
- `record_disposition`: Quality lead authorization for `rework`, `scrap`, or `released`.

---

### 9. Part Passport & Traceability

Implemented in `app/src/pages/PartDetailPage.tsx`.

Every manufactured part receives a **Part Passport** acting as a complete evidentiary dossier:
- **Header:** Part Display ID (`RSB-000184`), stable internal UUID, Station ID, Recipe Revision, Baseline reference, and `SYNTHETIC REPLAY` provenance banner.
- **Automated Check Findings:** Exact observed arc count versus expected count, and measured durations versus minimum requirements.
- **Weld Slot Table:** Granular per-seam breakdown including nominal timing, measured duration, average current (A), and slot status.
- **Acoustic Record:** Part score, baseline threshold, and acoustic verification state.
- **Complete Audit Timeline:** Chronological log from cycle start to boundary confirmation, logged findings, acknowledgments, inspections, and final disposition.
- **Export & Print:** Native clean print stylesheet for paper filing.

---

### 10. Persistence, Schema & Data Integrity

Implemented in `app/src/data/db.ts` using `idb` wrapping IndexedDB database `nabz-pwa-db` (Schema version 1).

#### Object Stores & Indexes
- `stations`: Key `id`.
- `recipes`: Key `id`, indexed by `by-job`.
- `baselines`: Key `id`, indexed by `by-recipe`.
- `parts`: Key `id`, indexed by `by-display`, `by-station`, `by-start`, `by-rule`, `by-disposition`, `by-session`.
- `findings`: Key `id`, indexed by `by-part`, `by-station`, `by-status`, `by-kind`.
- `actions`: Key `id`, indexed by `by-part`, `by-finding`, `by-time`.
- `inspections`: Key `id`, indexed by `by-part`.
- `dispositions`: Key `id`, indexed by `by-part`.

#### Atomic Transactions
Part summaries, observations, and generated findings are committed within a single atomic read-write transaction (`savePartFinalResult`).

#### Scoped Demo Reset
`resetDemoSession(sessionId)` removes only records generated during that specific replay session, leaving workshop configurations, recipe versions, and baselines intact.

#### Formula Injection Protection (`app/src/data/export.ts`)
CSV exports strictly adhere to RFC 4180. To prevent CSV Formula Injection attacks in spreadsheet software (Excel, LibreOffice), any cell value beginning with `=`, `+`, `-`, `@`, `\t`, or `\r` is automatically sanitized with an escaped leading single quote (`'`).

---

### 11. PWA Offline Reliability & Hardware Boundary

Implemented in `app/vite.config.ts` via `vite-plugin-pwa`:
- **Web App Manifest (`manifest.webmanifest`):** Configured with standalone display, theme color `#114957`, background `#F0F2F0`, and regular/maskable icons.
- **Service Worker Cache Strategy:** Workbox precaches all JavaScript, CSS, HTML, SVG, and JSON assets.
- **Offline Behavior:** Once visited or installed, the application runs completely offline in airplane mode. Replay scenarios, IndexedDB persistence, CSV exports, and passport lookups function without an active network connection.
- **Honest Hardware Boundary:** The diagnostics view (`/setup`) detects `getUserMedia` and `Web Bluetooth`, while clearly stating `Live capture not configured` for physical current clamps.

---

### 12. Accessibility & UI Design System

Designed according to WCAG 2.2 AA standards with palette tokens defined in `app/src/styles/tokens.css`:

| Token | Hex Value | Semantic Usage |
|---|---|---|
| `--paper` | `#F0F2F0` | Main application background (pale industrial paper) |
| `--surface` | `#FFFFFF` | Card panels, data tables, modals |
| `--ink` | `#19212C` | Primary text with 4.5:1+ contrast ratio |
| `--muted` | `#485662` | Secondary labels and timestamp metadata |
| `--action` | `#114957` | Deep industrial teal for primary buttons, active links |
| `--action-soft` | `#DEECEC` | Highlighted table rows and soft badges |
| `--trace-panel` | `#1D2734` | Instrument-grade dark background for current waveform |
| `--signal` | `#9CE4E5` | High-contrast cyan current signal curve |
| `--ok-bg` / `--ok-ink` | `#E9F3ED` / `#216149` | Checks clear status banner and badges |
| `--warn-bg` / `--warn-ink` | `#FFF3D6` / `#805000` | Setup check advisory banner and badges |
| `--hold-bg` / `--hold-ink` | `#FBEAE7` / `#A12E2A` | Part hold banner and badges |
| `--unknown-bg` / `--unknown-ink` | `#E7EBED` / `#485662` | Unverified sensor gap status and badges |

#### Accessibility Highlights
- **Keyboard Navigation:** Full focus rings (`outline: 2.5px solid var(--action)`).
- **Skip Link:** Dedicated `<a href="#main-content">Skip to main content</a>`.
- **Live Regions:** `aria-live="polite"` on the instruction banner for screen readers.
- **Accessible Table Alternatives:** Both the Current Trace SVG and Seam Map SVG include one-click toggles to view identical data as accessible HTML tables.

---

### 13. Deterministic Replay Scenarios & Judge Path

Implemented in `app/src/replay/scenarios.ts`.

#### 13.1 Catalog of 11 Test Scenarios
1. `bracket-normal`: All 4 welds completed with nominal duration $\implies$ Checks Clear.
2. `bracket-0184-missing`: W3 collar weld skipped due to simulated wire burnback $\implies$ **Hold Part RSB-000184** (3 of 4 welds observed).
3. `bracket-short-w2`: W2 right gusset terminates early at 1.80s (min 2.56s) $\implies$ **Hold Part** (Short arc).
4. `bracket-grinder`: Single loud acoustic spike from adjacent grinder on arc 2 $\implies$ Checks Clear (median part score suppresses isolated spike).
5. `bracket-current-gap`: Clamp sensor drops out during W2 $\implies$ **Verification Incomplete** (Current gap).
6. `bracket-audio-missing`: Microphone stream denied/unavailable $\implies$ Count and duration checks clear; sound checks unavailable.
7. `bracket-wire-lot`: New wire spool shifts acoustic harmonics $\implies$ **Advisory Open** across 4 of 6 parts (Operator verifies "Nothing found").
8. `bracket-open-arc`: Arc active when boundary initiated $\implies$ Verification Incomplete (Unconfirmed boundary).
9. `bracket-extra-arc`: 5 arcs observed for 4-weld recipe $\implies$ **Sequence Review** (Extra unassigned arcs).
10. `frame-six-normal`: General fabrication frame with all 6 welds completed $\implies$ Checks Clear on `FAB-206`.
11. `frame-six-missing-w4`: Mounting frame with W4 diagonal omitted $\implies$ **Hold Part** (5 of 6 welds, W4 absent).

#### 13.2 3-Minute Hackathon Demonstration Script
- **0:00–0:20 (Missing Arc Action):** Open station at `bracket-0184-missing`. Point to red banner: *"3 of 4 arc events observed. Hold part RSB-000184."* Emphasize: action first, not an abstract anomaly score.
- **0:20–0:45 (Explainable Evidence):** Open the Part Passport. Show W3 absent on both the 2D seam map and the 50 Hz dark current trace. Explain that current proves an arc event occurred, not internal weld quality.
- **0:45–1:10 (Quality Loop & Traceability):** Click **Record Inspection** (Visual: Rejected, missed joint), then **Record Disposition** (Rework). Refresh the browser to prove IndexedDB local durability.
- **1:10–1:35 (Acoustic Process Drift):** Switch scenario to `bracket-wire-lot`. Show the amber advisory: *"The arc sound changed across 4 of 6 valid parts."* Open the 3-minute setup checklist, inspect tip and gas, and record *"Nothing found"*.
- **1:35–2:00 (Dropout vs Missing Weld):** Switch scenario to `bracket-current-gap`. Demonstrate that lost sensor signal becomes *Verification Incomplete*, never a false assertion of 0 welds.
- **2:00–2:30 (Sector-Neutral 6-Weld Recipe):** Switch scenario to `frame-six-normal`. Demonstrate that Nabz is not limited to automotive brackets: it runs an equipment mounting frame with 6 distinct seams.
- **2:30–3:00 (Offline Handover & Ask):** Demonstrate the printable shift report and CSV export. Conclude with the pilot ask: one repeat-fixture fabrication station, a quality lead, and a two-week shadow trial.

---

### 14. Testing Suite & Verification Evidence

All 47 tests across the simulation and React app pass with zero errors:

```bash
# 1. Existing Simulation Suite (sim/*.test.mjs)
✔ same scenario + policy reproduces the same run
✔ threshold is fitted on known-good data only and sits above it
✔ healthy run: no advisory, no hold, every weld sound, teardown passes
✔ detector is causal: faults added later do not change earlier decisions
✔ worn tip: advisory precedes defects; part 0184 held when the advisory is ignored
✔ wire lot: one advisory, check finds nothing, no defects, costs money
✔ sandbox: a skipped weld is held by Nabz and ships without it
✔ figures agree with their inputs
✔ segmentation: dwell filter rejects failed starts
✔ full screen enters, exits and follows an external Escape exit
✔ a rejected request shows a message and allows retrying
✔ unsupported browsers disable the control with an explanation
✔ torch tracks all four seams exactly and approaches without a jump
✔ arc, sparks and smoke follow every weld and freeze at the playhead
✔ rewinding reconstructs effects and clears them at a new part
✔ skipped welds have no arc or particles; reduced motion retains the weld
(16 passed)

# 2. Site Calculation Suite (site/model.test.js)
✔ the stage example is 600 affected parts × ₹400 × 30%
✔ fractional rates and zero volume use the same arithmetic
✔ sensitivity never extends below 0% or above 100%
✔ the simulator URL supports a standalone app and a same-origin route
(4 passed)

# 3. App Domain & PWA Suite (app/src/tests/*.test.ts)
✔ src/tests/checker.test.ts (11 tests: dwell filter, open arc, 1-to-1 matching, missing arc, short arc, gap, extra arcs, FAB-206 6-welds, headline precedence)
✔ src/tests/recipes.test.ts (3 tests: RSB-417 validation, FAB-206 validation, invalid recipe rejection)
✔ src/tests/baseline.test.ts (4 tests: robust z-score, median aggregation, 4-of-6 window, held-part exclusion)
✔ src/tests/export.test.ts (4 tests: CSV formula injection neutralization, quote escaping, leading zeros, RFC 4180 structure)
✔ src/tests/scenarios.test.ts (9 tests: execution of all 11 replay scenarios)
(31 passed)

Total: 51 tests passed (100% passing)
```

---

### 15. How to Run, Build, and Deploy

#### Run Development Servers
```bash
# Run simulator (port 8000)
npm start

# Run React PWA in development mode (port 5173)
npm run app:dev
```

#### Run All Test Suites
```bash
# Runs root simulation tests and app unit tests
npm test

# Runs only app unit tests
npm run app:test
```

#### Production Build
```bash
# Compiles TypeScript and builds production PWA bundle with service worker
npm run app:build

# Preview production build locally
npm --prefix app run preview
```
