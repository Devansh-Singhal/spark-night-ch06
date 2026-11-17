import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUnresolvedFindings, recordAction } from '../data/db';
import { Finding } from '../domain/types';
import { useApp } from '../context/AppContext';
import { SetupCheckModal } from '../components/SetupCheckModal';
import { DispositionModal } from '../components/DispositionModal';

export const AttentionPage: React.FC = () => {
  const navigate = useNavigate();
  const { demoRole, activeAdvisory, refreshState } = useApp();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeSetupModal, setActiveSetupModal] = useState(false);
  const [dispositionTarget, setDispositionTarget] = useState<{ id: string; displayId: string } | null>(null);

  const loadFindings = () => {
    getUnresolvedFindings().then((data) => {
      setFindings(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadFindings();
  }, []);

  const handleAcknowledge = async (finding: Finding) => {
    await recordAction({
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      findingId: finding.id,
      partAttemptId: finding.partAttemptId,
      actionType: 'acknowledge',
      actor: demoRole === 'operator' ? 'Welding Operator' : 'Quality Supervisor',
      actorRole: demoRole,
      timestamp: new Date().toISOString(),
      details: { note: 'Finding acknowledged on attention queue.' },
    });
    await refreshState();
    loadFindings();
  };

  // Group findings according to F07
  const heldFindings = findings.filter((f) => f.kind === 'MISSING_REQUIRED_ARC' || f.kind === 'SHORT_REQUIRED_ARC');
  const verificationFindings = findings.filter((f) => f.kind === 'CURRENT_GAP' || f.kind === 'EXTRA_OR_AMBIGUOUS_ARCS' || f.kind === 'BOUNDARY_UNCONFIRMED');
  const advisoryFindings = findings.filter((f) => f.kind === 'SUSTAINED_AUDIO_SHIFT');

  return (
    <div className="attention-page">
      <div style={{ marginBottom: '1.25rem' }}>
        <h1>Attention Queue & Active Advisories</h1>
        <p className="text-muted" style={{ fontSize: '0.9rem' }}>
          Triage active holds, unverified telemetry gaps, and acoustic setup advisories.
        </p>
      </div>

      {loading ? (
        <p className="text-muted">Loading attention queue...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Section 1: Held Parts (Urgent) */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="badge badge-hold" style={{ fontSize: '0.85rem' }}>
                  HELD PARTS ({heldFindings.length})
                </span>
                <span style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
                  Confirmed missing or short weld events requiring physical segregation
                </span>
              </div>
            </div>

            {heldFindings.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0.5rem 0' }}>
                ✓ No active part holds. All evaluated parts satisfied arc count and minimum duration rules.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {heldFindings.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      padding: '0.85rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--hold-bg)',
                      border: '1px solid var(--hold-border)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                        <strong className="text-mono" style={{ fontSize: '1.05rem', color: 'var(--hold-ink)' }}>
                          {f.displayId}
                        </strong>
                        <span className="badge badge-hold">{f.title}</span>
                        {f.status === 'acknowledged' && <span className="badge badge-ok">Acknowledged</span>}
                      </div>
                      <p style={{ fontSize: '0.88rem', color: 'var(--hold-ink)', margin: 0 }}>{f.reason}</p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {f.status !== 'acknowledged' && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleAcknowledge(f)}
                        >
                          Acknowledge
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/parts/${f.partAttemptId}`)}
                      >
                        View Evidence
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setDispositionTarget({ id: f.partAttemptId, displayId: f.displayId })}
                      >
                        Record Disposition
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Needs Verification */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span className="badge badge-unknown" style={{ fontSize: '0.85rem' }}>
                NEEDS VERIFICATION ({verificationFindings.length})
              </span>
              <span style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
                Signal dropouts or sequence ambiguities where arc count cannot be definitively proven
              </span>
            </div>

            {verificationFindings.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0.5rem 0' }}>
                ✓ No unverified parts. Current telemetry coverage has been continuous.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {verificationFindings.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      padding: '0.85rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--unknown-bg)',
                      border: '1px solid var(--unknown-border)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                        <strong className="text-mono" style={{ fontSize: '1.05rem', color: 'var(--ink)' }}>
                          {f.displayId}
                        </strong>
                        <span className="badge badge-unknown">{f.title}</span>
                      </div>
                      <p style={{ fontSize: '0.88rem', color: 'var(--ink)', margin: 0 }}>{f.reason}</p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/parts/${f.partAttemptId}`)}
                      >
                        Inspect Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Setup Checks / Advisories */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span className="badge badge-warn" style={{ fontSize: '0.85rem' }}>
                SETUP CHECKS & ADVISORIES ({activeAdvisory || advisoryFindings.length > 0 ? 1 : 0})
              </span>
              <span style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
                Sustained acoustic process deviations requiring physical torch/gas inspection
              </span>
            </div>

            {!activeAdvisory && advisoryFindings.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0.5rem 0' }}>
                ✓ No active acoustic advisories. Rolling window scores remain within baseline variance.
              </p>
            ) : (
              <div
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--warn-bg)',
                  border: '1px solid var(--warn-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <strong style={{ color: 'var(--warn-ink)', fontSize: '1.05rem' }}>
                    Sustained Process Drift Detected
                  </strong>
                  <p style={{ fontSize: '0.88rem', color: 'var(--warn-ink)', margin: '0.25rem 0 0' }}>
                    4 of 6 valid scored parts sounded different. All arc intervals observed. Perform 3-minute setup check at next part change.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setActiveSetupModal(true)}
                  style={{ backgroundColor: 'var(--warn-ink)', borderColor: 'var(--warn-ink)' }}
                >
                  Start Setup Check
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Setup Check Modal */}
      <SetupCheckModal
        isOpen={activeSetupModal}
        onClose={() => setActiveSetupModal(false)}
        onComplete={() => {
          setActiveSetupModal(false);
          loadFindings();
        }}
      />

      {/* Disposition Modal */}
      {dispositionTarget && (
        <DispositionModal
          isOpen={!!dispositionTarget}
          partId={dispositionTarget.id}
          displayId={dispositionTarget.displayId}
          onClose={() => setDispositionTarget(null)}
          onSuccess={() => {
            setDispositionTarget(null);
            loadFindings();
          }}
        />
      )}
    </div>
  );
};
