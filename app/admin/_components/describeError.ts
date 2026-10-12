// В production Next.js скрывает текст ошибок, выброшенных на сервере
// (в браузере остаётся только «Minified React error #441»). Поэтому серверные
// действия админки не бросают исключения наружу, а возвращают сообщение —
// и переводят техническую причину в понятную администратору.
export function describeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const name = err instanceof Error ? err.name : ""

  if (name === "TimeoutError" || name === "AbortError") return "Сервис не ответил вовремя — попробуйте через минуту"

  const yk = raw.match(/YooKassa .*failed: (\d{3})/)
  if (yk) {
    const code = yk[1]
    if (code === "404") return "ЮKassa не нашла этот платёж (404) — возможно, он создан с другими ключами магазина"
    if (code === "401" || code === "403") return `ЮKassa отклонила ключи магазина (${code}) — проверьте YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY`
    return `ЮKassa ответила ошибкой ${code}`
  }

  const rw = raw.match(/Remnawave API (\S+) -> (\d{3})/)
  if (rw) {
    const [, path, code] = rw
    if (code === "401" || code === "403") return `Remnawave запретил запрос ${path} (${code}) — у API-токена нет прав`
    if (code === "404") return `Remnawave не нашёл ${path} (404) — пользователь мог быть удалён из панели`
    return `Remnawave ответил ошибкой ${code} на ${path}`
  }

  if (raw.includes("REMNAWAVE_SQUAD_UUID")) return "Не задан REMNAWAVE_SQUAD_UUID — новых пользователей VPN создать нельзя"
  if (raw.includes("Remnawave is not configured")) return "Remnawave не настроен (REMNAWAVE_API_URL / REMNAWAVE_API_TOKEN)"
  if (raw.includes("YOOKASSA") || raw.includes("YooKassa is not configured")) return "ЮKassa не настроена"

  return raw.length > 220 ? `${raw.slice(0, 220)}…` : raw || "Неизвестная ошибка"
}
