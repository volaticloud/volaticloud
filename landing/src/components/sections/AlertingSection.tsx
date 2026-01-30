import Container from '../ui/Container'

const alertRules = [
  { trigger: 'Bot Stopped', action: 'Email', icon: '⚠' },
  { trigger: 'Drawdown > 5%', action: 'Email + Slack', icon: '📉' },
  { trigger: 'Trade Executed', action: 'Log', icon: '✓' },
]

function MockAlertConfig() {
  return (
    <div className="w-full max-w-[560px] rounded-2xl border border-white/10 bg-[#1b1b1c] p-5 shadow-2xl">
      {/* Header with bell */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <span className="text-sm font-bold text-white">Alert Rules</span>
        <div className="relative">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/50">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF541F] text-[9px] font-bold text-white">
            3
          </span>
        </div>
      </div>

      {/* Alert rule cards */}
      <div className="mt-4 space-y-3">
        {alertRules.map((rule) => (
          <div
            key={rule.trigger}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3"
          >
            {/* Status dot */}
            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#079211] shadow-[0_0_6px_rgba(7,146,17,0.5)]" />

            {/* Rule content */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white/80">{rule.trigger}</span>
                <span className="text-white/20">→</span>
                <span className="text-sm text-[#FF541F]">{rule.action}</span>
              </div>
            </div>

            {/* Active badge */}
            <span className="rounded-full bg-[#079211]/15 px-2 py-0.5 text-[10px] font-bold text-[#079211]">
              Active
            </span>
          </div>
        ))}
      </div>

      {/* Add rule */}
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-white/10 p-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 text-xs text-white/30">
          +
        </span>
        <span className="text-xs text-white/30">Add alert rule...</span>
      </div>
    </div>
  )
}

export default function AlertingSection() {
  return (
    <section className="py-24" id="alerting">
      <Container>
        <div className="flex flex-col lg:flex-row items-center gap-16">
          {/* Text left */}
          <div className="flex-1">
            <h2 className="text-[48px] font-bold leading-tight text-white">
              Smart Alerts.{' '}
              <span className="text-[#079211] text-glow-green">Never Miss a Signal.</span>
            </h2>
            <ul className="mt-8 space-y-4 text-lg text-white/70">
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#079211]" />
                Real-time notifications on bot events
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#079211]" />
                Customizable alert conditions
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#079211]" />
                Email delivery with fine-grained control
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#079211]" />
                Monitor bot health, trade executions, and performance thresholds
              </li>
            </ul>
          </div>

          {/* Visual right */}
          <div className="flex-1 flex justify-end">
            <MockAlertConfig />
          </div>
        </div>
      </Container>
    </section>
  )
}
