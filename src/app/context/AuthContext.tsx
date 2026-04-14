import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

const AUTH_STORAGE_KEY = 'tennis-app-auth';

interface AuthContextType {
  currentUser: string | null;
  isAdmin: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const savedAuth = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!savedAuth) return;

    try {
      const parsed = JSON.parse(savedAuth) as { currentUser: string | null; isAdmin: boolean };
      if (parsed.currentUser) {
        setCurrentUser(parsed.currentUser);
        setIsAdmin(Boolean(parsed.isAdmin));
      }
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ currentUser, isAdmin })
    );
  }, [currentUser, isAdmin]);

  const normalizeName = (value: string) => value.replace(/\s+/g, '').trim();
  const isMasterName = (value: string) => {
    const normalized = normalizeName(value);
    return normalized === '장두희';
  };

  const login = (username: string, password: string): boolean => {
    const normalized = username.trim();
    if (!normalized || !password) {
      return false;
    }

    setCurrentUser(normalized);
    setIsAdmin(isMasterName(normalized));
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
