import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { currentUser, hydrated } = useAuth();

  if (!hydrated) {
    return <div style={{ padding: 40, textAlign: 'center' }}>로딩 중...</div>;
  }
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
