import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRecipeById, saveRecipe } from '../data/db';
import { RecipeVersion } from '../domain/types';
import { SeamMap } from '../components/SeamMap';
import { useApp } from '../context/AppContext';

export const JobDetailPage: React.FC = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { switchRecipe, activeRecipe } = useApp();

  const [recipe, setRecipe] = useState<RecipeVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    if (!jobId || jobId === 'new') {
      // Create new draft template
      setRecipe({
        id: `recipe-custom-${Date.now()}`,
        jobId: 'CUSTOM-01',
        revision: 'r1',
        name: 'Custom Fabricated Assembly',
        sector: 'General fabrication',
        process: 'MIG (GMAW), short-circuit transfer',
        material: 'Structural Steel S275',
        thickness: '3.0 mm',
        wire: '1.0 mm ER70S-6',
        gas: 'Ar/CO₂ 80/20',
        cycleSec: 45,
        durTolerance: 0.20,
        welds: [
          { id: 'W1', name: 'Main joint A', start: 8.0, dur: 3.5, minDur: 2.8, amps: 165, coordinates: { x1: 20, y1: 70, x2: 40, y2: 70 } },
          { id: 'W2', name: 'Main joint B', start: 16.0, dur: 3.5, minDur: 2.8, amps: 165, coordinates: { x1: 60, y1: 70, x2: 80, y2: 70 } },
        ],
        boundaryMethod: 'manual',
        sequencePolicy: 'fixed_ordered',
        restartPolicy: 'exclude_spikes',
        detectorConfig: {
          ampsOn: 40,
          ampsOff: 20,
          minDwell: 0.3,
          sampleHz: 50,
          window: 6,
          watchK: 2,
          adviseK: 4,
          checkMinutes: 3,
        },
        baselineReference: 'baseline-rsb417-v3',
        inspectionReference: 'WPS-REF-01',
        isDraft: true,
        isActive: false,
      });
      setIsEditing(true);
      setLoading(false);
      return;
    }

    getRecipeById(jobId).then((r) => {
      if (r) setRecipe(r);
      setLoading(false);
    });
  }, [jobId]);

  if (loading) return <div style={{ padding: '2rem' }}>Loading recipe details...</div>;
  if (!recipe) return <div style={{ padding: '2rem' }}>Recipe not found.</div>;

  const isCurrentlyActive = recipe.id === activeRecipe.id;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveRecipe(recipe);
    setSavedMsg(true);
    setIsEditing(false);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  const handleActivate = async () => {
    await switchRecipe(recipe.id);
  };

  return (
    <div className="job-detail-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/jobs')}
            style={{ marginBottom: '0.5rem', minHeight: '32px' }}
          >
            ← Back to Recipes
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1>{recipe.name} ({recipe.jobId} {recipe.revision})</h1>
            {isCurrentlyActive && <span className="badge badge-ok">ACTIVE</span>}
          </div>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>
            WPS Reference: {recipe.inspectionReference} · Sector: {recipe.sector}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {!isCurrentlyActive && (
            <button type="button" className="btn btn-primary" onClick={handleActivate}>
              Activate on Station
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsEditing((e) => !e)}
          >
            {isEditing ? 'Cancel Edit' : 'Edit Recipe'}
          </button>
        </div>
      </div>

      {savedMsg && (
        <div className="badge badge-ok" style={{ display: 'block', padding: '0.6rem 1rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
          ✓ Recipe draft saved locally to IndexedDB.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left: Recipe Form / Details */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="job-id">Job Identifier</label>
                <input
                  id="job-id"
                  type="text"
                  value={recipe.jobId}
                  disabled={!isEditing}
                  onChange={(e) => setRecipe({ ...recipe, jobId: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="revision">Revision Reference</label>
                <input
                  id="revision"
                  type="text"
                  value={recipe.revision}
                  disabled={!isEditing}
                  onChange={(e) => setRecipe({ ...recipe, revision: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="part-name">Workpiece Description</label>
              <input
                id="part-name"
                type="text"
                value={recipe.name}
                disabled={!isEditing}
                onChange={(e) => setRecipe({ ...recipe, name: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="process-desc">Process & Transfer Mode</label>
                <input
                  id="process-desc"
                  type="text"
                  value={recipe.process}
                  disabled={!isEditing}
                  onChange={(e) => setRecipe({ ...recipe, process: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="cycle-sec">Cycle Time (seconds)</label>
                <input
                  id="cycle-sec"
                  type="number"
                  value={recipe.cycleSec}
                  disabled={!isEditing}
                  onChange={(e) => setRecipe({ ...recipe, cycleSec: parseFloat(e.target.value) || 45 })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="wire-spec">Wire Specification</label>
                <input
                  id="wire-spec"
                  type="text"
                  value={recipe.wire}
                  disabled={!isEditing}
                  onChange={(e) => setRecipe({ ...recipe, wire: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="gas-spec">Shielding Gas Mix</label>
                <input
                  id="gas-spec"
                  type="text"
                  value={recipe.gas}
                  disabled={!isEditing}
                  onChange={(e) => setRecipe({ ...recipe, gas: e.target.value })}
                />
              </div>
            </div>

            {/* Weld slots table */}
            <div style={{ marginTop: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Weld Slot Sequence</h3>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Slot ID</th>
                      <th>Description</th>
                      <th>Start (s)</th>
                      <th>Nominal Dur (s)</th>
                      <th>Min Dur (80%)</th>
                      <th>Current (A)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipe.welds.map((w) => (
                      <tr key={w.id}>
                        <td className="text-mono"><strong>{w.id}</strong></td>
                        <td>{w.name}</td>
                        <td className="text-mono">{w.start.toFixed(1)}</td>
                        <td className="text-mono">{w.dur.toFixed(2)}</td>
                        <td className="text-mono">{w.minDur.toFixed(2)}</td>
                        <td className="text-mono">{w.amps} A</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {isEditing && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="submit" className="btn btn-primary">
                  Save Recipe Version
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Right: Seam Map Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <SeamMap recipe={recipe} />

          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '0.5rem' }}>Baseline Compatibility</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>
              Linked to baseline: <strong className="text-mono">{recipe.baselineReference}</strong>.
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
              Acoustic monitoring is active only when station hardware and gas/wire matches the approved baseline profile.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
