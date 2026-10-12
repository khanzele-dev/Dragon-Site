"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CreditCard, LayoutDashboard, Settings, Tags, Users } from "lucide-react"

const NAV = [
  { href: "/admin", label: "Обзор", icon: LayoutDashboard },
  { href: "/admin/users", label: "Пользователи", icon: Users },
  { href: "/admin/payments", label: "Платежи", icon: CreditCard },
  { href: "/admin/plans", label: "Тарифы", icon: Tags },
  { href: "/admin/settings", label: "Система", icon: Settings },
]

export function AdminNav() {
  const pathname = usePathname()
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label="Разделы админки">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition " +
              (active
                ? "bg-[#e0362a]/12 font-medium text-white ring-1 ring-inset ring-[#e0362a]/35"
                : "text-[#b8a9a9] hover:bg-white/[0.04] hover:text-white")
            }
          >
            <Icon className={"size-4 " + (active ? "text-[#ff6b5c]" : "text-[#8f7c7a]")} aria-hidden />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
