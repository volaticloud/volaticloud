import { useState } from 'react'
import Container from '../ui/Container'
import PricingCard from '../ui/PricingCard'
import { pricingContent, pricingTiers } from '../../data/content'

function Toggle({ active, onToggle }: { active: 'monthly' | 'yearly'; onToggle: () => void }) {
  return (
    <div className="mt-10 flex justify-center">
      <div className="inline-flex items-center rounded-full bg-white/10 p-[10px]">
        <button
          onClick={() => active !== 'monthly' && onToggle()}
          className={`cursor-pointer rounded-[20px] px-8 py-1.5 text-base transition-colors ${
            active === 'monthly' ? 'bg-white/20 text-white' : 'text-[#919191]'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => active !== 'yearly' && onToggle()}
          className={`cursor-pointer rounded-[20px] px-8 py-1.5 text-base transition-colors ${
            active === 'yearly' ? 'bg-white/20 text-white' : 'text-[#919191]'
          }`}
        >
          Yearly
        </button>
      </div>
    </div>
  )
}

export default function PricingSection() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')

  return (
    <section className="py-24" id="pricing">
      <Container>
        <div className="mx-auto max-w-[600px] text-center">
          <h2 className="text-3xl sm:text-[48px] lg:text-[64px] font-bold leading-tight text-white">
            {pricingContent.titleLine1}{' '}
            {pricingContent.titleLine2}
          </h2>
        </div>

        <p className="mx-auto mt-4 sm:mt-6 max-w-3xl text-center text-base sm:text-xl leading-6 text-[#d9d9d9]">
          {pricingContent.subtitle}
        </p>

        <Toggle active={billing} onToggle={() => setBilling(billing === 'monthly' ? 'yearly' : 'monthly')} />

        <div className="mt-12 flex flex-col lg:flex-row items-stretch gap-6 lg:gap-0">
          {pricingTiers.map((tier, i) => (
            <PricingCard
              key={tier.name}
              name={tier.name}
              price={billing === 'yearly' ? Math.round(tier.price * 0.8) : tier.price}
              period={tier.period}
              description={tier.description}
              features={tier.features}
              highlighted={tier.highlighted}
              ctaLabel={tier.ctaLabel}
              discount={tier.discount}
              position={i === 0 ? 'left' : i === 2 ? 'right' : 'center'}
            />
          ))}
        </div>
      </Container>
    </section>
  )
}
