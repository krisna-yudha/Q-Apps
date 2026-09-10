import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
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

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/splash" replace />;
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

export function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/splash" element={<SplashScreen />} />
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
          <Route path="evaluasi-sampling" element={<QASamplingWorksheet />} />
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

          {/* Backward Compatibility Aliases */}
          <Route path="input-supervisor" element={<Navigate to="/settings" replace />} />
          <Route path="hasil-diskusi" element={<Navigate to="/settings?tab=policy" replace />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
