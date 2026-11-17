import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPartById, getRecipeById } from '../data/db';
import { Action, Finding, PartAttempt, RecipeVersion } from '../domain/types';
import { InspectionModal } from '../components/InspectionModal';
import { DispositionModal } from '../components/DispositionModal';
import { AUTOMOTIVE_RECIPE_RSB417 } from '../domain/recipes';

export const PartDetailPage: React.FC = () => {
  const { partId } = useParams();
  const navigate = useNavigate();

  const [partData, setPartData] = useState<{
    part: PartAttempt;
    findings: Finding[];
    actions: Action[];
  } | null>(null);

  const [recipe, setRecipe] = useState<RecipeVersion>(AUTOMOTIVE_RECIPE_RSB417);
  const [loading, setLoading] = useState(true);
  const [isInspectionOpen, setIsInspectionOpen] = useState(false);
  const [isDispositionOpen, setIsDispositionOpen] = useState(false);

  const loadData = () => {
    if (!partId) return;
    getPartById(partId).then(async (data) => {
      if (data) {
        setPartData(data);
        const r = await getRecipeById(data.part.recipeId);
        if (r) setRecipe(r);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [partId]);

  if (loading) return <div style={{ padding: '2rem' }}>Loading part passport...</div>;

  if (!partData) {
    return (
      <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
        <h2>Part Record Not Found</h2>
        <p className="text-muted" style={{ margin: '0.5rem 0 1.25rem' }}>
          No recorded workpiece matches ID {partId}.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/parts')}>
          Return to Parts List
        </button>
      </div>
    );
  }

  const { part, findings, actions } = partData;

  const isHold = part.ruleFinding === 'missing' || part.ruleFinding === 'short';

  return (
    <div className="part-passport-page">
      {/* Top action and title strip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <button
            type="button"
            className="btn btn-secondary btn-sm no-print"
            onClick={() => navigate('/parts')}
            style={{ marginBottom: '0.5rem', minHeight: '32px' }}
          >
            ← Back to Parts
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.85rem' }}>Part Passport: {part.displayId}</h1>
            <span className="badge badge-provenance">SYNTHETIC REPLAY</span>
          </div>
          <p className="text-muted" style={{ fontSize: '0.88rem' }}>
            Internal UUID: <span className="text-mono">{part.id}</span> · Station {part.stationId} · Recipe {recipe.jobId} {part.recipeVersion}
          </p>
        </div>

        <div className="no-print" style={{ display: 'flex', gap: '0.6rem' }}>
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            Print Passport 🖨
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsInspectionOpen(true)}
          >
            Record Inspection
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsDispositionOpen(true)}
            style={{ borderColor: isHold ? 'var(--hold-border)' : undefined, color: isHold ? 'var(--hold-ink)' : undefined }}
          >
            Record Disposition
          </button>
        </div>
      </div>

      {/* Decision Summary Card */}
      <div
        className="card"
        style={{
          padding: '1.25rem',
          marginBottom: '1.25rem',
          backgroundColor: isHold ? 'var(--hold-bg)' : 'var(--surface)',
          borderColor: isHold ? 'var(--hold-border)' : 'var(--line)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isHold ? 'var(--hold-ink)' : 'var(--muted)' }}>
            AUTOMATED PROCESS CHECK FINDINGS
          </span>
          <span className={`badge ${isHold ? 'badge-hold' : 'badge-ok'}`}>
            {part.ruleFinding.toUpperCase()}
          </span>
        </div>

        <h2 style={{ fontSize: '1.35rem', color: isHold ? 'var(--hold-ink)' : 'var(--ink)', marginBottom: '0.4rem' }}>
          {part.headlineInstruction}
        </h2>
        <p style={{ fontSize: '0.95rem', color: isHold ? 'var(--hold-ink)' : 'var(--ink)' }}>
          {part.ruleReason}
        </p>
      </div>

      {/* Weld Slots Detailed Evidence Table */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Weld Slot Verification Evidence</h3>
        <div className="table-container">
          <table aria-label="Weld Slot Evidence">
            <thead>
              <tr>
                <th>Slot ID</th>
                <th>Seam Description</th>
                <th>Nominal Start</th>
                <th>Nominal Dur</th>
                <th>Min Dur</th>
                <th>Measured Dur</th>
                <th>Average Amps</th>
                <th>Verification Result</th>
              </tr>
            </thead>
            <tbody>
              {recipe.welds.map((slot) => {
                const obs = part.observations.find((o) => o.slot.id === slot.id);
                const isShort = obs?.status === 'short';
                const isAbsent = obs?.status === 'absent';

                return (
                  <tr key={slot.id} style={{ backgroundColor: isShort || isAbsent ? 'var(--hold-bg)' : undefined }}>
                    <td className="text-mono"><strong>{slot.id}</strong></td>
                    <td>{slot.name}</td>
                    <td className="text-mono">{slot.start.toFixed(1)} s</td>
                    <td className="text-mono">{slot.dur.toFixed(2)} s</td>
                    <td className="text-mono">{slot.minDur.toFixed(2)} s</td>
                    <td className="text-mono">
                      {obs?.arc ? `${obs.arc.dur.toFixed(2)} s` : '0.00 s'}
                    </td>
                    <td className="text-mono">
                      {obs?.arc ? `${obs.arc.amps.toFixed(1)} A` : '—'}
                    </td>
                    <td>
                      {obs?.status === 'observed' && <span className="badge badge-ok">✓ Arc Verified</span>}
                      {obs?.status === 'short' && <span className="badge badge-hold">⚠ Short Arc</span>}
                      {obs?.status === 'absent' && <span className="badge badge-hold">✕ Missing Arc</span>}
                      {!obs && <span className="badge badge-unknown">Unrecorded</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Acoustic Evidence Section */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Acoustic Monitoring Record</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.9rem' }}>
          <div>
            <span className="text-muted">Acoustic Score:</span>{' '}
            <strong className="text-mono">{part.audioScore != null ? part.audioScore.toFixed(2) : 'Unavailable'}</strong>
          </div>
          <div>
            <span className="text-muted">Threshold:</span>{' '}
            <strong className="text-mono">1.38</strong>
          </div>
          <div>
            <span className="text-muted">Drift Finding:</span>{' '}
            <strong>{part.driftFinding}</strong>
          </div>
          <div>
            <span className="text-muted">Audio Verification:</span>{' '}
            <strong>{part.audioVerification}</strong>
          </div>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.75rem' }}>
          Microphone features evaluated against frozen baseline {part.baselineId}. Sound provides sustained process change detection; it does not replace NDT examination.
        </p>
      </div>

      {/* Complete Append-Only Traceability Timeline */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Traceability & Quality Timeline</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Cycle Start */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <span className="text-mono text-muted" style={{ fontSize: '0.8rem', minWidth: '85px' }}>
              {new Date(part.startedAt).toLocaleTimeString()}
            </span>
            <div>
              <strong>Workpiece cycle initiated</strong>
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                Recipe {recipe.jobId} {part.recipeVersion} locked at Station {part.stationId}.
              </div>
            </div>
          </div>

          {/* Boundary Confirmation */}
          {part.endedAt && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <span className="text-mono text-muted" style={{ fontSize: '0.8rem', minWidth: '85px' }}>
                {new Date(part.endedAt).toLocaleTimeString()}
              </span>
              <div>
                <strong>Part boundary confirmed ({part.boundaryMethod})</strong>
                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                  Evaluated {part.observations.filter((o) => o.arc).length} observed arcs against {recipe.welds.length} expected weld slots.
                </div>
              </div>
            </div>
          )}

          {/* Logged Findings */}
          {findings.map((f) => (
            <div key={f.id} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <span className="text-mono text-muted" style={{ fontSize: '0.8rem', minWidth: '85px' }}>
                {new Date(f.firstSeenAt).toLocaleTimeString()}
              </span>
              <div>
                <strong style={{ color: f.severity === 'hold' ? 'var(--hold-ink)' : 'var(--warn-ink)' }}>
                  Finding: {f.title}
                </strong>
                <div style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>{f.reason}</div>
              </div>
            </div>
          ))}

          {/* Recorded Actions & Decisions */}
          {actions.map((a) => (
            <div key={a.id} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <span className="text-mono text-muted" style={{ fontSize: '0.8rem', minWidth: '85px' }}>
                {new Date(a.timestamp).toLocaleTimeString()}
              </span>
              <div>
                <strong>
                  Action: {a.actionType.replace(/_/g, ' ').toUpperCase()} by {a.actor} ({a.actorRole})
                </strong>
                {a.details && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                    {a.details.reason && <div>Reason: {a.details.reason}</div>}
                    {a.details.method && <div>Method: {a.details.method} (Result: {a.details.result})</div>}
                    {a.details.notes && <div>Notes: {a.details.notes}</div>}
                    {a.details.decision && <div>Decision: <strong>{a.details.decision.toUpperCase()}</strong></div>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Inspection Modal */}
      <InspectionModal
        isOpen={isInspectionOpen}
        partId={part.id}
        displayId={part.displayId}
        onClose={() => setIsInspectionOpen(false)}
        onSuccess={loadData}
      />

      {/* Disposition Modal */}
      <DispositionModal
        isOpen={isDispositionOpen}
        partId={part.id}
        displayId={part.displayId}
        onClose={() => setIsDispositionOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
};
