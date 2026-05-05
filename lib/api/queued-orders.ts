/**
 * API client de órdenes encoladas (deferred orders) — mock.
 *
 * Endpoints (cuando se conecte backend real):
 *   POST   /orders/queued                  body { assetId, side,
 *                                                  quantity, currency }
 *   GET    /orders/queued                  → { items: QueuedOrder[] }
 *   DELETE /orders/queued/:id
 *
 * Modelo QueuedOrder:
 *   id, userId, assetId, side, quantity, currency,
 *   status (queued/executed/failed/cancelled), queuedAt,
 *   executedAt?, executionPrice?
 *
 * Backend (responsabilidad ajena al cliente):
 *   - Cron / trigger automático a la hora de apertura del mercado
 *     toma la queue del día y la procesa una a una.
 *   - Por cada orden valida fondos disponibles del usuario:
 *       * Si alcanza   → ejecuta a mercado al mejor precio disponible
 *                        en ese instante; status='executed' con
 *                        executedAt + executionPrice.
 *       * Si NO alcanza → status='failed' + push notif al usuario
 *                         con la razón.
 *   - Push de éxito: ticker, side, qty, executionPrice, deep link al
 *     receipt o a la pantalla del activo.
 *
 * v1: solo orden a mercado (NO limit orders). El cliente NO envía
 * un precio target — el backend usa el mejor disponible al momento
 * de ejecución.
 */

import type { AssetCurrency } from "../data/assets";

const MOCK_MODE = true;
const MOCK_LATENCY_MIN = 120;
const MOCK_LATENCY_MAX = 320;

export type OrderSide = "buy" | "sell";
export type OrderStatus = "queued" | "executed" | "failed" | "cancelled";

export interface QueuedOrder {
  id: string;
  userId: string;
  assetId: string;
  side: OrderSide;
  /** Cantidad de unidades del activo. Para compra "por monto"
   *  el cliente convierte el monto a quantity al momento del
   *  encolado usando el precio de referencia (último cierre). */
  quantity: number;
  currency: AssetCurrency;
  status: OrderStatus;
  /** ISO timestamp de cuando se encoló. */
  queuedAt: string;
  /** Fecha estimada de ejecución (próxima apertura del mercado).
   *  El backend la calcula al recibir la orden. */
  estimatedExecutionAt: string;
  /** ISO timestamp real de ejecución (se setea al ejecutar). */
  executedAt?: string;
  /** Precio efectivo de ejecución (se setea al ejecutar). */
  executionPrice?: number;
  /** Razón del fail (cuando status='failed'). */
  failureReason?: string;
}

export interface CreateQueuedOrderInput {
  assetId: string;
  side: OrderSide;
  quantity: number;
  currency: AssetCurrency;
  /** Próxima apertura calculada por el cliente (lib/market/hours
   *  nextOpenFor). El backend va a recalcularla pero la pasamos
   *  para que el receipt mock muestre la fecha correcta sin
   *  segundo round-trip. */
  estimatedExecutionAt: string;
}

export class QueuedOrderApiError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "invalid"
      | "network"
      | "unauthorized"
      | "unknown" = "unknown",
  ) {
    super(message);
    this.name = "QueuedOrderApiError";
  }
}

/* ─── Mock store ─────────────────────────────────────────────── */

const _mockStore: QueuedOrder[] = [];
let _idSeq = 1;
const MOCK_USER_ID = "mock-user";

function mockDelay(): Promise<void> {
  const ms =
    MOCK_LATENCY_MIN +
    Math.random() * (MOCK_LATENCY_MAX - MOCK_LATENCY_MIN);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** POST /orders/queued */
export async function createQueuedOrder(
  input: CreateQueuedOrderInput,
  _accessToken?: string,
): Promise<QueuedOrder> {
  if (MOCK_MODE) {
    await mockDelay();
    if (!isFinite(input.quantity) || input.quantity <= 0) {
      throw new QueuedOrderApiError(
        "La cantidad debe ser mayor a 0.",
        "invalid",
      );
    }
    const created: QueuedOrder = {
      id: `qord-${_idSeq++}`,
      userId: MOCK_USER_ID,
      assetId: input.assetId,
      side: input.side,
      quantity: input.quantity,
      currency: input.currency,
      status: "queued",
      queuedAt: new Date().toISOString(),
      estimatedExecutionAt: input.estimatedExecutionAt,
    };
    _mockStore.push(created);
    return created;
  }
  throw new QueuedOrderApiError("createQueuedOrder no implementado");
}

/** GET /orders/queued — todas las del usuario, todos los estados. */
export async function getQueuedOrders(
  _accessToken?: string,
): Promise<QueuedOrder[]> {
  if (MOCK_MODE) {
    await mockDelay();
    // Ordenadas: queued primero (por estimatedExecutionAt asc, las
    // que ejecutan antes arriba), después executed/failed/cancelled.
    return [..._mockStore].sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === "queued") return -1;
        if (b.status === "queued") return 1;
      }
      if (a.status === "queued" && b.status === "queued") {
        return a.estimatedExecutionAt.localeCompare(b.estimatedExecutionAt);
      }
      return b.queuedAt.localeCompare(a.queuedAt);
    });
  }
  throw new QueuedOrderApiError("getQueuedOrders no implementado");
}

/** DELETE /orders/queued/:id — cancelar una orden encolada. Sólo
 *  permitido mientras status === 'queued' (el backend va a 409 si
 *  ya se ejecutó). En el mock cambia status a 'cancelled'. */
export async function cancelQueuedOrder(
  orderId: string,
  _accessToken?: string,
): Promise<void> {
  if (MOCK_MODE) {
    await mockDelay();
    const order = _mockStore.find((o) => o.id === orderId);
    if (!order) {
      throw new QueuedOrderApiError("Orden no encontrada.", "invalid");
    }
    if (order.status !== "queued") {
      throw new QueuedOrderApiError(
        "Esta orden ya no se puede cancelar.",
        "invalid",
      );
    }
    order.status = "cancelled";
    return;
  }
  throw new QueuedOrderApiError("cancelQueuedOrder no implementado");
}

/* ─── Helpers para tests / dev ──────────────────────────────── */

export function _resetMockQueuedOrders(): void {
  _mockStore.length = 0;
  _idSeq = 1;
}
