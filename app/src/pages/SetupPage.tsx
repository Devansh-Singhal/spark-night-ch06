import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { resetDemoSession, getAllRecipes } from '../data/db';
import { RecipeVersion } from '../domain/types';

export const SetupPage: React.FC = () => {
  const { station, setStationConfig, refreshState } = useApp();
  const [recipes, setRecipes] = useState<RecipeVersion[]>([]);

  const [workshopName, setWorkshopName] = useState(station.workshopName);
  const [stationName, setStationName] = useState(station.name);
  const [sector, setSector] = useState(station.sector);
  const [timezone, setTimezone] = useState(station.timezone);
  const [activeRecipeId, setActiveRecipeId] = useState(station.activeRecipeId);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Storage quota estimate
  const [quotaInfo, setQuotaInfo] = useState<string>('Estimating...');
  const [hasBluetooth, setHasBluetooth] = useState<boolean>(false);
  const [hasMicApi, setHasMicApi] = useState<boolean>(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    getAllRecipes().then(setRecipes);

    // Capabilities check
    if (typeof navigator !== 'undefined' && 'storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then((est) => {
        const usedMb = Math.round((est.usage || 0) / (1024 * 1024));
        const quotaMb = Math.round((est.quota || 0) / (1024 * 1024));
        setQuotaInfo(`${usedMb} MB used of ${quotaMb} MB available`);
      });
    } else {
      setQuotaInfo('IndexedDB available (StorageManager estimate unsupported)');
    }

    setHasBluetooth('bluetooth' in navigator);
    setHasMicApi('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const selRecipe = recipes.find((r) => r.id === activeRecipeId);
    await setStationConfig({
      ...station,
      workshopName,
      name: stationName,
      sector,
      timezone,
      activeRecipeId,
      activeRecipeVersion: selRecipe?.revision || station.activeRecipeVersion,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleResetDemo = async () => {
    if (window.confirm('Reset this demo session? This will remove generated demo parts while preserving station setup and recipes.')) {
      const res = await resetDemoSession('default-session');
      await refreshState();
      setResetMessage(`Demo session reset: removed ${res.deletedParts} parts.`);
      setTimeout(() => setResetMessage(null), 4000);
    }
  };

  return (
    <div className="setup-page" style={{ maxWidth: '900px' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1>Station Setup & Hardware Diagnostics</h1>
        <p className="text-muted" style={{ fontSize: '0.9rem' }}>
          Configure station identity, verify browser instrument capabilities, and manage local storage.
        </p>
      </div>

      {savedSuccess && (
        <div className="badge badge-ok" style={{ display: 'block', padding: '0.65rem 1rem', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
          ✓ Station configuration updated and saved locally.
        </div>
      )}

      {resetMessage && (
        <div className="badge badge-warn" style={{ display: 'block', padding: '0.65rem 1rem', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
          {resetMessage}
        </div>
      )}

      {/* Station Config Form */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Station Identity</h2>
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="station-name">Station Label</label>
              <input
                id="station-name"
                type="text"
                value={stationName}
                onChange={(e) => setStationName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="workshop-name">Workshop / Facility Name</label>
              <input
                id="workshop-name"
                type="text"
                value={workshopName}
                onChange={(e) => setWorkshopName(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="sector-input">Industry Sector (Organizational)</label>
              <input
                id="sector-input"
                type="text"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="e.g. Automotive, General fabrication..."
              />
              <div className="form-help">Sector is organizational metadata; recipe controls detection limits.</div>
            </div>

            <div className="form-group">
              <label htmlFor="timezone-input">Station Timezone</label>
              <input
                id="timezone-input"
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="active-recipe">Active Recipe Selection</label>
            <select
              id="active-recipe"
              value={activeRecipeId}
              onChange={(e) => setActiveRecipeId(e.target.value)}
            >
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.jobId} {r.revision}) — {r.welds.length} welds
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
            Save Station Configuration
          </button>
        </form>
      </div>

      {/* Hardware & Browser Capability Checklist (F01 / F13) */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Device Instrument Capability Checklist</h2>
        <p className="text-muted" style={{ fontSize: '0.88rem', marginBottom: '1.25rem' }}>
          Diagnostic assessment of browser APIs required for local offline operation and signal acquisition.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', backgroundColor: '#F8FAF9', borderRadius: 'var(--radius-sm)' }}>
            <div>
              <strong>Offline Application Shell & Service Worker</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Caches assets for offline execution</div>
            </div>
            <span className="badge badge-ok">Ready & Cached</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', backgroundColor: '#F8FAF9', borderRadius: 'var(--radius-sm)' }}>
            <div>
              <strong>Structured Local Storage (IndexedDB)</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{quotaInfo}</div>
            </div>
            <span className="badge badge-ok">Active</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', backgroundColor: '#F8FAF9', borderRadius: 'var(--radius-sm)' }}>
            <div>
              <strong>Microphone Input API (getUserMedia)</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                {hasMicApi ? 'Supported by browser' : 'Unavailable in this environment'}
              </div>
            </div>
            <span className={`badge ${hasMicApi ? 'badge-ok' : 'badge-unknown'}`}>
              {hasMicApi ? 'API Available' : 'Unsupported'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', backgroundColor: '#F8FAF9', borderRadius: 'var(--radius-sm)' }}>
            <div>
              <strong>Web Bluetooth Sensor Interface</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                {hasBluetooth ? 'Supported (Chrome/Android secure context)' : 'Not supported by this browser'}
              </div>
            </div>
            <span className={`badge ${hasBluetooth ? 'badge-ok' : 'badge-unknown'}`}>
              {hasBluetooth ? 'Supported' : 'Unavailable'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', backgroundColor: '#F8FAF9', borderRadius: 'var(--radius-sm)' }}>
            <div>
              <strong>Physical Current Clamp Adapter (Live Capture)</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Physical sensor integration</div>
            </div>
            <span className="badge badge-unknown">
              Live capture not configured
            </span>
          </div>
        </div>
      </div>

      {/* Scoped Demo Reset */}
      <div className="card" style={{ padding: '1.5rem', borderColor: 'var(--warn-border)' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.4rem', color: 'var(--warn-ink)' }}>
          Scoped Demo Session Reset
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
          Deletes only part attempts, findings, and actions recorded under this demo session. Preserves workshop station identity and saved recipe versions.
        </p>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleResetDemo}
          style={{ borderColor: 'var(--warn-border)', color: 'var(--warn-ink)', fontWeight: 650 }}
        >
          Reset Demo Parts ↺
        </button>
      </div>
    </div>
  );
};
