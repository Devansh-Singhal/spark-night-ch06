import React, { useState } from 'react';
import { RecipeVersion, SlotMatch } from '../domain/types';

interface SeamMapProps {
  recipe: RecipeVersion;
  matches?: SlotMatch[];
  selectedSlotId?: string | null;
  onSelectSlot?: (slotId: string | null) => void;
}

export const SeamMap: React.FC<SeamMapProps> = ({
  recipe,
  matches = [],
  selectedSlotId,
  onSelectSlot,
}) => {
  const [showTable, setShowTable] = useState(false);

  return (
    <div className="card" style={{ padding: '1rem', backgroundColor: 'var(--surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Workpiece Seam Map</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            2D schematic coordinates · {recipe.name} ({recipe.jobId})
          </span>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setShowTable((v) => !v)}
          style={{ minHeight: '32px' }}
        >
          {showTable ? 'Show Diagram' : 'Show Seam Table'}
        </button>
      </div>

      {!showTable ? (
        <div style={{ width: '100%', height: '220px', backgroundColor: '#F8FAF9', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', position: 'relative' }}>
          <svg
            viewBox="0 0 100 100"
            style={{ width: '100%', height: '100%', display: 'block' }}
            role="img"
            aria-label={`2D Schematic Seam Map for ${recipe.name}`}
          >
            {/* Outline of workpiece fixture */}
            {recipe.jobId === 'RSB-417' ? (
              // Bracket outline
              <path
                d="M 15 80 L 35 25 L 65 25 L 85 80 L 55 80 L 50 60 L 45 80 Z"
                fill="#EDF1F0"
                stroke="#BCC5C5"
                strokeWidth="1.2"
              />
            ) : (
              // Mounting frame outline
              <g>
                <rect x="15" y="15" width="70" height="70" rx="3" fill="#EDF1F0" stroke="#BCC5C5" strokeWidth="1.2" />
                <rect x="25" y="25" width="50" height="50" rx="2" fill="#F8FAF9" stroke="#BCC5C5" strokeWidth="1" />
              </g>
            )}

            {/* Weld Seams */}
            {recipe.welds.map((slot) => {
              const match = matches.find((m) => m.slot.id === slot.id);
              const isSelected = selectedSlotId === slot.id;

              let strokeColor = '#667785';
              let strokeDash: string | undefined = undefined;
              let strokeWidth = 3.5;

              if (match?.status === 'observed') {
                strokeColor = '#216149'; // ok green
              } else if (match?.status === 'short') {
                strokeColor = '#A12E2A'; // hold red
              } else if (match?.status === 'absent') {
                strokeColor = '#A12E2A';
                strokeDash = '2 1.5';
              }

              if (isSelected) {
                strokeWidth = 5.5;
              }

              const midX = (slot.coordinates.x1 + slot.coordinates.x2) / 2;
              const midY = (slot.coordinates.y1 + slot.coordinates.y2) / 2;

              return (
                <g
                  key={slot.id}
                  onClick={() => onSelectSlot && onSelectSlot(isSelected ? null : slot.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Seam line */}
                  <line
                    x1={slot.coordinates.x1}
                    y1={slot.coordinates.y1}
                    x2={slot.coordinates.x2}
                    y2={slot.coordinates.y2}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={strokeDash}
                  />

                  {/* Slot label tag */}
                  <circle cx={midX} cy={midY - 4} r="3.8" fill={isSelected ? '#114957' : '#FFFFFF'} stroke={strokeColor} strokeWidth="1" />
                  <text
                    x={midX}
                    y={midY - 2.5}
                    fontSize="3.2"
                    fontWeight="bold"
                    fontFamily="var(--font-mono)"
                    fill={isSelected ? '#FFFFFF' : '#19212C'}
                    textAnchor="middle"
                  >
                    {slot.id}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <div className="table-container">
          <table aria-label="Seam Map Details Table">
            <thead>
              <tr>
                <th>Seam</th>
                <th>Description</th>
                <th>Status</th>
                <th>Nominal Dur</th>
                <th>Measured Dur</th>
              </tr>
            </thead>
            <tbody>
              {recipe.welds.map((w) => {
                const match = matches.find((m) => m.slot.id === w.id);
                return (
                  <tr key={w.id} style={{ backgroundColor: selectedSlotId === w.id ? 'var(--action-soft)' : undefined }}>
                    <td className="text-mono"><strong>{w.id}</strong></td>
                    <td>{w.name}</td>
                    <td>
                      {match?.status === 'observed' && <span className="badge badge-ok">Observed</span>}
                      {match?.status === 'short' && <span className="badge badge-hold">Short</span>}
                      {match?.status === 'absent' && <span className="badge badge-hold">Absent</span>}
                      {!match && <span className="badge badge-unknown">Expected</span>}
                    </td>
                    <td className="text-mono">{w.dur.toFixed(2)} s</td>
                    <td className="text-mono">{match?.arc ? `${match.arc.dur.toFixed(2)} s` : '—'}</td>
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
