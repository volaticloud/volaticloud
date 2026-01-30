import Container from '../ui/Container'
import { heroContent } from '../../data/content'
import { CONSOLE_URL } from '../../config'

function HeroGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Large vivid orange/red glow — top-left */}
      <div className="absolute -top-[200px] -left-[200px] h-[900px] w-[900px] rounded-full bg-[#ff541f] opacity-[0.35] blur-[150px]" />
      <div className="absolute -top-[100px] left-[5%] h-[600px] w-[600px] rounded-full bg-[#e84e1b] opacity-[0.25] blur-[100px]" />

      {/* Teal/green glow — top-right */}
      <div className="absolute -top-[150px] -right-[150px] h-[700px] w-[700px] rounded-full bg-[#14b8a6] opacity-[0.3] blur-[130px]" />
      <div className="absolute -top-[50px] right-[10%] h-[400px] w-[400px] rounded-full bg-[#22c55e] opacity-[0.15] blur-[90px]" />

      {/* Diagonal light streaks — orange from top-left */}
      <div className="absolute -top-[50px] -left-[100px] w-[1400px] h-[600px] rotate-[12deg] origin-top-left">
        <div className="absolute top-0 left-0 w-full h-[40px] rounded-full bg-gradient-to-r from-[#ff541f]/70 via-[#ff8c5a]/30 to-transparent blur-[8px]" />
        <div className="absolute top-[60px] left-[20px] w-[90%] h-[35px] rounded-full bg-gradient-to-r from-[#e84e1b]/60 via-[#ff7043]/25 to-transparent blur-[10px]" />
        <div className="absolute top-[120px] left-[40px] w-[80%] h-[30px] rounded-full bg-gradient-to-r from-[#ff6b35]/50 via-[#ffab91]/15 to-transparent blur-[12px]" />
        <div className="absolute top-[180px] left-[60px] w-[70%] h-[25px] rounded-full bg-gradient-to-r from-[#ff541f]/35 via-[#ff8a65]/10 to-transparent blur-[14px]" />
      </div>

      {/* Diagonal light streaks — teal from top-right */}
      <div className="absolute -top-[30px] -right-[100px] w-[1200px] h-[500px] -rotate-[10deg] origin-top-right">
        <div className="absolute top-0 right-0 w-full h-[35px] rounded-full bg-gradient-to-l from-[#14b8a6]/60 via-[#2dd4bf]/25 to-transparent blur-[8px]" />
        <div className="absolute top-[55px] right-[20px] w-[85%] h-[30px] rounded-full bg-gradient-to-l from-[#0d9488]/50 via-[#5eead4]/15 to-transparent blur-[10px]" />
        <div className="absolute top-[110px] right-[40px] w-[70%] h-[25px] rounded-full bg-gradient-to-l from-[#14b8a6]/30 via-[#99f6e4]/10 to-transparent blur-[14px]" />
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-[250px] bg-gradient-to-t from-[#010101] via-[#010101]/60 to-transparent" />
    </div>
  )
}

function StatusBadge() {
  return (
    <div className="mb-8 flex items-center justify-center">
      <div className="inline-flex items-center gap-3 rounded-full border border-white/15 px-5 py-2.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#079211] opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#0AC300]" />
        </span>
        <span className="text-sm text-white/65 tracking-tight">Platform Online</span>
        <span className="text-white/20">·</span>
        <span className="text-sm text-white/65 tracking-tight">99.9% Uptime</span>
      </div>
    </div>
  )
}

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-40 pb-20">
      <HeroGlow />

      <Container className="relative text-center">
        <StatusBadge />

        <h1 className="mx-auto max-w-[1005px]">
          <span className="block text-[80px] font-black leading-[88px] tracking-tight text-white">
            {heroContent.titleLine1}{' '}
            <span className="italic text-[#079211] text-glow-green">
              {heroContent.titleAccent}
            </span>
          </span>
          <span className="block text-[68px] font-black leading-[88px] tracking-tight text-white">
            {heroContent.titleLine2}
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-[681px] text-[22px] leading-relaxed text-white/70">
          {heroContent.description}
        </p>

        <div className="mt-10 flex items-center justify-center gap-6">
          <a
            href={CONSOLE_URL}
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-[10px] bg-[#079211] px-9 py-4 text-xl text-white transition-colors hover:bg-[#068a0f]"
          >
            {heroContent.primaryCta}
          </a>
          <a
            href="#features"
            className="inline-flex items-center justify-center rounded-[10px] border border-white/[0.23] px-9 py-4 text-xl text-white transition-colors hover:bg-white/5"
          >
            {heroContent.secondaryCta}
          </a>
        </div>
      </Container>
    </section>
  )
}
