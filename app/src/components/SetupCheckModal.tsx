import React, { useState } from 'react';
import { Modal } from './Modal';
import { SETUP_CHECK_CHECKLIST } from '../domain/baseline';
import { useApp } from '../context/AppContext';
import { recordAction } from '../data/db';

interface SetupCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const SetupCheckModal: React.FC<SetupCheckModalProps> = ({ isOpen, onClose, onComplete }) => {
  const { station, demoRole, refreshState } = useApp();
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [outcome, setOutcome] = useState<'issue_found' | 'nothing_found' | 'inconclusive'>('nothing_found');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await recordAction({
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        actionType: 'complete_setup_check',
        actor: demoRole === 'operator' ? 'Welding Operator' : 'Quality Lead',
        actorRole: demoRole,
        timestamp: new Date().toISOString(),
        details: {
          checkedItems,
          outcome,
          notes,
          stationId: station.id,
        },
      });
      await refreshState();
      onComplete();
      onClose();
    } catch (err) {
      console.error('Failed to save setup check:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} title="Operator Setup Check (3-Minute Inspection)" onClose={onClose}>
      <form onSubmit={handleSave}>
        <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '1rem' }}>
          Sustained acoustic process deviation observed. Complete the standard physical setup checklist before proceeding.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
          {SETUP_CHECK_CHECKLIST.map((item) => (
            <label
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                fontSize: '0.88rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              <input
                type="checkbox"
                checked={!!checkedItems[item.id]}
                onChange={() => toggleCheck(item.id)}
                style={{ marginTop: '0.2rem', width: '18px', height: '18px' }}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>

        <div className="form-group">
          <label htmlFor="outcome-select">Investigation Outcome</label>
          <select
            id="outcome-select"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as any)}
            required
          >
            <option value="nothing_found">Nothing found · Process within spec (e.g. harmless wire lot)</option>
            <option value="issue_found">Physical issue found & corrected (e.g. worn tip replaced, nozzle cleaned)</option>
            <option value="inconclusive">Inconclusive · Will monitor next cycle</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="notes-input">Work Performed / Notes</label>
          <textarea
            id="notes-input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Document observed tip bore condition, wire spool number, or gas flow adjustment..."
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Recording...' : 'Complete Check & Resume'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
