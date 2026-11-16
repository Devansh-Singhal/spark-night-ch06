import React, { useState } from 'react';
import { Modal } from './Modal';
import { InspectionResult } from '../domain/types';
import { recordInspection } from '../data/db';
import { useApp } from '../context/AppContext';

interface InspectionModalProps {
  isOpen: boolean;
  partId: string;
  displayId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const InspectionModal: React.FC<InspectionModalProps> = ({
  isOpen,
  partId,
  displayId,
  onClose,
  onSuccess,
}) => {
  const { demoRole, refreshState } = useApp();
  const [method, setMethod] = useState('Visual inspection (100% seam coverage)');
  const [result, setResult] = useState<InspectionResult>('accepted');
  const [defectType, setDefectType] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await recordInspection({
        id: `insp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        partAttemptId: partId,
        actor: demoRole === 'operator' ? 'Welding Operator' : 'Quality Supervisor',
        method,
        result,
        defectType: result === 'rejected' ? defectType : undefined,
        notes,
        createdAt: new Date().toISOString(),
      });
      await refreshState();
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to record inspection:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} title={`Record Inspection Feedback: ${displayId}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="method-input">Inspection Method / Procedure Reference</label>
          <select id="method-input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="Visual inspection (100% seam coverage)">Visual inspection (100% seam coverage per WPS)</option>
            <option value="Cut-and-etch macro section (sampled teardown)">Cut-and-etch macro section (sampled teardown)</option>
            <option value="Ultrasonic NDT inspection">Ultrasonic NDT examination</option>
            <option value="Dye penetrant inspection">Dye penetrant crack check</option>
            <option value="Dimensional gauge verification">Dimensional gauge verification</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="result-select">Inspection Result</label>
          <select
            id="result-select"
            value={result}
            onChange={(e) => setResult(e.target.value as InspectionResult)}
            required
          >
            <option value="accepted">Accepted · Joint sound and within specification</option>
            <option value="rejected">Rejected · Visual or internal non-conformance verified</option>
            <option value="inconclusive">Inconclusive · Secondary examination required</option>
          </select>
        </div>

        {result === 'rejected' && (
          <div className="form-group">
            <label htmlFor="defect-type">Established Defect Classification (Inspection-proven only)</label>
            <input
              type="text"
              id="defect-type"
              value={defectType}
              onChange={(e) => setDefectType(e.target.value)}
              placeholder="e.g. Incomplete fusion, missed weld seam, crater cracking..."
              required
            />
            <div className="form-help">
              Note: Record physical inspection findings only. Never derive defect classification from audio drift alone.
            </div>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="notes-field">Inspection Observations / Reference Notes</label>
          <textarea
            id="notes-field"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reference report number, measured throat thickness, or fixture clamp observation..."
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Inspection'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
