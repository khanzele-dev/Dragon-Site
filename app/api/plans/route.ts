import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandling } from "@/lib/apiHandler"
import { isRateLimited } from "@/lib/rateLimit"
import { clientIp, jsonError } from "@/lib/http"

// Публичный, невайторизованный эндпоинт (карточки тарифов на главной) —
// лимитируем по IP, чтобы его нельзя было использовать для флуда БД.
export const GET = withErrorHandling(async (req: NextRequest) => {
  if (await isRateLimited(`plans:ip:${clientIp(req)}`, 60, 60 * 1000)) {
    return jsonError("Слишком много запросов. Попробуйте позже.", 429)
  }

  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, code: true, name: true, badge: true, months: true, days: true, priceRub: true },
  })
  return NextResponse.json({ plans })
})
