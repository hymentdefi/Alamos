/**
 * API client de alertas de precio — mock por ahora.
 *
 * Endpoints (cuando se conecte backend real):
 *   POST   /alerts                  body { assetId, threshold,
 *                                            direction, currency }
 *   GET    /alerts?asset=X          → { items: PriceAlert[] }
 *   GET    /alerts                  → { items: PriceAlert[] }
 *   DELETE /alerts/:id
 *
 * Modelo PriceAlert:
 *   id, userId, assetId, threshold, direction, currency,
 *   status (active/triggered/cancelled), createdAt, triggeredAt?
 *
 * Backend (responsabilidad ajena al cliente):
 *   - Evalúa el precio actual de cada asset contra todas las alertas
 *     active. Cuando se cumple el threshold, dispara push y cambia
 *     status a 'triggered' con triggeredAt = ahora.
 *   - Push payload: ticker, precio actual, threshold, deep link a
 *     pantalla del activo (ej: alamoscapital://detail?ticker=AAPL).
 *
 * v1: solo "subir a X" / "bajar a X" (threshold absoluto). Out of
 * scope: % de cambio, volumen, eventos, alertas relativas.
 */

import type { AssetCurrency } from "../data/assets";

const MOCK_MODE = true;
const MOCK_LATENCY_MIN = 100;
const MOCK_LATENCY_MAX = 280;

export type AlertDirection = "above" | "below";
/* paused: el user la silenció pero queremos preservarla para que pueda
 * reactivarla. Distinto de cancelled (borrado explícito) y de triggered
 * (ya disparó y vive en historial). */
export type AlertStatus = "active" | "paused" | "triggered" | "cancelled";

export interface PriceAlert {
  id: string;
  userId: string;
  assetId: string;
  threshold: number;
  direction: AlertDirection;
  currency: AssetCurrency;
  status: AlertStatus;
  createdAt: string;
  triggeredAt?: string;
  /** Precio del activo al momento exacto del disparo. Lo guardamos
   *  para que el historial muestre "se cumplió a $X" sin tener que
   *  re-fetchear el precio histórico cada vez. */
  triggeredPrice?: number;
}

export interface CreateAlertInput {
  assetId: string;
  threshold: number;
  direction: AlertDirection;
  currency: AssetCurrency;
}

export class AlertApiError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "duplicate"
      | "invalid"
      | "network"
      | "unknown" = "unknown",
  ) {
    super(message);
    this.name = "AlertApiError";
  }
}

/* ─── Mock store ─────────────────────────────────────────────── */

// Store mock — vive en memoria del proceso. Cuando se reinicia la
// app se pierde. La spec lo asume mock; cuando conectemos backend
// el store real es DB.
const _mockStore: PriceAlert[] = [];
let _idSeq = 1;
const MOCK_USER_ID = "mock-user";

function mockDelay(): Promise<void> {
  const ms =
    MOCK_LATENCY_MIN +
    Math.random() * (MOCK_LATENCY_MAX - MOCK_LATENCY_MIN);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Detecta duplicados: misma combinación assetId + threshold +
 *  direction + currency en estado active. La spec lo pide
 *  explícitamente para no bombardear push. */
function findDuplicate(
  input: CreateAlertInput,
): PriceAlert | undefined {
  return _mockStore.find(
    (a) =>
      a.status === "active" &&
      a.assetId === input.assetId &&
      a.direction === input.direction &&
      a.currency === input.currency &&
      a.threshold === input.threshold,
  );
}

/** POST /alerts */
export async function createAlert(
  input: CreateAlertInput,
  _accessToken?: string,
): Promise<PriceAlert> {
  if (MOCK_MODE) {
    await mockDelay();
    if (!isFinite(input.threshold) || input.threshold <= 0) {
      throw new AlertApiError("El precio objetivo debe ser mayor a 0.", "invalid");
    }
    const dup = findDuplicate(input);
    if (dup) {
      throw new AlertApiError(
        "Ya tenés una alerta configurada a este precio.",
        "duplicate",
      );
    }
    const created: PriceAlert = {
      id: `alert-${_idSeq++}`,
      userId: MOCK_USER_ID,
      assetId: input.assetId,
      threshold: input.threshold,
      direction: input.direction,
      currency: input.currency,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    _mockStore.push(created);
    return created;
  }
  throw new AlertApiError("createAlert no implementado contra backend real");
}

/** GET /alerts?asset=X — alertas filtradas por asset (active only
 *  por default; el backend puede aceptar status como query param
 *  cuando se implemente). */
export async function getAlertsForAsset(
  assetId: string,
  _accessToken?: string,
): Promise<PriceAlert[]> {
  if (MOCK_MODE) {
    await mockDelay();
    return _mockStore.filter(
      (a) => a.assetId === assetId && a.status === "active",
    );
  }
  throw new AlertApiError("getAlertsForAsset no implementado");
}

/** GET /alerts — todas las del usuario, todos los estados.
 *  Para la pantalla "Mis alertas". */
export async function getAllAlerts(
  _accessToken?: string,
): Promise<PriceAlert[]> {
  if (MOCK_MODE) {
    await mockDelay();
    // Ordenadas: active primero (más recientes arriba), después
    // triggered/cancelled.
    return [..._mockStore].sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === "active") return -1;
        if (b.status === "active") return 1;
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }
  throw new AlertApiError("getAllAlerts no implementado");
}

/** DELETE /alerts/:id */
export async function deleteAlert(
  alertId: string,
  _accessToken?: string,
): Promise<void> {
  if (MOCK_MODE) {
    await mockDelay();
    const idx = _mockStore.findIndex((a) => a.id === alertId);
    if (idx === -1) {
      throw new AlertApiError("Alerta no encontrada.", "invalid");
    }
    _mockStore.splice(idx, 1);
    return;
  }
  throw new AlertApiError("deleteAlert no implementado");
}

/** PATCH /alerts/:id — Update threshold + direction de una alerta
 *  existente. La currency y assetId no se cambian (si querés otra
 *  combinación, borrala y creá una nueva). El backend hará el mismo
 *  check de duplicado que en create. Conserva el id (importante para
 *  que la UI pueda mantener la posición en la lista durante el edit). */
export async function updateAlert(
  alertId: string,
  patch: { threshold: number; direction: AlertDirection },
  _accessToken?: string,
): Promise<PriceAlert> {
  if (MOCK_MODE) {
    await mockDelay();
    const idx = _mockStore.findIndex((a) => a.id === alertId);
    if (idx === -1) {
      throw new AlertApiError("Alerta no encontrada.", "invalid");
    }
    if (!isFinite(patch.threshold) || patch.threshold <= 0) {
      throw new AlertApiError(
        "El precio objetivo debe ser mayor a 0.",
        "invalid",
      );
    }
    // Check duplicado contra OTRAS alertas (excluyendo ésta).
    const current = _mockStore[idx];
    const dup = _mockStore.find(
      (a) =>
        a.id !== alertId &&
        a.status === "active" &&
        a.assetId === current.assetId &&
        a.direction === patch.direction &&
        a.currency === current.currency &&
        a.threshold === patch.threshold,
    );
    if (dup) {
      throw new AlertApiError(
        "Ya tenés una alerta configurada a este precio.",
        "duplicate",
      );
    }
    const updated: PriceAlert = {
      ...current,
      threshold: patch.threshold,
      direction: patch.direction,
    };
    _mockStore[idx] = updated;
    return updated;
  }
  throw new AlertApiError("updateAlert no implementado");
}

/** PATCH /alerts/:id/status — Pausa o reactiva una alerta. Sólo
 *  válido entre 'active' y 'paused'. Si la alerta ya disparó o fue
 *  cancelada el backend rechaza con invalid. */
export async function setAlertPaused(
  alertId: string,
  paused: boolean,
  _accessToken?: string,
): Promise<PriceAlert> {
  if (MOCK_MODE) {
    await mockDelay();
    const idx = _mockStore.findIndex((a) => a.id === alertId);
    if (idx === -1) {
      throw new AlertApiError("Alerta no encontrada.", "invalid");
    }
    const current = _mockStore[idx];
    if (current.status === "triggered" || current.status === "cancelled") {
      throw new AlertApiError(
        "No se puede pausar una alerta finalizada.",
        "invalid",
      );
    }
    const updated: PriceAlert = {
      ...current,
      status: paused ? "paused" : "active",
    };
    _mockStore[idx] = updated;
    return updated;
  }
  throw new AlertApiError("setAlertPaused no implementado");
}

/* ─── Helpers para tests / dev — sembrar alertas mock con histórico
 *     para que las pantallas de historial no se vean vacías al
 *     abrirlas la primera vez. ──────────────────────────────────── */

/** Inyecta una alerta ya disparada (para el historial). Útil para
 *  el seed inicial del mock store. */
export function _seedTriggeredAlert(alert: Omit<PriceAlert, "id" | "userId">): PriceAlert {
  const seeded: PriceAlert = {
    id: `alert-${_idSeq++}`,
    userId: MOCK_USER_ID,
    ...alert,
  };
  _mockStore.push(seeded);
  return seeded;
}

/** Reset del store mock — útil sólo para dev/storybook. */
export function _resetMockAlerts(): void {
  _mockStore.length = 0;
  _idSeq = 1;
}

/* ─── Seed inicial — alertas disparadas para que el historial no
 *     se vea vacío en demos. Sólo corre una vez en MOCK_MODE.
 *     Cuando conectemos backend real, este bloque desaparece. */
if (MOCK_MODE && _mockStore.length === 0) {
  const now = new Date();
  const hoursAgo = (h: number) =>
    new Date(now.getTime() - h * 3600 * 1000).toISOString();
  const daysAgo = (d: number) =>
    new Date(now.getTime() - d * 24 * 3600 * 1000).toISOString();
  _seedTriggeredAlert({
    assetId: "AAPL",
    threshold: 220,
    direction: "above",
    currency: "USD",
    status: "triggered",
    createdAt: daysAgo(3),
    triggeredAt: hoursAgo(8),
    triggeredPrice: 221.45,
  });
  _seedTriggeredAlert({
    assetId: "BTC",
    threshold: 95000,
    direction: "above",
    currency: "USDT",
    status: "triggered",
    createdAt: daysAgo(7),
    triggeredAt: daysAgo(2),
    triggeredPrice: 95342,
  });
  _seedTriggeredAlert({
    assetId: "GGAL",
    threshold: 8500,
    direction: "below",
    currency: "ARS",
    status: "triggered",
    createdAt: daysAgo(5),
    triggeredAt: daysAgo(1),
    triggeredPrice: 8412,
  });
}
