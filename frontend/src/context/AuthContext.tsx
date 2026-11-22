import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export type Role = 'ADMIN' | 'CUSTOMER' | 'TECHNICIAN';

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  phone?: string;
  address?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginWithGoogle: (credential: string) => Promise<User>;
  register: (data: any) => Promise<User>;
  updateProfile: (data: { fullName: string; phone: string; address: string }) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('solarops_token'));
  const [isLoading, setIsLoading] = useState(true);

  // Validate session on load
  useEffect(() => {
    async function loadUser() {
      const storedToken = localStorage.getItem('solarops_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.auth.me();
        if (response.success && response.user) {
          setUser(response.user);
        } else {
          localStorage.removeItem('solarops_token');
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.warn('Session verification failed, logging out:', err);
        localStorage.removeItem('solarops_token');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await api.auth.login({ email, password });
    localStorage.setItem('solarops_token', res.token);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const loginWithGoogle = async (credential: string): Promise<User> => {
    const res = await api.auth.googleLogin(credential);
    localStorage.setItem('solarops_token', res.token);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const register = async (data: any): Promise<User> => {
    const res = await api.auth.register(data);
    localStorage.setItem('solarops_token', res.token);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const updateProfile = async (data: { fullName: string; phone: string; address: string }): Promise<User> => {
    const res = await api.auth.updateProfile(data);
    setUser((current) => current ? { ...current, ...res.user } : res.user);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem('solarops_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, loginWithGoogle, register, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
