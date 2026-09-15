import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashOrderToken } from "@/lib/orderToken"
import { reconcileYookassaPayment } from "@/lib/paymentFulfillment"
import { getRemnawaveSubscription } from "@/lib/remnawave"
import { isRateLimited } from "@/lib/rateLimit"
import { clientIp, jsonError } from "@/lib/http"
import { withErrorHandling } from "@/lib/apiHandler"

// Открытый эндпоинт (без сессии) — доступ к заказу даёт только знание
// одноразового токена из return_url. Если платёж ещё не подтверждён, сверяем
// его с ЮKassa прямо сейчас — тем же вызовом, что использует вебхук, а не
// ждём отдельно его доставки.
export const GET = withErrorHandling(async (req: NextRequest) => {
  const ip = clientIp(req)
  if (await isRateLimited(`guest:order-status:ip:${ip}`, 30, 5 * 60 * 1000)) {
    return jsonError("Слишком много запросов. Попробуйте позже.", 429)
  }

  const token = req.nextUrl.searchParams.get("token")
  if (!token) return jsonError("Не передан токен заказа", 400)

  let payment = await prisma.payment.findUnique({
    where: { orderTokenHash: hashOrderToken(token) },
    include: { plan: true },
  })
  if (!payment) return jsonError("Заказ не найден", 404)

  if (payment.providerPaymentId && (payment.status === "PENDING" || (payment.status === "SUCCEEDED" && !payment.fulfilledAt))) {
    const reconciled = await reconcileYookassaPayment(payment.providerPaymentId)
    if (reconciled) payment = { ...payment, ...reconciled }
  }

  let subscriptionUrl: string | null = null
  if (payment.fulfilledAt && payment.remnawaveUuid) {
    try {
      const sub = await getRemnawaveSubscription(payment.remnawaveUuid)
      subscriptionUrl = sub.subscriptionUrl
    } catch (err) {
      console.error("[guest/orders/status] remnawave lookup failed", err)
    }
  }

  return NextResponse.json({
    status: payment.status,
    planName: payment.plan.name,
    amountRub: payment.amountRub,
    fulfilledAt: payment.fulfilledAt,
    subscriptionUrl,
  })
})
