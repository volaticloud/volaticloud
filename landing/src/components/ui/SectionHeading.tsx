import type { ReactNode } from 'react'

export default function SectionHeading({
  children,
  subtitle,
  centered = true,
}: {
  children: ReactNode
  subtitle?: string
  centered?: boolean
}) {
  return (
    <div className={centered ? 'text-center' : ''}>
      <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] leading-tight">
        {children}
      </h2>
      {subtitle && (
        <p className={`mt-4 max-w-2xl text-sm leading-relaxed text-gray-500 ${centered ? 'mx-auto' : ''}`}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
