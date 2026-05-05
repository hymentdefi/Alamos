/**
 * Mock API de watchlist — extiende el patrón Manteca (lib/auth/manteca.ts)
 * con `MOCK_MODE = true`. En MOCK_MODE el estado vive en memoria + se
 * persiste a SecureStore para sobrevivir cold starts. Cuando se saque
 * MOCK_MODE, las funciones llaman a los endpoints reales.
 *
 * Endpoints prod (TODO):
 *   POST /watchlist          — agregar
 *   DELETE /watchlist/:id    — quitar
 *   GET /watchlist           — listar
 */
import * as SecureStore from "expo-secure-store";

const MOCK_MODE = true;
const STORAGE_KEY = "alamos_watchlist_v1";

export interface WatchlistEntry {
  userId: string;
  assetId: string;
  addedAt: number;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

let cache: WatchlistEntry[] | null = null;

async function loadFromStorage(): Promise<WatchlistEntry[]> {
  if (cache) return cache;
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as WatchlistEntry[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

async function persist(entries: WatchlistEntry[]): Promise<void> {
  cache = entries;
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // No reventamos si SecureStore falla — la caché en memoria
    // mantiene el estado durante la sesión.
  }
}

export async function listWatchlist(userId: string): Promise<WatchlistEntry[]> {
  if (MOCK_MODE) {
    await delay(100);
    const all = await loadFromStorage();
    return all.filter((e) => e.userId === userId);
  }
  // TODO prod: GET /watchlist con Bearer token
  throw new Error("not implemented");
}

export async function addToWatchlist(
  userId: string,
  assetId: string,
): Promise<WatchlistEntry> {
  if (MOCK_MODE) {
    await delay(120);
    const all = await loadFromStorage();
    const existing = all.find(
      (e) => e.userId === userId && e.assetId === assetId,
    );
    if (existing) return existing;
    const entry: WatchlistEntry = { userId, assetId, addedAt: Date.now() };
    await persist([...all, entry]);
    return entry;
  }
  // TODO prod: POST /watchlist body { assetId }
  throw new Error("not implemented");
}

export async function removeFromWatchlist(
  userId: string,
  assetId: string,
): Promise<void> {
  if (MOCK_MODE) {
    await delay(120);
    const all = await loadFromStorage();
    await persist(
      all.filter((e) => !(e.userId === userId && e.assetId === assetId)),
    );
    return;
  }
  // TODO prod: DELETE /watchlist/:assetId
  throw new Error("not implemented");
}
