import type { ReactNode } from "react"
import { unstable_rethrow } from "next/navigation"
import { CircleCheck, CircleX, Database, Server, ShieldCheck, Wallet, TriangleAlert } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { isYookassaConfigured } from "@/lib/yookassa"
import { listRemnawaveNodes } from "@/lib/remnawave"
import { PageHeader, Panel } from "../_components/ui"

type Check = { ok: boolean | "warn"; detail: string }

async function timed<T>(fn: () => Promise<T>): Promise<{ value?: T; ms: number; error?: unknown }> {
  const t = Date.now()
  try {
    const value = await fn()
    return { value, ms: Date.now() - t }
  } catch (error) {
    unstable_rethrow(error)
    return { ms: Date.now() - t, error }
  }
}

function Row({ icon, label, hint, check }: { icon: ReactNode; label: string; hint: string; check: Check }) {
  const tone =
    check.ok === true
      ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/25"
      : check.ok === "warn"
        ? "bg-amber-400/10 text-amber-300 ring-amber-400/25"
        : "bg-[#e0362a]/12 text-[#ff8a7d] ring-[#e0362a]/30"
  const StatusIcon = check.ok === true ? CircleCheck : check.ok === "warn" ? TriangleAlert : CircleX
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.05] py-4 last:border-none">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-[#8f7c7a]">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="text-xs text-[#8f7c7a]">{hint}</p>
        </div>
      </div>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${tone}`}>
        <StatusIcon className="size-3.5" aria-hidden />
        {check.detail}
      </span>
    </div>
  )
}

export default async function AdminSettingsPage() {
  const remnawaveConfigured = Boolean(process.env.REMNAWAVE_API_URL && process.env.REMNAWAVE_API_TOKEN)
  const [db, nodes] = await Promise.all([
    timed(() => prisma.$queryRaw`SELECT 1`),
    remnawaveConfigured ? timed(() => listRemnawaveNodes()) : Promise.resolve(null),
  ])

  const appUrl = process.env.APP_URL ?? ""
  const appUrlCheck: Check = !appUrl
    ? { ok: false, detail: "Не задан" }
    : appUrl.includes("localhost")
      ? { ok: "warn", detail: "localhost — оплаты вернут не туда" }
      : { ok: true, detail: appUrl.replace(/^https?:\/\//, "") }

  const checks: { icon: ReactNode; label: string; hint: string; check: Check }[] = [
    {
      icon: <Database className="size-4" />,
      label: "База данных",
      hint: "PostgreSQL (DATABASE_URL)",
      check: db.error ? { ok: false, detail: "Нет соединения" } : { ok: true, detail: `Работает · ${db.ms} мс` },
    },
    {
      icon: <Server className="size-4" />,
      label: "Remnawave",
      hint: "Панель VPN: выдача и продление подписок (REMNAWAVE_API_URL / _TOKEN / _SQUAD_UUID)",
      check: !nodes
        ? { ok: false, detail: "Не настроено" }
        : nodes.error
          ? String(nodes.error).includes("-> 403")
            ? { ok: "warn", detail: "Отвечает, но токену запрещён /api/nodes (403)" }
            : { ok: false, detail: "Не отвечает" }
          : !process.env.REMNAWAVE_SQUAD_UUID
            ? { ok: "warn", detail: "Нет SQUAD_UUID — новые пользователи без серверов" }
            : { ok: true, detail: `Отвечает · ${nodes.ms} мс · нод: ${nodes.value?.length ?? 0}` },
    },
    {
      icon: <Wallet className="size-4" />,
      label: "ЮKassa",
      hint: "Приём оплат (YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY)",
      check: isYookassaConfigured() ? { ok: true, detail: "Ключи заданы" } : { ok: false, detail: "Не настроено" },
    },
    {
      icon: <ShieldCheck className="size-4" />,
      label: "Защита от перебора паролей",
      hint: "Upstash Redis для rate limit (UPSTASH_REDIS_REST_URL / _TOKEN)",
      check:
        process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
          ? { ok: true, detail: "Redis подключён" }
          : { ok: "warn", detail: "Лимит в памяти процесса" },
    },
    {
      icon: <ShieldCheck className="size-4" />,
      label: "Адрес сайта",
      hint: "APP_URL — сюда ЮKassa возвращает после оплаты",
      check: appUrlCheck,
    },
  ]

  const problems = checks.filter((c) => c.check.ok !== true).length

  return (
    <div>
      <PageHeader
        title="Система"
        description={problems === 0 ? "Все интеграции работают." : `Требуют внимания: ${problems}.`}
      />
      <Panel bodyClassName="px-5">
        {checks.map((c) => (
          <Row key={c.label} {...c} />
        ))}
      </Panel>
      <p className="mt-4 text-xs text-[#8f7c7a]">
        Проверки выполняются при каждом открытии страницы. Ключи меняются только в переменных окружения на сервере —
        здесь их нельзя увидеть или отредактировать намеренно.
      </p>
    </div>
  )
}
