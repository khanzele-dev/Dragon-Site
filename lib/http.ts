import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}

/** Единая точка для ответов об ошибке — никогда не пробрасывает message исключения наружу. */
export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}
