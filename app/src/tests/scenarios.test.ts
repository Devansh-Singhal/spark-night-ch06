import { describe, it, expect } from 'vitest';
import { generateScenarioTelemetry, REPLAY_SCENARIOS } from '../replay/scenarios';
import { segmentCurrentTrace, matchArcsToRecipe, evaluatePartChecks } from '../domain/checker';

describe('Replay Scenarios Telemetry and Expected Checks', () => {
  it('contains exactly the required 11 scenarios', () => {
    expect(REPLAY_SCENARIOS.length).toBe(11);
  });

  it('runs bracket-normal: 4 arcs observed, count and duration checks clear', () => {
    const telem = generateScenarioTelemetry('bracket-normal', 101);
    const arcs = segmentCurrentTrace(telem.trace, telem.sampleHz, 40, 20, 0.3);
    const matched = matchArcsToRecipe(arcs, telem.recipe.welds);
    const res = evaluatePartChecks(
      matched,
      { isBoundaryConfirmed: true, hasGap: false, currentVerification: 'valid', audioVerification: 'valid' },
      telem.recipe
    );

    expect(matched.observedCount).toBe(4);
    expect(res.ruleResult).toBe('clear');
  });

  it('runs bracket-0184-missing: W3 absent, part held with 3 of 4 arcs observed', () => {
    const telem = generateScenarioTelemetry('bracket-0184-missing', 184);
    const arcs = segmentCurrentTrace(telem.trace, telem.sampleHz, 40, 20, 0.3);
    const matched = matchArcsToRecipe(arcs, telem.recipe.welds);
    const res = evaluatePartChecks(
      matched,
      { isBoundaryConfirmed: true, hasGap: false, currentVerification: 'valid', audioVerification: 'valid' },
      telem.recipe
    );

    expect(matched.observedCount).toBe(3);
    expect(res.ruleResult).toBe('missing');
    expect(res.affectedSlots).toContain('W3');
  });

  it('runs bracket-short-w2: W2 cuts short at 1.80s, part held with short arc', () => {
    const telem = generateScenarioTelemetry('bracket-short-w2', 155);
    const arcs = segmentCurrentTrace(telem.trace, telem.sampleHz, 40, 20, 0.3);
    const matched = matchArcsToRecipe(arcs, telem.recipe.welds);
    const res = evaluatePartChecks(
      matched,
      { isBoundaryConfirmed: true, hasGap: false, currentVerification: 'valid', audioVerification: 'valid' },
      telem.recipe
    );

    expect(res.ruleResult).toBe('short');
    expect(res.affectedSlots).toContain('W2');
  });

  it('runs bracket-grinder: single loud acoustic spike on arc 2 does NOT trigger hold', () => {
    const telem = generateScenarioTelemetry('bracket-grinder', 127);
    const arcs = segmentCurrentTrace(telem.trace, telem.sampleHz, 40, 20, 0.3);
    const matched = matchArcsToRecipe(arcs, telem.recipe.welds);
    const res = evaluatePartChecks(
      matched,
      { isBoundaryConfirmed: true, hasGap: false, currentVerification: 'valid', audioVerification: 'valid' },
      telem.recipe
    );

    expect(res.ruleResult).toBe('clear');
    // Part median score should remain under threshold because only 1 arc had grinder noise
    expect(telem.partScore).toBeLessThan(1.38);
  });

  it('runs bracket-current-gap: telemetry dropout triggers verification incomplete', () => {
    const telem = generateScenarioTelemetry('bracket-current-gap', 196);
    expect(telem.hasGap).toBe(true);

    const arcs = segmentCurrentTrace(telem.trace, telem.sampleHz, 40, 20, 0.3);
    const matched = matchArcsToRecipe(arcs, telem.recipe.welds);
    const res = evaluatePartChecks(
      matched,
      { isBoundaryConfirmed: true, hasGap: true, currentVerification: 'unavailable', audioVerification: 'valid' },
      telem.recipe
    );

    expect(res.ruleResult).toBe('unverified');
    expect(res.findingCode).toBe('CURRENT_GAP');
  });

  it('runs bracket-audio-missing: mic unavailable does not disable current rules', () => {
    const telem = generateScenarioTelemetry('bracket-audio-missing', 105);
    expect(telem.isAudioAvailable).toBe(false);

    const arcs = segmentCurrentTrace(telem.trace, telem.sampleHz, 40, 20, 0.3);
    const matched = matchArcsToRecipe(arcs, telem.recipe.welds);
    const res = evaluatePartChecks(
      matched,
      { isBoundaryConfirmed: true, hasGap: false, currentVerification: 'valid', audioVerification: 'unavailable' },
      telem.recipe
    );

    // Current rules still clear!
    expect(res.ruleResult).toBe('clear');
  });

  it('runs frame-six-normal: all 6 weld slots of FAB-206 verified', () => {
    const telem = generateScenarioTelemetry('frame-six-normal', 1);
    expect(telem.recipe.welds.length).toBe(6);

    const arcs = segmentCurrentTrace(telem.trace, telem.sampleHz, 45, 25, 0.35);
    const matched = matchArcsToRecipe(arcs, telem.recipe.welds);
    const res = evaluatePartChecks(
      matched,
      { isBoundaryConfirmed: true, hasGap: false, currentVerification: 'valid', audioVerification: 'valid' },
      telem.recipe
    );

    expect(matched.observedCount).toBe(6);
    expect(res.ruleResult).toBe('clear');
  });

  it('runs frame-six-missing-w4: 5 of 6 welds observed, W4 absent on frame recipe', () => {
    const telem = generateScenarioTelemetry('frame-six-missing-w4', 2);
    const arcs = segmentCurrentTrace(telem.trace, telem.sampleHz, 45, 25, 0.35);
    const matched = matchArcsToRecipe(arcs, telem.recipe.welds);
    const res = evaluatePartChecks(
      matched,
      { isBoundaryConfirmed: true, hasGap: false, currentVerification: 'valid', audioVerification: 'valid' },
      telem.recipe
    );

    expect(matched.observedCount).toBe(5);
    expect(res.ruleResult).toBe('missing');
    expect(res.affectedSlots).toContain('W4');
  });
});
