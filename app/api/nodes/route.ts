import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { listRemnawaveNodes } from "@/lib/remnawave"
import { jsonError } from "@/lib/http"
import { withErrorHandling } from "@/lib/apiHandler"
import { isRateLimited } from "@/lib/rateLimit"

export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser()
  if (!user) return jsonError("Не авторизован", 401)

  // Каждый запрос идёт наружу в Remnawave-панель — лимитируем по юзеру,
  // чтобы один залогиненный аккаунт не мог заспамить панель запросами.
  if (await isRateLimited(`nodes:user:${user.id}`, 30, 60 * 1000)) {
    return jsonError("Слишком много запросов. Попробуйте позже.", 429)
  }

  try {
    const nodes = await listRemnawaveNodes()
    return NextResponse.json({ nodes })
  } catch (err) {
    console.error("[nodes] remnawave lookup failed", err)
    return NextResponse.json({ nodes: [] })
  }
})
