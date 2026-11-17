import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { InstructionCard } from '../components/InstructionCard';
import { TraceView } from '../components/TraceView';
import { SeamMap } from '../components/SeamMap';
import { SoundTrend } from '../components/SoundTrend';
import { SetupCheckModal } from '../components/SetupCheckModal';
import { REPLAY_SCENARIOS } from '../replay/scenarios';
import { getAllParts } from '../data/db';
import { PartAttempt } from '../domain/types';

export const StationPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    activeRecipe,
    activePart,
    activeTelemetry,
    currentReplayScenarioId,
    selectReplayScenario,
    stepReplay,
    resetReplayScenario,
    isReplayPlaying,
    toggleReplayPlay,
  } = useApp();

  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [recentParts, setRecentParts] = useState<PartAttempt[]>([]);

  useEffect(() => {
    getAllParts().then((parts) => setRecentParts(parts.slice(0, 8)));
  }, [activePart]);

  // Handle auto playback interval if playing
  useEffect(() => {
    let timer: any = null;
    if (isReplayPlaying) {
      timer = setInterval(() => {
        stepReplay();
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isReplayPlaying, stepReplay]);

  return (
    <div className="station-page">
      {/* Replay scenario control strip */}
      <div
        className="card no-print"
        style={{
          padding: '0.75rem 1rem',
          marginBottom: '1.25rem',
          backgroundColor: '#F3F6F6',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--action)' }}>
            REPLAY SCENARIO:
          </span>
          <select
            value={currentReplayScenarioId}
            onChange={(e) => selectReplayScenario(e.target.value)}
            style={{
              padding: '0.35rem 0.65rem',
              minHeight: '36px',
              fontSize: '0.88rem',
              fontWeight: 600,
              width: 'auto',
              minWidth: '280px',
            }}
          >
            {REPLAY_SCENARIOS.map((scn) => (
              <option key={scn.id} value={scn.id}>
                {scn.name} ({scn.recipe.jobId})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={toggleReplayPlay}
            title={isReplayPlaying ? 'Pause replay' : 'Play replay'}
          >
            {isReplayPlaying ? '⏸ Pause' : '▶ Play'}
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={stepReplay}
            title="Advance playback to next weld event"
          >
            Next Event ⏭
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={resetReplayScenario}
            title="Reset replay to part start"
          >
            Reset ↺
          </button>
        </div>
      </div>

      {/* Main station grid */}
      <div className="station-grid">
        {/* Left Column: Instruction + Trace + Seam map */}
        <div className="station-main">
          <InstructionCard
            onOpenChecklist={() => setIsChecklistOpen(true)}
            onOpenEvidence={() => {
              if (activePart) navigate(`/parts/${activePart.id}`);
            }}
          />

          {activeTelemetry && (
            <TraceView
              trace={activeTelemetry.trace}
              sampleHz={activeTelemetry.sampleHz}
              cycleSec={activeTelemetry.cycleSec}
              recipe={activeRecipe}
              matches={activePart?.observations || []}
              hasGap={activeTelemetry.hasGap}
              selectedSlotId={selectedSlotId}
              onSelectSlot={setSelectedSlotId}
            />
          )}

          <SeamMap
            recipe={activeRecipe}
            matches={activePart?.observations || []}
            selectedSlotId={selectedSlotId}
            onSelectSlot={setSelectedSlotId}
          />
        </div>

        {/* Right Column: Acoustic trend + Recent parts strip */}
        <div className="station-sidebar">
          <SoundTrend />

          {/* Recipe and Station Context Card */}
          <div className="card" style={{ padding: '1rem', backgroundColor: 'var(--surface)' }}>
            <h3 style={{ fontSize: '1.0rem', marginBottom: '0.5rem' }}>Active Recipe Parameters</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.85rem' }}>
              <div><span className="text-muted">Job:</span> <strong>{activeRecipe.jobId} {activeRecipe.revision}</strong></div>
              <div><span className="text-muted">Cycle:</span> <strong>{activeRecipe.cycleSec} s</strong></div>
              <div><span className="text-muted">Welds:</span> <strong>{activeRecipe.welds.length} slots</strong></div>
              <div><span className="text-muted">Tolerance:</span> <strong>{(activeRecipe.durTolerance * 100).toFixed(0)}% min</strong></div>
            </div>
            <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
              {activeRecipe.process}
            </div>
          </div>

          {/* Recent parts list */}
          <div className="card" style={{ padding: '1rem', backgroundColor: 'var(--surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '1.0rem', margin: 0 }}>Recent Recorded Parts</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => navigate('/parts')}
                style={{ minHeight: '30px', fontSize: '0.78rem' }}
              >
                View All
              </button>
            </div>

            {recentParts.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0.5rem 0' }}>
                No parts saved in this session yet. Finish a part or advance replay.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {recentParts.map((p) => {
                  let badge = 'badge-ok';
                  if (p.ruleFinding === 'missing' || p.ruleFinding === 'short') badge = 'badge-hold';
                  else if (p.ruleFinding === 'unverified') badge = 'badge-unknown';

                  return (
                    <div
                      key={p.id}
                      onClick={() => navigate(`/parts/${p.id}`)}
                      style={{
                        padding: '0.45rem 0.6rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--line)',
                        backgroundColor: '#FAFCFB',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      <div>
                        <strong className="text-mono" style={{ color: 'var(--action)' }}>
                          {p.displayId}
                        </strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                          {p.recipeId.includes('fab') ? 'FAB-206' : 'RSB-417'}
                        </div>
                      </div>
                      <span className={`badge ${badge}`} style={{ fontSize: '0.72rem' }}>
                        {p.ruleFinding.toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Operator Setup Checklist Modal */}
      <SetupCheckModal
        isOpen={isChecklistOpen}
        onClose={() => setIsChecklistOpen(false)}
        onComplete={() => {
          setIsChecklistOpen(false);
        }}
      />
    </div>
  );
};
