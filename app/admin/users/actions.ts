"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"
import { ensureRemnawaveUser, extendRemnawaveSubscription } from "@/lib/remnawave"
import { describeError } from "../_components/describeError"

export type ActionState = { ok: boolean; message: string } | null

/** Ручное продление подписки на N дней — компенсация, подарок, разбор
 *  жалобы. Если у пользователя ещё нет записи в Remnawave, создаём её так
 *  же, как при первой оплате. Деньги не списываются, платёж не создаётся. */
export async function grantDays(userId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin()
  if (!admin) return { ok: false, message: "Нет доступа" }

  const parsed = z.coerce.number().int().min(1).max(365).safeParse(formData.get("days"))
  if (!parsed.success) return { ok: false, message: "Укажите от 1 до 365 дней" }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return { ok: false, message: "Пользователь не найден" }

  try {
    let uuid = user.remnawaveUuid
    if (!uuid) {
      uuid = (await ensureRemnawaveUser({ externalId: user.id, phone: user.phone })).uuid
      await prisma.user.update({ where: { id: user.id }, data: { remnawaveUuid: uuid } })
    }
    await extendRemnawaveSubscription(uuid, { months: 0, days: parsed.data })
  } catch (err) {
    console.error("[admin] grantDays failed", err)
    return { ok: false, message: describeError(err) }
  }

  console.info(`[admin] ${admin.phone} granted ${parsed.data}d to ${user.phone}`)
  revalidatePath(`/admin/users/${userId}`)
  return { ok: true, message: `Добавлено дней: ${parsed.data}` }
}

/** Выкидывает пользователя со всех устройств: все выданные JWT становятся
 *  недействительными (тот же механизм, что при смене пароля). */
export async function resetSessions(userId: string, _prev: ActionState): Promise<ActionState> {
  const admin = await requireAdmin()
  if (!admin) return { ok: false, message: "Нет доступа" }
  if (admin.id === userId) return { ok: false, message: "Свои сессии так сбросить нельзя — вы выйдете из админки" }

  await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } })
  revalidatePath(`/admin/users/${userId}`)
  return { ok: true, message: "Все сессии пользователя завершены" }
}
