import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

const AuthContext = createContext();
const LOCAL_AUTH_KEY = 'tnc_local_auth_user';

const LOCAL_USERS = {
  admin: {
    password: 'admin1234',
    user: {
      email: 'admin@local',
      full_name: 'ผู้ดูแลระบบ',
      role: 'admin',
    },
  },
  teacher: {
    password: 'teacher1234',
    user: {
      email: 'teacher@local',
      full_name: 'ครูที่ปรึกษา',
      role: 'teacher',
    },
  },
};

const readLocalAuthUser = () => {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const saveLocalAuthUser = (value) => {
  localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(value));
};

const clearLocalAuthUser = () => {
  localStorage.removeItem(LOCAL_AUTH_KEY);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      const localUser = readLocalAuthUser();
      if (localUser) {
        setUser(localUser);
        setIsAuthenticated(true);
        setAuthChecked(true);
        setIsLoadingAuth(false);
        setIsLoadingPublicSettings(false);
        setAuthError(null);
        return;
      }

      setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.
      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId
        },
        token: appParams.token, // Include token if available
        interceptResponses: true
      });
      
      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);
        
        // If we got the app public settings successfully, check if user is authenticated
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Handle app-level errors
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);
      
      // If user auth fails, it might be an expired token
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    clearLocalAuthUser();

    // Always clear local tokens first so logout works even when SDK redirect endpoint
    // is unavailable in local/dev environments.
    try {
      localStorage.removeItem('base44_access_token');
      localStorage.removeItem('token');
      localStorage.removeItem('base44_token');
    } catch {
      // ignore localStorage access errors
    }

    const isLocalHost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const isLocalBase44Url = String(appParams.appBaseUrl || '').includes('localhost');

    // In local/dev environments, skip SDK logout endpoint and just clear local auth state.
    if (!isLocalHost && !isLocalBase44Url && appParams.appBaseUrl) {
      try {
        if (typeof base44?.auth?.logout === 'function') {
          if (shouldRedirect) {
            base44.auth.logout(window.location.href);
          } else {
            base44.auth.logout();
          }
          return;
        }
      } catch (error) {
        console.warn('SDK logout failed, falling back to local logout:', error);
      }
    }

    // Fallback for local/dev: redirect to app root after clearing tokens.
    if (shouldRedirect) {
      window.location.href = '/';
    }
  };

  const navigateToLogin = () => {
    if (!appParams.appBaseUrl) {
      return false;
    }

    // Use the SDK's redirectToLogin method
    base44.auth.redirectToLogin(window.location.href);
    return true;
  };

  const loginWithPassword = (username, password) => {
    const key = String(username || '').trim().toLowerCase();
    const account = LOCAL_USERS[key];

    if (!account || account.password !== password) {
      return false;
    }

    saveLocalAuthUser(account.user);
    setUser(account.user);
    setIsAuthenticated(true);
    setAuthChecked(true);
    setAuthError(null);
    return true;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      loginWithPassword,
      checkUserAuth,
      checkAppState
    }}>
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
