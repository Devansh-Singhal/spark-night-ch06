import { RecipeVersion, WeldSlot } from '../domain/types';
import { AUTOMOTIVE_RECIPE_RSB417, FABRICATION_RECIPE_FAB206 } from '../domain/recipes';
import { BASELINE_RSB417, BASELINE_FAB206, computeArcScore, computePartScore } from '../domain/baseline';

export interface ReplayScenario {
  id: string;
  name: string;
  recipeId: string;
  recipe: RecipeVersion;
  description: string;
  truthExplanation: string;
  expectedResult: 'clear' | 'hold' | 'unverified' | 'sequence_review' | 'advisory';
}

export const REPLAY_SCENARIOS: ReplayScenario[] = [
  {
    id: 'bracket-normal',
    name: 'Bracket: Normal Run',
    recipeId: AUTOMOTIVE_RECIPE_RSB417.id,
    recipe: AUTOMOTIVE_RECIPE_RSB417,
    description: 'Four weld arcs completed with normal durations and sound.',
    truthExplanation: 'Nominal process conditions. All 4 joints soundly welded.',
    expectedResult: 'clear',
  },
  {
    id: 'bracket-0184-missing',
    name: 'Bracket: Missed Weld (Part 0184)',
    recipeId: AUTOMOTIVE_RECIPE_RSB417.id,
    recipe: AUTOMOTIVE_RECIPE_RSB417,
    description: 'Wire burns back during W3 collar weld; 3 of 4 welds observed.',
    truthExplanation: 'Simulated burnback failure: W3 was completely skipped.',
    expectedResult: 'hold',
  },
  {
    id: 'bracket-short-w2',
    name: 'Bracket: Short Arc on W2',
    recipeId: AUTOMOTIVE_RECIPE_RSB417.id,
    recipe: AUTOMOTIVE_RECIPE_RSB417,
    description: 'W2 right gusset cuts short at 1.80 s against 2.56 s minimum.',
    truthExplanation: 'Operator or torch stopped prematurely on joint W2.',
    expectedResult: 'hold',
  },
  {
    id: 'bracket-grinder',
    name: 'Bracket: Grinder Noise Distraction',
    recipeId: AUTOMOTIVE_RECIPE_RSB417.id,
    recipe: AUTOMOTIVE_RECIPE_RSB417,
    description: 'Loud acoustic spike from nearby grinder during arc W2.',
    truthExplanation: 'Acoustic interference only. Weld arc is physically sound. Median part score suppresses the single spike.',
    expectedResult: 'clear',
  },
  {
    id: 'bracket-current-gap',
    name: 'Bracket: Current Sensor Dropout',
    recipeId: AUTOMOTIVE_RECIPE_RSB417.id,
    recipe: AUTOMOTIVE_RECIPE_RSB417,
    description: 'Telemetry drops out during W2. Coverage incomplete -> verification required.',
    truthExplanation: 'Sensor clamp disconnected. No assertion of weld quality or missing joint.',
    expectedResult: 'unverified',
  },
  {
    id: 'bracket-audio-missing',
    name: 'Bracket: Microphone Denied / Unavailable',
    recipeId: AUTOMOTIVE_RECIPE_RSB417.id,
    recipe: AUTOMOTIVE_RECIPE_RSB417,
    description: 'Microphone stream unavailable. Current checks continue normally; audio checks unavailable.',
    truthExplanation: 'Hardware audio loss. Arc count is verified clear; acoustic drift state is unavailable.',
    expectedResult: 'clear',
  },
  {
    id: 'bracket-wire-lot',
    name: 'Bracket: Harmless Wire Lot Shift (False Advisory)',
    recipeId: AUTOMOTIVE_RECIPE_RSB417.id,
    recipe: AUTOMOTIVE_RECIPE_RSB417,
    description: 'New wire spool introduces harmonic shift; triggers advisory across 4 of 6 parts.',
    truthExplanation: 'Harmless wire lot change. Weld quality meets WPS. Setup check confirms "nothing found".',
    expectedResult: 'advisory',
  },
  {
    id: 'bracket-open-arc',
    name: 'Bracket: Arc Open at Boundary',
    recipeId: AUTOMOTIVE_RECIPE_RSB417.id,
    recipe: AUTOMOTIVE_RECIPE_RSB417,
    description: 'Arc was still active when cycle boundary was initiated.',
    truthExplanation: 'Cycle reconciliation needed. Cannot calculate final duration of unfinished arc.',
    expectedResult: 'unverified',
  },
  {
    id: 'bracket-extra-arc',
    name: 'Bracket: Extra Unassigned Arc Event',
    recipeId: AUTOMOTIVE_RECIPE_RSB417.id,
    recipe: AUTOMOTIVE_RECIPE_RSB417,
    description: '5 arc events detected for a 4-weld recipe. Sequence review required.',
    truthExplanation: 'Extra arc struck between W2 and W3. Does not guarantee correct joint locations.',
    expectedResult: 'sequence_review',
  },
  {
    id: 'frame-six-normal',
    name: 'Mounting Frame: 6 Welds Normal',
    recipeId: FABRICATION_RECIPE_FAB206.id,
    recipe: FABRICATION_RECIPE_FAB206,
    description: 'General fabrication equipment mounting frame: all 6 weld slots completed normally.',
    truthExplanation: 'Nominal single-pass MIG execution on structural steel frame.',
    expectedResult: 'clear',
  },
  {
    id: 'frame-six-missing-w4',
    name: 'Mounting Frame: Missing W4 Diagonal',
    recipeId: FABRICATION_RECIPE_FAB206.id,
    recipe: FABRICATION_RECIPE_FAB206,
    description: '5 of 6 welds observed on mounting frame. Expected W4 diagonal absent.',
    truthExplanation: 'Operator missed top diagonal seam W4 in fixture sequence.',
    expectedResult: 'hold',
  },
];

export interface GeneratedTelemetry {
  partNumber: number;
  displayId: string;
  recipe: RecipeVersion;
  trace: Float32Array;
  sampleHz: number;
  cycleSec: number;
  hasGap: boolean;
  isBoundaryConfirmed: boolean;
  isAudioAvailable: boolean;
  arcScores: (number | null)[];
  partScore: number | null;
  bandFeatures: number[][];
}

/**
 * Generate synthetic 50 Hz current trace and acoustic features for a scenario
 */
export function generateScenarioTelemetry(scenarioId: string, partIndex = 1): GeneratedTelemetry {
  const scenario = REPLAY_SCENARIOS.find((s) => s.id === scenarioId) || REPLAY_SCENARIOS[0];
  const recipe = scenario.recipe;
  const sampleHz = recipe.detectorConfig.sampleHz;
  const nSamples = Math.round(recipe.cycleSec * sampleHz);
  const trace = new Float32Array(nSamples);

  const baseline = recipe.id === FABRICATION_RECIPE_FAB206.id ? BASELINE_FAB206 : BASELINE_RSB417;
  const prefix = recipe.jobId === 'FAB-206' ? 'FAB' : 'RSB';
  const displayId = `${prefix}-${String(partIndex).padStart(6, '0')}`;

  let hasGap = false;
  let isBoundaryConfirmed = true;
  let isAudioAvailable = true;

  // Determine which welds are present or modified based on scenario
  const weldConfigs: {
    slot: WeldSlot;
    skip: boolean;
    dur: number;
    noisy: boolean;
    elevatedSound: boolean;
  }[] = recipe.welds.map((slot) => ({
    slot,
    skip: false,
    dur: slot.dur,
    noisy: false,
    elevatedSound: false,
  }));

  if (scenario.id === 'bracket-0184-missing') {
    // W3 missing (index 2)
    if (weldConfigs[2]) weldConfigs[2].skip = true;
  } else if (scenario.id === 'bracket-short-w2') {
    // W2 short: 1.80s vs 2.56s min
    if (weldConfigs[1]) weldConfigs[1].dur = 1.80;
  } else if (scenario.id === 'bracket-grinder') {
    // Noise on W2
    if (weldConfigs[1]) weldConfigs[1].noisy = true;
  } else if (scenario.id === 'bracket-current-gap') {
    hasGap = true;
  } else if (scenario.id === 'bracket-audio-missing') {
    isAudioAvailable = false;
  } else if (scenario.id === 'bracket-wire-lot') {
    weldConfigs.forEach((w) => (w.elevatedSound = true));
  } else if (scenario.id === 'bracket-open-arc') {
    isBoundaryConfirmed = false;
  } else if (scenario.id === 'frame-six-missing-w4') {
    // W4 missing (index 3)
    if (weldConfigs[3]) weldConfigs[3].skip = true;
  }

  // Generate trace samples
  weldConfigs.forEach((cfg) => {
    if (cfg.skip) return;
    const startIdx = Math.round(cfg.slot.start * sampleHz);
    const endIdx = Math.round((cfg.slot.start + cfg.dur) * sampleHz);

    for (let i = startIdx; i < Math.min(endIdx, nSamples); i++) {
      // Simulate arc current with ripple
      const progress = (i - startIdx) / ((endIdx - startIdx) || 1);
      const ramp = Math.min(1, progress * 4);
      const ripple = Math.sin(i * 0.7) * 7.5 + (Math.random() - 0.5) * 5.0;
      trace[i] = Math.max(0, ramp * cfg.slot.amps + ripple);
    }
  });

  // Handle open arc scenario: arc starts at end of cycle and stays open
  if (scenario.id === 'bracket-open-arc') {
    const startIdx = Math.round((recipe.cycleSec - 4) * sampleHz);
    for (let i = startIdx; i < nSamples; i++) {
      trace[i] = 160 + (Math.random() - 0.5) * 6;
    }
  }

  // Handle extra arc scenario: inject an unassigned arc between slot 2 and slot 3
  if (scenario.id === 'bracket-extra-arc') {
    const extraStart = 18.5; // seconds
    const extraDur = 1.6;
    const sIdx = Math.round(extraStart * sampleHz);
    const eIdx = Math.round((extraStart + extraDur) * sampleHz);
    for (let i = sIdx; i < eIdx; i++) {
      trace[i] = 145 + (Math.random() - 0.5) * 8;
    }
  }

  // Handle gap: zero out a portion of current during second weld
  if (hasGap) {
    const gapStart = Math.round(15.2 * sampleHz);
    const gapEnd = Math.round(17.5 * sampleHz);
    for (let i = gapStart; i < gapEnd; i++) {
      trace[i] = 0;
    }
  }

  // Add background ambient floor (0-2 A)
  for (let i = 0; i < nSamples; i++) {
    if (trace[i] === 0) {
      trace[i] = Math.abs((Math.random() - 0.5) * 2.0);
    }
  }

  // Compute synthetic audio features & scores
  const bandFeatures: number[][] = [];
  const arcScores: (number | null)[] = [];

  if (!isAudioAvailable) {
    recipe.welds.forEach(() => {
      arcScores.push(null);
    });
    return {
      partNumber: partIndex,
      displayId,
      recipe,
      trace,
      sampleHz,
      cycleSec: recipe.cycleSec,
      hasGap,
      isBoundaryConfirmed,
      isAudioAvailable: false,
      arcScores,
      partScore: null,
      bandFeatures: [],
    };
  }

  weldConfigs.forEach((cfg, idx) => {
    if (cfg.skip) {
      arcScores.push(null);
      return;
    }
    const pos = baseline.positions[idx] || baseline.positions[0];
    const features = pos.med.map((m, b) => {
      let val = m + (Math.random() - 0.5) * 1.5;
      if (cfg.noisy) {
        // High frequency noise spike
        if (b >= 4) val += 14.0;
      }
      if (cfg.elevatedSound) {
        // Wire lot shift
        val += 3.5;
      }
      return Math.round(val * 10) / 10;
    });
    bandFeatures.push(features);
    const scored = computeArcScore(baseline, idx, features);
    arcScores.push(scored.score);
  });

  const validScores = arcScores.filter((s): s is number => s !== null);
  const partScore = validScores.length > 0 ? computePartScore(validScores) : null;

  return {
    partNumber: partIndex,
    displayId,
    recipe,
    trace,
    sampleHz,
    cycleSec: recipe.cycleSec,
    hasGap,
    isBoundaryConfirmed,
    isAudioAvailable,
    arcScores,
    partScore,
    bandFeatures,
  };
}
