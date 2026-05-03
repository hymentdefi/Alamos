const MOCK_MODE = true;
const BASE_URL = "https://api.manteca.dev";

export type Gender = "female" | "male" | "non-binary";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
export interface User {
  id: string;
  email: string;
  fullName: string;
  kycStatus: "pending" | "in_review" | "approved" | "rejected";
  /** Permite usar copy con género gramatical correcto (ej:
   *  inversor / inversora). Opcional — si está undefined usamos
   *  fallback no-marcado ("ya empezaste a invertir"). */
  gender?: Gender;
  /** True si el usuario ya hizo al menos una compra. Lo flippeamos
   *  desde el cliente al ejecutar la primera orden exitosa para
   *  trigger el layout de celebración + confetti. En prod tendría
   *  que volver del backend. */
  hasFirstTrade: boolean;
}
export interface LoginPayload {
  email: string;
  password: string;
}
export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  cuilCuit: string;
}

const MOCK_USER: User = {
  id: "usr_mock_001",
  email: "christian@alamos.capital",
  fullName: "Christian",
  kycStatus: "approved",
  gender: "male",
  // Default false — cada vez que se monta la AuthProvider (cold
  // start o reload del bundler) volvemos a empezar como si fuera el
  // primer trade. En prod este flag lo pisaría el backend.
  hasFirstTrade: false,
};
const MOCK_TOKENS: AuthTokens = { accessToken: "mock_access_jwt", refreshToken: "mock_refresh_jwt" };
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function login(payload: LoginPayload): Promise<{ user: User; tokens: AuthTokens }> {
  if (MOCK_MODE) {
    await delay(800);
    if (payload.email && payload.password.length >= 4) return { user: MOCK_USER, tokens: MOCK_TOKENS };
    throw new Error("Credenciales invalidas");
  }
  const res = await fetch(BASE_URL + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error("Login failed");
  return res.json();
}

export async function register(payload: RegisterPayload): Promise<{ user: User; tokens: AuthTokens }> {
  if (MOCK_MODE) {
    await delay(1000);
    return {
      user: { ...MOCK_USER, email: payload.email, fullName: payload.fullName },
      tokens: MOCK_TOKENS,
    };
  }
  const res = await fetch(BASE_URL + "/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error("Register failed");
  return res.json();
}

export async function getMe(accessToken: string): Promise<User> {
  if (MOCK_MODE) { await delay(400); return MOCK_USER; }
  const res = await fetch(BASE_URL + "/auth/me", { headers: { Authorization: "Bearer " + accessToken } });
  if (!res.ok) throw new Error("Session expired");
  return res.json();
}

/**
 * Marca el flag `hasFirstTrade` en el backend. En mock no persiste
 * — el efecto de "es el primer trade en esta sesión" lo da el
 * AuthProvider que arranca con MOCK_USER cada cold start. */
export async function markFirstTradeOnServer(accessToken: string): Promise<void> {
  if (MOCK_MODE) {
    await delay(80);
    return;
  }
  const res = await fetch(BASE_URL + "/auth/me/first-trade", {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken },
  });
  if (!res.ok) throw new Error("Could not mark first trade");
}
