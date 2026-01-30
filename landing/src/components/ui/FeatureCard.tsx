import type { ReactNode } from 'react'

export default function FeatureCard({
  icon,
  title,
  description,
  highlighted = false,
}: {
  icon: ReactNode
  title: string
  description: string
  highlighted?: boolean
}) {
  return (
    <div
      className="card-hover group relative overflow-hidden rounded-[20px] border-[1.25px] border-[rgba(255,84,31,0.2)] p-5"
      style={{
        backgroundColor: 'rgba(39,40,41,0.7)',
        ...(highlighted
          ? { backgroundImage: 'linear-gradient(142.85deg, rgba(0,0,0,0) 23.339%, rgba(255,60,0,0.3) 96.361%)' }
          : {}),
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-base sm:text-lg leading-[19.2px] text-[#d9d9d9]/85 mb-8 sm:mb-16">{description}</p>
          <h3 className="text-2xl sm:text-[34px] sm:leading-[40.8px] text-white">{title}</h3>
        </div>
        <div className="shrink-0 flex h-[50px] w-[50px] items-center justify-center rounded-full bg-[#079211] text-white -rotate-45">
          {icon}
        </div>
      </div>
    </div>
  )
}
