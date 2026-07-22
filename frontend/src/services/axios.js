import axios from 'axios';

const instance = axios.create({
  baseURL: 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 Unauthorized
instance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('companyId');
      localStorage.removeItem('companyName');
      
      // Prevent redirect loop if already on auth page or public apply page
      if (!window.location.pathname.includes('/login') && 
          !window.location.pathname.includes('/register') && 
          !window.location.pathname.includes('/apply') &&
          !window.location.pathname.includes('/interview') &&
          !window.location.pathname.includes('/result')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default instance;
