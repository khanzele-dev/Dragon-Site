"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"
import { reconcileYookassaPayment } from "@/lib/paymentFulfillment"

/**
 * Сверяет платёж с ЮKassa и, если он оплачен, выдаёт VPN — та же логика,
 * что у вебхука (идемпотентна и защищена advisory-локом, двойной выдачи не
 * будет). Нужна для «застрявших» оплат: деньги пришли, а Remnawave в тот
 * момент не ответил, или вебхук вообще не дошёл.
 */
export async function reconcilePayment(paymentId: string) {
  const admin = await requireAdmin()
  if (!admin) throw new Error("Нет доступа")

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
  if (!payment?.providerPaymentId) throw new Error("У платежа нет ID ЮKassa — сверять нечего")

  try {
    await reconcileYookassaPayment(payment.providerPaymentId)
  } catch (err) {
    console.error("[admin] reconcile failed", err)
    throw new Error("Не удалось сверить: ЮKassa или Remnawave не ответили. Попробуйте через минуту.")
  }
  revalidatePath("/admin/payments")
  revalidatePath("/admin")
}
