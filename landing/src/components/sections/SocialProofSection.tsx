import Container from '../ui/Container'
import Button from '../ui/Button'
import { socialProof } from '../../data/content'

const statColors = [
  ['bg-emerald-600', 'bg-sky-600'],
  ['bg-amber-600'],
  ['bg-rose-600'],
  ['bg-violet-600', 'bg-teal-600'],
]

const avatarColors = [
  'bg-emerald-700',
  'bg-sky-700',
  'bg-amber-700',
  'bg-rose-700',
  'bg-violet-700',
  'bg-teal-700',
  'bg-indigo-700',
  'bg-orange-700',
]

function QuoteDecoration() {
  return (
    <div className="mb-8 flex items-center justify-center gap-4">
      <div className="h-px flex-1 max-w-24 bg-gradient-to-r from-transparent to-gray-600" />
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-gray-500">
        <path
          d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"
          stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
        />
        <path
          d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"
          stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
      <div className="h-px flex-1 max-w-24 bg-gradient-to-l from-transparent to-gray-600" />
    </div>
  )
}

function BarIndicators() {
  return (
    <div className="mt-10 flex items-center justify-center gap-1.5">
      <div className="h-1 w-6 rounded-full bg-green-500/50" />
      <div className="h-1 w-4 rounded-full bg-green-500/30" />
      <div className="h-1 w-3 rounded-full bg-gray-700" />
      <div className="h-1 w-3 rounded-full bg-gray-700" />
      <div className="h-1 w-4 rounded-full bg-green-500/30" />
      <div className="h-1 w-6 rounded-full bg-green-500/50" />
    </div>
  )
}

function StatWithBar({ value, label, colors }: { value: string; label: string; colors: string[] }) {
  return (
    <div className="text-center">
      <div className="text-4xl font-extrabold tracking-tight text-white lg:text-5xl">
        {value}
      </div>
      <div className="mx-auto mt-3 mb-2 h-[2px] w-12 rounded-full bg-gradient-to-r from-green-500/60 to-green-500/0" />
      <div className="text-xs text-gray-500 uppercase tracking-wider">
        {label}
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {colors.map((color, i) => (
          <div key={i} className={`h-3 w-3 rounded-full ${color}`} />
        ))}
      </div>
    </div>
  )
}

export default function SocialProofSection() {
  return (
    <section className="py-24">
      <Container>
        {/* Quote + description */}
        <div className="mx-auto max-w-3xl text-center">
          <QuoteDecoration />
          <p className="text-[15px] leading-relaxed text-gray-400">
            {socialProof.description}
          </p>
          <BarIndicators />
        </div>

        {/* Stats row with vertical separators */}
        <div className="mt-14 grid grid-cols-4 divide-x divide-gray-800/60">
          {socialProof.stats.map((stat, i) => (
            <StatWithBar key={stat.label} value={stat.value} label={stat.label} colors={statColors[i]} />
          ))}
        </div>

        {/* Avatars + CTA */}
        <div className="mt-14 flex flex-col items-center gap-6">
          <div className="flex -space-x-2.5">
            {avatarColors.map((color, i) => (
              <div
                key={i}
                className={`h-9 w-9 rounded-full border-2 border-[#0a0a0a] ${color} ring-1 ring-white/5`}
              />
            ))}
          </div>
          <Button variant="primary" size="md">
            {socialProof.cta}
          </Button>
        </div>
      </Container>
    </section>
  )
}
