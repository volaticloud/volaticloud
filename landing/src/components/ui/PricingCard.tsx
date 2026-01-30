import Icon from './Icon'

export default function PricingCard({
  name,
  price,
  period,
  description,
  features,
  highlighted = false,
  ctaLabel,
  discount,
  position = 'center',
}: {
  name: string
  price: number
  period: string
  description: string
  features: string[]
  highlighted?: boolean
  ctaLabel: string
  discount?: string
  position?: 'left' | 'center' | 'right'
}) {
  // Mobile: all cards get full rounded corners. Desktop: connected layout
  const borderRadius = highlighted
    ? 'rounded-[20px]'
    : position === 'left'
      ? 'rounded-[20px] lg:rounded-none lg:rounded-tl-[20px] lg:rounded-bl-[20px]'
      : position === 'right'
        ? 'rounded-[20px] lg:rounded-none lg:rounded-tr-[20px] lg:rounded-br-[20px]'
        : 'rounded-[20px] lg:rounded-none'

  return (
    <div
      className={`relative flex flex-1 flex-col px-6 sm:px-8 py-5 ${borderRadius} ${
        highlighted
          ? 'border-[3px] border-[#acf9b7] bg-[#1b1b1c] z-10 lg:-my-4 pricing-glow'
          : 'border border-white/10 bg-[#1b1b1c]'
      }`}
    >
      <div className="mb-6">
        <h3 className={`${highlighted ? 'text-[30px] font-bold text-[#079211]' : 'text-lg text-white'}`}>
          {name}
        </h3>
        <p className="mt-2 text-base leading-6 text-white/75">
          {description}
        </p>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-[40px] font-bold text-white tracking-tight">
            ${price}
          </span>
          <span className="text-base text-white/75">{period}</span>
          {discount && (
            <span className="ml-2 rounded-full bg-[#079211] px-2 py-1 text-xs font-bold text-white">
              {discount}
            </span>
          )}
        </div>
      </div>

      {/* Separator line */}
      <div className="mb-6 h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }} />

      <ul className="mb-8 flex-1 space-y-4">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-base text-white">
            <Icon
              name="check"
              size={18}
              className={`mt-0.5 shrink-0 ${highlighted ? 'text-[#079211]' : 'text-white'}`}
              strokeWidth={2.5}
            />
            {feature}
          </li>
        ))}
      </ul>

      <button className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#079211] py-3 text-lg font-semibold text-white cursor-pointer transition-colors hover:bg-[#068a0f]">
        {ctaLabel}
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
          <path d="M1 1l6 6-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
