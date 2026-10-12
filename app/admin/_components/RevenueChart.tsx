import { rub } from "./format"

export type DayPoint = { date: Date; revenue: number; count: number }

const BAR_RED = "#e0362a"

const compact = (v: number) =>
  v >= 1000 ? `${(v / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}k` : String(Math.round(v))

/**
 * Выручка по дням — один ряд, поэтому без легенды (подпись — заголовок
 * панели). Столбики тонкие, со скруглением 4px сверху, между ними зазор;
 * при наведении — подсказка с датой, суммой и числом оплат. Ниже — та же
 * статистика таблицей (для скринридеров и для тех, кому удобнее цифры).
 */
export function RevenueChart({ days }: { days: DayPoint[] }) {
  const max = Math.max(...days.map((d) => d.revenue), 1)
  // Округляем верх шкалы до «красивого» числа, чтобы линия сетки читалась.
  const step = 10 ** Math.floor(Math.log10(max))
  const top = Math.ceil(max / step) * step
  const fmtDay = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })

  return (
    <div>
      <div className="relative h-56 pl-12">
        {/* Сетка: верх, середина, ноль — приглушённая, не спорит с данными */}
        {[1, 0.5, 0].map((f) => (
          <div
            key={f}
            className="absolute left-12 right-0 border-t border-dashed border-white/[0.07]"
            style={{ bottom: `${f * 100}%` }}
          >
            <span className="absolute -left-12 -translate-y-1/2 text-[10px] tabular-nums text-[#8f7c7a]">
              {compact(top * f)}
            </span>
          </div>
        ))}
        <div className="relative flex h-full items-end gap-[2px]">
          {days.map((d, i) => {
            const h = (d.revenue / top) * 100
            // У крайних столбиков подсказка прижимается внутрь, иначе её режет край панели.
            const align = i < 3 ? "left-0" : i > days.length - 4 ? "right-0" : "left-1/2 -translate-x-1/2"
            return (
              <div key={d.date.toISOString()} className="group relative flex h-full flex-1 items-end justify-center">
                {/* Зона наведения во всю высоту — по тонкому столбику легко промахнуться */}
                <div
                  className="w-full max-w-[18px] rounded-t-[4px] transition-[filter] group-hover:brightness-125"
                  style={{ height: d.revenue > 0 ? `max(${h}%, 3px)` : "0", background: BAR_RED }}
                />
                <div
                  className={`pointer-events-none absolute z-10 hidden ${align} whitespace-nowrap rounded-lg border border-white/10 bg-[#1a1011] px-3 py-2 text-xs shadow-xl group-hover:block`}
                  style={{ bottom: `calc(${Math.min(h, 100)}% + 8px)` }}
                >
                  <p className="font-medium text-white">{fmtDay(d.date)}</p>
                  <p className="mt-0.5 tabular-nums text-[#e8e0e0]">{rub(d.revenue)}</p>
                  <p className="text-[#8f7c7a]">оплат: {d.count}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-2 flex justify-between pl-12 text-[10px] text-[#8f7c7a]">
        <span>{fmtDay(days[0].date)}</span>
        <span>{fmtDay(days[Math.floor(days.length / 2)].date)}</span>
        <span>{fmtDay(days[days.length - 1].date)}</span>
      </div>
      <details className="mt-4 text-xs text-[#8f7c7a]">
        <summary className="cursor-pointer select-none hover:text-white">Показать таблицей</summary>
        <div className="mt-2 max-h-56 overflow-y-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[#8f7c7a]">
                <th className="py-1 font-medium">Дата</th>
                <th className="py-1 text-right font-medium">Оплат</th>
                <th className="py-1 text-right font-medium">Выручка</th>
              </tr>
            </thead>
            <tbody className="tabular-nums text-[#e8e0e0]">
              {[...days].reverse().map((d) => (
                <tr key={d.date.toISOString()} className="border-t border-white/[0.05]">
                  <td className="py-1">{fmtDay(d.date)}</td>
                  <td className="py-1 text-right">{d.count}</td>
                  <td className="py-1 text-right">{rub(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
