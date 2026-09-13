import { NextRequest, NextResponse } from "next/server"
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth"

/**
 * Гейт на уровне edge — быстрая проверка подписи/срока JWT без похода в БД
 * (Prisma с pg-адаптером не работает в edge runtime). Проверка tokenVersion
 * против БД (реальный отзыв сессии) происходит в lib/session.ts на серверных
 * маршрутах, где это по-настоящему важно (/api/users/me и т.д.).
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const payload = token ? await verifySessionToken(token) : null

  const isAdminRoute = pathname.startsWith("/admin")
  const isDashboard = pathname === "/dashboard.html"
  const isAuthPage = pathname === "/login.html" || pathname === "/register.html"

  if ((isDashboard || isAdminRoute) && !payload) {
    const loginUrl = new URL("/login.html", req.url)
    return NextResponse.redirect(loginUrl)
  }

  if (isAdminRoute && payload?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard.html", req.url))
  }

  if (isAuthPage && payload) {
    return NextResponse.redirect(new URL("/dashboard.html", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard.html", "/admin/:path*", "/login.html", "/register.html"],
}
