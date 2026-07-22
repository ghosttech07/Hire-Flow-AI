import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="error-screen" style={{ minHeight: '100vh', background: 'var(--bg-darker)' }}>
      <h1 className="sidebar-title" style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>404</h1>
      <h2>Page Not Found</h2>
      <p className="auth-subtitle" style={{ marginBottom: '2rem' }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to="/dashboard" className="btn btn-primary">
        Back to Dashboard
      </Link>
    </div>
  );
};

export default NotFound;
