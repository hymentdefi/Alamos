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
export type AlertStatus = "active" | "triggered" | "cancelled";

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

/* ─── Helpers para tests / dev ──────────────────────────────── */

/** Reset del store mock — útil sólo para dev/storybook. */
export function _resetMockAlerts(): void {
  _mockStore.length = 0;
  _idSeq = 1;
}
