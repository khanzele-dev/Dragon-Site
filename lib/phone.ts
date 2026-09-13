// Общая логика нормализации/валидации российского номера телефона.
// Используется на бэкенде (авторитетная проверка) — public/js/auth.js
// на фронтенде дублирует те же правила только для UX (мгновенная подсказка).

const PHONE_RE = /^(?:\+7|7|8)?\s*\(?\d{3}\)?[\s-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}$/

/** Возвращает номер в формате +7XXXXXXXXXX или null, если номер некорректный. */
export function normalizePhone(raw: string): string | null {
  if (!raw || !PHONE_RE.test(raw.trim())) return null
  let digits = raw.replace(/\D/g, "")
  if (digits.length === 11 && (digits[0] === "7" || digits[0] === "8")) {
    digits = digits.slice(1)
  }
  if (digits.length !== 10) return null
  return "+7" + digits
}
