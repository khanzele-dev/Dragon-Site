"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/session"

// Результат действия возвращаем через ?ok= / ?error= в адресе, а не throw:
// в production Next.js прячет текст брошенной ошибки, и вместо «Нельзя
// удалить тариф…» админ видел «Minified React error #441».
function done(message: string): never {
  revalidatePath("/admin/plans")
  redirect(`/admin/plans?ok=${encodeURIComponent(message)}`)
}

function fail(message: string): never {
  redirect(`/admin/plans?error=${encodeURIComponent(message)}`)
}

async function assertAdmin() {
  const admin = await requireAdmin()
  if (!admin) fail("Нет доступа — войдите заново")
}

export async function togglePlanActive(planId: string) {
  await assertAdmin()

  const plan = await prisma.plan.findUnique({ where: { id: planId } })
  if (!plan) fail("Тариф не найден")
  await prisma.plan.update({ where: { id: planId }, data: { isActive: !plan.isActive } })
  done(plan.isActive ? `«${plan.name}» скрыт с сайта` : `«${plan.name}» снова на сайте`)
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
  await assertAdmin()

  const parsed = createPlanSchema.safeParse({ ...readPlanFields(formData), code: formData.get("code") })
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Некорректные данные тарифа")
  if (parsed.data.months === 0 && parsed.data.days === 0) fail("Укажите длительность тарифа (месяцы и/или дни)")

  const exists = await prisma.plan.findUnique({ where: { code: parsed.data.code } })
  if (exists) fail(`Тариф с кодом «${parsed.data.code}» уже есть`)

  await prisma.plan.create({ data: parsed.data })
  done(`Тариф «${parsed.data.name}» создан`)
}

/** Редактирует существующий тариф — название, бейдж, длительность, цену,
 *  порядок сортировки. Публичные страницы (index.html/dashboard.html) берут
 *  эти данные из /api/plans при каждой загрузке, так что изменения здесь
 *  сразу видны на сайте, без отдельного шага деплоя. */
export async function updatePlan(planId: string, formData: FormData) {
  await assertAdmin()

  const parsed = planFieldsSchema.safeParse(readPlanFields(formData))
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Некорректные данные тарифа")
  if (parsed.data.months === 0 && parsed.data.days === 0) fail("Укажите длительность тарифа (месяцы и/или дни)")

  await prisma.plan.update({ where: { id: planId }, data: parsed.data })
  done(`Тариф «${parsed.data.name}» сохранён`)
}

/** Удаляет тариф. Если по нему уже были платежи — удалять нельзя: историю
 *  платежей терять нельзя (Payment.planId ссылается на тариф). */
export async function deletePlan(planId: string) {
  await assertAdmin()

  const payments = await prisma.payment.count({ where: { planId } })
  if (payments > 0) fail("Нельзя удалить тариф, по которому уже были платежи — скройте его вместо удаления")

  const plan = await prisma.plan.delete({ where: { id: planId } })
  done(`Тариф «${plan.name}» удалён`)
}
