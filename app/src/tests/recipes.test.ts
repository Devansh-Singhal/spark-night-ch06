import { describe, it, expect } from 'vitest';
import {
  AUTOMOTIVE_RECIPE_RSB417,
  FABRICATION_RECIPE_FAB206,
  validateRecipe,
} from '../domain/recipes';

describe('Recipe Definitions and Validation', () => {
  it('validates the reference automotive RSB-417 bracket recipe', () => {
    const res = validateRecipe(AUTOMOTIVE_RECIPE_RSB417);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
    expect(AUTOMOTIVE_RECIPE_RSB417.welds.length).toBe(4);
    expect(AUTOMOTIVE_RECIPE_RSB417.cycleSec).toBe(48);

    // Verify 80% duration tolerance
    AUTOMOTIVE_RECIPE_RSB417.welds.forEach((w) => {
      expect(w.minDur).toBeCloseTo(w.dur * 0.8, 2);
    });
  });

  it('validates the general fabrication FAB-206 equipment mounting frame recipe', () => {
    const res = validateRecipe(FABRICATION_RECIPE_FAB206);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
    expect(FABRICATION_RECIPE_FAB206.welds.length).toBe(6);
    expect(FABRICATION_RECIPE_FAB206.cycleSec).toBe(60);

    // Verify distinct slot IDs W1..W6
    const ids = FABRICATION_RECIPE_FAB206.welds.map((w) => w.id);
    expect(new Set(ids).size).toBe(6);
  });

  it('rejects invalid recipes with missing IDs, negative durations, or minDur > dur', () => {
    const invalid = {
      jobId: '',
      name: '',
      cycleSec: -10,
      welds: [
        { id: '', name: 'Bad', start: 0, dur: -2, minDur: 5, amps: 100, coordinates: { x1: 0, y1: 0, x2: 0, y2: 0 } },
      ],
    };
    const res = validateRecipe(invalid as any);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });
});
