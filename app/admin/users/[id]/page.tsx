import { notFound, unstable_rethrow } from "next/navigation"
import { Suspense } from "react"
import { getRemnawaveSubscription } from "@/lib/remnawave"
import { prisma } from "@/lib/prisma"
import { Badge, DataTable, EmptyRow, Field, PageHeader, Panel, StatCard } from "../../_components/ui"
import { PAYMENT_STATUS, PAYMENT_TYPE, SUB_STATUS, daysLeft, fmtDate, fmtDateTime, gb, plural, rub } from "../../_components/format"
import { grantDays, resetSessions } from "../actions"
import { GrantDaysForm, ResetSessionsForm } from "./UserActions"

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      payments: { orderBy: { createdAt: "desc" }, include: { plan: { select: { name: true } } } },
    },
  })
  if (!user) notFound()

  const paid = user.payments.filter((p) => p.status === "SUCCEEDED")
  const ltv = paid.reduce((s, p) => s + p.amountRub, 0)

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/users", label: "Все пользователи" }}
        title={user.phone}
        description={`Зарегистрирован ${fmtDate(user.createdAt)} · ID ${user.id}`}
        actions={user.role === "ADMIN" ? <Badge tone="accent">Администратор</Badge> : undefined}
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Принёс всего" value={rub(ltv)} tone="accent" />
        <StatCard label="Успешных оплат" value={paid.length} />
        <StatCard label="Всего заказов" value={user.payments.length} hint="включая отменённые" />
        <StatCard label="Последняя оплата" value={paid[0] ? fmtDate(paid[0].createdAt) : "—"} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Suspense
          fallback={
            <Panel title="Подписка VPN" className="xl:col-span-2">
              <div className="h-40 animate-pulse rounded-lg bg-white/[0.04]" />
            </Panel>
          }
        >
          <SubscriptionPanel uuid={user.remnawaveUuid} />
        </Suspense>

        <Panel title="Действия" description="Изменения сразу применяются в Remnawave">
          <div className="space-y-6">
            <GrantDaysForm action={grantDays.bind(null, user.id)} />
            <ResetSessionsForm action={resetSessions.bind(null, user.id)} />
          </div>
        </Panel>
      </div>

      <Panel title="Платежи" description={plural(user.payments.length, "заказ", "заказа", "заказов")} className="mt-4" bodyClassName="">
        <DataTable head={["Дата", "Тариф", "Тип", "Сумма", "Статус", "VPN выдан", "ID ЮKassa"]} minWidth={760}>
          {user.payments.map((p) => {
            const st = PAYMENT_STATUS[p.status] ?? { label: p.status, tone: "muted" as const }
            return (
              <tr key={p.id}>
                <td className="whitespace-nowrap px-4 py-3 text-[#8f7c7a]">{fmtDateTime(p.createdAt)}</td>
                <td className="px-4 py-3">{p.plan.name}</td>
                <td className="px-4 py-3 text-[#8f7c7a]">{PAYMENT_TYPE[p.type]}</td>
                <td className="px-4 py-3 tabular-nums">{rub(p.amountRub)}</td>
                <td className="px-4 py-3">
                  <Badge tone={st.tone}>{st.label}</Badge>
                </td>
                <td className="px-4 py-3 text-[#8f7c7a]">{p.fulfilledAt ? fmtDateTime(p.fulfilledAt) : "—"}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-[#8f7c7a]">{p.providerPaymentId ?? "—"}</td>
              </tr>
            )
          })}
          {user.payments.length === 0 && <EmptyRow colSpan={7}>Заказов не было</EmptyRow>}
        </DataTable>
      </Panel>
    </div>
  )
}

/** Живые данные из Remnawave — отдельным потоком: панель может отвечать
 *  медленно, а остальная карточка должна открыться сразу. */
async function SubscriptionPanel({ uuid }: { uuid: string | null }) {
  if (!uuid) {
    return (
      <Panel title="Подписка VPN" className="xl:col-span-2">
        <p className="text-sm text-[#8f7c7a]">
          VPN ещё не выдавался — запись в Remnawave появится после первой оплаты или ручного продления.
        </p>
      </Panel>
    )
  }

  let sub: Awaited<ReturnType<typeof getRemnawaveSubscription>> | null = null
  try {
    sub = await getRemnawaveSubscription(uuid)
  } catch (err) {
    unstable_rethrow(err)
    console.error("[admin] subscription lookup failed", err)
  }

  if (!sub) {
    return (
      <Panel title="Подписка VPN" className="xl:col-span-2">
        <p className="text-sm text-[#ff8a7d]">Remnawave не ответил. UUID: {uuid}</p>
      </Panel>
    )
  }

  const st = SUB_STATUS[sub.status] ?? { label: sub.status, tone: "muted" as const }
  const pct = sub.trafficLimitBytes > 0 ? Math.min(100, (sub.trafficUsedBytes / sub.trafficLimitBytes) * 100) : 0
  const left = daysLeft(sub.expireAt)

  return (
    <Panel title="Подписка VPN" action={<Badge tone={st.tone}>{st.label}</Badge>} className="xl:col-span-2">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8f7c7a]">Осталось</p>
          <p className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-white">{plural(left, "день", "дня", "дней")}</p>
          <p className="mt-1 text-sm text-[#8f7c7a]">до {fmtDate(sub.expireAt)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8f7c7a]">Трафик в этом месяце</p>
          <p className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-white">{gb(sub.trafficUsedBytes)}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-[#e0362a]" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-[#8f7c7a]">
            из {gb(sub.trafficLimitBytes)} · {pct.toFixed(0)}%
          </p>
        </div>
      </div>
      <div className="mt-5 border-t border-white/[0.06] pt-2">
        <Field label="Ссылка подписки">
          <span className="font-mono text-xs">{sub.subscriptionUrl}</span>
        </Field>
        <Field label="UUID в Remnawave">
          <span className="font-mono text-xs">{uuid}</span>
        </Field>
      </div>
    </Panel>
  )
}
