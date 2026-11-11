import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { UserSummary } from '@tenants/shared-types';
import { useMobileAuthService } from './MobileServicesContext';

interface MobileAuthContextValue {
  user: UserSummary | null;
  isRestoring: boolean;
  login: (email: string, password: string) => Promise<UserSummary>;
  logout: () => Promise<void>;
}

const MobileAuthContext = createContext<MobileAuthContextValue | null>(null);

export const MobileAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authService = useMobileAuthService();
  const [user, setUser] = useState<UserSummary | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    let active = true;
    authService
      .restoreSession()
      .then((restored) => {
        if (active) setUser(restored);
      })
      .finally(() => {
        if (active) setIsRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [authService]);

  const login = useCallback(
    async (email: string, password: string) => {
      const signedIn = await authService.login(email, password);
      setUser(signedIn);
      return signedIn;
    },
    [authService]
  );

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, [authService]);

  return (
    <MobileAuthContext.Provider value={{ user, isRestoring, login, logout }}>
      {children}
    </MobileAuthContext.Provider>
  );
};

export function useMobileAuth(): MobileAuthContextValue {
  const ctx = useContext(MobileAuthContext);
  if (!ctx) {
    throw new Error('useMobileAuth must be used inside MobileAuthProvider');
  }
  return ctx;
}

