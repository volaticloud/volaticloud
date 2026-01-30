import Container from '../ui/Container'

const metrics = [
  { label: 'Win Rate', value: '67.3%', color: 'text-[#079211]' },
  { label: 'Sharpe', value: '2.14', color: 'text-white' },
  { label: 'Max DD', value: '-8.2%', color: 'text-[#FF541F]' },
  { label: 'Profit Factor', value: '1.89', color: 'text-[#079211]' },
]

const monthlyReturns = [
  { month: 'Jan', value: 4.2, positive: true },
  { month: 'Feb', value: -1.8, positive: false },
  { month: 'Mar', value: 6.1, positive: true },
  { month: 'Apr', value: 3.5, positive: true },
  { month: 'May', value: -2.4, positive: false },
  { month: 'Jun', value: 5.8, positive: true },
  { month: 'Jul', value: 7.2, positive: true },
  { month: 'Aug', value: -0.9, positive: false },
  { month: 'Sep', value: 4.6, positive: true },
  { month: 'Oct', value: 3.1, positive: true },
  { month: 'Nov', value: -1.5, positive: false },
  { month: 'Dec', value: 8.3, positive: true },
]

const maxVal = 10

function MockBacktestResults() {
  return (
    <div className="w-full max-w-[560px] rounded-2xl border border-white/10 bg-[#1b1b1c] p-5 shadow-2xl">
      {/* Metric cards row */}
      <div className="grid grid-cols-4 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
            <div className={`text-lg font-bold font-mono ${m.color}`}>{m.value}</div>
            <div className="mt-1 text-[10px] text-white/40">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Monthly returns chart */}
      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="text-xs text-white/40 mb-3">Monthly Returns</div>
        <div className="flex items-end justify-between gap-1.5 h-[100px]">
          {monthlyReturns.map((m) => {
            const height = Math.abs(m.value) / maxVal * 100
            return (
              <div key={m.month} className="flex flex-col items-center gap-1 flex-1">
                <div className="w-full flex flex-col justify-end h-[80px]">
                  <div
                    className={`w-full rounded-sm ${m.positive ? 'bg-[#079211]' : 'bg-[#FF541F]'}`}
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className="text-[9px] text-white/30">{m.month}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom stats */}
      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs text-white/40">
        <span>Sortino: <span className="text-white/70 font-mono">3.21</span></span>
        <span>Calmar: <span className="text-white/70 font-mono">4.56</span></span>
        <span>Trades: <span className="text-white/70 font-mono">342</span></span>
      </div>
    </div>
  )
}

export default function BacktestingSection() {
  return (
    <section className="py-24" id="backtesting">
      <Container>
        <div className="flex flex-col lg:flex-row items-center gap-16">
          {/* Text left */}
          <div className="flex-1">
            <h2 className="text-[48px] font-bold leading-tight text-white">
              The Most Powerful{' '}
              <span className="text-[#079211] text-glow-green">Backtesting Engine</span>
            </h2>
            <ul className="mt-8 space-y-4 text-lg text-white/70">
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#079211]" />
                Test against real historical market data
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#079211]" />
                Detailed metrics: Win Rate, Sharpe Ratio, Max Drawdown, Profit Factor, Sortino, Calmar
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#079211]" />
                Parallel backtest execution
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#079211]" />
                Optimize parameters before going live
              </li>
            </ul>
          </div>

          {/* Visual right */}
          <div className="flex-1 flex justify-end">
            <MockBacktestResults />
          </div>
        </div>
      </Container>
    </section>
  )
}
