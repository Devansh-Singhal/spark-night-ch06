import { describe, it, expect } from 'vitest';
import {
  segmentCurrentTrace,
  matchArcsToRecipe,
  evaluatePartChecks,
  deriveHeadlineInstruction,
} from '../domain/checker';
import { AUTOMOTIVE_RECIPE_RSB417, FABRICATION_RECIPE_FAB206 } from '../domain/recipes';
import { ArcInterval } from '../domain/types';

describe('Segmentation and Dwell Filter', () => {
  it('segments normal arc pulses exceeding ampsOn and dropping below ampsOff', () => {
    const sampleHz = 50;
    const n = sampleHz * 10;
    const trace = new Float32Array(n);

    // Pulse from 2.0s to 5.0s (duration 3.0s, amps 160)
    for (let i = 2 * sampleHz; i < 5 * sampleHz; i++) {
      trace[i] = 160;
    }

    const arcs = segmentCurrentTrace(trace, sampleHz, 40, 20, 0.3);
    expect(arcs.length).toBe(1);
    expect(arcs[0].start).toBeCloseTo(2.0, 1);
    expect(arcs[0].end).toBeCloseTo(5.0, 1);
    expect(arcs[0].dur).toBeCloseTo(3.0, 1);
    expect(arcs[0].amps).toBeCloseTo(160, 1);
  });

  it('rejects failed starts and contact spikes shorter than minDwell (0.3s)', () => {
    const sampleHz = 50;
    const trace = new Float32Array(sampleHz * 5);

    // 0.15s spike (less than 0.3s minDwell)
    for (let i = 1 * sampleHz; i < 1 * sampleHz + Math.round(0.15 * sampleHz); i++) {
      trace[i] = 150;
    }

    const arcs = segmentCurrentTrace(trace, sampleHz, 40, 20, 0.3);
    expect(arcs.length).toBe(0);
  });

  it('handles arc still open at the buffer boundary without crashing or discarding', () => {
    const sampleHz = 50;
    const n = sampleHz * 4;
    const trace = new Float32Array(n);

    // Arc starts at 2.0s and continues all the way to 4.0s
    for (let i = 2 * sampleHz; i < n; i++) {
      trace[i] = 175;
    }

    const arcs = segmentCurrentTrace(trace, sampleHz, 40, 20, 0.3);
    expect(arcs.length).toBe(1);
    expect(arcs[0].start).toBeCloseTo(2.0, 1);
    expect(arcs[0].end).toBeCloseTo(4.0, 1);
    expect(arcs[0].dur).toBeCloseTo(2.0, 1);
  });
});

describe('Recipe Matching and Deterministic Checks', () => {
  it('enforces one-to-one matching between observed arcs and recipe slots', () => {
    const arcs: ArcInterval[] = [
      { start: 9.1, end: 12.3, dur: 3.2, amps: 165 }, // matches W1 (start 9.0)
      { start: 15.2, end: 18.4, dur: 3.2, amps: 165 }, // matches W2 (start 15.0)
      { start: 22.1, end: 26.5, dur: 4.4, amps: 180 }, // matches W3 (start 22.0)
      { start: 30.6, end: 33.0, dur: 2.4, amps: 150 }, // matches W4 (start 30.5)
    ];

    const match = matchArcsToRecipe(arcs, AUTOMOTIVE_RECIPE_RSB417.welds);
    expect(match.observedCount).toBe(4);
    expect(match.extraArcs.length).toBe(0);

    const evalRes = evaluatePartChecks(
      match,
      {
        isBoundaryConfirmed: true,
        hasGap: false,
        currentVerification: 'valid',
        audioVerification: 'valid',
      },
      AUTOMOTIVE_RECIPE_RSB417
    );

    expect(evalRes.ruleResult).toBe('clear');
    expect(evalRes.ruleReason).toBe('Count and duration checks clear');
  });

  it('detects missing weld slot (e.g. W3 missing) and holds part with exact reason', () => {
    const arcs: ArcInterval[] = [
      { start: 9.1, end: 12.3, dur: 3.2, amps: 165 }, // W1
      { start: 15.2, end: 18.4, dur: 3.2, amps: 165 }, // W2
      // W3 omitted!
      { start: 30.6, end: 33.0, dur: 2.4, amps: 150 }, // W4
    ];

    const match = matchArcsToRecipe(arcs, AUTOMOTIVE_RECIPE_RSB417.welds);
    expect(match.observedCount).toBe(3);

    const evalRes = evaluatePartChecks(
      match,
      {
        isBoundaryConfirmed: true,
        hasGap: false,
        currentVerification: 'valid',
        audioVerification: 'valid',
      },
      AUTOMOTIVE_RECIPE_RSB417
    );

    expect(evalRes.ruleResult).toBe('missing');
    expect(evalRes.findingCode).toBe('MISSING_REQUIRED_ARC');
    expect(evalRes.affectedSlots).toContain('W3');
    expect(evalRes.ruleReason).toContain('3 of 4 expected arc events observed');
    expect(evalRes.ruleReason).toContain('W3 absent');
  });

  it('detects short arc on W2 (1.80s vs 2.56s min) and holds part with measured vs min duration', () => {
    const arcs: ArcInterval[] = [
      { start: 9.1, end: 12.3, dur: 3.2, amps: 165 }, // W1
      { start: 15.1, end: 16.9, dur: 1.8, amps: 165 }, // W2 short! (1.8s < 2.56s)
      { start: 22.1, end: 26.5, dur: 4.4, amps: 180 }, // W3
      { start: 30.6, end: 33.0, dur: 2.4, amps: 150 }, // W4
    ];

    const match = matchArcsToRecipe(arcs, AUTOMOTIVE_RECIPE_RSB417.welds);
    const evalRes = evaluatePartChecks(
      match,
      {
        isBoundaryConfirmed: true,
        hasGap: false,
        currentVerification: 'valid',
        audioVerification: 'valid',
      },
      AUTOMOTIVE_RECIPE_RSB417
    );

    expect(evalRes.ruleResult).toBe('short');
    expect(evalRes.findingCode).toBe('SHORT_REQUIRED_ARC');
    expect(evalRes.affectedSlots).toContain('W2');
    expect(evalRes.ruleReason).toContain('Short arc on W2');
  });

  it('handles current sensor gap: flags verification incomplete, never asserts 0 welds', () => {
    const arcs: ArcInterval[] = [
      { start: 9.1, end: 12.3, dur: 3.2, amps: 165 },
    ];

    const match = matchArcsToRecipe(arcs, AUTOMOTIVE_RECIPE_RSB417.welds);
    const evalRes = evaluatePartChecks(
      match,
      {
        isBoundaryConfirmed: true,
        hasGap: true, // sensor dropped!
        currentVerification: 'unavailable',
        audioVerification: 'valid',
      },
      AUTOMOTIVE_RECIPE_RSB417
    );

    expect(evalRes.ruleResult).toBe('unverified');
    expect(evalRes.findingCode).toBe('CURRENT_GAP');
    expect(evalRes.ruleReason).toContain('Current signal missing. This part needs verification.');
  });

  it('handles extra unassigned arcs by requesting sequence review without accepting', () => {
    const arcs: ArcInterval[] = [
      { start: 9.1, end: 12.3, dur: 3.2, amps: 165 }, // W1
      { start: 15.2, end: 18.4, dur: 3.2, amps: 165 }, // W2
      { start: 19.0, end: 20.5, dur: 1.5, amps: 140 }, // Extra unassigned arc!
      { start: 22.1, end: 26.5, dur: 4.4, amps: 180 }, // W3
      { start: 30.6, end: 33.0, dur: 2.4, amps: 150 }, // W4
    ];

    const match = matchArcsToRecipe(arcs, AUTOMOTIVE_RECIPE_RSB417.welds);
    expect(match.extraArcs.length).toBe(1);

    const evalRes = evaluatePartChecks(
      match,
      {
        isBoundaryConfirmed: true,
        hasGap: false,
        currentVerification: 'valid',
        audioVerification: 'valid',
      },
      AUTOMOTIVE_RECIPE_RSB417
    );

    expect(evalRes.ruleResult).toBe('sequence_review');
    expect(evalRes.findingCode).toBe('EXTRA_OR_AMBIGUOUS_ARCS');
  });

  it('correctly checks 6-weld general fabrication recipe FAB-206', () => {
    // 6 valid arcs matching FAB-206 nominal starts [8, 14, 21, 30, 36, 43]
    const arcs: ArcInterval[] = [
      { start: 8.0, end: 11.0, dur: 3.0, amps: 170 },
      { start: 14.1, end: 17.1, dur: 3.0, amps: 170 },
      { start: 21.0, end: 25.0, dur: 4.0, amps: 185 },
      { start: 30.2, end: 33.2, dur: 3.0, amps: 170 },
      { start: 36.0, end: 39.0, dur: 3.0, amps: 160 },
      { start: 43.1, end: 47.1, dur: 4.0, amps: 185 },
    ];

    const match = matchArcsToRecipe(arcs, FABRICATION_RECIPE_FAB206.welds);
    expect(match.observedCount).toBe(6);

    const evalRes = evaluatePartChecks(
      match,
      {
        isBoundaryConfirmed: true,
        hasGap: false,
        currentVerification: 'valid',
        audioVerification: 'valid',
      },
      FABRICATION_RECIPE_FAB206
    );

    expect(evalRes.ruleResult).toBe('clear');
  });
});

describe('Headline Instruction Precedence', () => {
  it('prioritizes hold over open advisory', () => {
    const instruction = deriveHeadlineInstruction(
      {
        displayId: 'RSB-000184',
        ruleFinding: 'missing',
        ruleReason: '3 of 4 welds observed · W3 absent',
        lifecycle: 'completed',
        driftFinding: 'advisory_open',
      },
      true
    );

    expect(instruction.headline).toContain('Hold part RSB-000184');
    expect(instruction.severity).toBe('hold');
  });

  it('shows check setup advisory when count/duration checks are clear', () => {
    const instruction = deriveHeadlineInstruction(
      {
        displayId: 'RSB-000150',
        ruleFinding: 'clear',
        ruleReason: 'Count and duration checks clear',
        lifecycle: 'completed',
        driftFinding: 'advisory_open',
      },
      true
    );

    expect(instruction.headline).toContain('Check setup at next safe part change');
    expect(instruction.severity).toBe('warning');
  });
});
