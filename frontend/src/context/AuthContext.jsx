import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../services/endpoints';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [companyId, setCompanyId] = useState(localStorage.getItem('companyId'));
  const [companyName, setCompanyName] = useState(localStorage.getItem('companyName'));
  const [companyProfile, setCompanyProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const hydrateAuth = async () => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      try {
        const profile = await getMe();
        setCompanyId(profile.company_id);
        setCompanyName(profile.company_name);
        setCompanyProfile(profile);
        localStorage.setItem('companyId', profile.company_id);
        localStorage.setItem('companyName', profile.company_name);
      } catch (err) {
        console.error('Failed to hydrate auth profile, logging out...', err);
        logout();
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    hydrateAuth();
  }, [token]);

  const login = (newToken, newCompanyId, newCompanyName) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('companyId', newCompanyId);
    localStorage.setItem('companyName', newCompanyName);
    setToken(newToken);
    setCompanyId(newCompanyId);
    setCompanyName(newCompanyName);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('companyId');
    localStorage.removeItem('companyName');
    setToken(null);
    setCompanyId(null);
    setCompanyName(null);
    setCompanyProfile(null);
  };

  const refreshProfile = async () => {
    try {
      const profile = await getMe();
      setCompanyName(profile.company_name);
      setCompanyProfile(profile);
      localStorage.setItem('companyName', profile.company_name);
    } catch (err) {
      console.error('Failed to refresh profile', err);
    }
  };

  return (
    <AuthContext.Provider value={{ token, companyId, companyName, companyProfile, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
