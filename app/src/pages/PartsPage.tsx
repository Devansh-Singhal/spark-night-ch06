import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllParts } from '../data/db';
import { PartAttempt } from '../domain/types';
import { downloadFile, generatePartsCsv } from '../data/export';

export const PartsPage: React.FC = () => {
  const navigate = useNavigate();
  const [parts, setParts] = useState<PartAttempt[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [ruleFilter, setRuleFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllParts().then((data) => {
      setParts(data);
      setLoading(false);
    });
  }, []);

  const filteredParts = parts.filter((p) => {
    const matchesSearch =
      searchTerm.trim() === '' ||
      p.displayId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.batchOrOrder && p.batchOrOrder.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRule =
      ruleFilter === 'all' ||
      (ruleFilter === 'hold' && (p.ruleFinding === 'missing' || p.ruleFinding === 'short')) ||
      p.ruleFinding === ruleFilter;

    return matchesSearch && matchesRule;
  });

  const handleExportCsv = () => {
    const csv = generatePartsCsv(filteredParts);
    downloadFile(csv, `nabz-parts-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="parts-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1>Recorded Workpieces & Traceability</h1>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>
            Part passports with complete weld slot verification, acoustic evidence, and inspection history.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleExportCsv}
          disabled={filteredParts.length === 0}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV Summary
        </button>
      </div>

      {/* Filter and Search controls */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        <div style={{ flex: '1 1 250px' }}>
          <label htmlFor="search-parts" className="sr-only">Search parts</label>
          <input
            id="search-parts"
            type="search"
            placeholder="Search by part ID (e.g. RSB-000184) or work order..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label htmlFor="rule-filter" style={{ margin: 0, fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
            Finding:
          </label>
          <select
            id="rule-filter"
            value={ruleFilter}
            onChange={(e) => setRuleFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '150px' }}
          >
            <option value="all">All Findings</option>
            <option value="hold">Held Parts (Missing / Short)</option>
            <option value="clear">Checks Clear</option>
            <option value="unverified">Unverified (Sensor Gap)</option>
            <option value="sequence_review">Sequence Review</option>
          </select>
        </div>
      </div>

      {/* Parts Table */}
      {loading ? (
        <p className="text-muted">Loading recorded parts...</p>
      ) : parts.length === 0 ? (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <h3>No parts recorded yet</h3>
          <p className="text-muted" style={{ margin: '0.5rem 0 1.25rem' }}>
            Open the demo station or select a replay scenario to record parts with deterministic verification evidence.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
            Go to Station
          </button>
        </div>
      ) : filteredParts.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3>No matching parts</h3>
          <p className="text-muted">No parts match the selected search query or finding filter.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setSearchTerm(''); setRuleFilter('all'); }}>
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table aria-label="Recorded Parts List">
            <thead>
              <tr>
                <th>Part Display ID</th>
                <th>Job / Rev</th>
                <th>Completion Time (UTC)</th>
                <th>Rule Finding</th>
                <th>Verification State</th>
                <th>Audio Drift</th>
                <th>Inspection</th>
                <th>Disposition</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredParts.map((p) => {
                let ruleBadge = 'badge-ok';
                if (p.ruleFinding === 'missing' || p.ruleFinding === 'short') ruleBadge = 'badge-hold';
                else if (p.ruleFinding === 'unverified') ruleBadge = 'badge-unknown';
                else if (p.ruleFinding === 'sequence_review') ruleBadge = 'badge-warn';

                return (
                  <tr key={p.id}>
                    <td>
                      <strong className="text-mono" style={{ color: 'var(--action)', fontSize: '0.95rem' }}>
                        {p.displayId}
                      </strong>
                    </td>
                    <td>
                      {p.recipeId.includes('fab') ? 'FAB-206' : 'RSB-417'} {p.recipeVersion}
                    </td>
                    <td className="text-mono" style={{ fontSize: '0.85rem' }}>
                      {p.endedAt ? new Date(p.endedAt).toLocaleTimeString() : 'In progress'}
                    </td>
                    <td>
                      <span className={`badge ${ruleBadge}`}>
                        {p.ruleFinding.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${p.currentVerification === 'valid' ? 'badge-ok' : 'badge-unknown'}`}>
                        {p.currentVerification}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${p.driftFinding === 'advisory_open' ? 'badge-warn' : 'badge-ok'}`}>
                        {p.driftFinding === 'advisory_open' ? 'Advisory' : 'Normal'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${p.inspectionStatus === 'accepted' ? 'badge-ok' : p.inspectionStatus === 'rejected' ? 'badge-hold' : 'badge-unknown'}`}>
                        {p.inspectionStatus}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${p.dispositionStatus === 'released' ? 'badge-ok' : p.dispositionStatus === 'scrap' || p.dispositionStatus === 'rework' ? 'badge-hold' : 'badge-unknown'}`}>
                        {p.dispositionStatus}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(`/parts/${p.id}`)}
                        style={{ minHeight: '32px', padding: '0.25rem 0.65rem' }}
                      >
                        Passport ↗
                      </button>
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
