import Container from '../ui/Container'

function MockStrategyBuilder() {
  return (
    <div className="w-full max-w-[560px] rounded-2xl border border-white/10 bg-[#1b1b1c] p-5 shadow-2xl">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-4">
        <span className="text-xs text-white/40 font-mono">Indicators:</span>
        {['RSI', 'MACD', 'EMA', 'BB'].map((ind) => (
          <span
            key={ind}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-mono text-white/70"
          >
            {ind}
          </span>
        ))}
      </div>

      {/* Condition tree */}
      <div className="mt-4 space-y-3 pl-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-[#079211]/20 px-2 py-0.5 text-xs font-bold text-[#079211]">IF</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <div className="ml-6 space-y-2">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <span className="font-mono text-sm text-[#FF541F]">RSI</span>
            <span className="text-sm text-white/40">&lt;</span>
            <span className="font-mono text-sm text-white">30</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-bold text-white/60">AND</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <span className="font-mono text-sm text-[#FF541F]">MACD</span>
            <span className="text-sm text-white/40">Cross Up</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="rounded bg-[#079211]/20 px-2 py-0.5 text-xs font-bold text-[#079211]">THEN</span>
          <span className="rounded-lg border border-[#079211]/30 bg-[#079211]/10 px-3 py-1 text-sm font-bold text-[#079211]">
            BUY LONG
          </span>
        </div>
      </div>

      {/* Leverage slider */}
      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between text-xs text-white/40 mb-2">
          <span>Leverage</span>
          <span className="font-mono text-white">5x</span>
        </div>
        <div className="relative h-2 rounded-full bg-white/10">
          <div className="absolute left-0 top-0 h-2 w-[40%] rounded-full bg-[#FF541F]" />
          <div className="absolute top-1/2 left-[40%] -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-[#FF541F] bg-[#1b1b1c]" />
        </div>
      </div>

      {/* Trading type badges */}
      <div className="mt-4 flex gap-2">
        {[
          { label: 'Spot', active: true },
          { label: 'Margin', active: true },
          { label: 'Futures', active: true },
        ].map((t) => (
          <span
            key={t.label}
            className="rounded-md border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/70"
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function StrategyBuilderSection() {
  return (
    <section className="py-24" id="strategy-builder">
      <Container>
        <div className="flex flex-col lg:flex-row items-center gap-16">
          {/* Text left */}
          <div className="flex-1">
            <h2 className="text-[48px] font-bold leading-tight text-white">
              Build Strategies Visually.{' '}
              <span className="text-[#079211] text-glow-green">No Code Required.</span>
            </h2>
            <ul className="mt-8 space-y-4 text-lg text-white/70">
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#079211]" />
                Fine-grained control of 20+ technical indicators (RSI, MACD, EMA, Bollinger Bands…)
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#079211]" />
                Define precise entry & exit conditions with conditional logic trees
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#079211]" />
                All trading types — Spot, Margin, Futures
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#079211]" />
                Both Long & Short positions supported
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#079211]" />
                Full leverage control with smart conditions and fine-grained criteria
              </li>
            </ul>
          </div>

          {/* Visual right */}
          <div className="flex-1 flex justify-end">
            <MockStrategyBuilder />
          </div>
        </div>
      </Container>
    </section>
  )
}
