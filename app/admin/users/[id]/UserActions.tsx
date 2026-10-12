"use client"

import { useActionState } from "react"
import { CalendarPlus, KeyRound } from "lucide-react"
import type { ActionState } from "../actions"
import { buttonGhost, buttonPrimary, fieldClass } from "../../_components/ui"

type BoundAction = (prev: ActionState, formData: FormData) => Promise<ActionState>

function Result({ state }: { state: ActionState }) {
  if (!state) return null
  return (
    <p role="status" className={`mt-2 text-xs ${state.ok ? "text-emerald-400" : "text-[#ff8a7d]"}`}>
      {state.message}
    </p>
  )
}

export function GrantDaysForm({ action }: { action: BoundAction }) {
  const [state, formAction, pending] = useActionState(action, null)
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const days = new FormData(e.currentTarget).get("days")
        if (!confirm(`Добавить ${days} дн. подписки бесплатно?`)) e.preventDefault()
      }}
    >
      <label className="text-xs text-[#8f7c7a]" htmlFor="grant-days">
        Добавить дней к подписке (без оплаты)
      </label>
      <div className="mt-1.5 flex gap-2">
        <input id="grant-days" name="days" type="number" min={1} max={365} defaultValue={7} required className={`${fieldClass} w-24`} />
        <button type="submit" disabled={pending} className={buttonPrimary}>
          <CalendarPlus className="size-4" aria-hidden />
          {pending ? "Продлеваем…" : "Добавить"}
        </button>
      </div>
      <Result state={state} />
    </form>
  )
}

export function ResetSessionsForm({ action }: { action: (prev: ActionState) => Promise<ActionState> }) {
  const [state, formAction, pending] = useActionState(action, null)
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("Завершить все сессии пользователя? Ему придётся войти заново.")) e.preventDefault()
      }}
    >
      <p className="text-xs text-[#8f7c7a]">Выйти со всех устройств (например, если номер скомпрометирован)</p>
      <button type="submit" disabled={pending} className={`${buttonGhost} mt-1.5`}>
        <KeyRound className="size-4" aria-hidden />
        {pending ? "Сбрасываем…" : "Завершить все сессии"}
      </button>
      <Result state={state} />
    </form>
  )
}
