import type { ReactNode } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Onest } from "next/font/google"
import { ExternalLink, ShieldCheck } from "lucide-react"
import { requireAdmin } from "@/lib/session"
import { AdminNav } from "./_components/AdminNav"

// Geist из корневого layout не содержит кириллицы — весь русский текст
// админки падал на системный шрифт. Onest — тот же шрифт, что на сайте.
const onest = Onest({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700", "800"] })

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Дублирует проверку из proxy.ts — это Server Component, доверять только
  // edge-гейту нельзя (там нет обращения к БД), поэтому здесь она авторитетная.
  const admin = await requireAdmin()
  if (!admin) redirect("/login.html")

  return (
    <div className={`${onest.className} relative min-h-screen overflow-x-clip bg-[#0a0608] text-[#e8e0e0]`}>
      <div
        aria-hidden
        className="pointer-events-none fixed -right-32 -top-48 size-[560px] rounded-full bg-[#7a120c] opacity-25 blur-[140px]"
      />
      <div className="relative mx-auto flex max-w-[1320px] flex-col gap-6 px-4 py-5 sm:px-6 lg:flex-row lg:gap-8 lg:py-8">
        <aside className="shrink-0 lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)] lg:w-60">
          <div className="flex h-full flex-col rounded-2xl border border-white/[0.07] bg-[#0f0809]/80 p-3 backdrop-blur lg:p-4">
            <Link href="/admin" className="mb-4 flex items-center justify-between px-2 pt-1 lg:mb-6">
              <span className="text-lg font-extrabold tracking-wide text-white">
                DRAGON<span className="text-[#e0362a]">VPN</span>
              </span>
              <span className="rounded-md bg-[#e0362a]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#ff8a7d]">
                admin
              </span>
            </Link>
            <AdminNav />
            <div className="mt-4 hidden border-t border-white/[0.07] pt-4 lg:mt-auto lg:block">
              <div className="flex items-center gap-2 px-2 text-xs text-[#8f7c7a]">
                <ShieldCheck className="size-3.5 text-emerald-400" aria-hidden />
                <span className="truncate">{admin.phone}</span>
              </div>
              <Link
                href="/"
                className="mt-3 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-[#8f7c7a] transition hover:bg-white/[0.04] hover:text-white"
              >
                <ExternalLink className="size-3.5" aria-hidden /> Открыть сайт
              </Link>
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
