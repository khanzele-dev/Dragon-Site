/**
 * Клиент Remnawave API. Все секреты и вызовы — только на сервере,
 * фронтенд никогда не видит REMNAWAVE_API_TOKEN.
 *
 * Схема подтверждена вручную против реальной панели (panel.dragonvpn.online,
 * 2026-08-29) — не полагаемся на типовую документацию Remnawave, там были
 * расхождения. Ключевые нюансы:
 *  - Все ответы обёрнуты в `{ "response": ... }`.
 *  - Отдельного эндпоинта подписки нет — все данные (status/expireAt/
 *    трафик/subscriptionUrl) лежат прямо на объекте пользователя.
 *  - Создание пользователя требует expireAt/trafficLimitBytes/
 *    trafficLimitStrategy и явного назначения squad (иначе доступа к
 *    серверам не будет вообще — "пользователь есть, VPN не работает").
 *  - Продление — PATCH /api/users (uuid передаётся в теле, не в пути).
 */

const BASE_URL = process.env.REMNAWAVE_API_URL
const API_TOKEN = process.env.REMNAWAVE_API_TOKEN
// UUID squad'а, в который попадают все платные пользователи сайта — тот же,
// что использует существующий Telegram-бот ("Users"), чтобы у них был доступ
// к тем же нодам. Посмотреть/сменить: GET /api/internal-squads в панели.
const SQUAD_UUID = process.env.REMNAWAVE_SQUAD_UUID

// Стандартный пакет для платных тарифов сайта — совпадает с тем, что уже
// выдаёт существующий бот (200 GiB, сброс раз в месяц).
const DEFAULT_TRAFFIC_LIMIT_BYTES = 200 * 1024 * 1024 * 1024
const DEFAULT_TRAFFIC_STRATEGY = "MONTH"

function assertConfigured() {
  if (!BASE_URL || !API_TOKEN) {
    throw new Error("Remnawave is not configured (REMNAWAVE_API_URL / REMNAWAVE_API_TOKEN)")
  }
}

async function rw<T>(path: string, init?: RequestInit): Promise<T> {
  assertConfigured()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Remnawave API ${path} -> ${res.status}: ${body}`)
  }
  const json = await res.json()
  return json.response as T
}

type RemnawaveUser = {
  uuid: string
  status: "ACTIVE" | "DISABLED" | "LIMITED" | "EXPIRED"
  expireAt: string
  trafficLimitBytes: number
  subscriptionUrl: string
  userTraffic?: { usedTrafficBytes: number } | null
}

export type RemnawaveSubscription = {
  status: "ACTIVE" | "DISABLED" | "LIMITED" | "EXPIRED"
  expireAt: string
  trafficLimitBytes: number
  trafficUsedBytes: number
  subscriptionUrl: string
}

export type RemnawaveNode = {
  host: string
  countryCode: string
  status: "online" | "offline"
}

function toSubscription(user: RemnawaveUser): RemnawaveSubscription {
  return {
    status: user.status,
    expireAt: user.expireAt,
    trafficLimitBytes: user.trafficLimitBytes,
    trafficUsedBytes: user.userTraffic?.usedTrafficBytes ?? 0,
    subscriptionUrl: user.subscriptionUrl,
  }
}

// Remnawave принимает в username только [A-Za-z0-9_-]. Существующий
// Telegram-бот, который делит с сайтом эту же панель/squad ("Users"),
// называет своих пользователей "user_<telegram_id>" — используем тот же
// стиль с префиксом "site_", чтобы в общем списке панели было сразу видно
// источник, а по цифрам телефона пользователя можно было найти поиском
// (телефон уже нормализован как +7XXXXXXXXXX, см. lib/phone.ts).
function buildRemnawaveUsername(phone: string): string {
  return `site_${phone.replace(/\D/g, "")}`
}

/** Находит пользователя Remnawave по externalId (используем userId сайта), либо создаёт нового. */
export async function ensureRemnawaveUser(params: {
  externalId: string
  phone: string
}): Promise<{ uuid: string }> {
  if (!SQUAD_UUID) {
    throw new Error("Remnawave squad is not configured (REMNAWAVE_SQUAD_UUID)")
  }
  const created = await rw<RemnawaveUser>("/api/users", {
    method: "POST",
    body: JSON.stringify({
      username: buildRemnawaveUsername(params.phone),
      // Новый пользователь стартует "истёкшим" — extendRemnawaveSubscription
      // сразу после этого вызова продлевает его на купленный срок.
      expireAt: new Date().toISOString(),
      trafficLimitBytes: DEFAULT_TRAFFIC_LIMIT_BYTES,
      trafficLimitStrategy: DEFAULT_TRAFFIC_STRATEGY,
      activeInternalSquads: [SQUAD_UUID],
      // externalId (id пользователя в БД сайта) оставляем в описании — если
      // username когда-нибудь разъедется с телефоном (смена номера и т.п.),
      // по этому id всё равно можно найти запись в БД сайта для саппорта.
      description: `Dragon VPN (сайт) · ${params.phone} · site_id:${params.externalId}`,
    }),
  })
  return { uuid: created.uuid }
}

export async function getRemnawaveSubscription(uuid: string): Promise<RemnawaveSubscription> {
  const user = await rw<RemnawaveUser>(`/api/users/${uuid}`)
  return toSubscription(user)
}

export type SubscriptionDuration = { months: number; days: number }

/** Месяцы/дни могут прийти NaN из повреждённого ответа Remnawave или из
 *  рассинхронизированного Prisma Client (запущенный dev-процесс со старой
 *  схемой) — лучше упасть здесь с понятной причиной, чем внутри toISOString(). */
function assertValidDate(date: Date, context: string): void {
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Remnawave: получена невалидная дата (${context})`)
  }
}

/** Продлевает подписку пользователя на N месяцев + N дней (используется и для первой активации). */
export async function extendRemnawaveSubscription(uuid: string, duration: SubscriptionDuration): Promise<void> {
  const current = await rw<RemnawaveUser>(`/api/users/${uuid}`)
  const currentExpireAt = new Date(current.expireAt)
  assertValidDate(currentExpireAt, `user.expireAt="${current.expireAt}"`)
  const base = currentExpireAt > new Date() ? currentExpireAt : new Date()
  const nextExpireAt = new Date(base)
  nextExpireAt.setMonth(nextExpireAt.getMonth() + duration.months)
  nextExpireAt.setDate(nextExpireAt.getDate() + duration.days)
  assertValidDate(nextExpireAt, `months=${duration.months} days=${duration.days}`)

  await rw("/api/users", {
    method: "PATCH",
    body: JSON.stringify({ uuid, expireAt: nextExpireAt.toISOString() }),
  })
}

/** Возврат средств за оплату — урезает подписку ровно на длительность этого
 *  конкретного платежа, не больше. Если expireAt уходит в прошлое — это
 *  нормально, Remnawave просто отдаст статус EXPIRED. */
export async function reduceRemnawaveSubscription(uuid: string, duration: SubscriptionDuration): Promise<void> {
  const current = await rw<RemnawaveUser>(`/api/users/${uuid}`)
  const nextExpireAt = new Date(current.expireAt)
  assertValidDate(nextExpireAt, `user.expireAt="${current.expireAt}"`)
  nextExpireAt.setMonth(nextExpireAt.getMonth() - duration.months)
  nextExpireAt.setDate(nextExpireAt.getDate() - duration.days)
  assertValidDate(nextExpireAt, `months=${duration.months} days=${duration.days}`)

  await rw("/api/users", {
    method: "PATCH",
    body: JSON.stringify({ uuid, expireAt: nextExpireAt.toISOString() }),
  })
}

export async function listRemnawaveNodes(): Promise<RemnawaveNode[]> {
  const nodes = await rw<
    Array<{ address: string; countryCode: string; isConnected: boolean; isDisabled: boolean }>
  >("/api/nodes")
  return nodes.map((n) => ({
    host: n.address,
    countryCode: n.countryCode,
    status: n.isConnected && !n.isDisabled ? "online" : "offline",
  }))
}
