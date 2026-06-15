const STYLES: Record<string, string> = {
  published: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
  flagged: 'bg-amber-900/50 text-amber-300 border-amber-700/50',
  revoked: 'bg-red-900/50 text-red-300 border-red-700/50',
}

export function StatusBadge({ status, title }: { status: string; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium ${
        STYLES[status] ?? 'bg-neutral-800 text-neutral-300 border-neutral-700'
      }`}
    >
      {status}
    </span>
  )
}
