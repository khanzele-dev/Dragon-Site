import Link from "next/link"
import { RefreshCw, Search } from "lucide-react"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { Badge, DataTable, EmptyRow, PageHeader, Pagination, Panel, StatCard, buttonGhost, fieldClass, inputClass } from "../_components/ui"
import { PAYMENT_STATUS, PAYMENT_TYPE, fmtDateTime, rub } from "../_components/format"
import { reconcilePayment } from "./actions"

const PAGE_SIZE = 30
const STATUSES = ["SUCCEEDED", "PENDING", "CANCELED", "FAILED", "REFUNDED"] as const
const TYPES = ["ACCOUNT", "GUEST_PURCHASE", "GUEST_RENEWAL"] as const

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; period?: string; page?: string }>
}) {
  const sp = await searchParams
  const q = (sp.q ?? "").trim()
  // STUCK — не статус в БД, а «оплачен, но VPN не выдан»: то, что требует внимания.
  const status = sp.status === "STUCK" || STATUSES.includes(sp.status as never) ? sp.status : undefined
  const type = TYPES.includes(sp.type as never) ? sp.type : undefined
  const period = ["7", "30", "90"].includes(sp.period ?? "") ? Number(sp.period) : undefined
  const page = Math.max(1, Number(sp.page) || 1)

  const digits = q.replace(/\D/g, "").replace(/^8(?=\d{10})/, "7")
  const where: Prisma.PaymentWhereInput = {
    ...(status === "STUCK"
      ? { status: "SUCCEEDED", fulfilledAt: null }
      : status
        ? { status: status as (typeof STATUSES)[number] }
        : {}),
    ...(type ? { type: type as (typeof TYPES)[number] } : {}),
    ...(period ? { createdAt: { gte: new Date(Date.now() - period * 86_400_000) } } : {}),
    ...(q
      ? {
          OR: [
            ...(digits.length >= 3 ? [{ user: { phone: { contains: digits } } }] : []),
            { id: q },
            { providerPaymentId: q },
          ],
        }
      : {}),
  }

  const [total, payments, sums] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { id: true, phone: true } }, plan: { select: { name: true } } },
    }),
    // «Оплачено» — только успешные платежи внутри выборки. Если фильтр по
    // статусу исключает успешные (например, «В обработке»), там ноль.
    status && status !== "STUCK" && status !== "SUCCEEDED"
      ? Promise.resolve({ _sum: { amountRub: 0 }, _count: 0 })
      : prisma.payment.aggregate({ where: { ...where, status: "SUCCEEDED" }, _sum: { amountRub: true }, _count: true }),
  ])
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const filters = { q: q || undefined, status, type, period: period ? String(period) : undefined }
  const filtered = Boolean(q || status || type || period)

  return (
    <div>
      <PageHeader title="Платежи" description="Все заказы: из личного кабинета и без регистрации." />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label={filtered ? "Найдено заказов" : "Всего заказов"} value={total.toLocaleString("ru-RU")} />
        <StatCard label="Оплачено в выборке" value={rub(sums._sum.amountRub ?? 0)} hint={`${sums._count} успешных`} tone="accent" />
        <StatCard
          label="Средний чек"
          value={rub(sums._count ? Math.round((sums._sum.amountRub ?? 0) / sums._count) : 0)}
        />
      </div>

      <Panel bodyClassName="">
        <form className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] p-4" role="search">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8f7c7a]" aria-hidden />
            <input
              name="q"
              defaultValue={q}
              placeholder="Телефон, ID заказа или ID ЮKassa"
              className={`${inputClass} pl-9`}
              aria-label="Поиск"
            />
          </div>
          <select name="status" defaultValue={status ?? ""} className={fieldClass} aria-label="Статус">
            <option value="">Все статусы</option>
            <option value="STUCK">⚠ Оплачен, VPN не выдан</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {PAYMENT_STATUS[s].label}
              </option>
            ))}
          </select>
          <select name="type" defaultValue={type ?? ""} className={fieldClass} aria-label="Тип">
            <option value="">Все типы</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {PAYMENT_TYPE[t]}
              </option>
            ))}
          </select>
          <select name="period" defaultValue={period ? String(period) : ""} className={fieldClass} aria-label="Период">
            <option value="">За всё время</option>
            <option value="7">7 дней</option>
            <option value="30">30 дней</option>
            <option value="90">90 дней</option>
          </select>
          <button type="submit" className={buttonGhost}>
            Применить
          </button>
          {filtered && (
            <Link href="/admin/payments" className="text-xs text-[#8f7c7a] hover:text-white">
              Сбросить
            </Link>
          )}
        </form>

        <DataTable head={["Дата", "Клиент", "Тип", "Тариф", "Сумма", "Статус", "VPN", ""]} minWidth={860}>
          {payments.map((p) => {
            const st = PAYMENT_STATUS[p.status] ?? { label: p.status, tone: "muted" as const }
            const stuck = p.status === "SUCCEEDED" && !p.fulfilledAt
            const canReconcile = Boolean(p.providerPaymentId) && (stuck || p.status === "PENDING")
            return (
              <tr key={p.id} className={stuck ? "bg-[#e0362a]/[0.06]" : undefined}>
                <td className="whitespace-nowrap px-4 py-3 text-[#8f7c7a]">{fmtDateTime(p.createdAt)}</td>
                <td className="px-4 py-3">
                  {p.user ? (
                    <Link href={`/admin/users/${p.user.id}`} className="text-white hover:text-[#ff8a7d]">
                      {p.user.phone}
                    </Link>
                  ) : (
                    <span className="text-[#8f7c7a]">без регистрации</span>
                  )}
                  <p className="font-mono text-[10px] text-[#6d5d5c]">{p.providerPaymentId ?? p.id}</p>
                </td>
                <td className="px-4 py-3 text-[#8f7c7a]">{PAYMENT_TYPE[p.type] ?? p.type}</td>
                <td className="px-4 py-3">{p.plan.name}</td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">{rub(p.amountRub)}</td>
                <td className="px-4 py-3">
                  <Badge tone={st.tone}>{st.label}</Badge>
                </td>
                <td className="px-4 py-3">
                  {p.fulfilledAt ? (
                    <span className="text-xs text-emerald-400">выдан</span>
                  ) : stuck ? (
                    <Badge tone="bad">не выдан</Badge>
                  ) : (
                    <span className="text-[#8f7c7a]">—</span>
                  )}
                </td>
                <td className="sticky right-0 bg-gradient-to-l from-[#0e0809] from-70% to-transparent px-4 py-3 text-right">
                  {canReconcile && (
                    <form action={reconcilePayment.bind(null, p.id)}>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-[#e8e0e0] transition hover:border-[#e0362a]/50 hover:text-white"
                        title="Сверить статус с ЮKassa и выдать VPN, если оплата прошла"
                      >
                        <RefreshCw className="size-3.5" aria-hidden />
                        {stuck ? "Повторить выдачу" : "Сверить"}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            )
          })}
          {payments.length === 0 && <EmptyRow colSpan={8}>{filtered ? "Ничего не нашли по фильтрам" : "Платежей ещё не было"}</EmptyRow>}
        </DataTable>
        <Pagination page={page} pageCount={pageCount} basePath="/admin/payments" params={filters} />
      </Panel>
    </div>
  )
}
