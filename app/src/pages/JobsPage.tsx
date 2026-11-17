import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllRecipes } from '../data/db';
import { RecipeVersion } from '../domain/types';
import { useApp } from '../context/AppContext';

export const JobsPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeRecipe, switchRecipe } = useApp();
  const [recipes, setRecipes] = useState<RecipeVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllRecipes().then((data) => {
      setRecipes(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="jobs-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1>WPS Recipes & Workpiece Templates</h1>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>
            Versioned welding parameter recipes, expected seam arrays, and baseline compatibility.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate('/jobs/new')}
        >
          + Create Recipe Draft
        </button>
      </div>

      {loading ? (
        <p className="text-muted">Loading recipes...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {recipes.map((r) => {
            const isCurrentlyActive = r.id === activeRecipe.id;

            return (
              <div
                key={r.id}
                className="card"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderWidth: isCurrentlyActive ? 2 : 1,
                  borderColor: isCurrentlyActive ? 'var(--action)' : 'var(--line)',
                  backgroundColor: isCurrentlyActive ? '#FAFCFC' : 'var(--surface)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span className="badge badge-provenance">
                      {r.sector || 'General fabrication'}
                    </span>
                    {isCurrentlyActive && (
                      <span className="badge badge-ok">
                        ACTIVE ON STATION
                      </span>
                    )}
                  </div>

                  <h2 style={{ fontSize: '1.3rem', marginBottom: '0.3rem' }}>
                    {r.name}
                  </h2>
                  <div className="text-mono" style={{ fontSize: '0.9rem', color: 'var(--action)', fontWeight: 700, marginBottom: '0.75rem' }}>
                    Job ID: {r.jobId} (Rev {r.revision})
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
                    {r.process} · {r.material} ({r.thickness})
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.85rem', padding: '0.65rem', backgroundColor: 'var(--paper)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem' }}>
                    <div>Cycle Time: <strong>{r.cycleSec} s</strong></div>
                    <div>Weld Slots: <strong>{r.welds.length} seams</strong></div>
                    <div>Tolerance: <strong>{(r.durTolerance * 100).toFixed(0)}% min</strong></div>
                    <div>Baseline: <strong>{r.baselineReference}</strong></div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', marginTop: 'auto' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate(`/jobs/${r.id}`)}
                    style={{ flex: 1 }}
                  >
                    View Details & Slots
                  </button>

                  {!isCurrentlyActive && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => switchRecipe(r.id)}
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
