import React from 'react';
import { useApp } from '../context/AppContext';

interface InstructionCardProps {
  onStartPart?: () => void;
  onFinishPart?: () => void;
  onOpenChecklist?: () => void;
  onOpenEvidence?: () => void;
}

export const InstructionCard: React.FC<InstructionCardProps> = ({
  onStartPart,
  onFinishPart,
  onOpenChecklist,
  onOpenEvidence,
}) => {
  const { activePart, activeAdvisory, startPart, finishPart } = useApp();

  // Determine state colors
  let bg = 'var(--surface)';
  let border = 'var(--line)';
  let ink = 'var(--ink)';
  let badgeClass = 'badge-unknown';
  let statusIcon = '●';

  const isHold = activePart?.ruleFinding === 'missing' || activePart?.ruleFinding === 'short';
  const isUnverified = activePart?.ruleFinding === 'unverified';
  const isClear = activePart?.ruleFinding === 'clear';
  const isActive = activePart?.lifecycle === 'active';

  if (isHold) {
    bg = 'var(--hold-bg)';
    border = 'var(--hold-border)';
    ink = 'var(--hold-ink)';
    badgeClass = 'badge-hold';
    statusIcon = '⚠ HOLD';
  } else if (activeAdvisory || activePart?.driftFinding === 'advisory_open') {
    bg = 'var(--warn-bg)';
    border = 'var(--warn-border)';
    ink = 'var(--warn-ink)';
    badgeClass = 'badge-warn';
    statusIcon = '⚠ ADVISORY';
  } else if (isUnverified) {
    bg = 'var(--unknown-bg)';
    border = 'var(--unknown-border)';
    ink = 'var(--unknown-ink)';
    badgeClass = 'badge-unknown';
    statusIcon = '? UNVERIFIED';
  } else if (isClear) {
    bg = 'var(--ok-bg)';
    border = 'var(--ok-border)';
    ink = 'var(--ok-ink)';
    badgeClass = 'badge-ok';
    statusIcon = '✓ CHECKS CLEAR';
  } else if (isActive) {
    bg = '#EAF4F7';
    border = '#9ecad4';
    ink = 'var(--action)';
    badgeClass = 'badge-provenance';
    statusIcon = '⚡ MONITORING';
  }

  return (
    <section
      className="card"
      style={{
        backgroundColor: bg,
        borderColor: border,
        borderWidth: 2,
        padding: '1.5rem',
      }}
      aria-live="polite"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span className={`badge ${badgeClass}`} style={{ fontSize: '0.85rem', padding: '0.25rem 0.65rem' }}>
          {statusIcon}
        </span>
        {activePart && (
          <span className="text-mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: ink }}>
            {activePart.displayId}
          </span>
        )}
      </div>

      <h2 style={{ fontSize: '1.65rem', color: ink, marginBottom: '0.5rem', lineHeight: 1.25 }}>
        {activePart?.headlineInstruction || 'Ready for next part'}
      </h2>

      <p style={{ fontSize: '1.05rem', color: ink, marginBottom: '1.25rem', maxWidth: '75ch' }}>
        {activePart?.ruleReason || 'Fixture ready. Load workpiece and initiate cycle.'}
      </p>

      {/* Action bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        {!activePart || activePart.lifecycle !== 'active' ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onStartPart || (() => startPart())}
            style={{ minWidth: '160px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Start Part
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onFinishPart || (() => finishPart())}
            style={{ minWidth: '160px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="6" y="6" width="12" height="12" />
            </svg>
            Finish Part
          </button>
        )}

        {(activeAdvisory || activePart?.driftFinding === 'advisory_open') && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onOpenChecklist}
            style={{ borderColor: 'var(--warn-border)', color: 'var(--warn-ink)', fontWeight: 700 }}
          >
            Check Setup Now
          </button>
        )}

        {onOpenEvidence && (
          <button type="button" className="btn btn-secondary" onClick={onOpenEvidence}>
            View Complete Evidence
          </button>
        )}
      </div>
    </section>
  );
};
