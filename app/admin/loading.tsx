// Скелетон на время серверного рендера любой страницы админки —
// раньше при переходе между разделами экран просто «замирал».
export default function AdminLoading() {
  const block = "animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]"
  return (
    <div aria-busy="true" aria-label="Загрузка">
      <div className="mb-7 h-8 w-56 animate-pulse rounded-lg bg-white/[0.05]" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${block} h-[116px]`} />
        ))}
      </div>
      <div className={`${block} mt-4 h-72`} />
    </div>
  )
}
