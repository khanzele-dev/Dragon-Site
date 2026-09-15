import { randomBytes, createHash } from "crypto"

/**
 * Одноразовый токен гостевого заказа — кладётся в return_url ЮKassa как
 * query-параметр, чтобы после оплаты показать результат именно этого заказа
 * без сессии/логина. В БД хранится только sha256-хэш (orderTokenHash) —
 * из него сам токен не восстановить, а значит и по дампу БД доступ к чужому
 * заказу не получить.
 */
export function generateOrderToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("hex")
  return { token, hash: hashOrderToken(token) }
}

export function hashOrderToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}
