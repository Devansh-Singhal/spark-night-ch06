import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  BaselineVersion,
  DemoRole,
  Finding,
  PartAttempt,
  RecipeVersion,
  StationConfig,
} from '../domain/types';
import {
  getStation,
  initDb,
  getRecipeById,
  getBaselineById,
  savePartFinalResult,
  getUnresolvedFindings,
  updateStation,
} from '../data/db';
import { AUTOMOTIVE_RECIPE_RSB417, FABRICATION_RECIPE_FAB206 } from '../domain/recipes';
import { BASELINE_RSB417, BASELINE_FAB206 } from '../domain/baseline';
import {
  evaluatePartChecks,
  matchArcsToRecipe,
  segmentCurrentTrace,
  deriveHeadlineInstruction,
} from '../domain/checker';
import {
  generateScenarioTelemetry,
  GeneratedTelemetry,
  REPLAY_SCENARIOS,
} from '../replay/scenarios';

interface AppContextValue {
  station: StationConfig;
  activeRecipe: RecipeVersion;
  activeBaseline: BaselineVersion;
  demoRole: DemoRole;
  setDemoRole: (role: DemoRole) => void;
  activePart: PartAttempt | null;
  activeTelemetry: GeneratedTelemetry | null;
  currentReplayScenarioId: string;
  isReplayPlaying: boolean;
  replayPlaybackProgress: number; // 0 to 1
  activeAdvisory: boolean;
  unresolvedCount: number;
  // Actions
  setStationConfig: (st: StationConfig) => Promise<void>;
  switchRecipe: (recipeId: string) => Promise<void>;
  selectReplayScenario: (scenarioId: string) => void;
  startPart: (batchOrOrder?: string) => Promise<PartAttempt>;
  finishPart: () => Promise<PartAttempt | null>;
  cancelPart: (reason: string) => Promise<void>;
  stepReplay: () => void;
  toggleReplayPlay: () => void;
  resetReplayScenario: () => void;
  refreshState: () => Promise<void>;
  acknowledgeFinding: (findingId: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [station, setStation] = useState<StationConfig>({
    id: 'station-02',
    name: 'Station 02',
    workshopName: 'North Bay Assembly',
    sector: 'Automotive components & General fabrication',
    timezone: 'UTC+05:30',
    activeRecipeId: 'recipe-rsb417-v3',
    activeRecipeVersion: 'r3',
    inputMode: 'synthetic',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const [activeRecipe, setActiveRecipe] = useState<RecipeVersion>(AUTOMOTIVE_RECIPE_RSB417);
  const [activeBaseline, setActiveBaseline] = useState<BaselineVersion>(BASELINE_RSB417);
  const [demoRole, setDemoRole] = useState<DemoRole>('operator');

  const [activePart, setActivePart] = useState<PartAttempt | null>(null);
  const [activeTelemetry, setActiveTelemetry] = useState<GeneratedTelemetry | null>(null);
  const [currentReplayScenarioId, setCurrentReplayScenarioId] = useState<string>('bracket-normal');
  const [isReplayPlaying, setIsReplayPlaying] = useState<boolean>(false);
  const [replayPlaybackProgress, setReplayPlaybackProgress] = useState<number>(1.0);
  const [activeAdvisory, setActiveAdvisory] = useState<boolean>(false);
  const [unresolvedCount, setUnresolvedCount] = useState<number>(0);

  const sessionIdRef = useRef<string>(`session-${Date.now()}`);
  const partCounterRef = useRef<number>(184);

  // Load and sync database state
  const refreshState = useCallback(async () => {
    try {
      await initDb();
      const st = await getStation();
      setStation(st);

      const r = await getRecipeById(st.activeRecipeId);
      if (r) setActiveRecipe(r);

      const b = await getBaselineById(r?.baselineReference || '');
      if (b) setActiveBaseline(b);

      const unres = await getUnresolvedFindings();
      setUnresolvedCount(unres.length);
    } catch (err) {
      console.error('Failed to init/refresh state:', err);
    }
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  // Load scenario telemetry into state
  const selectReplayScenario = useCallback(
    (scenarioId: string) => {
      setCurrentReplayScenarioId(scenarioId);
      setIsReplayPlaying(false);
      setReplayPlaybackProgress(1.0);

      const scn = REPLAY_SCENARIOS.find((s) => s.id === scenarioId) || REPLAY_SCENARIOS[0];
      const telem = generateScenarioTelemetry(scenarioId, partCounterRef.current);
      setActiveTelemetry(telem);

      // If scenario requires different recipe, sync recipe
      if (scn.recipe.id !== activeRecipe.id) {
        setActiveRecipe(scn.recipe);
        const base = scn.recipe.id === FABRICATION_RECIPE_FAB206.id ? BASELINE_FAB206 : BASELINE_RSB417;
        setActiveBaseline(base);
      }

      // Generate provisional active part for this scenario
      const isMissingW3 = scenarioId === 'bracket-0184-missing';
      const partDisplayId = isMissingW3 ? 'RSB-000184' : telem.displayId;

      // Segment current trace
      const arcs = segmentCurrentTrace(
        telem.trace,
        telem.sampleHz,
        scn.recipe.detectorConfig.ampsOn,
        scn.recipe.detectorConfig.ampsOff,
        scn.recipe.detectorConfig.minDwell
      );

      const matched = matchArcsToRecipe(arcs, scn.recipe.welds);
      const evalResult = evaluatePartChecks(
        matched,
        {
          isBoundaryConfirmed: telem.isBoundaryConfirmed,
          hasGap: telem.hasGap,
          currentVerification: telem.hasGap ? 'unavailable' : 'valid',
          audioVerification: telem.isAudioAvailable ? 'valid' : 'unavailable',
        },
        scn.recipe
      );

      const headlineInfo = deriveHeadlineInstruction(
        {
          displayId: partDisplayId,
          ruleFinding: evalResult.ruleResult,
          ruleReason: evalResult.ruleReason,
          lifecycle: 'completed',
          currentVerification: telem.hasGap ? 'unavailable' : 'valid',
          driftFinding: scenarioId === 'bracket-wire-lot' ? 'advisory_open' : 'normal',
        },
        scenarioId === 'bracket-wire-lot'
      );

      if (scenarioId === 'bracket-wire-lot') {
        setActiveAdvisory(true);
      }

      const pAttempt: PartAttempt = {
        id: `part-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        displayId: partDisplayId,
        workpieceRef: scn.recipe.jobId,
        attemptNumber: 1,
        stationId: station.id,
        recipeId: scn.recipe.id,
        recipeVersion: scn.recipe.revision,
        baselineId: scn.recipe.baselineReference,
        sourceKind: 'synthetic',
        sessionId: sessionIdRef.current,
        startedAt: new Date(Date.now() - scn.recipe.cycleSec * 1000).toISOString(),
        endedAt: new Date().toISOString(),
        boundaryMethod: 'replay_marker',
        lifecycle: 'completed',
        currentVerification: telem.hasGap ? 'unavailable' : 'valid',
        audioVerification: telem.isAudioAvailable ? 'valid' : 'unavailable',
        ruleFinding: evalResult.ruleResult,
        ruleReason: evalResult.ruleReason,
        driftFinding: scenarioId === 'bracket-wire-lot' ? 'advisory_open' : 'normal',
        audioScore: telem.partScore,
        elevated: (telem.partScore ?? 0) > 1.38,
        headlineInstruction: headlineInfo.headline,
        inspectionStatus: 'not_recorded',
        dispositionStatus: 'pending',
        savedState: 'saved_local',
        observations: matched.matches,
      };

      setActivePart(pAttempt);
    },
    [activeRecipe.id, station.id]
  );

  // Initialize with default scenario
  useEffect(() => {
    selectReplayScenario('bracket-normal');
  }, [selectReplayScenario]);

  // Start a part manually
  const startPart = useCallback(
    async (batchOrOrder?: string): Promise<PartAttempt> => {
      partCounterRef.current += 1;
      const count = partCounterRef.current;
      const prefix = activeRecipe.jobId === 'FAB-206' ? 'FAB' : 'RSB';
      const displayId = `${prefix}-${String(count).padStart(6, '0')}`;

      // Generate telemetry for active part
      const telem = generateScenarioTelemetry(currentReplayScenarioId, count);
      setActiveTelemetry(telem);

      const newPart: PartAttempt = {
        id: `part-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        displayId,
        workpieceRef: activeRecipe.jobId,
        attemptNumber: 1,
        batchOrOrder,
        stationId: station.id,
        recipeId: activeRecipe.id,
        recipeVersion: activeRecipe.revision,
        baselineId: activeRecipe.baselineReference,
        sourceKind: station.inputMode,
        sessionId: sessionIdRef.current,
        startedAt: new Date().toISOString(),
        boundaryMethod: station.inputMode === 'synthetic' ? 'replay_marker' : 'manual',
        lifecycle: 'active',
        currentVerification: 'valid',
        audioVerification: 'valid',
        ruleFinding: 'pending',
        ruleReason: 'Observing arc current and sound · Awaiting part boundary',
        driftFinding: activeAdvisory ? 'advisory_open' : 'normal',
        headlineInstruction: `Monitoring part ${displayId}`,
        inspectionStatus: 'not_recorded',
        dispositionStatus: 'pending',
        savedState: 'saved_local',
        observations: activeRecipe.welds.map((slot) => ({
          slot,
          arc: null,
          status: 'expected',
        })),
      };

      setActivePart(newPart);
      return newPart;
    },
    [activeRecipe, currentReplayScenarioId, station.id, station.inputMode, activeAdvisory]
  );

  // Finish a part: evaluate rules and save to IndexedDB
  const finishPart = useCallback(async (): Promise<PartAttempt | null> => {
    if (!activePart || !activeTelemetry) return null;

    const telem = activeTelemetry;
    const arcs = segmentCurrentTrace(
      telem.trace,
      telem.sampleHz,
      activeRecipe.detectorConfig.ampsOn,
      activeRecipe.detectorConfig.ampsOff,
      activeRecipe.detectorConfig.minDwell
    );

    const matched = matchArcsToRecipe(arcs, activeRecipe.welds);
    const evalResult = evaluatePartChecks(
      matched,
      {
        isBoundaryConfirmed: true,
        hasGap: telem.hasGap,
        currentVerification: telem.hasGap ? 'unavailable' : 'valid',
        audioVerification: telem.isAudioAvailable ? 'valid' : 'unavailable',
      },
      activeRecipe
    );

    const headline = deriveHeadlineInstruction(
      {
        displayId: activePart.displayId,
        ruleFinding: evalResult.ruleResult,
        ruleReason: evalResult.ruleReason,
        lifecycle: 'completed',
        currentVerification: telem.hasGap ? 'unavailable' : 'valid',
        driftFinding: activeAdvisory ? 'advisory_open' : 'normal',
      },
      activeAdvisory
    );

    const completedPart: PartAttempt = {
      ...activePart,
      endedAt: new Date().toISOString(),
      lifecycle: 'completed',
      currentVerification: telem.hasGap ? 'unavailable' : 'valid',
      audioVerification: telem.isAudioAvailable ? 'valid' : 'unavailable',
      ruleFinding: evalResult.ruleResult,
      ruleReason: evalResult.ruleReason,
      driftFinding: activeAdvisory ? 'advisory_open' : 'normal',
      audioScore: telem.partScore,
      elevated: (telem.partScore ?? 0) > 1.38,
      headlineInstruction: headline.headline,
      observations: matched.matches,
    };

    // Prepare findings to save
    const findings: Finding[] = evalResult.findingsToCreate.map((f, idx) => ({
      ...f,
      id: `find-${Date.now()}-${idx}`,
      partAttemptId: completedPart.id,
      displayId: completedPart.displayId,
      stationId: completedPart.stationId,
    }));

    await savePartFinalResult(completedPart, findings);
    setActivePart(completedPart);
    await refreshState();

    return completedPart;
  }, [activePart, activeTelemetry, activeRecipe, activeAdvisory, refreshState]);

  // Cancel part with reason
  const cancelPart = useCallback(
    async (reason: string) => {
      if (!activePart) return;
      const cancelled: PartAttempt = {
        ...activePart,
        endedAt: new Date().toISOString(),
        lifecycle: 'cancelled',
        cancellationReason: reason,
        headlineInstruction: `Part ${activePart.displayId} Cancelled`,
      };
      await savePartFinalResult(cancelled, []);
      setActivePart(null);
      await refreshState();
    },
    [activePart, refreshState]
  );

  // Replay controls
  const stepReplay = useCallback(() => {
    // Step forward 20%
    setReplayPlaybackProgress((prev) => {
      const next = prev + 0.2;
      return next >= 1.0 ? 1.0 : next;
    });
  }, []);

  const toggleReplayPlay = useCallback(() => {
    setIsReplayPlaying((p) => !p);
  }, []);

  const resetReplayScenario = useCallback(() => {
    setIsReplayPlaying(false);
    setReplayPlaybackProgress(0.0);
    selectReplayScenario(currentReplayScenarioId);
  }, [currentReplayScenarioId, selectReplayScenario]);

  // Switch active recipe
  const switchRecipe = useCallback(
    async (recipeId: string) => {
      const r = await getRecipeById(recipeId);
      if (r) {
        setActiveRecipe(r);
        const b = await getBaselineById(r.baselineReference);
        if (b) setActiveBaseline(b);

        await updateStation({
          ...station,
          activeRecipeId: r.id,
          activeRecipeVersion: r.revision,
        });
        await refreshState();
      }
    },
    [station, refreshState]
  );

  const setStationConfig = useCallback(
    async (st: StationConfig) => {
      await updateStation(st);
      setStation(st);
      await refreshState();
    },
    [refreshState]
  );

  const acknowledgeFinding = useCallback(
    async (_findingId: string) => {
      // Find and acknowledge
      await refreshState();
    },
    [refreshState]
  );

  return (
    <AppContext.Provider
      value={{
        station,
        activeRecipe,
        activeBaseline,
        demoRole,
        setDemoRole,
        activePart,
        activeTelemetry,
        currentReplayScenarioId,
        isReplayPlaying,
        replayPlaybackProgress,
        activeAdvisory,
        unresolvedCount,
        setStationConfig,
        switchRecipe,
        selectReplayScenario,
        startPart,
        finishPart,
        cancelPart,
        stepReplay,
        toggleReplayPlay,
        resetReplayScenario,
        refreshState,
        acknowledgeFinding,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
