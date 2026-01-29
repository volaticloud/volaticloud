import Container from '../ui/Container'
import Button from '../ui/Button'
import { ctaBanner } from '../../data/content'

export default function CTASection() {
  return (
    <section className="py-24">
      <Container>
        <div className="gradient-border relative overflow-hidden rounded-2xl bg-gradient-to-b from-gray-900/80 to-gray-950/80 px-8 py-16 text-center sm:px-16">
          {/* Subtle glow in top-right corner */}
          <div className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-green-500/5 blur-[80px]" />

          <h2 className="relative text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {ctaBanner.title}
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-sm leading-relaxed text-gray-500">
            {ctaBanner.description}
          </p>
          <div className="relative mt-8">
            <Button variant="primary" size="lg">
              {ctaBanner.cta}
            </Button>
          </div>
        </div>
      </Container>
    </section>
  )
}
