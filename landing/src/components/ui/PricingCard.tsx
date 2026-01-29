import Button from './Button'
import Icon from './Icon'

export default function PricingCard({
  name,
  price,
  period,
  features,
  highlighted = false,
  ctaLabel,
}: {
  name: string
  price: number
  period: string
  features: string[]
  highlighted?: boolean
  ctaLabel: string
}) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-8 ${
        highlighted
          ? 'border-green-500/40 bg-gray-900/80 pricing-glow scale-[1.02] z-10'
          : 'border-gray-800/60 bg-gray-900/40'
      }`}
    >
      {/* Green top edge for highlighted card */}
      {highlighted && (
        <>
          <div className="absolute top-0 left-4 right-4 h-[2px] rounded-full bg-gradient-to-r from-transparent via-green-500 to-transparent" />
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-green-500 px-4 py-1 text-xs font-semibold text-white">
            Popular
          </span>
        </>
      )}
      <div className="mb-8">
        <h3 className="text-sm font-medium text-gray-400">{name}</h3>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-5xl font-extrabold tracking-tight text-white">
            ${price}
          </span>
          <span className="text-sm text-gray-500">{period}</span>
          {price > 0 && (
            <span className="ml-1 rounded-full bg-green-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-green-400 border border-green-500/25">
              Save
            </span>
          )}
        </div>
      </div>
      <ul className="mb-8 flex-1 space-y-4">
        {features.map((feature, i) => {
          const featureColors = highlighted
            ? ['text-green-500', 'text-green-500', 'text-orange-400', 'text-green-500', 'text-orange-400', 'text-green-500']
            : ['text-green-500']
          const colorClass = featureColors[i % featureColors.length] || 'text-green-500'
          return (
            <li
              key={feature}
              className="flex items-start gap-3 text-sm text-gray-300"
            >
              <Icon
                name="check"
                size={16}
                className={`mt-0.5 shrink-0 ${colorClass}`}
                strokeWidth={2.5}
              />
              {feature}
            </li>
          )
        })}
      </ul>
      <Button
        variant={highlighted ? 'primary' : 'outline'}
        size="lg"
        className="w-full"
      >
        {ctaLabel}
      </Button>
    </div>
  )
}
