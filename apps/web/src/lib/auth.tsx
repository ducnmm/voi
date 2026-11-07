"use client";
import { useI18n } from "@/lib/i18n";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, request } from "./api-client";
import type { AuthResponse, UserProfile } from "./api-types";
interface AuthState {
  token: string | null;
  user: UserProfile | null;
  ready: boolean;
  signIn: (email: string, displayName?: string) => Promise<void>;
  signInWithGoogle: (credential?: string) => Promise<void>;
  signInWithApple: (
    identityToken: string,
    nonce: string,
    fullName?: string,
  ) => Promise<void>;
  signOut: () => void;
  updateUser: (user: UserProfile) => void;
}
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const updateUser = useCallback((next: UserProfile) => {
    localStorage.setItem("voi.user", JSON.stringify(next));
    setUser(next);
  }, []);
  const clear = useCallback(() => {
    ["voi.token", "voi.user", "voi.refresh"].forEach((key) =>
      localStorage.removeItem(key),
    );
    setToken(null);
    setUser(null);
  }, []);
  useEffect(() => {
    let active = true;
    const stored = localStorage.getItem("voi.token");
    if (stored && stored !== "mock-google-token") {
      api
        .me(stored)
        .then(({ user }) => {
          if (active) {
            setToken(localStorage.getItem("voi.token") ?? stored);
            updateUser(user);
          }
        })
        .catch(() => {
          if (active) clear();
        })
        .finally(() => {
          if (active) setReady(true);
        });
    } else {
      clear();
      setReady(true);
    }
    window.addEventListener("voi:expired", clear);
    return () => {
      active = false;
      window.removeEventListener("voi:expired", clear);
    };
  }, [clear, updateUser]);
  const accept = useCallback(
    (result: AuthResponse) => {
      const access = result.accessToken ?? result.token;
      if (!access) throw new Error(t("Thiếu phiên đăng nhập."));
      localStorage.setItem("voi.token", access);
      localStorage.setItem("voi.refresh", result.refreshToken);
      setToken(access);
      updateUser(result.user);
    },
    [updateUser],
  );
  const signIn = useCallback(
    async (email: string, displayName?: string) => {
      accept(await api.devLogin(email, displayName));
    },
    [accept],
  );
  const signInWithGoogle = useCallback(
    async (credential?: string) => {
      if (!credential) throw new Error(t("Vui lòng chọn tài khoản Google."));
      accept(
        await request<AuthResponse>("/auth/google", {
          method: "POST",
          body: { idToken: credential },
        }),
      );
    },
    [accept],
  );
  const signInWithApple = useCallback(
    async (identityToken: string, nonce: string, fullName?: string) => {
      accept(
        await request<AuthResponse>("/auth/apple", {
          method: "POST",
          body: { identityToken, nonce, fullName },
        }),
      );
    },
    [accept],
  );
  const signOut = useCallback(() => {
    const refreshToken = localStorage.getItem("voi.refresh");
    if (refreshToken)
      void request("/auth/logout", {
        method: "POST",
        body: { refreshToken },
      }).catch(() => undefined);
    clear();
  }, [clear]);
  const value = useMemo(
    () => ({
      token,
      user,
      ready,
      signIn,
      signInWithGoogle,
      signInWithApple,
      signOut,
      updateUser,
    }),
    [
      token,
      user,
      ready,
      signIn,
      signInWithGoogle,
      signInWithApple,
      signOut,
      updateUser,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}
