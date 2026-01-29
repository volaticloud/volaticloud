import type { ReactNode } from 'react'

export default function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="card-hover group relative overflow-hidden rounded-xl border border-gray-700/40 bg-gradient-to-b from-gray-900/50 to-gray-950/50 p-5 pl-7">
      {/* Green left border accent */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-[2px] rounded-r-full bg-green-500/60" />

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-relaxed text-gray-500 mb-3">{description}</p>
          <h3 className="text-[15px] font-semibold text-white">{title}</h3>
        </div>
        <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-green-500/10 text-green-400">
          {icon}
        </div>
      </div>
    </div>
  )
}
