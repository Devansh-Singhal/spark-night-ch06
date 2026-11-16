import {
  ArcInterval,
  Finding,
  PartAttempt,
  RecipeVersion,
  RuleFindingCode,
  RuleResult,
  SlotMatch,
  VerificationState,
  WeldSlot,
} from './types';

export interface CoverageStatus {
  isBoundaryConfirmed: boolean;
  hasGap: boolean;
  gapIntervals?: { start: number; end: number }[];
  currentVerification: VerificationState;
  audioVerification: VerificationState;
}

export interface MatchResult {
  matches: SlotMatch[];
  extraArcs: ArcInterval[];
  observedCount: number;
}

/**
 * Hysteresis segmentation with minimum dwell filter.
 * Rejects pulses shorter than minDwell (failed starts, contact chatter).
 */
export function segmentCurrentTrace(
  trace: Float32Array | number[],
  sampleHz: number,
  ampsOn: number,
  ampsOff: number,
  minDwellSec: number
): ArcInterval[] {
  const arcs: ArcInterval[] = [];
  let on = false;
  let s = 0;

  for (let i = 0; i < trace.length; i++) {
    const val = trace[i];
    if (!on && val >= ampsOn) {
      on = true;
      s = i;
    } else if (on && val < ampsOff) {
      on = false;
      const dur = (i - s) / sampleHz;
      if (dur >= minDwellSec) {
        let sum = 0;
        for (let k = s; k < i; k++) {
          sum += trace[k];
        }
        arcs.push({
          start: s / sampleHz,
          end: i / sampleHz,
          dur: Math.round(dur * 100) / 100,
          amps: Math.round((sum / (i - s)) * 10) / 10,
        });
      }
    }
  }

  // Handle open arc still running at the end of the trace buffer
  if (on) {
    const dur = (trace.length - s) / sampleHz;
    let sum = 0;
    for (let k = s; k < trace.length; k++) sum += trace[k];
    arcs.push({
      start: s / sampleHz,
      end: trace.length / sampleHz,
      dur: Math.round(dur * 100) / 100,
      amps: Math.round((sum / (trace.length - s)) * 10) / 10,
    });
  }

  return arcs;
}

/**
 * Match segmented arcs to recipe weld slots.
 * One-to-one constraint: each observed arc interval can satisfy at most one recipe slot.
 */
export function matchArcsToRecipe(
  arcs: ArcInterval[],
  slots: WeldSlot[],
  timeToleranceSec = 2.5
): MatchResult {
  const usedArcIndices = new Set<number>();
  const matches: SlotMatch[] = [];

  for (const slot of slots) {
    let bestArcIdx = -1;
    let minDelta = Infinity;

    for (let i = 0; i < arcs.length; i++) {
      if (usedArcIndices.has(i)) continue;
      const delta = Math.abs(arcs[i].start - slot.start);
      if (delta <= timeToleranceSec && delta < minDelta) {
        minDelta = delta;
        bestArcIdx = i;
      }
    }

    if (bestArcIdx !== -1) {
      usedArcIndices.add(bestArcIdx);
      const arc = arcs[bestArcIdx];
      const isShort = arc.dur < slot.minDur;
      matches.push({
        slot,
        arc,
        status: isShort ? 'short' : 'observed',
        measuredDuration: arc.dur,
        amps: arc.amps,
      });
    } else {
      matches.push({
        slot,
        arc: null,
        status: 'absent',
      });
    }
  }

  const extraArcs: ArcInterval[] = [];
  for (let i = 0; i < arcs.length; i++) {
    if (!usedArcIndices.has(i)) {
      extraArcs.push(arcs[i]);
    }
  }

  const observedCount = matches.filter((m) => m.arc !== null).length;

  return {
    matches,
    extraArcs,
    observedCount,
  };
}

export interface RuleEvaluation {
  ruleResult: RuleResult;
  ruleReason: string;
  findingCode?: RuleFindingCode;
  affectedSlots: string[];
  findingsToCreate: Omit<Finding, 'id' | 'partAttemptId' | 'displayId' | 'stationId'>[];
}

/**
 * Deterministic arc check evaluation at part boundary.
 */
export function evaluatePartChecks(
  match: MatchResult,
  coverage: CoverageStatus,
  recipe: RecipeVersion
): RuleEvaluation {
  const missingSlots = match.matches.filter((m) => m.status === 'absent').map((m) => m.slot);
  const shortSlots = match.matches.filter((m) => m.status === 'short').map((m) => m.slot);
  const findings: Omit<Finding, 'id' | 'partAttemptId' | 'displayId' | 'stationId'>[] = [];

  // Check 1: Was coverage interrupted by a current gap?
  if (coverage.hasGap || coverage.currentVerification === 'unavailable' || coverage.currentVerification === 'partial') {
    // If a missing slot intersects a gap, we cannot confirm it was physically skipped!
    return {
      ruleResult: 'unverified',
      ruleReason: 'Current signal missing. This part needs verification.',
      findingCode: 'CURRENT_GAP',
      affectedSlots: missingSlots.map((s) => s.id),
      findingsToCreate: [
        {
          kind: 'CURRENT_GAP',
          severity: 'warning',
          title: 'Verification Incomplete — Current Gap',
          reason: 'Current telemetry suffered a gap or dropout during this cycle. Arc count cannot be confirmed.',
          status: 'unresolved',
          firstSeenAt: new Date().toISOString(),
        },
      ],
    };
  }

  // Check 2: Boundary confirmed?
  if (!coverage.isBoundaryConfirmed) {
    return {
      ruleResult: 'pending',
      ruleReason: 'Part in progress · Boundary not confirmed',
      affectedSlots: [],
      findingsToCreate: [],
    };
  }

  // Check 3: Missing required arcs (under valid coverage)
  if (missingSlots.length > 0) {
    const missingIds = missingSlots.map((s) => s.id);
    const reason = `${match.observedCount} of ${recipe.welds.length} expected arc events observed. Expected ${missingIds.join(', ')} absent.`;
    findings.push({
      kind: 'MISSING_REQUIRED_ARC',
      severity: 'hold',
      title: `Missing Arc: ${missingIds.join(', ')}`,
      reason,
      configuredValue: `${recipe.welds.length} arcs expected`,
      measuredValue: `${match.observedCount} arcs observed`,
      affectedSlots: missingIds,
      status: 'unresolved',
      firstSeenAt: new Date().toISOString(),
    });
    return {
      ruleResult: 'missing',
      ruleReason: reason,
      findingCode: 'MISSING_REQUIRED_ARC',
      affectedSlots: missingIds,
      findingsToCreate: findings,
    };
  }

  // Check 4: Short arc duration below configured minimum
  if (shortSlots.length > 0) {
    const shortIds = shortSlots.map((s) => s.id);
    const details = shortSlots
      .map((s) => {
        const obs = match.matches.find((m) => m.slot.id === s.id);
        const dur = obs?.measuredDuration ?? 0;
        return `${s.id}: ${dur.toFixed(2)} s observed; minimum ${s.minDur.toFixed(2)} s`;
      })
      .join('; ');
    const reason = `Short arc on ${shortIds.join(', ')}. ${details}.`;
    findings.push({
      kind: 'SHORT_REQUIRED_ARC',
      severity: 'hold',
      title: `Short Arc on ${shortIds.join(', ')}`,
      reason,
      affectedSlots: shortIds,
      status: 'unresolved',
      firstSeenAt: new Date().toISOString(),
    });
    return {
      ruleResult: 'short',
      ruleReason: reason,
      findingCode: 'SHORT_REQUIRED_ARC',
      affectedSlots: shortIds,
      findingsToCreate: findings,
    };
  }

  // Check 5: Unexpected extra or ambiguous arcs
  if (match.extraArcs.length > 0) {
    const reason = `Unexpected extra arc events detected (${match.extraArcs.length} extra). Review arc sequence.`;
    findings.push({
      kind: 'EXTRA_OR_AMBIGUOUS_ARCS',
      severity: 'warning',
      title: 'Extra Arc Events',
      reason,
      measuredValue: `${match.extraArcs.length} unassigned arcs`,
      status: 'unresolved',
      firstSeenAt: new Date().toISOString(),
    });
    return {
      ruleResult: 'sequence_review',
      ruleReason: reason,
      findingCode: 'EXTRA_OR_AMBIGUOUS_ARCS',
      affectedSlots: [],
      findingsToCreate: findings,
    };
  }

  // All checks clear!
  return {
    ruleResult: 'clear',
    ruleReason: 'Count and duration checks clear',
    affectedSlots: [],
    findingsToCreate: [],
  };
}

/**
 * Derive high-level operator instruction from current state and findings according to Section 7.2
 */
export function deriveHeadlineInstruction(part: Partial<PartAttempt> | null, activeAdvisory = false): {
  headline: string;
  actionText: string;
  severity: 'hold' | 'warning' | 'info' | 'ok';
} {
  if (!part) {
    if (activeAdvisory) {
      return {
        headline: 'Check setup at next safe part change',
        actionText: 'The arc sound changed across recent parts. Complete the setup checklist.',
        severity: 'warning',
      };
    }
    return {
      headline: 'Ready for next part',
      actionText: 'Load workpiece into fixture and select Start Part.',
      severity: 'info',
    };
  }

  // Priority 1: Unresolved hold from a known rule failure
  if (part.ruleFinding === 'missing' || part.ruleFinding === 'short') {
    return {
      headline: `Hold part ${part.displayId}`,
      actionText: `Segregate this part. ${part.ruleReason} Follow the shop inspection process.`,
      severity: 'hold',
    };
  }

  // Priority 2: Incomplete required current or boundary evidence
  if (part.ruleFinding === 'unverified' || part.currentVerification === 'unavailable' || part.currentVerification === 'partial') {
    return {
      headline: `Verification incomplete on ${part.displayId}`,
      actionText: `${part.ruleReason || 'Current signal lost.'} Route part for manual verification.`,
      severity: 'warning',
    };
  }

  // Priority 3: Active part without a final finding
  if (part.lifecycle === 'active') {
    return {
      headline: `Monitoring part ${part.displayId}`,
      actionText: 'Observing arc current and sound. Awaiting part boundary.',
      severity: 'info',
    };
  }

  // Priority 4: Open acoustic advisory on otherwise valid completed monitoring
  if (part.driftFinding === 'advisory_open' || activeAdvisory) {
    return {
      headline: 'Check setup at next safe part change',
      actionText: 'The arc sound changed across 4 of 6 valid scored parts. All count/duration checks clear.',
      severity: 'warning',
    };
  }

  // Priority 5: Completed count and duration checks clear
  if (part.ruleFinding === 'clear') {
    return {
      headline: 'Count and duration checks clear',
      actionText: 'All expected arc events and durations satisfied. Continue normal workflow.',
      severity: 'ok',
    };
  }

  // Sequence review
  if (part.ruleFinding === 'sequence_review') {
    return {
      headline: `Sequence review on ${part.displayId}`,
      actionText: part.ruleReason || 'Arc sequence requires supervisory review.',
      severity: 'warning',
    };
  }

  return {
    headline: 'Ready for next part',
    actionText: 'Station idle.',
    severity: 'info',
  };
}
