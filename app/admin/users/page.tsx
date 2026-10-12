import Link from "next/link"
import { Search } from "lucide-react"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { Badge, DataTable, EmptyRow, PageHeader, Pagination, Panel, buttonGhost, fieldClass, inputClass } from "../_components/ui"
import { fmtDate, rub } from "../_components/format"

const PAGE_SIZE = 25

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; page?: string }>
}) {
  const sp = await searchParams
  const q = (sp.q ?? "").trim()
  const role = sp.role === "ADMIN" ? "ADMIN" : undefined
  const page = Math.max(1, Number(sp.page) || 1)

  // Ищем по цифрам номера: «999 123», «+7999…» и «8999…» находят одно и то же.
  const digits = q.replace(/\D/g, "").replace(/^8(?=\d{10})/, "7")
  const where: Prisma.UserWhereInput = {
    ...(digits ? { phone: { contains: digits } } : {}),
    ...(role ? { role } : {}),
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, phone: true, role: true, remnawaveUuid: true, createdAt: true },
    }),
  ])

  const stats = users.length
    ? await prisma.payment.groupBy({
        by: ["userId"],
        where: { userId: { in: users.map((u) => u.id) }, status: "SUCCEEDED" },
        _sum: { amountRub: true },
        _count: true,
        _max: { createdAt: true },
      })
    : []
  const byUser = new Map(stats.map((s) => [s.userId, s]))
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <PageHeader title="Пользователи" description={`Зарегистрированные на сайте: ${total.toLocaleString("ru-RU")}.`} />

      <Panel bodyClassName="">
        <form className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] p-4" role="search">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8f7c7a]" aria-hidden />
            <input name="q" defaultValue={q} placeholder="Поиск по телефону" className={`${inputClass} pl-9`} aria-label="Поиск по телефону" />
          </div>
          <select name="role" defaultValue={role ?? ""} className={fieldClass} aria-label="Роль">
            <option value="">Все роли</option>
            <option value="ADMIN">Только админы</option>
          </select>
          <button type="submit" className={buttonGhost}>
            Найти
          </button>
          {(q || role) && (
            <Link href="/admin/users" className="text-xs text-[#8f7c7a] hover:text-white">
              Сбросить
            </Link>
          )}
        </form>

        <DataTable head={["Телефон", "Роль", "VPN", "Оплат", "Принёс", "Последняя оплата", "Регистрация"]} minWidth={760}>
          {users.map((u) => {
            const s = byUser.get(u.id)
            return (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${u.id}`} className="font-medium text-white hover:text-[#ff8a7d]">
                    {u.phone}
                  </Link>
                </td>
                <td className="px-4 py-3">{u.role === "ADMIN" ? <Badge tone="accent">Админ</Badge> : <span className="text-[#8f7c7a]">Пользователь</span>}</td>
                <td className="px-4 py-3">{u.remnawaveUuid ? <Badge tone="good">Выдан</Badge> : <Badge>Нет</Badge>}</td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">{s?._count ?? 0}</td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums">{s ? rub(s._sum.amountRub ?? 0) : "—"}</td>
                <td className="px-4 py-3 text-[#8f7c7a]">{s?._max.createdAt ? fmtDate(s._max.createdAt) : "—"}</td>
                <td className="px-4 py-3 text-[#8f7c7a]">{fmtDate(u.createdAt)}</td>
              </tr>
            )
          })}
          {users.length === 0 && <EmptyRow colSpan={7}>{q ? "Никого не нашли по этому номеру" : "Пока нет пользователей"}</EmptyRow>}
        </DataTable>
        <Pagination page={page} pageCount={pageCount} basePath="/admin/users" params={{ q: q || undefined, role }} />
      </Panel>
    </div>
  )
}
