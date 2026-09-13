import bcrypt from "bcryptjs"
import { SignJWT, jwtVerify } from "jose"

export const SESSION_COOKIE = "dragonvpn_session"
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 дней

function secretKey() {
  const secret = process.env.AUTH_JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_JWT_SECRET is not set or too short (see .env.example)")
  }
  return new TextEncoder().encode(secret)
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export type SessionPayload = {
  sub: string // userId
  role: "USER" | "ADMIN"
  tokenVersion: number
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role, tokenVersion: payload.tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey())
}

/** Возвращает payload при валидной подписи/сроке действия, иначе null. Не проверяет tokenVersion против БД — это делает вызывающий код там, где это критично (см. requireUser). */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey())
    if (typeof payload.sub !== "string") return null
    return {
      sub: payload.sub,
      role: payload.role as SessionPayload["role"],
      tokenVersion: payload.tokenVersion as number,
    }
  } catch {
    return null
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
}
