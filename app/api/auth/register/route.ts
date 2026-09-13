import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { normalizePhone } from "@/lib/phone"
import { hashPassword, signSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth"
import { isRateLimited } from "@/lib/rateLimit"
import { clientIp, jsonError } from "@/lib/http"
import { withErrorHandling } from "@/lib/apiHandler"

const bodySchema = z.object({
  phone: z.string().max(32),
  password: z.string().min(8).max(72),
  confirmPassword: z.string(),
})

export const POST = withErrorHandling(async (req: NextRequest) => {
  const ip = clientIp(req)
  if (await isRateLimited(`register:${ip}`, 10, 10 * 60 * 1000)) {
    return jsonError("Слишком много попыток. Попробуйте позже.", 429)
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return jsonError("Некорректные данные", 400)

  const { phone: rawPhone, password, confirmPassword } = parsed.data
  if (password !== confirmPassword) return jsonError("Пароли не совпадают", 400)

  const phone = normalizePhone(rawPhone)
  if (!phone) return jsonError("Введите корректный номер телефона", 400)

  try {
    const existing = await prisma.user.findUnique({ where: { phone } })
    if (existing) return jsonError("Этот номер уже зарегистрирован", 409)

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({ data: { phone, passwordHash } })

    const token = await signSession({ sub: user.id, role: user.role, tokenVersion: user.tokenVersion })
    const res = NextResponse.json({ user: { id: user.id, phone: user.phone, role: user.role } })
    res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS)
    return res
  } catch (err) {
    // Гонка: два запроса с одним номером могли пройти проверку выше одновременно —
    // уникальный индекс в БД ловит это как P2002.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return jsonError("Этот номер уже зарегистрирован", 409)
    }
    throw err
  }
})
