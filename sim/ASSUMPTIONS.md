# Nabz replay: scenarios, sources and assumptions

Everything in the replay is **simulated**. The telemetry is synthetic, and the supplier, job RSB-417 and part IDs are fictional. Part 0184 with three of four welds comes from the staged example in `docs.md`. The detector logic in `engine.js` is real code running on the synthetic data. It is not a measured Nabz result.

## What the detector does (engine.js)

Following `docs.md`, technical approach steps 1–4:

1. **Arc segmentation from clamp current.** Arc on at 40 A, off at 20 A, minimum dwell 0.3 s. Failed starts shorter than the dwell are ignored.
2. **Count and duration rule at the part boundary.** Four arcs, each at least 80% of its recipe duration. A failure produces **Hold part ####**. A lost clamp signal produces **Unverified**: the part goes to normal inspection and is not held.
3. **Sound score per arc.** Audio is scored only inside the arc windows. Each arc gets eight band energies. The score is the RMS robust z-score against the per-weld-position median and MAD of a frozen baseline: 40 known-good parts, 0061–0100, before the passed teardown. The part score is the median of its arcs, so one noisy arc cannot elevate a part.
4. **Threshold.** The 99th percentile of 40 *separate* held-out known-good parts, × 1.1, which gives 1.38.
5. **Drift rule.** If 2 of the last 6 parts are above the threshold, the state is **Watching** (no action). If 4 of 6 are above it, Nabz raises an amber **Check setup** advisory. After the operator checks, the window is cleared.

Every decision for part *p* uses only parts ≤ *p*. `engine.test.mjs` checks this.

## Scenarios

| Scenario | Ground truth | What Nabz does |
| --- | --- | --- |
| **Healthy** (control) | No process change. A nearby grinder spikes one arc on 0127. The clamp drops out on 0196. | Stays green. Ignores the single loud arc. Marks 0196 unverified. Teardown passes. |
| **Worn tip** (fault) | Contact-tip wear from 0136. Internal lack of fusion from 0175. Burnback stops W3 on 0184. | Advisory at **0163** (14:52:24), with count and durations still in recipe. If the operator acts: tip changed, 3 min stop, no defects, teardown passes. If the operator keeps running: **Hold 0184** (3 of 4 welds), and the batch still fails at the teardown. |
| **Sandbox** | Whatever you inject. Each fault starts on the next part. A worn tip ramps up and burns back W3 once when wear is severe. A skipped weld and a clamp dropout affect one part. | Same rules. A skipped weld is held at the fixture. Without Nabz it ships unless the teardown sample is bad. |
| **Wire lot** (borderline) | New wire lot at 0150 without a baseline refresh. A small spectral shift, with welds in spec. | Repeated Watching states, then one advisory at 0174. The check finds nothing, so it is a false alert that costs a 3-minute stop. |

The lead times in these runs (e.g. 12 parts, about 9.6 min, before the first defective weld) come from how the scenario was built. They are **not** a measured lead time. `docs.md` lists lead time and false alerts as unmeasured pilot questions.

## Cost model (editable in the app under *Assumptions & sources*)

```
cost  = held parts × sort cost + scrapped parts × scrap value + stop minutes × ₹/min + shipped bad parts × escape cost
₹/min = (60 s ÷ cycle s) × contribution margin per part
```

| Input | Value | Basis |
| --- | --- | --- |
| Cycle time | 48 s | Fictional fixture job |
| Teardown interval | 120 parts; the last part is sampled | Fictional. Cut-and-etch sampling frequency is set by each OEM. |
| Quarantine handling + visual sort | ₹25 per held part | About 10 min of inspector time at ~₹150/h loaded. The Haryana skilled minimum wage is ≈ ₹13,000–13,700/month (2025), roughly doubled for overhead. |
| Scrap value per bracket | ₹450 | Placeholder for a pilot to replace |
| Contribution margin per part | ₹40, giving ₹50/min | Placeholder |
| Containment stop after a failed teardown | 30 min | Placeholder |
| Operator setup check | 3 min | Placeholder |
| Bad part reaching the customer | ₹5,000 per part | Placeholder for complaint handling and sorting at the customer. Only applies when a teardown passes and a defective part ships (Sandbox). |
| Quarantine range | Last good check (0100) → teardown (0220) | `docs.md`: hold parts made since the last good check |
| Scrap range | First defective part → teardown | Assumes extra sections bound the range. Porosity and lack of fusion cannot be sorted visually. |

The worn-tip fault comes to ₹25,200 without Nabz and ₹150 with the check, so ₹25,050 is avoidable in this run. The hardware target in `docs.md` is ₹10,000–15,000 per station. Healthy (−₹25) and borderline (−₹150) show the honest cost of an unverified part and of a false alert.

## Synthetic signal model

- **Tip wear.** Severity ramps from 0136. It raises high-band energy and band variance, and adds current ripple. This matches published accounts of tip wear: an oval bore, a wandering wire, unstable arcs and burnback before feed stops.
- **Process.** MIG short-circuit transfer, 0.9 mm ER70S-6 wire, Ar/CO₂ 82/18, arcs at 150–180 A for 2.4–4.4 s. This sits inside typical ranges for 0.035" wire.
- **Noise.** Counter-based deterministic noise keyed by (scenario, part, weld, band). The same scenario and the same decision always reproduce the same run. The "with Nabz" branch differs from the baseline only after the operator acts.

## Sources

- `docs.md` and `README.md` in this repository: mechanism, capability status, part 0184, pricing target.
- Stemmer et al., *Unsupervised Welding Defect Detection Using Audio and Video* (Intel, 2024), https://arxiv.org/abs/2409.02290. Precedent that weld audio carries defect signals. Their AUCs are Intel's robotic-weld results, not Nabz's.
- Rohe et al., shielding-gas flow detection from weld audio with a CNN, *J. Manuf. Mater. Process.* (2021), https://doaj.org/article/dbd1a86babec4432a10e4faeb1f54dde
- Belgian Welding Institute sound clips on Edge Impulse (the planned first audio baseline): https://studio.edgeimpulse.com/public/47648/latest/acquisition/training
- Bernard / Tregaskiss, *Understanding and extending contact tip life*: https://bernardtregaskiss.com/understanding-and-extending-contact-tip-life
- Miller, *MIG welding 101* (current ranges by wire size): https://www.millerwelds.com/resources/article-library/mig-welding-101
- Assembly Magazine, *Parts quarantine and recovery*: https://www.assemblymag.com/articles/95740-parts-quarantine-and-recovery
- SIAM voluntary recall register (VW/Škoda, Oct 2024): https://www.siam.in/siam-voluntary-recall
- WageIndicator, Haryana minimum wage: https://wageindicator.org/en-in/work-in-india/minimum-wage/17192-haryana/17487-shops-and-commercial-establishments
