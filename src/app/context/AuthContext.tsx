import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

const AUTH_STORAGE_KEY = 'tennis-app-auth';

import type { User } from '../data/mockData.js';
interface AuthContextType {
  currentUser: string | null;
  isAdmin: boolean;
  login: (user: User | null, password: string) => boolean;
  logout: () => void;
  hydrated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);



import { useAppData } from './AppDataContext.js';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const { getUserByName } = useAppData();

  useEffect(() => {
    const savedAuth = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!savedAuth) {
      setHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(savedAuth) as { currentUser: string | null; isAdmin: boolean };
      if (parsed.currentUser) {
        setCurrentUser(parsed.currentUser);
        setIsAdmin(Boolean(parsed.isAdmin));
      }
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } finally {
      setHydrated(true);
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

  const login = (user: User | null, password: string): boolean => {
    console.log('[AuthContext] login called', user, password);
    if (!user || !password || !user.phoneLast4) {
      console.log('[AuthContext] login fail: missing user or phoneLast4');
      return false;
    }
    if (user.phoneLast4 !== password) {
      console.log('[AuthContext] login fail: phoneLast4 mismatch');
      return false;
    }
    setCurrentUser(user.name);
    setIsAdmin(isMasterName(user.name));
    console.log('[AuthContext] login success', user.name);
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAdmin, login, logout, hydrated }}>
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
