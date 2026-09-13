import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { normalizePhone } from "@/lib/phone"
import { verifyPassword, signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth"
import { isRateLimited } from "@/lib/rateLimit"
import { clientIp, jsonError } from "@/lib/http"
import { withErrorHandling } from "@/lib/apiHandler"

const bodySchema = z.object({
  phone: z.string().max(32),
  password: z.string().max(200),
})

export const POST = withErrorHandling(async (req: NextRequest) => {
  const ip = clientIp(req)

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return jsonError("Некорректные данные", 400)

  const phone = normalizePhone(parsed.data.phone)
  const genericError = () => jsonError("Неверный телефон или пароль", 401)

  // Лимитируем и по IP, и по конкретному номеру — так подбор пароля к одному
  // аккаунту с разных IP тоже упирается в лимит.
  if (await isRateLimited(`login:ip:${ip}`, 20, 10 * 60 * 1000)) {
    return jsonError("Слишком много попыток. Попробуйте позже.", 429)
  }
  if (phone && (await isRateLimited(`login:phone:${phone}`, 8, 10 * 60 * 1000))) {
    return jsonError("Слишком много попыток. Попробуйте позже.", 429)
  }

  if (!phone) return genericError()

  try {
    const user = await prisma.user.findUnique({ where: { phone } })
    if (!user) return genericError()

    const ok = await verifyPassword(parsed.data.password, user.passwordHash)
    if (!ok) return genericError()

    const token = await signSession({ sub: user.id, role: user.role, tokenVersion: user.tokenVersion })
    const res = NextResponse.json({ user: { id: user.id, phone: user.phone, role: user.role } })
    res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS)
    return res
  } catch (err) {
    console.error("[auth/login]", err)
    return jsonError("Сервис временно недоступен. Попробуйте позже.", 500)
  }
})
