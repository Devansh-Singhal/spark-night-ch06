import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getAllParts, exportJsonBackup, importJsonBackup } from '../data/db';
import { PartAttempt } from '../domain/types';
import { downloadFile, generatePartsCsv } from '../data/export';

export const ReportsPage: React.FC = () => {
  const { station, refreshState } = useApp();
  const [parts, setParts] = useState<PartAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  useEffect(() => {
    getAllParts().then((data) => {
      setParts(data);
      setLoading(false);
    });
  }, []);

  // Compute shift summary metrics
  const totalStarted = parts.length;
  const totalCompleted = parts.filter((p) => p.lifecycle === 'completed').length;
  const totalCancelled = parts.filter((p) => p.lifecycle === 'cancelled').length;

  const checksClear = parts.filter((p) => p.ruleFinding === 'clear').length;
  const heldParts = parts.filter((p) => p.ruleFinding === 'missing' || p.ruleFinding === 'short').length;
  const unverifiedParts = parts.filter((p) => p.ruleFinding === 'unverified' || p.currentVerification !== 'valid').length;
  const advisoryEpisodes = parts.filter((p) => p.driftFinding === 'advisory_open').length;

  const inspectionsAccepted = parts.filter((p) => p.inspectionStatus === 'accepted').length;
  const inspectionsRejected = parts.filter((p) => p.inspectionStatus === 'rejected').length;
  const inspectionsInconclusive = parts.filter((p) => p.inspectionStatus === 'inconclusive').length;

  const dispositionsReleased = parts.filter((p) => p.dispositionStatus === 'released').length;
  const dispositionsRework = parts.filter((p) => p.dispositionStatus === 'rework').length;
  const dispositionsScrap = parts.filter((p) => p.dispositionStatus === 'scrap').length;

  const coveragePercent = totalCompleted > 0 ? Math.round(((totalCompleted - unverifiedParts) / totalCompleted) * 100) : 100;

  const handleExportCsv = () => {
    const csv = generatePartsCsv(parts);
    downloadFile(csv, `nabz-shift-report-${station.id}-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleExportJson = async () => {
    const jsonStr = await exportJsonBackup();
    downloadFile(jsonStr, `nabz-backup-${station.id}-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = ev.target?.result as string;
      const res = await importJsonBackup(content);
      setBackupStatus(res.message);
      await refreshState();
      getAllParts().then(setParts);
    };
    reader.readAsText(file);
  };

  return (
    <div className="reports-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1>Station Shift Handover & Quality Report</h1>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>
            Station: <strong>{station.name}</strong> · Timezone: <strong>{station.timezone}</strong> · Source: <strong>Synthetic Replay</strong>
          </p>
        </div>

        <div className="no-print" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            Print Shift Report 🖨
          </button>

          <button type="button" className="btn btn-secondary" onClick={handleExportCsv}>
            Export CSV
          </button>

          <button type="button" className="btn btn-secondary" onClick={handleExportJson}>
            JSON Backup
          </button>

          <label className="btn btn-secondary" style={{ margin: 0, cursor: 'pointer' }}>
            Restore JSON
            <input type="file" accept=".json" onChange={handleImportJson} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {backupStatus && (
        <div className="badge badge-ok" style={{ display: 'block', padding: '0.6rem 1rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {backupStatus}
        </div>
      )}

      {loading ? (
        <p className="text-muted">Loading report records...</p>
      ) : (
        <>
          {/* Metrics Summary Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 650 }}>TOTAL COMPLETED PARTS</div>
              <div style={{ fontSize: '2.0rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--action)' }}>
                {totalCompleted}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                {totalStarted} started · {totalCancelled} cancelled
              </div>
            </div>

            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--ok-ink)', fontWeight: 650 }}>COUNT & DURATION CLEAR</div>
              <div style={{ fontSize: '2.0rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--ok-ink)' }}>
                {checksClear}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                {totalCompleted > 0 ? `${Math.round((checksClear / totalCompleted) * 100)}% of completed` : '—'}
              </div>
            </div>

            <div className="card" style={{ padding: '1rem', backgroundColor: heldParts > 0 ? 'var(--hold-bg)' : undefined }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--hold-ink)', fontWeight: 650 }}>HELD PARTS (MISSING/SHORT)</div>
              <div style={{ fontSize: '2.0rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--hold-ink)' }}>
                {heldParts}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--hold-ink)' }}>
                Segregated per inspection procedure
              </div>
            </div>

            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--unknown-ink)', fontWeight: 650 }}>UNVERIFIED (GAPS/DROPOUTS)</div>
              <div style={{ fontSize: '2.0rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--unknown-ink)' }}>
                {unverifiedParts}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                Telemetry coverage: {coveragePercent}% · Advisories: {advisoryEpisodes}
              </div>
            </div>
          </div>

      {/* Secondary Metrics: Inspections & Dispositions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>Human Inspection Outcomes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Inspections Accepted:</span>
              <strong className="text-mono" style={{ color: 'var(--ok-ink)' }}>{inspectionsAccepted}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Inspections Rejected (Defects Verified):</span>
              <strong className="text-mono" style={{ color: 'var(--hold-ink)' }}>{inspectionsRejected}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Inconclusive / Pending Re-test:</span>
              <strong className="text-mono">{inspectionsInconclusive}</strong>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>Physical Part Dispositions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Released to Next Process:</span>
              <strong className="text-mono" style={{ color: 'var(--ok-ink)' }}>{dispositionsReleased}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Sent to Repair / Rework:</span>
              <strong className="text-mono" style={{ color: 'var(--warn-ink)' }}>{dispositionsRework}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Scrapped / Quarantined:</span>
              <strong className="text-mono" style={{ color: 'var(--hold-ink)' }}>{dispositionsScrap}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Disclosures and Provenance */}
      <div className="card" style={{ padding: '1.25rem', backgroundColor: '#F8FAF9' }}>
        <h4 style={{ fontSize: '0.95rem', marginBottom: '0.4rem' }}>Report Disclosures & Evidence Boundaries</h4>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
          This report compiles deterministic arc-presence rules and acoustic process deviation scores for Station {station.name}. Arc count confirmation indicates that the torch struck the planned number of arcs within cycle timing; it does not replace the manufacturer's qualified welding procedure (WPS) or mandatory NDT examination.
        </p>
      </div>
        </>
      )}
    </div>
  );
};
