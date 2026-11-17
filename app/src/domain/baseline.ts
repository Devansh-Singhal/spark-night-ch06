import { BaselineVersion, DriftState } from './types';

export const BASELINE_RSB417: BaselineVersion = {
  id: 'baseline-rsb417-v3',
  recipeId: 'recipe-rsb417-v3',
  status: 'demo',
  threshold: 1.38,
  thresholdMethod: '99th percentile + 10% safety margin on 40 validation parts',
  featureVersion: 'logmel-8band-v1',
  provenance: 'Synthetic baseline (seeded normal parts 0061-0100)',
  bands: 8,
  bandLabels: ['0.1', '0.3', '0.6', '1.2', '2.4', '4.8', '9.6', '16'],
  positions: [
    {
      med: [62.0, 66.0, 70.0, 68.0, 63.0, 57.0, 50.0, 42.0],
      mad: [2.37, 2.07, 1.78, 1.78, 1.93, 2.22, 2.67, 2.96],
    },
    {
      med: [62.0, 66.0, 70.0, 68.0, 63.0, 57.0, 50.0, 42.0],
      mad: [2.37, 2.07, 1.78, 1.78, 1.93, 2.22, 2.67, 2.96],
    },
    {
      med: [64.0, 68.0, 72.0, 70.0, 64.0, 57.0, 49.0, 41.0],
      mad: [2.37, 2.07, 1.78, 1.78, 1.93, 2.22, 2.67, 2.96],
    },
    {
      med: [60.0, 64.0, 68.0, 67.0, 62.0, 56.0, 50.0, 43.0],
      mad: [2.37, 2.07, 1.78, 1.78, 1.93, 2.22, 2.67, 2.96],
    },
  ],
  baselinePartsCount: 40,
  validationPartsCount: 40,
  approvedBy: 'Quality lead (Demo)',
  approvedAt: '2026-11-17T08:00:00.000Z',
};

export const BASELINE_FAB206: BaselineVersion = {
  id: 'baseline-fab206-r1',
  recipeId: 'recipe-fab206-r1',
  status: 'demo',
  threshold: 1.42,
  thresholdMethod: '99th percentile + 10% safety margin on 40 validation parts',
  featureVersion: 'logmel-8band-v1',
  provenance: 'Synthetic baseline (illustrative non-automotive model)',
  bands: 8,
  bandLabels: ['0.1', '0.3', '0.6', '1.2', '2.4', '4.8', '9.6', '16'],
  positions: [
    { med: [63, 67, 71, 69, 64, 58, 51, 43], mad: [2.4, 2.1, 1.8, 1.8, 1.9, 2.2, 2.7, 3.0] },
    { med: [63, 67, 71, 69, 64, 58, 51, 43], mad: [2.4, 2.1, 1.8, 1.8, 1.9, 2.2, 2.7, 3.0] },
    { med: [65, 69, 73, 71, 65, 59, 52, 44], mad: [2.4, 2.1, 1.8, 1.8, 1.9, 2.2, 2.7, 3.0] },
    { med: [63, 67, 71, 69, 64, 58, 51, 43], mad: [2.4, 2.1, 1.8, 1.8, 1.9, 2.2, 2.7, 3.0] },
    { med: [62, 65, 69, 68, 63, 57, 50, 42], mad: [2.4, 2.1, 1.8, 1.8, 1.9, 2.2, 2.7, 3.0] },
    { med: [65, 69, 73, 71, 65, 59, 52, 44], mad: [2.4, 2.1, 1.8, 1.8, 1.9, 2.2, 2.7, 3.0] },
  ],
  baselinePartsCount: 40,
  validationPartsCount: 40,
  approvedBy: 'Quality lead (Demo)',
  approvedAt: '2026-11-17T08:00:00.000Z',
};

export const INITIAL_BASELINES: BaselineVersion[] = [BASELINE_RSB417, BASELINE_FAB206];

export const SETUP_CHECK_CHECKLIST = [
  { id: 'tip_nozzle', label: 'Contact tip & nozzle condition (inspect for spatter buildup, bore wear, or burnback)' },
  { id: 'gas_delivery', label: 'Shielding gas delivery (verify cylinder pressure, regulator flow rate, and nozzle cup seal)' },
  { id: 'wire_feed', label: 'Wire feeding mechanism (check drive rolls, spool brake tension, and torch liner)' },
  { id: 'mic_position', label: 'Microphone position & orientation (ensure correct line-of-sight to the arc without vibration contact)' },
  { id: 'ambient_noise', label: 'Nearby acoustic interference (check for grinders, compressed air blasts, or adjacent welding)' },
];

export function computeArcScore(
  baseline: BaselineVersion,
  slotIdx: number,
  features: number[]
): { score: number; zScores: number[] } {
  const pos = baseline.positions[slotIdx] || baseline.positions[0];
  let sumSq = 0;
  const zScores = features.map((val, b) => {
    const med = pos.med[b] ?? 60;
    const mad = pos.mad[b] ?? 2.0;
    const z = (val - med) / (mad || 1.0);
    sumSq += z * z;
    return Math.round(z * 100) / 100;
  });
  const score = Math.round(Math.sqrt(sumSq / features.length) * 100) / 100;
  return { score, zScores };
}

export function computePartScore(arcScores: number[]): number {
  if (arcScores.length === 0) return 0;
  const sorted = [...arcScores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const med = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(med * 100) / 100;
}

export interface DriftWindowResult {
  state: DriftState;
  k: number;
  n: number;
  elevatedCount: number;
  isAdvisoryOpen: boolean;
  message: string;
}

/**
 * Evaluate rolling window of valid scored parts for acoustic drift.
 * Excludes held and unverified parts.
 */
export function evaluateDriftWindow(
  history: { score: number | null | undefined; isEligible: boolean }[],
  windowSize = 6,
  watchK = 2,
  adviseK = 4,
  currentAdvisoryOpen = false
): DriftWindowResult {
  // Filter for valid scored, eligible parts only
  const validParts = history.filter((p) => p.isEligible && p.score != null);

  const window = validParts.slice(-windowSize);
  const n = window.length;

  if (n < windowSize) {
    const k = window.filter((p) => (p.score ?? 0) > 1.38).length;
    return {
      state: 'warming_up',
      k,
      n,
      elevatedCount: k,
      isAdvisoryOpen: currentAdvisoryOpen,
      message: `Acoustic baseline warming up (${n} of ${windowSize} valid scored parts observed).`,
    };
  }

  const k = window.filter((p) => (p.score ?? 0) > 1.38).length;

  if (currentAdvisoryOpen) {
    return {
      state: 'advisory_open',
      k,
      n,
      elevatedCount: k,
      isAdvisoryOpen: true,
      message: `Setup check advisory remains open (${k} of ${n} parts elevated). Acknowledge and perform setup check.`,
    };
  }

  if (k >= adviseK) {
    return {
      state: 'advisory_open',
      k,
      n,
      elevatedCount: k,
      isAdvisoryOpen: true,
      message: `${k} of ${n} valid scored parts sounded different. All required arc intervals were observed. Check setup at next safe part change.`,
    };
  }

  if (k >= watchK) {
    return {
      state: 'watching',
      k,
      n,
      elevatedCount: k,
      isAdvisoryOpen: false,
      message: `${k} of ${n} valid scored parts elevated. Watching acoustic trend.`,
    };
  }

  return {
    state: 'normal',
    k,
    n,
    elevatedCount: k,
    isAdvisoryOpen: false,
    message: `Acoustic process normal (${k} of ${n} elevated, below watch threshold).`,
  };
}
