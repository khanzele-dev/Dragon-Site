"use client"

export default function AdminPlansError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-white">Тарифы</h1>
      <div className="rounded-xl border border-[#e0362a]/30 bg-[#e0362a]/10 px-5 py-4">
        <p className="text-sm text-[#f3b8b1]">{error.message || "Не удалось выполнить действие"}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-md border border-[#e0362a]/40 px-3 py-1.5 text-xs font-medium text-[#e8e0e0] transition hover:bg-[#e0362a] hover:text-white"
        >
          Понятно, вернуться к тарифам
        </button>
      </div>
    </div>
  )
}
