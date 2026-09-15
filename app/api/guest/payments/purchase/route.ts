import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isYookassaConfigured } from "@/lib/yookassa"
import { createPayment } from "@/lib/createPayment"
import { isRateLimited } from "@/lib/rateLimit"
import { clientIp, jsonError } from "@/lib/http"
import { withErrorHandling } from "@/lib/apiHandler"

const bodySchema = z.object({ planId: z.string() })

// Открытый эндпоинт (без сессии) — лимитируем по IP.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const ip = clientIp(req)
  if (await isRateLimited(`guest:purchase:ip:${ip}`, 10, 5 * 60 * 1000)) {
    return jsonError("Слишком много запросов. Попробуйте позже.", 429)
  }

  if (!isYookassaConfigured()) {
    return jsonError("Оплата временно недоступна, попробуйте позже.", 503)
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return jsonError("Некорректные данные", 400)

  const appUrl = process.env.APP_URL || "http://localhost:3000"
  const result = await createPayment({
    planId: parsed.data.planId,
    type: "GUEST_PURCHASE",
    returnUrl: `${appUrl}/order-result.html`,
  })

  if (!result.ok) return jsonError(result.error, result.status)
  return NextResponse.json({ confirmationUrl: result.confirmationUrl })
})
