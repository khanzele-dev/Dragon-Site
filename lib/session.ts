import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth"

/**
 * Читает сессионную куку, проверяет подпись JWT и сверяет tokenVersion с БД —
 * это и есть механизм отзыва сессий (смена пароля/бан бампает tokenVersion,
 * все ранее выданные токены сразу становятся недействительными).
 */
export async function getCurrentUser() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  const payload = await verifySessionToken(token)
  if (!payload) return null

  const user = await prisma.user.findUnique({ where: { id: payload.sub } })
  if (!user || user.tokenVersion !== payload.tokenVersion) return null

  return user
}

export async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== "ADMIN") return null
  return user
}
