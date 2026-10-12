import type { ReactNode } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { Tone } from "./format"

// Базовые кирпичики админки. Цвета — те же токены, что у публичного сайта:
// фон #0a0608, акцент #e0362a, приглушённый текст #8f7c7a.

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  back?: { href: string; label: string }
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link
            href={back.href}
            className="mb-3 inline-flex items-center gap-1 text-xs text-[#8f7c7a] transition hover:text-white"
          >
            <ChevronLeft className="size-3.5" /> {back.label}
          </Link>
        )}
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-white">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-[#8f7c7a]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({
  title,
  description,
  action,
  children,
  className = "",
  bodyClassName = "p-5",
}: {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section
      className={
        "min-w-0 rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#140c0d] to-[#0d0708] " + className
      }
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-white">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-[#8f7c7a]">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: LucideIcon
  tone?: "default" | "accent" | "warn"
}) {
  const ring =
    tone === "accent"
      ? "border-[#e0362a]/40 from-[#2a1210] to-[#0d0708]"
      : tone === "warn"
        ? "border-amber-400/30 from-[#1f1709] to-[#0d0708]"
        : "border-white/[0.07] from-[#140c0d] to-[#0d0708]"
  return (
    <div className={`min-w-0 rounded-2xl border bg-gradient-to-br p-5 ${ring}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8f7c7a]">{label}</p>
        {Icon && <Icon className="size-4 shrink-0 text-[#8f7c7a]" aria-hidden />}
      </div>
      <p className="mt-3 truncate text-[21px] font-extrabold sm:text-[28px] leading-none tracking-[-0.03em] text-white tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-[#8f7c7a]">{hint}</p>}
    </div>
  )
}

const TONE_CLASS: Record<Tone, string> = {
  good: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/25",
  warn: "bg-amber-400/10 text-amber-300 ring-amber-400/25",
  bad: "bg-[#e0362a]/12 text-[#ff8a7d] ring-[#e0362a]/30",
  muted: "bg-white/[0.04] text-[#a8999a] ring-white/10",
  accent: "bg-[#e0362a]/15 text-[#ff8a7d] ring-[#e0362a]/35",
}

export function Badge({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  )
}

/** Таблица в рамке со скроллом по горизонтали на узких экранах. */
export function DataTable({ head, children, minWidth = 640 }: { head: ReactNode[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-white/[0.07] text-[11px] uppercase tracking-[0.1em] text-[#8f7c7a]">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-white/[0.05] [&>tr:last-child]:border-none [&>tr]:transition-colors hover:[&>tr]:bg-white/[0.02]">
          {children}
        </tbody>
      </table>
    </div>
  )
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-[#8f7c7a]">
        {children}
      </td>
    </tr>
  )
}

/** Пагинация через ?page= — сохраняет остальные параметры фильтра. */
export function Pagination({
  page,
  pageCount,
  basePath,
  params,
}: {
  page: number
  pageCount: number
  basePath: string
  params: Record<string, string | undefined>
}) {
  if (pageCount <= 1) return null
  const href = (p: number) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v)
    if (p > 1) q.set("page", String(p))
    const s = q.toString()
    return s ? `${basePath}?${s}` : basePath
  }
  const btn =
    "inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs text-[#c9bcbc] transition hover:border-[#e0362a]/50 hover:text-white"
  const off = "pointer-events-none opacity-35"
  return (
    <nav className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3 text-xs text-[#8f7c7a]">
      <span>
        Страница {page} из {pageCount}
      </span>
      <div className="flex gap-2">
        <Link href={href(page - 1)} className={`${btn} ${page <= 1 ? off : ""}`} aria-disabled={page <= 1}>
          <ChevronLeft className="size-3.5" /> Назад
        </Link>
        <Link href={href(page + 1)} className={`${btn} ${page >= pageCount ? off : ""}`} aria-disabled={page >= pageCount}>
          Вперёд <ChevronRight className="size-3.5" />
        </Link>
      </div>
    </nav>
  )
}

// Без ширины — для select/коротких полей; inputClass — то же на всю ширину.
export const fieldClass =
  "h-9 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition placeholder:text-[#6d5d5c] focus:border-[#e0362a] focus:ring-2 focus:ring-[#e0362a]/20"

export const inputClass = `${fieldClass} w-full`

export const buttonPrimary =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-[#ff5240] via-[#e0362a] to-[#7a140f] px-4 text-sm font-medium text-white shadow-[0_8px_24px_-12px_rgba(224,54,42,.8)] transition hover:brightness-110 disabled:opacity-50"

export const buttonGhost =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 px-4 text-sm text-[#e8e0e0] transition hover:border-[#e0362a]/50 hover:bg-[#e0362a]/10 hover:text-white disabled:opacity-50"

/** Строка «ключ — значение» для карточек с деталями. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] py-2.5 text-sm last:border-none">
      <span className="shrink-0 text-[#8f7c7a]">{label}</span>
      <span className="min-w-0 break-words text-right text-white">{children}</span>
    </div>
  )
}
