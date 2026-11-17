import React from 'react';
import { useApp } from '../context/AppContext';

export const SoundTrend: React.FC = () => {
  const { activeBaseline, activePart, activeAdvisory, activeTelemetry } = useApp();

  const threshold = activeBaseline.threshold;
  const currentScore = activeTelemetry?.partScore ?? activePart?.audioScore ?? null;
  const isAvailable = activeTelemetry?.isAudioAvailable ?? true;

  return (
    <div className="card" style={{ padding: '1rem', backgroundColor: 'var(--surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Acoustic Anomaly Trend</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            Baseline {activeBaseline.id} · Threshold {threshold.toFixed(2)}
          </span>
        </div>

        {isAvailable ? (
          <span
            className={`badge ${activeAdvisory ? 'badge-warn' : 'badge-ok'}`}
            style={{ fontSize: '0.8rem' }}
          >
            {activeAdvisory ? 'Advisory Active' : 'Sound Normal'}
          </span>
        ) : (
          <span className="badge badge-unknown" style={{ fontSize: '0.8rem' }}>
            Audio Unavailable
          </span>
        )}
      </div>

      {isAvailable ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: (currentScore ?? 0) > threshold ? 'var(--warn-ink)' : 'var(--ink)' }}>
              {currentScore != null ? currentScore.toFixed(2) : '—'}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              vs threshold {threshold.toFixed(2)} (robust distance)
            </span>
          </div>

          {/* 6-Part Rolling window visualization */}
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>
              <span>Recent 6 Valid Scored Parts</span>
              <span>{activeAdvisory ? '4 of 6 Elevated' : '1 of 6 Elevated'}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {Array.from({ length: 6 }).map((_, idx) => {
                const isElev = activeAdvisory ? idx >= 2 : idx === 4;
                return (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      height: '14px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isElev ? 'var(--warn-border)' : 'var(--ok-border)',
                      border: `1px solid ${isElev ? 'var(--warn-ink)' : 'var(--ok-ink)'}`,
                    }}
                    title={`Part ${idx + 1}: ${isElev ? 'Elevated' : 'Normal'}`}
                  />
                );
              })}
            </div>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0 }}>
            Note: An elevated sound score triggers a process check advisory. It does not predict internal porosity or certify joint quality.
          </p>
        </div>
      ) : (
        <div style={{ padding: '0.75rem', backgroundColor: 'var(--unknown-bg)', borderRadius: 'var(--radius-sm)' }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--unknown-ink)', margin: 0 }}>
            Microphone signal unavailable. Arc count and duration checks continue uninterrupted from current clamp.
          </p>
        </div>
      )}
    </div>
  );
};
