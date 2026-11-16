import React, { useState } from 'react';
import { Modal } from './Modal';
import { DispositionDecision } from '../domain/types';
import { recordDisposition } from '../data/db';
import { useApp } from '../context/AppContext';

interface DispositionModalProps {
  isOpen: boolean;
  partId: string;
  displayId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const DispositionModal: React.FC<DispositionModalProps> = ({
  isOpen,
  partId,
  displayId,
  onClose,
  onSuccess,
}) => {
  const { demoRole, refreshState } = useApp();
  const [decision, setDecision] = useState<DispositionDecision>('rework');
  const [reason, setReason] = useState('');
  const [inspectionRef, setInspectionRef] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await recordDisposition({
        id: `disp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        partAttemptId: partId,
        actor: demoRole === 'supervisor' ? 'Quality Lead' : 'Plant Supervisor',
        decision,
        reason,
        inspectionRef: inspectionRef || undefined,
        createdAt: new Date().toISOString(),
      });
      await refreshState();
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to record disposition:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} title={`Record Final Disposition: ${displayId}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="decision-select">Quality Disposition Decision</label>
          <select
            id="decision-select"
            value={decision}
            onChange={(e) => setDecision(e.target.value as DispositionDecision)}
            required
          >
            <option value="rework">Rework · Route to repair station for secondary weld pass</option>
            <option value="scrap">Scrap · Workpiece rejected and quarantined for disposal</option>
            <option value="released">Release · Authorized release to next manufacturing operation</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="reason-field">Disposition Justification / Decision Reason</label>
          <textarea
            id="reason-field"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Document engineering justification, rework procedure number, or scrap authorization..."
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="ref-field">Inspection Procedure / Sign-off Reference</label>
          <input
            type="text"
            id="ref-field"
            value={inspectionRef}
            onChange={(e) => setInspectionRef(e.target.value)}
            placeholder="e.g. NCR-2026-0814 / Sign-off QA-104"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Recording...' : 'Authorize Disposition'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
