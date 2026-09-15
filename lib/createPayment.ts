import type { PaymentType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { createYookassaPayment } from "@/lib/yookassa"
import { generateOrderToken } from "@/lib/orderToken"

type CreatePaymentParams = {
  planId: string
  type: PaymentType
  /** ACCOUNT — платёж привязан к пользователю личного кабинета. */
  userId?: string
  /** GUEST_RENEWAL — панельный пользователь уже найден по ссылке подписки на момент создания. */
  remnawaveUuid?: string
  /** Базовый return_url без query — для гостевых типов сюда допишется ?order_token=... */
  returnUrl: string
}

export type CreatePaymentResult =
  | { ok: true; confirmationUrl: string }
  | { ok: false; error: string; status: number }

/**
 * Единая точка создания платежа ЮKassa — аккаунт-покупка/продление и обе
 * гостевые сценарии (покупка/продление без регистрации) вызывают именно эту
 * функцию с разными параметрами, а не дублируют шаги создания Payment/оплаты.
 * Выдача доступа после оплаты — отдельно, в lib/paymentFulfillment.ts.
 */
export async function createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
  const plan = await prisma.plan.findUnique({ where: { id: params.planId } })
  if (!plan || !plan.isActive) {
    return { ok: false, error: "Тариф не найден", status: 404 }
  }

  const isGuest = params.type !== "ACCOUNT"
  const orderToken = isGuest ? generateOrderToken() : null

  const payment = await prisma.payment.create({
    data: {
      userId: params.userId,
      planId: plan.id,
      type: params.type,
      remnawaveUuid: params.remnawaveUuid,
      amountRub: plan.priceRub,
      status: "PENDING",
      orderTokenHash: orderToken?.hash,
    },
  })

  const returnUrl = orderToken
    ? `${params.returnUrl}${params.returnUrl.includes("?") ? "&" : "?"}order_token=${orderToken.token}`
    : params.returnUrl

  try {
    const ykPayment = await createYookassaPayment({
      idempotenceKey: payment.id,
      amountRub: plan.priceRub,
      description: `Dragon VPN — тариф «${plan.name}»`,
      returnUrl,
      metadata: { paymentId: payment.id, planId: plan.id, type: params.type },
    })

    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerPaymentId: ykPayment.id },
    })

    return { ok: true, confirmationUrl: ykPayment.confirmation?.confirmation_url ?? "" }
  } catch (err) {
    console.error("[createPayment]", err)
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } })
    return { ok: false, error: "Не удалось создать платёж. Попробуйте позже.", status: 502 }
  }
}
