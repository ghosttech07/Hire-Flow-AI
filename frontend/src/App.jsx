import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import ApplyPage from './pages/ApplyPage';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import JobsPage from './pages/JobsPage';
import JobDetailPage from './pages/JobDetailPage';
import CandidateReportPage from './pages/CandidateReportPage';
import CandidatePipeline from './pages/CandidatePipeline';
import Settings from './pages/Settings';
import InterviewPage from './pages/InterviewPage';
import ResultPage from './pages/ResultPage';
import NotFound from './pages/NotFound';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/apply/:jobId" element={<ApplyPage />} />
      <Route path="/interview/:token" element={<InterviewPage />} />
      <Route path="/result/:token" element={<ResultPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Navigate to="jobs" replace />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="jobs/:jobId" element={<JobDetailPage />} />
          <Route path="jobs/:jobId/candidates/:candidateId" element={<CandidateReportPage />} />
          <Route path="candidates" element={<CandidatePipeline />} />
          <Route path="analytics" element={<DashboardHome />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
