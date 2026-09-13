import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandling } from "@/lib/apiHandler"

export const GET = withErrorHandling(async () => {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, code: true, name: true, badge: true, months: true, days: true, priceRub: true },
  })
  return NextResponse.json({ plans })
})
