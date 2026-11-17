import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Header } from './components/Header';
import { NavRail } from './components/NavRail';
import { BottomNav } from './components/BottomNav';

import { StationPage } from './pages/StationPage';
import { PartsPage } from './pages/PartsPage';
import { PartDetailPage } from './pages/PartDetailPage';
import { AttentionPage } from './pages/AttentionPage';
import { JobsPage } from './pages/JobsPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { ReportsPage } from './pages/ReportsPage';
import { SetupPage } from './pages/SetupPage';
import { DemoPage } from './pages/DemoPage';

import './styles/global.css';
import './styles/layout.css';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppProvider>
        <div className="app-container">
          <a href="#main-content" className="skip-link">Skip to main content</a>
          <Header />
          <div className="app-body">
            <NavRail />
            <main id="main-content" className="app-content">
              <Routes>
                <Route path="/" element={<StationPage />} />
                <Route path="/station/:stationId" element={<StationPage />} />
                <Route path="/parts" element={<PartsPage />} />
                <Route path="/parts/:partId" element={<PartDetailPage />} />
                <Route path="/alerts" element={<AttentionPage />} />
                <Route path="/jobs" element={<JobsPage />} />
                <Route path="/jobs/:jobId" element={<JobDetailPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/setup" element={<SetupPage />} />
                <Route path="/demo" element={<DemoPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
          <BottomNav />
        </div>
      </AppProvider>
    </BrowserRouter>
  );
};

export default App;
