import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { REPLAY_SCENARIOS } from '../replay/scenarios';

export const DemoPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentReplayScenarioId, selectReplayScenario } = useApp();

  const handleLaunchScenario = (id: string) => {
    selectReplayScenario(id);
    navigate('/');
  };

  return (
    <div className="demo-page" style={{ maxWidth: '1000px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1>Interactive Replay & Hackathon Stage Path</h1>
        <p className="text-muted" style={{ fontSize: '0.95rem' }}>
          Demonstrate Nabz behavior deterministically without needing an electric arc, live sensor, or network connection.
        </p>
      </div>

      {/* 3-Minute Stage Demo Script (Section 14.1) */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', backgroundColor: '#F8FAF9' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--action)' }}>
          3-Minute Hackathon Stage Walkthrough
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
          <div style={{ padding: '0.6rem', borderLeft: '3px solid var(--action)', backgroundColor: 'var(--surface)' }}>
            <strong>0:00–0:20 · Missing Arc Action</strong>
            <p className="text-muted" style={{ margin: '0.2rem 0 0' }}>
              Select <strong>Bracket: Missed Weld (0184)</strong>. Show the large red instruction: "3 of 4 arc events observed. Hold part RSB-000184."
            </p>
          </div>

          <div style={{ padding: '0.6rem', borderLeft: '3px solid var(--action)', backgroundColor: 'var(--surface)' }}>
            <strong>0:20–0:45 · Explainable Evidence</strong>
            <p className="text-muted" style={{ margin: '0.2rem 0 0' }}>
              Click <strong>View Evidence</strong> to open the Part Passport. Show W3 absent on the seam map and current trace.
            </p>
          </div>

          <div style={{ padding: '0.6rem', borderLeft: '3px solid var(--action)', backgroundColor: 'var(--surface)' }}>
            <strong>0:45–1:10 · Record Loop & Traceability</strong>
            <p className="text-muted" style={{ margin: '0.2rem 0 0' }}>
              Click <strong>Record Inspection</strong> (Rejected: Missed seam), then <strong>Record Disposition</strong> (Rework). Refresh the page to prove local persistence!
            </p>
          </div>

          <div style={{ padding: '0.6rem', borderLeft: '3px solid var(--action)', backgroundColor: 'var(--surface)' }}>
            <strong>1:10–1:35 · Sustained Drift & Setup Check</strong>
            <p className="text-muted" style={{ margin: '0.2rem 0 0' }}>
              Select <strong>Wire Lot Shift</strong>. Show amber advisory: "Check setup." Open the 3-minute checklist and complete "nothing found."
            </p>
          </div>

          <div style={{ padding: '0.6rem', borderLeft: '3px solid var(--action)', backgroundColor: 'var(--surface)' }}>
            <strong>1:35–2:00 · Dropout vs Missing Arc</strong>
            <p className="text-muted" style={{ margin: '0.2rem 0 0' }}>
              Select <strong>Current Sensor Dropout</strong>. Emphasize that lost signal becomes "Verification incomplete", never a false 0-weld assertion.
            </p>
          </div>

          <div style={{ padding: '0.6rem', borderLeft: '3px solid var(--action)', backgroundColor: 'var(--surface)' }}>
            <strong>2:00–2:30 · Non-Automotive General Fabrication</strong>
            <p className="text-muted" style={{ margin: '0.2rem 0 0' }}>
              Select <strong>Mounting Frame (6 Welds)</strong>. Demonstrate that the app is sector-neutral with an actual 6-slot fixture recipe!
            </p>
          </div>
        </div>
      </div>

      {/* Scenario Catalog */}
      <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Deterministic Replay Scenarios</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {REPLAY_SCENARIOS.map((scn) => {
          const isCurrent = scn.id === currentReplayScenarioId;
          let badge = 'badge-ok';
          if (scn.expectedResult === 'hold') badge = 'badge-hold';
          else if (scn.expectedResult === 'unverified') badge = 'badge-unknown';
          else if (scn.expectedResult === 'advisory' || scn.expectedResult === 'sequence_review') badge = 'badge-warn';

          return (
            <div
              key={scn.id}
              className="card"
              style={{
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderWidth: isCurrent ? 2 : 1,
                borderColor: isCurrent ? 'var(--action)' : 'var(--line)',
                backgroundColor: isCurrent ? '#FAFCFC' : 'var(--surface)',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span className={`badge ${badge}`}>
                    {scn.expectedResult.toUpperCase()}
                  </span>
                  <span className="text-mono" style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                    {scn.recipe.jobId}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem' }}>{scn.name}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--ink)', marginBottom: '0.6rem' }}>
                  {scn.description}
                </p>

                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', padding: '0.5rem', backgroundColor: 'var(--paper)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
                  <strong>Ground Truth:</strong> {scn.truthExplanation}
                </div>
              </div>

              <button
                type="button"
                className={`btn ${isCurrent ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => handleLaunchScenario(scn.id)}
              >
                {isCurrent ? 'Current Station Scenario' : 'Load Scenario & Go to Station →'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Link to 3D CAD Station Simulator */}
      <div className="card" style={{ padding: '1.25rem', backgroundColor: '#EDF4F4', borderColor: '#b8d6d7' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--action)', margin: 0 }}>
              Want to see the physical station in 3D?
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0.2rem 0 0' }}>
              Open the CAD 3D fixture station with real-time torch kinematic animation and spark simulation.
            </p>
          </div>

          <a href="/sim/" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ backgroundColor: '#FFFFFF' }}>
            Open 3D Simulator ↗
          </a>
        </div>
      </div>
    </div>
  );
};
