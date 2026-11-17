import React, { useState } from 'react';
import { RecipeVersion, SlotMatch } from '../domain/types';

interface TraceViewProps {
  trace: Float32Array | number[];
  sampleHz: number;
  cycleSec: number;
  recipe: RecipeVersion;
  matches?: SlotMatch[];
  hasGap?: boolean;
  selectedSlotId?: string | null;
  onSelectSlot?: (slotId: string | null) => void;
}

export const TraceView: React.FC<TraceViewProps> = ({
  trace,
  sampleHz,
  cycleSec,
  recipe,
  matches = [],
  hasGap = false,
  selectedSlotId,
  onSelectSlot,
}) => {
  const [showTable, setShowTable] = useState(false);

  // SVG coordinate dimensions
  const width = 800;
  const height = 220;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 25;
  const padBottom = 30;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const maxAmps = 240;

  // Downsample trace for SVG path if trace is large
  const step = Math.max(1, Math.floor(trace.length / 800));
  const points: [number, number][] = [];

  for (let i = 0; i < trace.length; i += step) {
    const tSec = i / sampleHz;
    const x = padLeft + (tSec / cycleSec) * plotWidth;
    const amps = Math.min(maxAmps, Math.max(0, trace[i]));
    const y = padTop + plotHeight - (amps / maxAmps) * plotHeight;
    points.push([x, y]);
  }

  const pathD = points.length > 0 ? `M ${points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L ')}` : '';

  return (
    <div className="card" style={{ padding: '1rem', backgroundColor: 'var(--surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Current Trace & Expected Intervals</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            Clamp current at 50 Hz · Cyan signal vs recipe intervals (A vs s)
          </span>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShowTable((v) => !v)}
          style={{ minHeight: '32px' }}
        >
          {showTable ? 'Show Chart' : 'Show Data Table'}
        </button>
      </div>

      {!showTable ? (
        <div style={{ position: 'relative', width: '100%', overflowX: 'auto', borderRadius: 'var(--radius-md)' }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: '100%', height: 'auto', display: 'block', backgroundColor: 'var(--trace-panel)' }}
            role="img"
            aria-label="Welding current vs time graph with expected interval regions"
          >
            {/* Grid lines */}
            {[0, 60, 120, 180, 240].map((amps) => {
              const y = padTop + plotHeight - (amps / maxAmps) * plotHeight;
              return (
                <g key={amps}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={width - padRight}
                    y2={y}
                    stroke="var(--trace-grid)"
                    strokeWidth="1"
                    strokeDasharray={amps === 0 ? 'none' : '3 3'}
                  />
                  <text
                    x={padLeft - 8}
                    y={y + 4}
                    fill="var(--trace-text)"
                    fontSize="11"
                    fontFamily="var(--font-mono)"
                    textAnchor="end"
                  >
                    {amps} A
                  </text>
                </g>
              );
            })}

            {/* Time Grid lines */}
            {Array.from({ length: Math.floor(cycleSec / 10) + 1 }).map((_, idx) => {
              const sec = idx * 10;
              const x = padLeft + (sec / cycleSec) * plotWidth;
              return (
                <g key={sec}>
                  <line x1={x} y1={padTop} x2={x} y2={padTop + plotHeight} stroke="var(--trace-grid)" strokeWidth="1" />
                  <text
                    x={x}
                    y={height - 10}
                    fill="var(--trace-text)"
                    fontSize="11"
                    fontFamily="var(--font-mono)"
                    textAnchor="middle"
                  >
                    {sec} s
                  </text>
                </g>
              );
            })}

            {/* Expected weld intervals shaded bands */}
            {recipe.welds.map((slot) => {
              const x1 = padLeft + (slot.start / cycleSec) * plotWidth;
              const x2 = padLeft + ((slot.start + slot.dur) / cycleSec) * plotWidth;
              const isSelected = selectedSlotId === slot.id;

              return (
                <g
                  key={slot.id}
                  onClick={() => onSelectSlot && onSelectSlot(isSelected ? null : slot.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={x1}
                    y={padTop}
                    width={x2 - x1}
                    height={plotHeight}
                    fill={isSelected ? 'rgba(156, 228, 229, 0.25)' : 'rgba(255, 255, 255, 0.07)'}
                    stroke={isSelected ? '#9CE4E5' : '#447b85'}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  <text
                    x={(x1 + x2) / 2}
                    y={padTop - 8}
                    fill={isSelected ? '#9CE4E5' : '#8ea1b5'}
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="var(--font-mono)"
                    textAnchor="middle"
                  >
                    {slot.id} ({slot.dur}s)
                  </text>
                </g>
              );
            })}

            {/* Observed intervals tags */}
            {matches.map((m) => {
              if (!m.arc) return null;
              const x1 = padLeft + (m.arc.start / cycleSec) * plotWidth;
              const x2 = padLeft + (m.arc.end / cycleSec) * plotWidth;
              const isShort = m.status === 'short';

              return (
                <g key={`obs-${m.slot.id}`}>
                  {/* Underline bar indicating detected arc pulse */}
                  <rect
                    x={x1}
                    y={padTop + plotHeight - 4}
                    width={Math.max(2, x2 - x1)}
                    height={4}
                    fill={isShort ? '#F2ABA5' : '#9CE4E5'}
                  />
                  <text
                    x={(x1 + x2) / 2}
                    y={padTop + plotHeight + 16}
                    fill={isShort ? '#F2ABA5' : '#9CE4E5'}
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {m.arc.dur.toFixed(2)}s
                  </text>
                </g>
              );
            })}

            {/* Gap zone indicator if present */}
            {hasGap && (
              <g>
                <rect
                  x={padLeft + (15.2 / cycleSec) * plotWidth}
                  y={padTop}
                  width={(2.3 / cycleSec) * plotWidth}
                  height={plotHeight}
                  fill="rgba(161, 46, 42, 0.35)"
                  stroke="#A12E2A"
                  strokeDasharray="4 2"
                />
                <text
                  x={padLeft + (16.35 / cycleSec) * plotWidth}
                  y={padTop + plotHeight / 2}
                  fill="#FBEAE7"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  SENSOR GAP
                </text>
              </g>
            )}

            {/* Current Trace Path */}
            <path d={pathD} fill="none" stroke="var(--signal)" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        </div>
      ) : (
        /* Accessible data table alternative */
        <div className="table-container">
          <table aria-label="Weld Interval Summary Table">
            <thead>
              <tr>
                <th>Slot</th>
                <th>Name</th>
                <th>Nominal Start</th>
                <th>Nominal Duration</th>
                <th>Min Duration</th>
                <th>Measured Duration</th>
                <th>Avg Amps</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recipe.welds.map((slot) => {
                const match = matches.find((m) => m.slot.id === slot.id);
                return (
                  <tr key={slot.id} style={{ backgroundColor: selectedSlotId === slot.id ? 'var(--action-soft)' : undefined }}>
                    <td className="text-mono"><strong>{slot.id}</strong></td>
                    <td>{slot.name}</td>
                    <td className="text-mono">{slot.start.toFixed(1)} s</td>
                    <td className="text-mono">{slot.dur.toFixed(2)} s</td>
                    <td className="text-mono">{slot.minDur.toFixed(2)} s</td>
                    <td className="text-mono">
                      {match?.arc ? `${match.arc.dur.toFixed(2)} s` : '—'}
                    </td>
                    <td className="text-mono">
                      {match?.arc ? `${match.arc.amps.toFixed(1)} A` : '—'}
                    </td>
                    <td>
                      {match?.status === 'observed' && <span className="badge badge-ok">Observed</span>}
                      {match?.status === 'short' && <span className="badge badge-hold">Short</span>}
                      {match?.status === 'absent' && <span className="badge badge-hold">Absent</span>}
                      {!match && <span className="badge badge-unknown">Expected</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
