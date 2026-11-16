import { describe, it, expect } from 'vitest';
import {
  BASELINE_RSB417,
  computeArcScore,
  computePartScore,
  evaluateDriftWindow,
} from '../domain/baseline';

describe('Acoustic Baseline Scoring and Window Evaluation', () => {
  it('computes robust arc score against baseline median and mad', () => {
    // Normal features matching median closely
    const normalFeatures = [62, 66, 70, 68, 63, 57, 50, 42];
    const scored = computeArcScore(BASELINE_RSB417, 0, normalFeatures);

    expect(scored.score).toBeLessThan(0.5);
    expect(scored.zScores.length).toBe(8);

    // Drifting features with elevated high-frequency spatter
    const driftingFeatures = [60, 64, 67, 67, 67, 63, 58, 51];
    const driftScored = computeArcScore(BASELINE_RSB417, 0, driftingFeatures);
    expect(driftScored.score).toBeGreaterThan(1.38);
  });

  it('computes part score as the median of its arc scores', () => {
    // 3 normal arcs and 1 noisy spike arc (grinder scenario)
    const arcScores = [0.45, 2.85, 0.48, 0.52]; // Arc 2 spiked!
    const pScore = computePartScore(arcScores);

    // The median of [0.45, 0.48, 0.52, 2.85] is (0.48 + 0.52)/2 = 0.50
    expect(pScore).toBe(0.5);
    expect(pScore).toBeLessThan(BASELINE_RSB417.threshold);
  });

  it('evaluates rolling drift window: 4 of 6 elevated triggers advisory', () => {
    const history = [
      { score: 0.5, isEligible: true },
      { score: 1.45, isEligible: true }, // elevated
      { score: 1.52, isEligible: true }, // elevated
      { score: 1.48, isEligible: true }, // elevated
      { score: 0.6, isEligible: true },
      { score: 1.62, isEligible: true }, // elevated (4 of 6)
    ];

    const result = evaluateDriftWindow(history, 6, 2, 4);
    expect(result.state).toBe('advisory_open');
    expect(result.isAdvisoryOpen).toBe(true);
    expect(result.k).toBe(4);
    expect(result.n).toBe(6);
  });

  it('excludes ineligible or held parts from rolling acoustic window', () => {
    const history = [
      { score: 0.5, isEligible: true },
      { score: 1.8, isEligible: false }, // held part excluded!
      { score: 0.6, isEligible: true },
      { score: 0.55, isEligible: true },
      { score: 0.48, isEligible: true },
      { score: 0.52, isEligible: true },
    ];

    // Only 5 eligible parts -> still warming up
    const result = evaluateDriftWindow(history, 6, 2, 4);
    expect(result.state).toBe('warming_up');
    expect(result.n).toBe(5);
  });
});
