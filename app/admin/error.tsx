"use client"

import { TriangleAlert } from "lucide-react"

// Общий обработчик ошибок админки: упавшая БД, ошибка серверного действия
// (например, «нельзя удалить тариф с платежами») — показываем текст, а не
// белый экран Next.js.
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-2xl border border-[#e0362a]/30 bg-[#e0362a]/[0.08] p-6">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-[#ff8a7d]" aria-hidden />
        <div>
          <h1 className="text-base font-semibold text-white">Не получилось выполнить действие</h1>
          <p className="mt-1 text-sm text-[#f3b8b1]">{error.message || "Неизвестная ошибка. Попробуйте ещё раз."}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 inline-flex h-9 items-center rounded-lg border border-[#e0362a]/40 px-4 text-sm text-[#e8e0e0] transition hover:bg-[#e0362a] hover:text-white"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    </div>
  )
}
