export default function StatCard({
  value,
  label,
  tag,
  tagColor = 'green',
}: {
  value: string
  label: string
  tag?: string
  tagColor?: 'green' | 'blue' | 'orange'
}) {
  const tagColors = {
    green: 'bg-green-500/15 text-green-400 border-green-500/25',
    blue: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    orange: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  }

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      {tag && (
        <span
          className={`rounded-full border px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tagColors[tagColor]}`}
        >
          {tag}
        </span>
      )}
      <div className="text-3xl font-extrabold text-white sm:text-4xl tracking-tight">
        {value}
      </div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}
