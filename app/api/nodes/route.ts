import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/session"
import { listRemnawaveNodes } from "@/lib/remnawave"
import { jsonError } from "@/lib/http"
import { withErrorHandling } from "@/lib/apiHandler"

export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser()
  if (!user) return jsonError("Не авторизован", 401)

  try {
    const nodes = await listRemnawaveNodes()
    return NextResponse.json({ nodes })
  } catch (err) {
    console.error("[nodes] remnawave lookup failed", err)
    return NextResponse.json({ nodes: [] })
  }
})
