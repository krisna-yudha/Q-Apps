import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { getStoredToken } from './utils/cookie';
import { Layout } from './components/layout/Layout';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { SplashScreen } from './pages/SplashScreen';
import { Login } from './pages/Login';
import { MainHub } from './pages/MainHub';
import { GlobalDashboard } from './pages/GlobalDashboard';
import { AnevRanking } from './pages/AnevRanking';
import { AgentRecap } from './pages/AgentRecap';
import { QATrainerSampling } from './pages/QATrainerSampling';
import { PolicyRepository } from './pages/PolicyRepository';
import { Settings } from './pages/Settings';
import { UserManagement } from './pages/UserManagement';
import { AutoDistribution } from './pages/AutoDistribution';
import { QASamplingWorksheet } from './pages/QASamplingWorksheet';
import { UnderTeamRekap } from './pages/UnderTeamRekap';
import { NakerHistory } from './pages/NakerHistory';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Supervisor Only Route Guard
const SupervisorRoute = ({ children }) => {
  const { user } = useAuth();
  const isSupervisor = user?.role === 'supervisor' || user?.role === 'admin' || user?.role === 'superadmin';
  if (!isSupervisor) {
    return <Navigate to="/dashboard-global" replace />;
  }
  return children;
};

// Sampling Ticket Route Guard (Only QA Evaluator and Supervisor/Admin)
const SamplingRoute = ({ children }) => {
  const { user } = useAuth();
  const role = user?.role;
  const isSupervisor = role === 'supervisor' || role === 'admin' || role === 'superadmin';
  const isQA = role === 'quality_assurance' || role === 'qa';
  const isTLorTrainer = role === 'team_leader' || role === 'tl' || role === 'trainer';

  if (isTLorTrainer) {
    return <Navigate to="/rekap-under-team" replace />;
  }
  if (!isSupervisor && !isQA) {
    return <Navigate to="/dashboard-global" replace />;
  }
  return children;
};

// Data Master Route Guard (Supervisor, TL, and Trainer)
const DataMasterRoute = ({ children }) => {
  const { user } = useAuth();
  const isSupervisor = user?.role === 'supervisor' || user?.role === 'admin' || user?.role === 'superadmin';
  const isTLorTrainer = user?.role === 'team_leader' || user?.role === 'tl' || user?.role === 'trainer';
  if (!isSupervisor && !isTLorTrainer) {
    return <Navigate to="/dashboard-global" replace />;
  }
  return children;
};

// Under Team Route Guard (TL, Trainer, and Supervisor)
const UnderTeamRoute = ({ children }) => {
  const { user } = useAuth();
  const isSupervisor = user?.role === 'supervisor' || user?.role === 'admin' || user?.role === 'superadmin';
  const isTLorTrainer = user?.role === 'team_leader' || user?.role === 'tl' || user?.role === 'trainer';
  if (!isSupervisor && !isTLorTrainer) {
    return <Navigate to="/dashboard-global" replace />;
  }
  return children;
};

export function App() {
  const { isInitializing } = useAuth();
  const [showSplash, setShowSplash] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.location.pathname === '/splash') {
        return false; // Handled by /splash route
      }
      const splashShown = sessionStorage.getItem('digiqa_splash_shown');
      return !splashShown;
    } catch {
      return false;
    }
  });

  const handleSplashComplete = () => {
    try {
      sessionStorage.setItem('digiqa_splash_shown', 'true');
    } catch (e) {
      console.error(e);
    }
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/splash" element={<SplashScreen onComplete={handleSplashComplete} forceShow />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<MainHub />} />
          <Route path="dashboard-global" element={<GlobalDashboard />} />
          <Route path="anev" element={<AnevRanking />} />
          <Route path="rekap-agent" element={<AgentRecap />} />
          <Route path="pencapaian-qa" element={<QATrainerSampling />} />
          <Route
            path="evaluasi-sampling"
            element={
              <SamplingRoute>
                <QASamplingWorksheet />
              </SamplingRoute>
            }
          />
          <Route
            path="rekap-under-team"
            element={
              <UnderTeamRoute>
                <UnderTeamRekap />
              </UnderTeamRoute>
            }
          />
          <Route path="tim-binaan" element={<Navigate to="/rekap-under-team" replace />} />
          <Route path="kebijakan" element={<PolicyRepository />} />
          <Route
            path="auto-distribution"
            element={
              <SupervisorRoute>
                <AutoDistribution />
              </SupervisorRoute>
            }
          />
          <Route
            path="settings"
            element={
              <SupervisorRoute>
                <Settings />
              </SupervisorRoute>
            }
          />
          <Route
            path="kelola-akun"
            element={
              <SupervisorRoute>
                <UserManagement />
              </SupervisorRoute>
            }
          />
          <Route
            path="riwayat-naker"
            element={
              <SupervisorRoute>
                <NakerHistory />
              </SupervisorRoute>
            }
          />
          <Route path="history-naker" element={<Navigate to="/riwayat-naker" replace />} />

          {/* Backward Compatibility Aliases */}
          <Route path="input-supervisor" element={<Navigate to="/settings?tab=import" replace />} />
          <Route path="hasil-diskusi" element={<Navigate to="/kebijakan" replace />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
