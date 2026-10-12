import { Suspense } from "react"
import Link from "next/link"
import { unstable_rethrow } from "next/navigation"
import { CreditCard, Receipt, TrendingUp, TriangleAlert, UserPlus, Users, Wallet } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { listRemnawaveNodes } from "@/lib/remnawave"
import { Badge, DataTable, EmptyRow, PageHeader, Panel, StatCard } from "./_components/ui"
import { RevenueChart, type DayPoint } from "./_components/RevenueChart"
import { PAYMENT_STATUS, PAYMENT_TYPE, fmtDateTime, plural, rub } from "./_components/format"

const DAY = 86_400_000

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Изменение к прошлому периоду: «+12%» / «−5%» / «—», если сравнивать не с чем. */
function trend(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? "новые продажи" : "—"
  const pct = Math.round(((cur - prev) / prev) * 100)
  return `${pct >= 0 ? "+" : "−"}${Math.abs(pct)}% к прошлым 30 дням`
}

export default async function AdminOverviewPage() {
  const today = startOfDay(new Date())
  const since30 = new Date(today.getTime() - 29 * DAY)
  const since60 = new Date(today.getTime() - 59 * DAY)
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000)

  const [
    totalUsers,
    newUsers30,
    allTime,
    paid30,
    paidPrev30,
    stuck,
    stalePending,
    byType,
    byPlan,
    recent,
    plans,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since30 } } }),
    prisma.payment.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amountRub: true }, _count: true }),
    prisma.payment.findMany({
      where: { status: "SUCCEEDED", createdAt: { gte: since30 } },
      select: { createdAt: true, amountRub: true },
    }),
    prisma.payment.aggregate({
      where: { status: "SUCCEEDED", createdAt: { gte: since60, lt: since30 } },
      _sum: { amountRub: true },
    }),
    prisma.payment.count({ where: { status: "SUCCEEDED", fulfilledAt: null } }),
    prisma.payment.count({ where: { status: "PENDING", createdAt: { lt: hourAgo } } }),
    prisma.payment.groupBy({
      by: ["type"],
      where: { status: "SUCCEEDED", createdAt: { gte: since30 } },
      _sum: { amountRub: true },
      _count: true,
    }),
    prisma.payment.groupBy({
      by: ["planId"],
      where: { status: "SUCCEEDED", createdAt: { gte: since30 } },
      _sum: { amountRub: true },
      _count: true,
      orderBy: { _sum: { amountRub: "desc" } },
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { id: true, phone: true } }, plan: { select: { name: true } } },
    }),
    prisma.plan.findMany({ select: { id: true, name: true } }),
  ])

  // Выручка по дням за 30 дней (включая сегодня), пустые дни — нули.
  const days: DayPoint[] = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(since30.getTime() + i * DAY),
    revenue: 0,
    count: 0,
  }))
  for (const p of paid30) {
    const idx = Math.floor((startOfDay(p.createdAt).getTime() - since30.getTime()) / DAY)
    if (days[idx]) {
      days[idx].revenue += p.amountRub
      days[idx].count += 1
    }
  }

  const revenue30 = paid30.reduce((s, p) => s + p.amountRub, 0)
  const revenueToday = days[days.length - 1].revenue
  const avgCheck = paid30.length ? Math.round(revenue30 / paid30.length) : 0
  const planName = new Map(plans.map((p) => [p.id, p.name]))
  const typeTotal = byType.reduce((s, t) => s + (t._sum.amountRub ?? 0), 0)

  return (
    <div>
      <PageHeader
        title="Обзор"
        description={`Сводка по продажам и пользователям сайта. Сегодня: ${rub(revenueToday)} выручки.`}
      />

      {(stuck > 0 || stalePending > 0) && (
        <div className="mb-5 flex flex-col gap-2">
          {stuck > 0 && (
            <Link
              href="/admin/payments?status=STUCK"
              className="flex items-center gap-3 rounded-2xl border border-[#e0362a]/40 bg-[#e0362a]/10 px-4 py-3 text-sm text-[#ffd0ca] transition hover:bg-[#e0362a]/15"
            >
              <TriangleAlert className="size-4 shrink-0 text-[#ff8a7d]" aria-hidden />
              <span>
                Оплачено, но VPN не выдан: <b className="text-white">{plural(stuck, "заказ", "заказа", "заказов")}</b>.
                Откройте и нажмите «Повторить выдачу».
              </span>
            </Link>
          )}
          {stalePending > 0 && (
            <Link
              href="/admin/payments?status=PENDING"
              className="flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-100 transition hover:bg-amber-400/10"
            >
              <TriangleAlert className="size-4 shrink-0 text-amber-300" aria-hidden />
              <span>
                «В обработке» дольше часа: <b className="text-white">{plural(stalePending, "заказ", "заказа", "заказов")}</b>.
                Скорее всего, брошенные оплаты — их можно сверить с ЮKassa.
              </span>
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Выручка за 30 дней"
          value={rub(revenue30)}
          hint={trend(revenue30, paidPrev30._sum.amountRub ?? 0)}
          icon={TrendingUp}
          tone="accent"
        />
        <StatCard label="Оплат за 30 дней" value={paid30.length} hint={`Средний чек ${rub(avgCheck)}`} icon={Receipt} />
        <StatCard
          label="Выручка за всё время"
          value={rub(allTime._sum.amountRub ?? 0)}
          hint={plural(allTime._count, "оплата", "оплаты", "оплат")}
          icon={Wallet}
        />
        <StatCard
          label="Пользователей"
          value={totalUsers.toLocaleString("ru-RU")}
          hint={`+${newUsers30} за 30 дней · без учёта гостей`}
          icon={Users}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          title="Выручка по дням"
          description="Успешные оплаты за последние 30 дней"
          className="xl:col-span-2"
        >
          <RevenueChart days={days} />
        </Panel>

        <Panel title="Откуда продажи" description="Оплаты за 30 дней по типу заказа">
          {byType.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#8f7c7a]">Пока нет оплат</p>
          ) : (
            <ul className="space-y-4">
              {byType
                .sort((a, b) => (b._sum.amountRub ?? 0) - (a._sum.amountRub ?? 0))
                .map((t) => {
                  const sum = t._sum.amountRub ?? 0
                  const share = typeTotal ? Math.round((sum / typeTotal) * 100) : 0
                  return (
                    <li key={t.type}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="text-white">{PAYMENT_TYPE[t.type] ?? t.type}</span>
                        <span className="tabular-nums text-[#e8e0e0]">{rub(sum)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-[#e0362a]" style={{ width: `${share}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-[#8f7c7a]">
                        {share}% · {plural(t._count, "оплата", "оплаты", "оплат")}
                      </p>
                    </li>
                  )
                })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          title="Последние платежи"
          action={
            <Link href="/admin/payments" className="text-xs text-[#ff8a7d] hover:underline">
              Все платежи →
            </Link>
          }
          className="xl:col-span-2"
          bodyClassName=""
        >
          <DataTable head={["Когда", "Клиент", "Тариф", "Сумма", "Статус"]} minWidth={560}>
            {recent.map((p) => {
              const st = PAYMENT_STATUS[p.status] ?? { label: p.status, tone: "muted" as const }
              return (
                <tr key={p.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-[#8f7c7a]">{fmtDateTime(p.createdAt)}</td>
                  <td className="px-4 py-3">
                    {p.user ? (
                      <Link href={`/admin/users/${p.user.id}`} className="text-white hover:text-[#ff8a7d]">
                        {p.user.phone}
                      </Link>
                    ) : (
                      <span className="text-[#8f7c7a]">{PAYMENT_TYPE[p.type]}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{p.plan.name}</td>
                  <td className="px-4 py-3 tabular-nums">{rub(p.amountRub)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </td>
                </tr>
              )
            })}
            {recent.length === 0 && <EmptyRow colSpan={5}>Платежей ещё не было</EmptyRow>}
          </DataTable>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Популярные тарифы" description="По выручке за 30 дней">
            {byPlan.length === 0 ? (
              <p className="py-4 text-center text-sm text-[#8f7c7a]">Пока нет оплат</p>
            ) : (
              <ol className="space-y-2.5">
                {byPlan.slice(0, 5).map((row, i) => (
                  <li key={row.planId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-white/[0.05] text-xs text-[#8f7c7a]">
                        {i + 1}
                      </span>
                      <span className="truncate text-white">{planName.get(row.planId) ?? "Удалённый тариф"}</span>
                    </span>
                    <span className="shrink-0 text-right tabular-nums">
                      {rub(row._sum.amountRub ?? 0)}
                      <span className="ml-1.5 text-xs text-[#8f7c7a]">×{row._count}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Suspense fallback={<Panel title="Серверы"><div className="h-16 animate-pulse rounded-lg bg-white/[0.04]" /></Panel>}>
            <NodesPanel />
          </Suspense>
        </div>
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-[#8f7c7a]">
        <UserPlus className="size-3.5" aria-hidden /> Гостевые покупки без регистрации не создают пользователей — они
        видны только в <Link href="/admin/payments" className="text-[#ff8a7d] hover:underline">платежах</Link>.
        <CreditCard className="ml-2 size-3.5" aria-hidden /> Даты — по времени создания платежа.
      </p>
    </div>
  )
}

/** Статус нод из Remnawave — отдельным потоком, чтобы медленная панель не
 *  задерживала всю страницу. */
async function NodesPanel() {
  let nodes: Awaited<ReturnType<typeof listRemnawaveNodes>> | null = null
  try {
    nodes = await listRemnawaveNodes()
  } catch (err) {
    unstable_rethrow(err)
    console.error("[admin] nodes lookup failed", err)
  }
  const online = nodes?.filter((n) => n.status === "online").length ?? 0
  return (
    <Panel
      title="Серверы"
      description={nodes ? `${online} из ${nodes.length} онлайн` : "Панель Remnawave недоступна"}
      action={nodes && <Badge tone={online === nodes.length ? "good" : "warn"}>{online === nodes.length ? "Всё ок" : "Есть сбои"}</Badge>}
    >
      {!nodes ? (
        <p className="text-sm text-[#ff8a7d]">Не удалось получить список нод. Проверьте раздел «Система».</p>
      ) : nodes.length === 0 ? (
        <p className="text-sm text-[#8f7c7a]">Нод нет</p>
      ) : (
        <ul className="space-y-2">
          {nodes.map((n) => (
            <li key={n.host} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className={`size-2 shrink-0 rounded-full ${n.status === "online" ? "bg-emerald-400" : "bg-[#e0362a]"}`} />
                <span className="truncate text-white">{n.countryCode}</span>
                <span className="truncate text-xs text-[#8f7c7a]">{n.host}</span>
              </span>
              <span className="shrink-0 text-xs text-[#8f7c7a]">{n.status === "online" ? "онлайн" : "офлайн"}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
