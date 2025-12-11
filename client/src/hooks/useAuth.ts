import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';

export interface User {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
  loginMethod: string | null;
}

export function useAuth() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('auth_token');
  });

  // Query para obter dados do usuário via token JWT
  const { data: user, isLoading, error } = trpc.auth.me.useQuery(
    { token: token || '' },
    {
      enabled: !!token,
      retry: false,
      onError: () => {
        // Token inválido ou expirado, limpar e redirecionar
        localStorage.removeItem('auth_token');
        setToken(null);
      },
    }
  );

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setLocation('/login');
  };

  const isAuthenticated = !!user && !!token;

  return {
    user: user || null,
    loading: isLoading,
    error: error?.message || null,
    isAuthenticated,
    logout,
    token,
  };
}
