import Container from '../ui/Container'
import Button from '../ui/Button'
import { heroContent } from '../../data/content'

function HeroGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Ambient glow behind the streaks */}
      <div className="absolute -top-40 -left-40 h-[700px] w-[700px] rounded-full bg-orange-600/20 blur-[120px]" />
      <div className="absolute -top-20 left-20 h-[500px] w-[500px] rounded-full bg-amber-600/15 blur-[90px]" />
      <div className="absolute -top-10 left-[15%] h-[300px] w-[400px] rounded-full bg-red-600/10 blur-[80px]" />
      <div className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-teal-500/15 blur-[100px]" />
      <div className="absolute -top-10 right-[10%] h-[300px] w-[300px] rounded-full bg-green-500/8 blur-[80px]" />

      {/* Wide curved light ray BANDS — orange/amber from top-left */}
      <svg
        className="absolute -top-20 -left-40 w-[1200px] h-[500px]"
        viewBox="0 0 1200 500"
        fill="none"
      >
        {/* Thick band rays using fill between two curves */}
        <path d="M-50 0 Q300 -10 600 120 Q850 220 1200 160 L1200 180 Q850 250 600 155 Q300 30 -50 40 Z" fill="url(#band-o1)" />
        <path d="M-50 30 Q280 15 550 150 Q800 270 1200 200 L1200 225 Q800 300 550 190 Q280 55 -50 70 Z" fill="url(#band-o2)" />
        <path d="M-50 70 Q250 50 500 190 Q750 320 1150 260 L1150 285 Q750 350 500 230 Q250 95 -50 110 Z" fill="url(#band-o3)" />
        <path d="M-50 120 Q220 100 460 240 Q700 370 1100 320 L1100 340 Q700 395 460 275 Q220 140 -50 155 Z" fill="url(#band-o4)" />
        <defs>
          <linearGradient id="band-o1" x1="0" y1="0" x2="1200" y2="0">
            <stop offset="0%" stopColor="rgba(234,88,12,0)" />
            <stop offset="10%" stopColor="rgba(234,88,12,0.5)" />
            <stop offset="30%" stopColor="rgba(251,146,60,0.3)" />
            <stop offset="55%" stopColor="rgba(251,146,60,0.08)" />
            <stop offset="100%" stopColor="rgba(251,146,60,0)" />
          </linearGradient>
          <linearGradient id="band-o2" x1="0" y1="0" x2="1200" y2="0">
            <stop offset="0%" stopColor="rgba(239,68,68,0)" />
            <stop offset="8%" stopColor="rgba(239,68,68,0.45)" />
            <stop offset="25%" stopColor="rgba(234,88,12,0.25)" />
            <stop offset="50%" stopColor="rgba(234,88,12,0.06)" />
            <stop offset="100%" stopColor="rgba(234,88,12,0)" />
          </linearGradient>
          <linearGradient id="band-o3" x1="0" y1="0" x2="1200" y2="0">
            <stop offset="0%" stopColor="rgba(251,146,60,0)" />
            <stop offset="12%" stopColor="rgba(251,146,60,0.35)" />
            <stop offset="30%" stopColor="rgba(234,88,12,0.15)" />
            <stop offset="55%" stopColor="rgba(234,88,12,0.03)" />
            <stop offset="100%" stopColor="rgba(234,88,12,0)" />
          </linearGradient>
          <linearGradient id="band-o4" x1="0" y1="0" x2="1200" y2="0">
            <stop offset="0%" stopColor="rgba(220,38,38,0)" />
            <stop offset="15%" stopColor="rgba(220,38,38,0.25)" />
            <stop offset="35%" stopColor="rgba(239,68,68,0.08)" />
            <stop offset="100%" stopColor="rgba(239,68,68,0)" />
          </linearGradient>
        </defs>
      </svg>

      {/* Wide curved light ray BANDS — teal/green from top-right */}
      <svg
        className="absolute -top-20 -right-40 w-[1000px] h-[400px]"
        viewBox="0 0 1000 400"
        fill="none"
      >
        <path d="M1050 0 Q700 -5 450 100 Q200 200 -50 150 L-50 175 Q200 230 450 135 Q700 30 1050 35 Z" fill="url(#band-t1)" />
        <path d="M1050 35 Q680 25 420 130 Q180 230 -50 190 L-50 215 Q180 260 420 170 Q680 65 1050 70 Z" fill="url(#band-t2)" />
        <path d="M1050 75 Q660 60 400 165 Q170 265 -30 230 L-30 250 Q170 290 400 200 Q660 100 1050 108 Z" fill="url(#band-t3)" />
        <defs>
          <linearGradient id="band-t1" x1="1000" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="rgba(20,184,166,0)" />
            <stop offset="10%" stopColor="rgba(20,184,166,0.4)" />
            <stop offset="30%" stopColor="rgba(34,197,94,0.2)" />
            <stop offset="55%" stopColor="rgba(34,197,94,0.04)" />
            <stop offset="100%" stopColor="rgba(34,197,94,0)" />
          </linearGradient>
          <linearGradient id="band-t2" x1="1000" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="rgba(34,197,94,0)" />
            <stop offset="12%" stopColor="rgba(34,197,94,0.3)" />
            <stop offset="35%" stopColor="rgba(20,184,166,0.12)" />
            <stop offset="60%" stopColor="rgba(20,184,166,0.02)" />
            <stop offset="100%" stopColor="rgba(20,184,166,0)" />
          </linearGradient>
          <linearGradient id="band-t3" x1="1000" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="rgba(20,184,166,0)" />
            <stop offset="15%" stopColor="rgba(20,184,166,0.2)" />
            <stop offset="40%" stopColor="rgba(34,197,94,0.06)" />
            <stop offset="100%" stopColor="rgba(34,197,94,0)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

function TrustBadges() {
  return (
    <div className="mb-6 flex items-center justify-center gap-3">
      {/* Small app icons */}
      <div className="flex -space-x-1.5">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 border border-white/10" />
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 border border-white/10" />
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-green-500 to-green-700 border border-white/10" />
      </div>
      {/* Star ratings */}
      <div className="flex items-center gap-0.5 text-orange-400">
        {'★★★★★'.split('').map((star, i) => (
          <span key={i} className="text-sm">{star}</span>
        ))}
      </div>
    </div>
  )
}

function ScrollIndicator() {
  return (
    <div className="mt-12 flex flex-col items-center gap-1.5">
      <div className="h-[2px] w-8 rounded-full bg-gradient-to-r from-transparent via-green-500/50 to-transparent" />
      <div className="h-[2px] w-5 rounded-full bg-gradient-to-r from-transparent via-green-500/30 to-transparent" />
      <div className="h-[1.5px] w-3 rounded-full bg-gradient-to-r from-transparent via-green-500/15 to-transparent" />
    </div>
  )
}

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20">
      <HeroGlow />

      <Container className="relative text-center">
        <TrustBadges />

        <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-6xl">
          {heroContent.titleLine1}
          <br />
          <span className="italic text-green-400 text-glow-green">
            {heroContent.titleAccent}
          </span>
          <br />
          {heroContent.titleLine2}
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-gray-500">
          {heroContent.description}
        </p>

        <div className="mt-10 flex items-center justify-center gap-4">
          <Button variant="primary" size="lg">
            {heroContent.primaryCta}
          </Button>
          <Button variant="secondary" size="lg">
            {heroContent.secondaryCta}
          </Button>
        </div>

        <ScrollIndicator />
      </Container>
    </section>
  )
}
