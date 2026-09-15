import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getRemnawaveUserByShortUuid } from "@/lib/remnawave"
import { extractSubscriptionKey } from "@/lib/subscriptionLink"
import { isRateLimited } from "@/lib/rateLimit"
import { clientIp, jsonError } from "@/lib/http"
import { withErrorHandling } from "@/lib/apiHandler"

const bodySchema = z.object({ subscriptionKey: z.string().min(1) })

// Открытый эндпоинт (без сессии) — лимитируем по IP. Отдаём только то, что
// нужно показать гостю (статус/трафик/срок/ссылку) — без внутренних полей
// панели (uuid, username и т.п.), как и toSubscription() в lib/remnawave.ts.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const ip = clientIp(req)
  if (await isRateLimited(`guest:lookup:ip:${ip}`, 20, 5 * 60 * 1000)) {
    return jsonError("Слишком много запросов. Попробуйте позже.", 429)
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return jsonError("Некорректные данные", 400)

  const key = extractSubscriptionKey(parsed.data.subscriptionKey)
  if (!key) return jsonError("Не удалось распознать ссылку подписки", 400)

  try {
    const found = await getRemnawaveUserByShortUuid(key)
    return NextResponse.json({
      subscription: {
        status: found.status,
        expireAt: found.expireAt,
        trafficLimitBytes: found.trafficLimitBytes,
        trafficUsedBytes: found.trafficUsedBytes,
        subscriptionUrl: found.subscriptionUrl,
      },
    })
  } catch (err) {
    console.error("[guest/subscription/lookup]", err)
    return jsonError("Подписка не найдена. Проверьте ссылку.", 404)
  }
})
