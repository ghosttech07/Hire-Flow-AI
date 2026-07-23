import api from './axios';
import axios from 'axios';

const BACKEND_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'https://hire-flow-ai.onrender.com').replace(/\/$/, '');

// Auth endpoints
export const registerCompany = (data) => api.post('/api/auth/register', data).then(res => res.data);
export const verifyOtp = (data) => api.post('/api/auth/verify-otp', data).then(res => res.data);
export const resendOtp = (data) => api.post('/api/auth/resend-otp', data).then(res => res.data);
export const loginCompany = (data) => api.post('/api/auth/login', data).then(res => res.data);
export const googleAuth = (token) => {
  console.log("📡 CALLING BACKEND...");
  return axios.post(`${BACKEND_URL}/api/auth/google`, { token });
};
export const getMe = () => api.get('/api/auth/me').then(res => res.data);
export const updateProfile = (data) => api.put('/api/auth/profile', data).then(res => res.data);
export const getDashboardStats = () => api.get('/api/dashboard-stats').then(res => res.data);
export const setPassword = (password) => api.post('/api/auth/set-password', { password }).then(res => res.data);
export const changePassword = (data) => api.post('/api/auth/change-password', data).then(res => res.data);

// Jobs endpoints
export const listJobs = () => api.get('/api/jobs/').then(res => res.data);
export const createJob = (data) => api.post('/api/jobs/', data).then(res => res.data);
export const parseJob = (data) => api.post('/api/jobs/parse', data).then(res => res.data);
export const getJob = (jobId) => api.get(`/api/jobs/${jobId}`).then(res => res.data);
export const updateJobStatus = (jobId, status) => api.patch(`/api/jobs/${jobId}/status`, { status }).then(res => res.data);
export const deleteJob = (jobId) => api.delete(`/api/jobs/${jobId}`).then(res => res.data);

// Candidates endpoints
export const listCandidates = (jobId) => api.get(`/api/jobs/${jobId}/candidates`).then(res => res.data);
export const screenCandidate = (jobId, data) => api.post(`/api/jobs/${jobId}/candidates/screen`, data).then(res => res.data);
export const getCandidate = (candidateId) => api.get(`/api/jobs/candidates/${candidateId}`).then(res => res.data);
export const shortlistCandidate = (jobId, candidateId, data = {}) => api.post(`/api/jobs/${jobId}/candidates/${candidateId}/shortlist`, data).then(res => res.data);
export const evaluateAnswer = (jobId, candidateId, data) => api.post(`/api/jobs/${jobId}/candidates/${candidateId}/evaluate`, data).then(res => res.data);
export const getCandidateEvaluations = (jobId, candidateId) => api.get(`/api/jobs/${jobId}/candidates/${candidateId}/evaluations`).then(res => res.data);
export const scheduleCandidate = (jobId, candidateId) => api.post(`/api/jobs/${jobId}/candidates/${candidateId}/schedule`).then(res => res.data);

// Public Apply endpoints
export const getPublicJobInfo = (jobId) => api.get(`/api/apply/${jobId}`).then(res => res.data);
export const submitApplication = (jobId, formData) => api.post(`/api/apply/${jobId}/submit`, formData, {
  headers: {
    'Content-Type': 'multipart/form-data'
  }
}).then(res => res.data);

// Public Interview endpoints
export const getInterviewSession = (token) => api.get(`/api/interview/${token}`).then(res => res.data);
export const submitInterviewAnswer = (token, data) => api.post(`/api/interview/${token}/answer`, data).then(res => res.data);
export const getInterviewResult = (token) => api.get(`/api/result/${token}`).then(res => res.data);

