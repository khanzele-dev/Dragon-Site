// Форматирование для админки — одно место для денег, дат и подписей статусов.

export const rub = (n: number) => `${n.toLocaleString("ru-RU")} ₽`

export const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" })

export const fmtDateTime = (d: Date | string) =>
  new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

export const gb = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(1)} ГБ`

export function daysLeft(iso: string | Date): number {
  const ms = new Date(iso).getTime() - Date.now()
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0
}

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return `${n} ${one}`
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return `${n} ${few}`
  return `${n} ${many}`
}

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "В обработке", tone: "warn" },
  SUCCEEDED: { label: "Оплачен", tone: "good" },
  FAILED: { label: "Ошибка", tone: "bad" },
  CANCELED: { label: "Отменён", tone: "muted" },
  REFUNDED: { label: "Возврат", tone: "muted" },
}

export const PAYMENT_TYPE: Record<string, string> = {
  ACCOUNT: "Кабинет",
  GUEST_PURCHASE: "Покупка без рег.",
  GUEST_RENEWAL: "Продление без рег.",
}

export const SUB_STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Активна", tone: "good" },
  LIMITED: { label: "Лимит трафика", tone: "warn" },
  DISABLED: { label: "Отключена", tone: "bad" },
  EXPIRED: { label: "Истекла", tone: "muted" },
}

export type Tone = "good" | "warn" | "bad" | "muted" | "accent"
