import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { isYookassaConfigured, createYookassaPayment } from "@/lib/yookassa"
import { jsonError } from "@/lib/http"
import { withErrorHandling } from "@/lib/apiHandler"

const bodySchema = z.object({ planId: z.string() })

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return jsonError("Не авторизован", 401)

  if (!isYookassaConfigured()) {
    return jsonError("Оплата временно недоступна, попробуйте позже.", 503)
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return jsonError("Некорректные данные", 400)

  const plan = await prisma.plan.findUnique({ where: { id: parsed.data.planId } })
  if (!plan || !plan.isActive) return jsonError("Тариф не найден", 404)

  const payment = await prisma.payment.create({
    data: { userId: user.id, planId: plan.id, amountRub: plan.priceRub, status: "PENDING" },
  })

  try {
    const appUrl = process.env.APP_URL || "http://localhost:3000"
    const ykPayment = await createYookassaPayment({
      idempotenceKey: payment.id,
      amountRub: plan.priceRub,
      description: `Dragon VPN — тариф «${plan.name}»`,
      returnUrl: `${appUrl}/dashboard.html?payment=pending`,
      metadata: { paymentId: payment.id, userId: user.id, planId: plan.id },
    })

    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerPaymentId: ykPayment.id },
    })

    return NextResponse.json({ confirmationUrl: ykPayment.confirmation?.confirmation_url })
  } catch (err) {
    console.error("[payments/create]", err)
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } })
    return jsonError("Не удалось создать платёж. Попробуйте позже.", 502)
  }
})
