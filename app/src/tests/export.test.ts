import { describe, it, expect } from 'vitest';
import { sanitizeCsvCell, generatePartsCsv } from '../data/export';
import { PartAttempt } from '../domain/types';

describe('CSV Export and Formula Injection Protection', () => {
  it('neutralizes formula injection characters (=, +, -, @) by prefixing single quote', () => {
    expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe("\"'=SUM(A1:A10)\"");
    expect(sanitizeCsvCell('+cmd|/c calc')).toBe("\"'+cmd|/c calc\"");
    expect(sanitizeCsvCell('-10+20')).toBe("\"'-10+20\"");
    expect(sanitizeCsvCell('@IMPORTDATA()')).toBe("\"'@IMPORTDATA()\"");
  });

  it('escapes internal double quotes properly according to RFC 4180', () => {
    expect(sanitizeCsvCell('Weld "W3" collar')).toBe('"Weld ""W3"" collar"');
  });

  it('preserves leading zeros in display IDs and alphanumeric part codes', () => {
    expect(sanitizeCsvCell('RSB-000184')).toBe('"RSB-000184"');
    expect(sanitizeCsvCell('FAB-000001')).toBe('"FAB-000001"');
  });

  it('generates a well-formed CSV with headers and rows', () => {
    const parts: PartAttempt[] = [
      {
        id: 'uuid-1',
        displayId: 'RSB-000184',
        workpieceRef: 'RSB-417',
        attemptNumber: 1,
        stationId: 'station-02',
        recipeId: 'recipe-rsb417-v3',
        recipeVersion: 'r3',
        baselineId: 'baseline-rsb417-v3',
        sourceKind: 'synthetic',
        sessionId: 'session-01',
        startedAt: '2026-11-17T08:00:00.000Z',
        endedAt: '2026-11-17T08:00:48.000Z',
        boundaryMethod: 'replay_marker',
        lifecycle: 'completed',
        currentVerification: 'valid',
        audioVerification: 'valid',
        ruleFinding: 'missing',
        ruleReason: '3 of 4 welds observed · Expected W3 absent',
        driftFinding: 'normal',
        audioScore: 0.85,
        headlineInstruction: 'Hold part RSB-000184',
        inspectionStatus: 'not_recorded',
        dispositionStatus: 'pending',
        savedState: 'saved_local',
        observations: [],
      },
    ];

    const csv = generatePartsCsv(parts);
    expect(csv).toContain('Internal UUID');
    expect(csv).toContain('"RSB-000184"');
    expect(csv).toContain('"missing"');
    expect(csv).toContain('"3 of 4 welds observed · Expected W3 absent"');
  });
});
