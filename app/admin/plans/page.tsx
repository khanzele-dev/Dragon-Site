import { prisma } from "@/lib/prisma"
import { togglePlanActive, createPlan, updatePlan, deletePlan } from "./actions"
import { Badge, PageHeader, Panel, buttonPrimary, fieldClass, inputClass } from "../_components/ui"
import { rub } from "../_components/format"

const small = `${fieldClass} h-8 w-full px-2`

export default async function AdminPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>
}) {
  const { ok, error } = await searchParams
  const since30 = new Date(Date.now() - 30 * 86_400_000)
  const [plans, sales, sales30] = await Promise.all([
    prisma.plan.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.payment.groupBy({ by: ["planId"], where: { status: "SUCCEEDED" }, _sum: { amountRub: true }, _count: true }),
    prisma.payment.groupBy({ by: ["planId"], where: { status: "SUCCEEDED", createdAt: { gte: since30 } }, _count: true }),
  ])
  const allTime = new Map(sales.map((s) => [s.planId, s]))
  const recent = new Map(sales30.map((s) => [s.planId, s._count]))

  return (
    <div>
      <PageHeader
        title="Тарифы"
        description="Изменения сразу видны на сайте и в личном кабинете — они берут список из /api/plans. Скрытый тариф пропадает с сайта, но история платежей по нему сохраняется."
      />

      {(ok || error) && (
        <p
          role="status"
          className={`mb-4 rounded-xl px-4 py-3 text-sm ring-1 ring-inset ${
            error ? "bg-[#e0362a]/10 text-[#ffd0ca] ring-[#e0362a]/35" : "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25"
          }`}
        >
          {error ?? ok}
        </p>
      )}

      <Panel bodyClassName="">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] text-[11px] uppercase tracking-[0.1em] text-[#8f7c7a]">
                <th className="px-3 py-3 font-medium">Код</th>
                <th className="px-3 py-3 font-medium">Название</th>
                <th className="px-3 py-3 font-medium">Бейдж</th>
                <th className="px-3 py-3 font-medium">Мес.</th>
                <th className="px-3 py-3 font-medium">Дн.</th>
                <th className="px-3 py-3 font-medium">Цена, ₽</th>
                <th className="px-3 py-3 font-medium">Сорт.</th>
                <th className="px-3 py-3 font-medium">Продажи</th>
                <th className="px-3 py-3 font-medium">Статус</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const formId = `plan-form-${plan.id}`
                const s = allTime.get(plan.id)
                const perMonth =
                  plan.months > 0 ? Math.round(plan.priceRub / (plan.months + plan.days / 30)) : null
                return (
                  <tr key={plan.id} className="border-b border-white/[0.05] align-top last:border-none">
                    <td className="px-3 py-3 font-mono text-xs text-[#8f7c7a]">
                      {plan.code}
                      {/* Форма без визуального тела — инпуты в других ячейках привязаны к ней через form={formId} */}
                      <form id={formId} action={updatePlan.bind(null, plan.id)} />
                    </td>
                    <td className="min-w-[140px] px-3 py-3">
                      <input form={formId} name="name" defaultValue={plan.name} required className={small} aria-label="Название" />
                    </td>
                    <td className="min-w-[130px] px-3 py-3">
                      <input form={formId} name="badge" defaultValue={plan.badge ?? ""} placeholder="—" className={small} aria-label="Бейдж" />
                    </td>
                    <td className="px-3 py-3">
                      <input form={formId} name="months" type="number" min={0} defaultValue={plan.months} className={`${fieldClass} h-8 w-16 px-2`} aria-label="Месяцев" />
                    </td>
                    <td className="px-3 py-3">
                      <input form={formId} name="days" type="number" min={0} defaultValue={plan.days} className={`${fieldClass} h-8 w-16 px-2`} aria-label="Дней" />
                    </td>
                    <td className="px-3 py-3">
                      <input form={formId} name="priceRub" type="number" min={1} required defaultValue={plan.priceRub} className={`${fieldClass} h-8 w-24 px-2`} aria-label="Цена" />
                      {perMonth && <p className="mt-1 text-[11px] text-[#8f7c7a]">≈ {rub(perMonth)}/мес</p>}
                    </td>
                    <td className="px-3 py-3">
                      <input form={formId} name="sortOrder" type="number" defaultValue={plan.sortOrder} className={`${fieldClass} h-8 w-16 px-2`} aria-label="Порядок" />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs">
                      <p className="tabular-nums text-white">{rub(s?._sum.amountRub ?? 0)}</p>
                      <p className="text-[#8f7c7a]">
                        {s?._count ?? 0} всего · {recent.get(plan.id) ?? 0} за 30 дн.
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      {plan.isActive ? <Badge tone="good">На сайте</Badge> : <Badge>Скрыт</Badge>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-stretch gap-1.5">
                        <button
                          type="submit"
                          form={formId}
                          className="rounded-lg bg-[#e0362a] px-3 py-1.5 text-xs font-medium text-white transition hover:brightness-110"
                        >
                          Сохранить
                        </button>
                        <form action={togglePlanActive.bind(null, plan.id)}>
                          <button
                            type="submit"
                            className="w-full rounded-lg border border-[#e0362a]/40 px-3 py-1.5 text-xs text-[#e8e0e0] transition hover:bg-[#e0362a] hover:text-white"
                          >
                            {plan.isActive ? "Скрыть" : "Показать"}
                          </button>
                        </form>
                        <form action={deletePlan.bind(null, plan.id)}>
                          <button
                            type="submit"
                            className="w-full rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#8f7c7a] transition hover:border-red-500/40 hover:text-red-400"
                          >
                            Удалить
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {plans.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-[#8f7c7a]">
                    Тарифов пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Новый тариф"
        description="Бейдж — необязательная метка на карточке («Популярное», «Выгода ≈5%»). С бейджем карточка на сайте подсвечивается."
        className="mt-6 max-w-3xl"
      >
        <form action={createPlan} className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <label className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
            <span className="text-xs text-[#8f7c7a]">Код (уникальный)</span>
            <input name="code" required placeholder="test5d" className={inputClass} />
          </label>
          <label className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
            <span className="text-xs text-[#8f7c7a]">Название</span>
            <input name="name" required placeholder="Тест (+5 дней)" className={inputClass} />
          </label>
          <label className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
            <span className="text-xs text-[#8f7c7a]">Бейдж (необязательно)</span>
            <input name="badge" placeholder="Популярное" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-[#8f7c7a]">Месяцев</span>
            <input name="months" type="number" min={0} defaultValue={0} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-[#8f7c7a]">Дней</span>
            <input name="days" type="number" min={0} defaultValue={0} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-[#8f7c7a]">Цена, ₽</span>
            <input name="priceRub" type="number" min={1} required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-[#8f7c7a]">Порядок сортировки</span>
            <input name="sortOrder" type="number" defaultValue={99} className={inputClass} />
          </label>
          <div className="col-span-2 flex items-end sm:col-span-3">
            <button type="submit" className={buttonPrimary}>
              Создать тариф
            </button>
          </div>
        </form>
      </Panel>
    </div>
  )
}
