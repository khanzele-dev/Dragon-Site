"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"
import { reconcileYookassaPayment } from "@/lib/paymentFulfillment"
import { describeError } from "../_components/describeError"

export type ReconcileState = { ok: boolean; message: string } | null

const STATUS_RU: Record<string, string> = {
  PENDING: "ещё в обработке у ЮKassa",
  SUCCEEDED: "оплачен",
  CANCELED: "отменён — покупатель не оплатил",
  FAILED: "ошибка оплаты",
  REFUNDED: "возврат",
}

/**
 * Сверяет платёж с ЮKassa и, если он оплачен, выдаёт VPN — та же логика,
 * что у вебхука (идемпотентна и защищена advisory-локом, двойной выдачи не
 * будет). Нужна для «застрявших» оплат: деньги пришли, а Remnawave в тот
 * момент не ответил, или вебхук вообще не дошёл.
 *
 * Возвращает сообщение вместо throw: в production Next.js прячет текст
 * брошенной ошибки, и админ видел бы только «React error #441».
 */
export async function reconcilePayment(paymentId: string, _prev: ReconcileState): Promise<ReconcileState> {
  const admin = await requireAdmin()
  if (!admin) return { ok: false, message: "Нет доступа" }

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
  if (!payment?.providerPaymentId) return { ok: false, message: "У платежа нет ID ЮKassa — сверять нечего" }

  try {
    const result = await reconcileYookassaPayment(payment.providerPaymentId)
    revalidatePath("/admin/payments")
    revalidatePath("/admin")
    if (!result) return { ok: false, message: "Платёж не найден в базе после сверки" }
    if (result.status === "SUCCEEDED" && result.fulfilledAt) return { ok: true, message: "Оплачен, VPN выдан" }
    return { ok: result.status !== "FAILED", message: `Статус: ${STATUS_RU[result.status] ?? result.status}` }
  } catch (err) {
    console.error("[admin] reconcile failed", paymentId, err)
    return { ok: false, message: describeError(err) }
  }
}
