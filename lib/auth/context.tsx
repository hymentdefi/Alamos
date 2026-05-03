import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import {
  login as apiLogin,
  register as apiRegister,
  getMe,
  markFirstTradeOnServer,
  type User,
  type AuthTokens,
  type LoginPayload,
  type RegisterPayload,
} from "./manteca";

interface AuthState { user: User | null; isLoading: boolean; isAuthenticated: boolean; }
interface AuthActions {
  login: (p: LoginPayload) => Promise<void>;
  register: (p: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  /** Flippea `user.hasFirstTrade` a true. Si ya estaba en true es
   *  no-op. Idempotente. */
  markFirstTrade: () => Promise<void>;
}
type AuthContextValue = AuthState & AuthActions;

const TOKEN_KEY = "alamos_tokens";
const storeTokens = async (t: AuthTokens) => SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(t));
const getStoredTokens = async (): Promise<AuthTokens | null> => { const r = await SecureStore.getItemAsync(TOKEN_KEY); return r ? JSON.parse(r) : null; };
const clearTokens = async () => SecureStore.deleteItemAsync(TOKEN_KEY);

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const tokens = await getStoredTokens();
        if (tokens?.accessToken) { const me = await getMe(tokens.accessToken); setUser(me); }
      } catch { await clearTokens(); }
      finally { setIsLoading(false); }
    })();
  }, []);

  const login = async (p: LoginPayload) => { const { user, tokens } = await apiLogin(p); await storeTokens(tokens); setUser(user); };
  const register = async (p: RegisterPayload) => { const { user, tokens } = await apiRegister(p); await storeTokens(tokens); setUser(user); };
  const logout = async () => { await clearTokens(); setUser(null); };

  const markFirstTrade = useCallback(async () => {
    // Idempotente: si ya estaba marcado, no hago nada.
    if (!user || user.hasFirstTrade) return;
    setUser({ ...user, hasFirstTrade: true });
    try {
      const tokens = await getStoredTokens();
      if (tokens?.accessToken) await markFirstTradeOnServer(tokens.accessToken);
    } catch {
      // Si el server falla, dejamos el flag local en true igual —
      // la celebración ya pasó. La próxima sesión va a re-leer de
      // /auth/me; si no se persistió allá, se vuelve a celebrar
      // (preferible a no celebrar nunca).
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        markFirstTrade,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
