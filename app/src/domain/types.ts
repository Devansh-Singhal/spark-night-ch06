export type DemoRole = 'operator' | 'supervisor' | 'production_lead' | 'technical_team';

export type InputMode = 'synthetic' | 'recorded' | 'live';

export type PartLifecycle = 'idle' | 'active' | 'completed' | 'cancelled' | 'interrupted';

export type VerificationState = 'valid' | 'partial' | 'unavailable' | 'ambiguous';

export type RuleFindingCode =
  | 'MISSING_REQUIRED_ARC'
  | 'SHORT_REQUIRED_ARC'
  | 'EXTRA_OR_AMBIGUOUS_ARCS'
  | 'CURRENT_GAP'
  | 'BOUNDARY_UNCONFIRMED'
  | 'AUDIO_UNAVAILABLE'
  | 'BASELINE_INCOMPATIBLE'
  | 'SUSTAINED_AUDIO_SHIFT'
  | 'LOCAL_SAVE_FAILED';

export type RuleResult = 'pending' | 'clear' | 'missing' | 'short' | 'sequence_review' | 'unverified';

export type DriftState = 'warming_up' | 'normal' | 'watching' | 'advisory_open' | 'under_review' | 'unavailable';

export type InspectionResult = 'not_recorded' | 'accepted' | 'rejected' | 'inconclusive';

export type DispositionDecision = 'pending' | 'rework' | 'scrap' | 'released';

export interface WeldSlot {
  id: string; // e.g. "W1"
  name: string; // e.g. "Left gusset"
  start: number; // nominal seconds in cycle
  dur: number; // nominal duration seconds
  minDur: number; // minimum valid duration seconds
  amps: number; // nominal welding current
  // 2D schematic coordinates on a 100x100 canvas
  coordinates: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

export interface DetectorConfig {
  ampsOn: number;
  ampsOff: number;
  minDwell: number;
  sampleHz: number;
  window: number;
  watchK: number;
  adviseK: number;
  checkMinutes: number;
}

export interface RecipeVersion {
  id: string; // stable internal key, e.g. "recipe-rsb417-v1"
  jobId: string; // "RSB-417"
  revision: string; // "r1"
  name: string; // "Rear suspension bracket"
  sector?: string; // "Automotive components" | "General fabrication"
  process: string;
  material: string;
  thickness: string;
  wire: string;
  gas: string;
  cycleSec: number;
  durTolerance: number; // e.g. 0.20 (80% minimum)
  welds: WeldSlot[];
  boundaryMethod: 'manual' | 'replay_marker' | 'fixture_signal';
  sequencePolicy: 'fixed_ordered' | 'flexible_unsupported';
  restartPolicy: 'exclude_spikes' | 'supervisor_review';
  detectorConfig: DetectorConfig;
  baselineReference: string;
  inspectionReference: string;
  isDraft: boolean;
  isActive: boolean;
  activatedAt?: string;
  activatedBy?: string;
}

export interface BaselinePosition {
  med: number[];
  mad: number[];
}

export interface BaselineVersion {
  id: string;
  recipeId: string;
  status: 'demo' | 'draft' | 'approved' | 'incompatible' | 'retired';
  threshold: number;
  thresholdMethod: string;
  featureVersion: string;
  provenance: string;
  bands: number;
  bandLabels: string[];
  positions: BaselinePosition[];
  baselinePartsCount: number;
  validationPartsCount: number;
  approvedBy?: string;
  approvedAt?: string;
}

export interface StationConfig {
  id: string; // "station-02"
  name: string; // "Station 02"
  workshopName: string; // "North Bay Assembly"
  sector: string;
  timezone: string;
  activeRecipeId: string;
  activeRecipeVersion: string;
  inputMode: InputMode;
  createdAt: string;
  updatedAt: string;
}

export interface ArcInterval {
  start: number;
  end: number;
  dur: number;
  amps: number;
}

export interface SlotMatch {
  slot: WeldSlot;
  arc: ArcInterval | null;
  status: 'expected' | 'active' | 'observed' | 'short' | 'absent' | 'unknown';
  measuredDuration?: number;
  amps?: number;
  audioScore?: number | null;
}

export interface Finding {
  id: string;
  partAttemptId: string;
  displayId: string;
  stationId: string;
  kind: RuleFindingCode;
  severity: 'hold' | 'warning' | 'info';
  title: string;
  reason: string;
  measuredValue?: string;
  configuredValue?: string;
  affectedSlots?: string[];
  status: 'unresolved' | 'acknowledged' | 'in_progress' | 'resolved';
  firstSeenAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
}

export interface Action {
  id: string;
  partAttemptId?: string;
  findingId?: string;
  actionType:
    | 'acknowledge'
    | 'start_setup_check'
    | 'complete_setup_check'
    | 'send_to_inspection'
    | 'continue_normal_inspection'
    | 'record_inspection'
    | 'record_disposition'
    | 'cancel_part';
  actor: string;
  actorRole: DemoRole;
  timestamp: string;
  details?: Record<string, any>;
}

export interface InspectionRecord {
  id: string;
  partAttemptId: string;
  actor: string;
  method: string;
  result: InspectionResult;
  defectType?: string;
  notes?: string;
  createdAt: string;
}

export interface DispositionRecord {
  id: string;
  partAttemptId: string;
  actor: string;
  decision: DispositionDecision;
  reason: string;
  inspectionRef?: string;
  createdAt: string;
}

export interface PartAttempt {
  id: string; // UUID
  displayId: string; // "RSB-000184"
  workpieceRef: string;
  attemptNumber: number;
  batchOrOrder?: string;
  stationId: string;
  recipeId: string;
  recipeVersion: string;
  baselineId: string;
  sourceKind: InputMode;
  sessionId: string;
  startedAt: string;
  endedAt?: string;
  boundaryMethod: 'manual' | 'replay_marker';
  lifecycle: PartLifecycle;
  cancellationReason?: string;
  currentVerification: VerificationState;
  audioVerification: VerificationState;
  ruleFinding: RuleResult;
  ruleReason: string;
  driftFinding: DriftState;
  audioScore?: number | null;
  elevated?: boolean;
  headlineInstruction: string;
  inspectionStatus: InspectionResult;
  dispositionStatus: DispositionDecision;
  savedState: 'saved_local' | 'save_error';
  // Detailed observations
  observations: SlotMatch[];
}

export interface ShiftReportSummary {
  stationId: string;
  stationName: string;
  timeRangeLabel: string;
  timezone: string;
  totalStarted: number;
  totalCompleted: number;
  totalCancelled: number;
  checksClear: number;
  heldParts: number;
  unverifiedParts: number;
  advisoryEpisodes: number;
  inspectionsAccepted: number;
  inspectionsRejected: number;
  inspectionsInconclusive: number;
  dispositionsReleased: number;
  dispositionsRework: number;
  dispositionsScrap: number;
  unresolvedHolds: number;
  coveragePercent: number;
}
