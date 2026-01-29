import { useState } from 'react'
import Container from '../ui/Container'
import SectionHeading from '../ui/SectionHeading'
import PricingCard from '../ui/PricingCard'
import { pricingContent, pricingTiers } from '../../data/content'

function Toggle({
  enabled,
  onToggle,
}: {
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <div className="mt-10 flex items-center justify-center gap-3">
      <span className={`text-sm transition-colors ${!enabled ? 'text-white' : 'text-gray-500'}`}>
        Monthly
      </span>
      <button
        onClick={onToggle}
        className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer ${
          enabled ? 'bg-green-500' : 'bg-gray-700'
        }`}
        aria-label="Toggle billing period"
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            enabled ? 'translate-x-5' : ''
          }`}
        />
      </button>
      <span className={`text-sm transition-colors ${enabled ? 'text-white' : 'text-gray-500'}`}>
        Annual
      </span>
    </div>
  )
}

export default function PricingSection() {
  const [annual, setAnnual] = useState(false)

  return (
    <section className="py-24" id="pricing">
      <Container>
        <SectionHeading subtitle={pricingContent.subtitle}>
          {pricingContent.titleLine1}
          <br />
          {pricingContent.titleLine2}
        </SectionHeading>

        <Toggle enabled={annual} onToggle={() => setAnnual(!annual)} />

        <div className="mt-16 grid items-center gap-6 lg:grid-cols-3">
          {pricingTiers.map((tier) => (
            <PricingCard
              key={tier.name}
              name={tier.name}
              price={annual ? Math.round(tier.price * 0.8) : tier.price}
              period={annual ? '/year' : tier.period}
              features={tier.features}
              highlighted={tier.highlighted}
              ctaLabel={tier.ctaLabel}
            />
          ))}
        </div>
      </Container>
    </section>
  )
}
