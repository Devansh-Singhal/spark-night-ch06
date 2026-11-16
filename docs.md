# Nabz · SPARK Night CH-06

Nabz is a proposed low-cost retrofit that uses weld current and sound to catch missed or short welds and give operators an earlier warning when a process drifts. The first customer is a small auto-component supplier running repeat parts on an existing MIG arc-welding fixture.

**Pitch line.** Catch the missing weld before the part leaves the fixture.

**Name.** Nabz (नब्ज़ / نبض) means pulse in Hindi and Urdu. For the stage, “Nabz means pulse. We’re taking the pulse of every weld.”

## Project links

| Item | Location |
| --- | --- |
| Judges’ deck | [Canva](https://www.canva.com/d/Zux05mF5rtGJmd_) |
| PowerPoint | [Nabz-SPARK-Night-CH06-Judges.pptx](https://chatgpt.com/library?file_id=libfile_e8fc666e5a388191995237caaeb6a517&account_id=personal) |
| Code and documentation | [Devansh-Singhal/spark-night-ch06](https://github.com/Devansh-Singhal/spark-night-ch06) |
| Source brief | [SPARK Night CH-06 weld early-warning idea brief](https://chatgpt.com/library?file_id=libfile_1909bcad189881919ae810e452ac01b5&account_id=personal) |

The GitHub repo is private. GitHub shows write access for teammate `@yashclouded`. The deck links to the repo on slide 8, so judges need repo access if they are expected to open it.

## Challenge and problem

**CH-06** asks how factories can predict defects before they become visible using multimodal AI and low-cost sensors on legacy manufacturing equipment. Nabz starts with repetitive arc welding because a fixture and known weld sequence give us a reference for expected behavior.

A supplier can miss one weld while the line keeps making parts. A sampled teardown gives the quality lead information at the time of the check. If a defect is found, the supplier may need to hold the parts made since the last good check. In October 2024, Volkswagen and Škoda recalled 52 cars in India over a suspected missed weld seam on a track control arm. The recall is a real example of why a missing seam matters. The times and part IDs in the pitch are examples. [SIAM recall register](https://www.siam.in/siam-voluntary-recall)

## Product and current status

The clamp measures current on an existing welding cable. The signal supplies arc start, stop and duration. The phone captures sound, and the model analyzes the audio during that station’s arc windows. The job recipe supplies the part number, expected count and acceptable arc duration. The operator gets a part ID, reason and next action.

| Function | Proposed behavior | Status |
| --- | --- | --- |
| Missed or short weld | At a confirmed part boundary, compare the count and arc durations with the job recipe. Hold the specific part when the rule fails. | Staged operator screen shows part 0184 with three of four expected welds. Recorded or live detection still needs an implementation and a test. |
| Drift alert | Score sound against known-good welds for the same job. A sustained change gives the operator an amber advisory to check the setup. | Illustrative trend in the pitch. Factory lead time and false alerts are unmeasured. |
| Traceability | Record the station, job, part ID, weld count, duration, alert reason and disposition. | Proposed station log. The concept screen shows the fields a quality lead would see. |
| Diagnosis | Associate alerts with inspection results and process changes. | Later work after the team collects labeled pilot data. |

The judges’ deck, concept demo, submission copy and repo README are ready. The data importer, scoring model, live sensor integration and pilot still need to be built or verified. Routine teardown remains part of the workflow.

## Technical approach

1. **Segment the arc and the part.** Detect arc intervals from current with separate on/off thresholds and a minimum dwell time. Count the intervals inside a confirmed part cycle and compare their durations with that job’s recipe. For the first replay, use explicit part boundaries and a synthetic missing-pulse fixture. For a real station, verify part boundaries against the fixture or operator input before issuing a hold.
2. **Score sound during each arc.** Align the microphone stream to the sensor timestamps. Compute a log-mel spectrogram or compact spectral features per arc. Start with a distance-based baseline trained on known-good welds, such as a robust distance from the median feature vector. Establish whether the audio signal separates normal from error examples before adding model complexity.
3. **Combine evidence into an operator action.** Track a rolling run of elevated audio scores for drift. Count and duration failures produce a hold recommendation for the part. Drift produces an amber setup advisory so a single noisy arc does not stop the line. Record the threshold, baseline version and alert reason for review.
4. **Keep the baseline tied to the job.** Make a new baseline when the part, recipe, wire or gas changes. Use welds associated with a passed inspection and freeze the baseline during evaluation and drift monitoring. If the sensor stream drops out or a part boundary is uncertain, display that status and fall back to the normal inspection workflow.

The deep-tech claim is the combination of time-aligned current and acoustic signals with a job-specific unsupervised baseline. The count and duration checks are deterministic. The model is for detecting unusual sound, and an unusual sound needs inspection before anyone calls it a defect.

## Data and validation

| Source | How to use it |
| --- | --- |
| Belgian Welding Institute recordings on Edge Impulse | First audio baseline. The public project lists 109 training clips and 21 held-out clips, about 24½ minutes total. Start with the microphone channel. Confirm what the two other channels represent before using them as current or any other telemetry. [Edge Impulse project](https://studio.edgeimpulse.com/public/47648/latest/acquisition/training) |
| Intel robotic welding paper | Published precedent for defect signals in weld audio. The paper reports about 0.85 ROC AUC for audio alone and 0.92 for audio plus video across the evaluated defects. It used robotic welds and dedicated sensors. [Stemmer et al.](https://arxiv.org/abs/2409.02290) |
| Intel multimodal dataset | Optional research extension. It includes audio and time-series data, with gated research-only access and a 39.9 GB archive. Build the first demo without depending on access. [Intel dataset card](https://huggingface.co/datasets/IntelLabs/Intel_Robotic_Welding_Multimodal_Dataset) |

Fit on normal training recordings. Keep clips from the same original weld, run or session in one split. Tune the threshold on a validation split, then report the untouched test split and its sample counts. Report ROC AUC and a confusion matrix at the chosen threshold. The test set is small, so give counts next to rates. Evaluate the count/duration rule separately on labeled replay fixtures. Run audio-only and current-only baselines before claiming the combined signals improve results. Use original pilot data before drawing conclusions about production lead time, noisy manual welding or commercial performance.

Keep external raw datasets out of the repo. Document their access terms and provide a download or import step once the prototype uses them. Keep real factory data with the supplier and get permission for any external examples.

## Build order

| Step | What to build | Done when |
| --- | --- | --- |
| 1. Data intake | A Python loader for the labeled clips with a manifest of dataset version, channel, clip ID, sample rate and split. | A teammate can fetch data, build the manifest and reproduce the same split. |
| 2. Replay and rule engine | A part/weld event format and a replay with four expected arcs, one missing arc, one short arc and a sensor-dropout case. | The demo identifies the affected part and shows the correct reason for each case. A normal four-arc replay clears. |
| 3. Audio baseline | Normal-only training, a saved threshold and a reproducible evaluation on held-out recordings. | The team can report the actual results with a split manifest and limitations. |
| 4. Station dashboard | Show the current part, arc count, recent audio scores, alert reason and operator action. Use replay files as input first. | The demo can replay part 0184, a normal part and a labeled illustrative drift sequence without needing a live welder. |
| 5. Sensor trial | Compare a suitable split-core Hall sensor and Android microphone capture on one approved station. Check signal quality, timing sync and noise from nearby work. | The team can reproduce arc segmentation on the station and identify when the audio or current stream is unreliable. |
| 6. Factory pilot | Run alongside normal inspections on one repeated part and review every alert with the quality lead. | We have actual lead times, false alerts, disposition outcomes and an install cost for the station. |

For the first working build, Python with a simple local dashboard is enough. Keep separate entry points for replay and scoring so the team can use a held-out clip on demand. Deploy on the phone only after the replay workflow and sensor timing work. Recordings can be scored directly. Playing them out loud into a phone adds a second speaker and room acoustics as confounds.

For hardware sourcing, start by pricing an appropriately rated split-core Hall sensor, microcontroller, budget Android phone, enclosure and mount. The source brief flagged the price and availability of a production-range 400–500 A clamp as unresolved. Bench and station tests should check enclosure placement, nearby arc noise, electrical interference and capture continuity before treating the kit as ready for a shop.

## Stage demo

1. **Open on the missed weld.** Station 02 expects four welds, observes three, and shows “Hold part 0184.” Point to the part ID, the absent arc and the operator action.
2. **Show the early-warning case.** A normal baseline is followed by a staged shift replay. Explain why several elevated scores are worth checking while the process is running. Label the sequence as illustrative.
3. **Use a mystery clip once the scorer is ready.** Let a judge pick a held-out recording. Show the score and the relevant audio segment, then reveal the source label. Present the actual outcome, including a miss if it happens.
4. **Close with the pilot ask.** Ask for an introduction to one auto-component shop in Rai or Kundli for a two-week pilot on one repeat-part fixture. Keep a screen recording for the stage after the replay has been rehearsed.

The eight-slide order is hook, inspection gap, sensing retrofit, missed-weld example, illustrative drift, evidence and concept status, pricing, and pilot ask.

## Pilot and business

- **Buyer.** Start with a quality lead or owner at a smaller auto-component supplier that runs repeated MIG jobs and has to manage batch holds or customer rejections. Ask how parts are identified, how often teardown occurs, and what a hold or rejection costs.
- **Pilot.** Start with a fixture and one part number. Pair alerts with normal teardown results. Log verified missed and short welds, warning lead time in minutes and welds, false alerts per shift, parts held, and operator response. Record installation time and cost. Review what the model missed as well as what it caught.
- **Pricing.** Target ₹10,000–₹15,000 of hardware per station. Test roughly ₹1,000 a month for alerts and records as a subscription hypothesis. A US listing for the Lincoln Arc Tracker was about $4,220, roughly ₹3.7 lakh using the brief’s conversion, before shipping and duties. That is a benchmark from one listing. [Welding Outfitter listing](https://www.weldingoutfitter.com/products/lincoln-k3019-1-arc-tracker-data-monitor)
- **Adoption.** The supplier needs to see which parts the system would hold, how often an alert is wrong, and whether it would reduce sorting and quarantine cost. Once a pilot measures those costs, compare avoided losses against hardware, setup, support and subscription costs.
- **Expansion.** Move to a second fixture after validating the first. Use the same record structure across the plant. Spot welding, casting and machining are later research directions requiring their own sensor and defect-label validation.

## Next work session

1. Agree who owns data and scoring, dashboard and replay, and factory outreach and pitch. Keep `docs.md` aligned as decisions and results change.
2. Start with the missed-weld replay and make it reproducible from the repo. In parallel, acquire the public audio clips and freeze a split before running any experiments.
3. Ask a quality lead in Rai or Kundli about part boundaries, inspection intervals and batch holds. Confirm clamp range and actual kit quotes before moving from a target price to a bill of materials.
4. Update the judges’ deck and form only when new evidence is in hand. Keep published Intel metrics attributed to Intel and observations from the pilot attributed to Nabz.

The original brief listed Round 1 for **16 November 2026 at noon IST** and refined submissions for qualifying teams on **17 November 2026 at noon IST**. Confirm the active deadline and submission status with the organizers.

## Submission copy

**Challenge prompt**

CH-06 — Predicting product defects before they become visible using multimodal AI and low-cost sensors on legacy manufacturing equipment.

**Problem and solution summary (edited version)**

Volkswagen and Škoda recalled 52 cars in India in 2024 because a supplier may have missed a weld seam. Picture that moment on the factory floor. The operator unclamps the part, loads the next one, and the line keeps running. By the next sample check, the quality lead may have a whole batch to quarantine.

We built a concept demo of **Nabz** that puts the warning where it matters. Station 02 expects four welds. It sees three and flashes “Hold part 0184” before the operator releases it. The proposed kit pairs a clip-on current sensor with an Android phone. It fits the welder the shop already owns without rewiring it.

Current tells us exactly when the arc fires and how long it runs. The phone analyzes sound only during those windows, so the model can focus on the weld amid the noise of the shop. It learns what good welds sound like for each part number. A missing or short arc flags the part. A sustained change in sound tells the operator to check the setup before the next teardown.

Our hardware target is ₹10,000–₹15,000 per station compared to 3.5L+ for US arc trackers . For a small supplier, that buys the chance to pull one suspect part off the fixture before there’s a whole batch to pull off the line.
