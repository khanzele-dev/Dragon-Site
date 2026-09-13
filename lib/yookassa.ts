/**
 * Клиент ЮKassa (https://yookassa.ru/developers/api). Ключи (YOOKASSA_SHOP_ID /
 * YOOKASSA_SECRET_KEY) появятся позже — до тех пор isYookassaConfigured()
 * возвращает false и /api/payments/create отвечает понятной ошибкой, не падая.
 */

const SHOP_ID = process.env.YOOKASSA_SHOP_ID
const SECRET_KEY = process.env.YOOKASSA_SECRET_KEY
const API_BASE = "https://api.yookassa.ru/v3"

export function isYookassaConfigured() {
  return Boolean(SHOP_ID && SECRET_KEY)
}

function authHeader() {
  const token = Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString("base64")
  return `Basic ${token}`
}

export type YookassaPayment = {
  id: string
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled"
  amount: { value: string; currency: string }
  confirmation?: { confirmation_url?: string }
  metadata?: Record<string, string>
}

export async function createYookassaPayment(params: {
  idempotenceKey: string
  amountRub: number
  description: string
  returnUrl: string
  metadata: Record<string, string>
}): Promise<YookassaPayment> {
  if (!isYookassaConfigured()) {
    throw new Error("YooKassa is not configured yet")
  }
  const res = await fetch(`${API_BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      "Idempotence-Key": params.idempotenceKey,
    },
    body: JSON.stringify({
      amount: { value: params.amountRub.toFixed(2), currency: "RUB" },
      capture: true,
      confirmation: { type: "redirect", return_url: params.returnUrl },
      description: params.description,
      metadata: params.metadata,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`YooKassa create payment failed: ${res.status} ${body}`)
  }
  return res.json()
}

/**
 * ЮKassa не подписывает вебхуки — единственный надёжный способ убедиться, что
 * событие настоящее, это запросить сам платёж по его id через API (Basic Auth)
 * и сверить статус, а не доверять телу вебхука напрямую.
 */
export async function fetchYookassaPayment(paymentId: string): Promise<YookassaPayment> {
  const res = await fetch(`${API_BASE}/payments/${paymentId}`, {
    headers: { Authorization: authHeader() },
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`YooKassa fetch payment failed: ${res.status}`)
  }
  return res.json()
}

export type YookassaRefund = {
  id: string
  payment_id: string
  status: "pending" | "succeeded" | "canceled"
  amount: { value: string; currency: string }
}

/** Та же логика, что и у fetchYookassaPayment — телу вебхука не доверяем, сверяем по API. */
export async function fetchYookassaRefund(refundId: string): Promise<YookassaRefund> {
  const res = await fetch(`${API_BASE}/refunds/${refundId}`, {
    headers: { Authorization: authHeader() },
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`YooKassa fetch refund failed: ${res.status}`)
  }
  return res.json()
}
