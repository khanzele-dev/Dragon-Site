import { jsonError } from "@/lib/http"

/**
 * Оборачивает route handler так, что ЛЮБОЕ необработанное исключение
 * (упавшая БД, сеть до Remnawave/ЮKassa и т.п.) превращается в аккуратный
 * JSON {error} вместо дефолтной страницы/стектрейса Next.js. Внутренние
 * try/catch внутри хендлеров остаются там, где нужно отличить один случай
 * от другого (например, P2002 → 409); эта обёртка — последняя линия обороны.
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args)
    } catch (err) {
      console.error("[api] unhandled error", err)
      return jsonError("Внутренняя ошибка сервера. Попробуйте позже.", 500)
    }
  }
}
