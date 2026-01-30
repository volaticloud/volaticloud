import Container from '../ui/Container'
import { ctaBanner } from '../../data/content'
import { CONSOLE_URL } from '../../config'

export default function CTASection() {
  return (
    <section className="py-24">
      <Container>
        <div className="relative" style={{ maxWidth: '1120px', margin: '0 auto' }}>
        <div className="gradient-border relative overflow-hidden rounded-[30px] bg-white/[0.04] px-16 py-14 text-center">
          {/* Subtle inner glow */}
          <div className="pointer-events-none absolute inset-0 cta-glow opacity-20" />

          {/* Dot grid pattern overlay */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.23]">
            <svg className="w-full h-full" viewBox="0 0 1120 375">
              {Array.from({ length: 28 }).map((_, row) =>
                Array.from({ length: 28 }).map((_, col) => (
                  <circle
                    key={`${row}-${col}`}
                    cx={20 + col * 39.5}
                    cy={20 + row * 39.5}
                    r="1.5"
                    fill="white"
                  />
                ))
              )}
            </svg>
          </div>

          <h2 className="relative mx-auto max-w-[789px] text-[64px] font-black leading-tight text-white">
            {ctaBanner.title}
          </h2>
          <p className="relative mx-auto mt-6 max-w-[618px] text-xl leading-[22.4px] text-white/80">
            {ctaBanner.description}
          </p>
          <div className="relative mt-8">
            <a
              href={CONSOLE_URL}
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-[10px] bg-[#079211] px-9 py-4 text-xl font-bold text-white transition-colors hover:bg-[#068a0f]"
            >
              {ctaBanner.cta}
              <svg width="23" height="16" viewBox="0 0 23 16" fill="none">
                <path d="M22.7 8.7a1 1 0 0 0 0-1.4L16.35.95a1 1 0 1 0-1.42 1.42L20.57 8l-5.64 5.64a1 1 0 1 0 1.42 1.42L22.7 8.7ZM0 9h22V7H0v2Z" fill="white" />
              </svg>
            </a>
          </div>
        </div>
        </div>
      </Container>
    </section>
  )
}
