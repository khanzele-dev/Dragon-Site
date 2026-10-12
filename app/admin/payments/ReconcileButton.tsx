"use client"

import { useActionState } from "react"
import { RefreshCw } from "lucide-react"
import type { ReconcileState } from "./actions"

export function ReconcileButton({
  action,
  label,
}: {
  action: (prev: ReconcileState) => Promise<ReconcileState>
  label: string
}) {
  const [state, formAction, pending] = useActionState(action, null)
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-[#e8e0e0] transition hover:border-[#e0362a]/50 hover:text-white disabled:opacity-60"
        title="Сверить статус с ЮKassa и выдать VPN, если оплата прошла"
      >
        <RefreshCw className={`size-3.5 ${pending ? "animate-spin" : ""}`} aria-hidden />
        {pending ? "Сверяем…" : label}
      </button>
      {state && (
        <p role="status" className={`max-w-[260px] whitespace-normal text-right text-[11px] leading-snug ${state.ok ? "text-emerald-400" : "text-[#ff8a7d]"}`}>
          {state.message}
        </p>
      )}
    </form>
  )
}
