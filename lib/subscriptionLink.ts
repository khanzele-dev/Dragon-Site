/**
 * Достаёт ключ подписки (short-uuid Remnawave) из того, что вставил
 * пользователь на странице продления: полная ссылка (со схемой и хостом),
 * ссылка с хвостом-приложением (".../sub/<key>/v2ray"), либо голый ключ.
 * Используется и поиском подписки, и продлением без регистрации.
 */
export function extractSubscriptionKey(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const withoutQuery = trimmed.split(/[?#]/)[0]
  const segments = withoutQuery.split("/").filter(Boolean)
  if (segments.length === 0) return null

  const subIndex = segments.findIndex((s) => s.toLowerCase() === "sub")
  if (subIndex !== -1 && segments[subIndex + 1]) {
    return segments[subIndex + 1]
  }

  // Похоже на "host.tld/что-то" без /sub/ — берём последний сегмент пути,
  // а не хост, если сегментов больше одного (после протокола/хоста).
  const last = segments[segments.length - 1]
  // Если строка целиком — это просто хост (например, вставили домен без пути),
  // последний сегмент совпадёт с самим хостом и содержать точку — тогда это,
  // скорее всего, не ключ, а мусор.
  if (segments.length === 1 && last.includes(".") && !last.includes(":")) {
    return null
  }
  return last
}
