"use client"

import { TriangleAlert } from "lucide-react"

// Общий обработчик ошибок админки. В production Next.js заменяет текст
// серверной ошибки на «Minified React error #441» — показываем вместо этого
// человеческое сообщение и digest: по нему ошибку находят в логах сервера
// (там она записана полностью, с тем же кодом).
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const hidden = !error.message || error.message.includes("Minified React error") || Boolean(error.digest)
  return (
    <div className="rounded-2xl border border-[#e0362a]/30 bg-[#e0362a]/[0.08] p-6">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-[#ff8a7d]" aria-hidden />
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-white">Страница не загрузилась</h1>
          <p className="mt-1 text-sm text-[#f3b8b1]">
            {hidden
              ? "На сервере произошла ошибка — например, не ответила база данных, Remnawave или ЮKassa. Попробуйте ещё раз через минуту."
              : error.message}
          </p>
          {error.digest && (
            <p className="mt-2 text-xs text-[#8f7c7a]">
              Код для поиска в логах сервера: <span className="font-mono text-[#e8e0e0]">{error.digest}</span>
            </p>
          )}
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
