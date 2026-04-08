import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, LoginRequest, login as apiLogin, logout as apiLogout, getCurrentUser, isAuthenticated, getToken } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  // Initialize auth state on mount
  useEffect(() => {
    if (isAuthenticated() && getToken()) {
      const currentUser = getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setAuthenticated(true);
      } else {
        // Token exists but user data is missing, clear everything
        apiLogout();
        setAuthenticated(false);
      }
    } else {
      setAuthenticated(false);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = async (credentials: LoginRequest) => {
    setIsLoading(true);
    try {
      const response = await apiLogin(credentials);
      setUser(response.user);
      setAuthenticated(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    apiLogout();
    setUser(null);
    setAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: authenticated,
        isLoading,
        login: handleLogin,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
