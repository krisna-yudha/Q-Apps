import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { SplashScreen } from './pages/SplashScreen';
import { Login } from './pages/Login';
import { MainHub } from './pages/MainHub';
import { GlobalDashboard } from './pages/GlobalDashboard';
import { AnevRanking } from './pages/AnevRanking';
import { AgentRecap } from './pages/AgentRecap';
import { QATrainerSampling } from './pages/QATrainerSampling';
import { PolicyRepository } from './pages/PolicyRepository';
import { SupervisorInput } from './pages/SupervisorInput';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/splash" replace />;
  }
  return children;
};

export function App() {
  return (
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
        <Route path="hasil-diskusi" element={<PolicyRepository />} />
        <Route path="input-supervisor" element={<SupervisorInput />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
