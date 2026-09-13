import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { jsonError } from "@/lib/http"
import { withErrorHandling } from "@/lib/apiHandler"

export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser()
  if (!user) return jsonError("Не авторизован", 401)

  const payments = await prisma.payment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { plan: { select: { name: true } } },
  })

  return NextResponse.json({
    payments: payments.map((p) => ({
      id: p.id,
      date: p.createdAt,
      description: `Подписка — ${p.plan.name}`,
      amount: p.amountRub,
      currency: "₽",
      status:
        p.status === "SUCCEEDED"
          ? "paid"
          : p.status === "PENDING"
            ? "pending"
            : p.status === "REFUNDED"
              ? "refunded"
              : "failed",
    })),
  })
})
