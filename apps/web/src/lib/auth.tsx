"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type { ReactNode } from "react";
import type { UserProfile } from "./api-types";
import { api } from "./api-client";

const TOKEN_KEY = "voi.token";
const USER_KEY = "voi.user";

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  ready: boolean;
  signIn: (email: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_KEY);
    const storedUser = window.localStorage.getItem(USER_KEY);
    if (storedToken) {
      setToken(storedToken);
    }
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser) as UserProfile);
      } catch {
        window.localStorage.removeItem(USER_KEY);
      }
    }
    setReady(true);
  }, []);

  const signIn = useCallback(async (email: string, displayName?: string) => {
    const result = await api.devLogin(email, displayName);
    window.localStorage.setItem(TOKEN_KEY, result.token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    setToken(result.token);
    setUser(result.user);
  }, []);

  // Prototype Google sign-in: creates a local mock session so the flow is
  // clickable without a backend. Replace with real Google OAuth (NextAuth /
  // backend OAuth callback) before launch — see docs.
  const signInWithGoogle = useCallback(async () => {
    const mockUser: UserProfile = {
      id: "google-mock-user",
      email: "ban@gmail.com",
      displayName: "Bạn",
      avatarUrl: null,
      defaultSkillLevel: "INTERMEDIATE"
    };
    window.localStorage.setItem(TOKEN_KEY, "mock-google-token");
    window.localStorage.setItem(USER_KEY, JSON.stringify(mockUser));
    setToken("mock-google-token");
    setUser(mockUser);
  }, []);

  const signOut = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ token, user, ready, signIn, signInWithGoogle, signOut }),
    [token, user, ready, signIn, signInWithGoogle, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
