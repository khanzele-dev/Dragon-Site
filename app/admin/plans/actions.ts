"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"

export async function togglePlanActive(planId: string) {
  const admin = await requireAdmin()
  if (!admin) throw new Error("Не авторизован")

  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } })
  await prisma.plan.update({ where: { id: planId }, data: { isActive: !plan.isActive } })
  revalidatePath("/admin/plans")
}

// Пустая строка/отсутствие поля → null (нет бейджа на карточке).
const badgeField = z.preprocess(
  (v) => (typeof v === "string" && v.trim().length > 0 ? v.trim() : null),
  z.string().max(40, "Бейдж слишком длинный").nullable(),
)

const planFieldsSchema = z.object({
  name: z.string().trim().min(1, "Название обязательно"),
  badge: badgeField,
  months: z.coerce.number().int().min(0),
  days: z.coerce.number().int().min(0),
  priceRub: z.coerce.number().int().min(1, "Цена должна быть не меньше 1 ₽"),
  sortOrder: z.coerce.number().int(),
})

const createPlanSchema = planFieldsSchema.extend({
  code: z
    .string()
    .trim()
    .min(1, "Код обязателен")
    .regex(/^[a-z0-9_-]+$/i, "Код: латиница, цифры, - и _"),
})

function readPlanFields(formData: FormData) {
  return {
    name: formData.get("name"),
    badge: formData.get("badge"),
    months: formData.get("months"),
    days: formData.get("days"),
    priceRub: formData.get("priceRub"),
    sortOrder: formData.get("sortOrder"),
  }
}

/** Создаёт новый тариф (например, тестовый на несколько дней) прямо из
 *  админки — раньше это делалось только через prisma studio/seed-скрипт. */
export async function createPlan(formData: FormData) {
  const admin = await requireAdmin()
  if (!admin) throw new Error("Не авторизован")

  const parsed = createPlanSchema.safeParse({ ...readPlanFields(formData), code: formData.get("code") })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные тарифа")
  }
  if (parsed.data.months === 0 && parsed.data.days === 0) {
    throw new Error("Укажите длительность тарифа (месяцы и/или дни)")
  }

  await prisma.plan.create({ data: parsed.data })
  revalidatePath("/admin/plans")
}

/** Редактирует существующий тариф — название, бейдж, длительность, цену,
 *  порядок сортировки. Публичные страницы (index.html/dashboard.html) берут
 *  эти данные из /api/plans при каждой загрузке, так что изменения здесь
 *  сразу видны на сайте, без отдельного шага деплоя. */
export async function updatePlan(planId: string, formData: FormData) {
  const admin = await requireAdmin()
  if (!admin) throw new Error("Не авторизован")

  const parsed = planFieldsSchema.safeParse(readPlanFields(formData))
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные тарифа")
  }
  if (parsed.data.months === 0 && parsed.data.days === 0) {
    throw new Error("Укажите длительность тарифа (месяцы и/или дни)")
  }

  await prisma.plan.update({ where: { id: planId }, data: parsed.data })
  revalidatePath("/admin/plans")
}

/** Удаляет тариф. Если по нему уже были платежи — Prisma откажет из-за
 *  внешнего ключа Payment.planId, и это правильно: историю платежей терять нельзя. */
export async function deletePlan(planId: string) {
  const admin = await requireAdmin()
  if (!admin) throw new Error("Не авторизован")

  try {
    await prisma.plan.delete({ where: { id: planId } })
  } catch {
    throw new Error("Нельзя удалить тариф, по которому уже были платежи — скройте его вместо удаления")
  }
  revalidatePath("/admin/plans")
}
