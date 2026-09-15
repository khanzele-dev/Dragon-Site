import { prisma } from "@/lib/prisma"
import { fetchYookassaPayment, fetchYookassaRefund } from "@/lib/yookassa"
import {
  ensureRemnawaveUser,
  createGuestRemnawaveUser,
  extendRemnawaveSubscription,
  reduceRemnawaveSubscription,
} from "@/lib/remnawave"

/**
 * Выдача доступа под блокировкой на уровне БД (advisory lock по id платежа).
 * Вебхук ЮKassa и опрос статуса со страницы заказа могут прийти почти
 * одновременно — без лока оба могли бы одновременно пройти проверку
 * `fulfilledAt == null` и продлить подписку дважды. pg_advisory_xact_lock
 * снимается сам в конце транзакции, поэтому явного unlock не нужно.
 *
 * Внешний HTTP-вызов к Remnawave выполняется прямо внутри транзакции — это
 * держит соединение с БД дольше обычного, поэтому таймаут увеличен.
 */
async function fulfillPaymentLocked(paymentId: string) {
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('payment'), hashtext(${paymentId}))`

      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: { plan: true },
      })
      if (payment.fulfilledAt) return // кто-то другой уже выдал, пока мы ждали лок

      let remnawaveUuid = payment.remnawaveUuid

      if (payment.type === "ACCOUNT") {
        const user = await tx.user.findUniqueOrThrow({ where: { id: payment.userId! } })
        remnawaveUuid = user.remnawaveUuid
        if (!remnawaveUuid) {
          const created = await ensureRemnawaveUser({ externalId: user.id, phone: user.phone })
          remnawaveUuid = created.uuid
          await tx.user.update({ where: { id: user.id }, data: { remnawaveUuid } })
        }
      } else if (payment.type === "GUEST_PURCHASE" && !remnawaveUuid) {
        const created = await createGuestRemnawaveUser({ paymentId: payment.id })
        remnawaveUuid = created.uuid
        await tx.payment.update({ where: { id: payment.id }, data: { remnawaveUuid } })
      }
      // GUEST_RENEWAL: remnawaveUuid уже известен с момента создания платежа
      // (нашли пользователя по вставленной ссылке подписки перед оплатой).

      await extendRemnawaveSubscription(remnawaveUuid!, { months: payment.plan.months, days: payment.plan.days })
      await tx.payment.update({ where: { id: payment.id }, data: { fulfilledAt: new Date() } })
    },
    { timeout: 20000 },
  )
}

/**
 * Общая логика подтверждения оплаты — используется и вебхуком ЮKassa, и
 * ручной сверкой при возврате пользователя (личный кабинет — /api/payments/sync,
 * гостевые заказы — /api/guest/orders/status). ЮKassa не подписывает вебхуки,
 * поэтому телу запроса не доверяем — реальный статус всегда берём отдельным
 * запросом к их API.
 *
 * Идемпотентна: Payment.status меняется на SUCCEEDED только один раз,
 * Payment.fulfilledAt отдельно защищает от повторной выдачи VPN в Remnawave.
 */
export async function reconcileYookassaPayment(providerPaymentId: string) {
  const verified = await fetchYookassaPayment(providerPaymentId)

  const payment = await prisma.payment.findUnique({
    where: { providerPaymentId: verified.id },
    include: { plan: true },
  })
  if (!payment) return null

  if (verified.status !== "succeeded") {
    if (verified.status === "canceled" && payment.status === "PENDING") {
      return prisma.payment.update({ where: { id: payment.id }, data: { status: "CANCELED" } })
    }
    return payment
  }

  if (payment.status !== "SUCCEEDED") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCEEDED", rawPayload: verified as unknown as object },
    })
  }

  if (!payment.fulfilledAt) {
    await fulfillPaymentLocked(payment.id)
  }

  return prisma.payment.findUnique({ where: { id: payment.id } })
}

/**
 * Возврат средств за конкретный платёж — урезает подписку ровно на
 * plan.months этого платежа, не больше (даже если платежей у пользователя
 * было несколько). Идемпотентна через Payment.refundedAt, как и выдача.
 */
export async function reconcileYookassaRefund(refundId: string) {
  const refund = await fetchYookassaRefund(refundId)
  if (refund.status !== "succeeded") return null

  const payment = await prisma.payment.findUnique({
    where: { providerPaymentId: refund.payment_id },
    include: { plan: true },
  })
  if (!payment || payment.refundedAt) return payment

  // Урезаем VPN только если по этому платежу его вообще выдавали —
  // иначе просто фиксируем статус, вычитать нечего.
  if (payment.fulfilledAt) {
    const remnawaveUuid =
      payment.remnawaveUuid ??
      (payment.userId ? (await prisma.user.findUnique({ where: { id: payment.userId } }))?.remnawaveUuid : null)
    if (remnawaveUuid) {
      await reduceRemnawaveSubscription(remnawaveUuid, { months: payment.plan.months, days: payment.plan.days })
    }
  }

  return prisma.payment.update({
    where: { id: payment.id },
    data: { status: "REFUNDED", refundedAt: new Date() },
  })
}
