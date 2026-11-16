import React from 'react';
import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export const NavRail: React.FC = () => {
  const { station, unresolvedCount } = useApp();

  return (
    <nav className="nav-rail no-print" aria-label="Main Navigation Rail">
      <NavLink
        to={`/station/${station.id}`}
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <span>Station</span>
      </NavLink>

      <NavLink
        to="/parts"
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <span>Parts</span>
      </NavLink>

      <NavLink
        to="/alerts"
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <span>Attention</span>
        {unresolvedCount > 0 && (
          <span className="nav-badge" title={`${unresolvedCount} unresolved items`}>
            {unresolvedCount}
          </span>
        )}
      </NavLink>

      <NavLink
        to="/jobs"
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <span>Jobs</span>
      </NavLink>

      <NavLink
        to="/reports"
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <span>Reports</span>
      </NavLink>

      <div className="nav-divider" />

      <NavLink
        to="/setup"
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <span>Setup</span>
      </NavLink>

      <NavLink
        to="/demo"
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <span>Demo & Replay</span>
      </NavLink>

      <div style={{ marginTop: 'auto', padding: '0.5rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
        <div>Source: 50 Hz replay</div>
        <div>Offline PWA v1.0</div>
      </div>
    </nav>
  );
};
