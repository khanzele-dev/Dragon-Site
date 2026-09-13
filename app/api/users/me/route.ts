import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { getRemnawaveSubscription } from "@/lib/remnawave"
import { jsonError } from "@/lib/http"
import { withErrorHandling } from "@/lib/apiHandler"

export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser()
  if (!user) return jsonError("Не авторизован", 401)

  let subscription = null
  if (user.remnawaveUuid) {
    try {
      subscription = await getRemnawaveSubscription(user.remnawaveUuid)
    } catch (err) {
      // Remnawave временно недоступен — не роняем личный кабинет из-за этого,
      // просто отдаём профиль без данных подписки.
      console.error("[users/me] remnawave lookup failed", err)
    }
  }

  const lastPaidPlan = await prisma.payment.findFirst({
    where: { userId: user.id, status: "SUCCEEDED" },
    orderBy: { createdAt: "desc" },
    select: { plan: { select: { name: true } } },
  })

  return NextResponse.json({
    user: { id: user.id, phone: user.phone, role: user.role },
    subscription,
    planName: lastPaidPlan?.plan.name ?? null,
  })
})
