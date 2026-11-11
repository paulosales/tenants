import React, { createContext, useCallback, useContext, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserSummary } from '@tenants/shared-types';
import { useAuthGateway } from './ApiContext';

interface AuthContextValue {
  user: UserSummary | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<UserSummary>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authGateway = useAuthGateway();
  const queryClient = useQueryClient();
  const [explicitUser, setExplicitUser] = useState<UserSummary | null | undefined>(undefined);

  const {
    data: sessionUser,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['auth-me'],
    queryFn: async () => {
      try {
        return await authGateway.getCurrentUser();
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 60 * 1000,
  });

  const user = explicitUser !== undefined ? explicitUser : sessionUser ?? null;

  const login = useCallback(
    async (email: string, password: string): Promise<UserSummary> => {
      const response = await authGateway.login(email, password);
      setExplicitUser(response.user);
      queryClient.setQueryData(['auth-me'], response.user);
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      return response.user;
    },
    [authGateway, queryClient]
  );

  const logout = useCallback(async () => {
    try {
      await authGateway.logout();
    } finally {
      setExplicitUser(null);
      queryClient.setQueryData(['auth-me'], null);
      queryClient.clear();
    }
  }, [authGateway, queryClient]);

  const refreshUser = useCallback(async () => {
    setExplicitUser(undefined);
    await refetch();
  }, [refetch]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading: isLoading && explicitUser === undefined,
        isAuthenticated: Boolean(user),
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

