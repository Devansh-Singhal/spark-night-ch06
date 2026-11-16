import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { DemoRole } from '../domain/types';

export const Header: React.FC = () => {
  const { station, activeRecipe, demoRole, setDemoRole } = useApp();

  return (
    <header className="app-header no-print" role="banner">
      <div className="header-brand">
        <Link to={`/station/${station.id}`} className="brand-title" aria-label="Nabz Home">
          <svg width="22" height="22" viewBox="0 0 64 64" fill="none" style={{ verticalAlign: 'middle', marginRight: 6 }}>
            <rect width="64" height="64" rx="14" fill="#114957"/>
            <path d="M 8 36 L 22 36 L 27 20 L 33 46 L 39 30 L 43 36 L 56 36" stroke="#9CE4E5" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          NABZ
        </Link>
        <div className="brand-meta">
          <strong>{station.name}</strong>
          <span>/</span>
          <span>{activeRecipe.jobId} {activeRecipe.revision}</span>
          <span>·</span>
          <span className="text-muted">{station.workshopName}</span>
        </div>
      </div>

      <div className="header-status-strip">
        <span className="badge badge-provenance" title="This environment runs on synthetic reproducible telemetry">
          SYNTHETIC REPLAY
        </span>

        <span className="badge badge-ok" title="IndexedDB persistence and cached offline shell ready">
          ● Saved locally
        </span>

        {/* Demo role selector */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <label htmlFor="role-select" className="sr-only">Demo Role</label>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Demo role:</span>
          <select
            id="role-select"
            value={demoRole}
            onChange={(e) => setDemoRole(e.target.value as DemoRole)}
            style={{
              padding: '0.25rem 0.5rem',
              minHeight: '34px',
              fontSize: '0.82rem',
              width: 'auto',
              borderRadius: 'var(--radius-sm)',
              borderColor: 'var(--line)',
              backgroundColor: 'var(--action-soft)',
              color: 'var(--action)',
              fontWeight: 650,
            }}
          >
            <option value="operator">Operator</option>
            <option value="supervisor">Quality Lead / Supervisor</option>
            <option value="production_lead">Workshop Owner</option>
            <option value="technical_team">Installer / Tech Team</option>
          </select>
        </div>
      </div>
    </header>
  );
};
