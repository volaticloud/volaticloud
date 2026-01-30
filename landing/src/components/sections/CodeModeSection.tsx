import Container from '../ui/Container'

const codeLines = [
  { num: 1, code: 'def populate_entry_trend(self, df):', color: 'text-[#c678dd]' },
  { num: 2, code: '    df.loc[', color: 'text-white/80' },
  { num: 3, code: "        (df['rsi'] < 30) &", color: 'text-white/80' },
  { num: 4, code: "        (df['macd'] > df['signal']),", color: 'text-white/80' },
  { num: 5, code: "        'enter_long'] = 1", color: 'text-[#079211]' },
  { num: 6, code: '    return df', color: 'text-[#c678dd]' },
]

function MockCodeEditor() {
  return (
    <div className="w-full max-w-[560px] rounded-2xl border border-white/10 bg-[#1b1b1c] shadow-2xl overflow-hidden">
      {/* Editor toolbar */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-[#ff5f56]" />
          <div className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
          <div className="h-3 w-3 rounded-full bg-[#27c93f]" />
        </div>
        <span className="ml-3 text-xs text-white/40 font-mono">strategy.py</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="rounded bg-[#FF541F]/20 px-2 py-0.5 text-[10px] font-bold text-[#FF541F]">
            Exported from UI Builder
          </span>
        </div>
      </div>

      {/* Code area */}
      <div className="p-4 font-mono text-sm leading-7">
        {codeLines.map((line) => (
          <div key={line.num} className="flex">
            <span className="w-8 shrink-0 text-right text-white/20 select-none">{line.num}</span>
            <pre className={`ml-4 ${line.color}`}>{line.code}</pre>
          </div>
        ))}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-[10px] text-white/30">
        <span>Python 3.11</span>
        <span>UTF-8</span>
      </div>
    </div>
  )
}

export default function CodeModeSection() {
  return (
    <section className="py-24" id="code-mode">
      <Container>
        <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
          {/* Text right */}
          <div className="flex-1">
            <h2 className="text-[48px] font-bold leading-tight text-white">
              Full Freedom with{' '}
              <span className="text-[#FF541F]">Code Mode</span>
            </h2>
            <p className="mt-4 text-lg text-white/50">
              For advanced users — export from the visual builder to native Python, or write strategies from scratch.
            </p>
            <ul className="mt-8 space-y-4 text-lg text-white/70">
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#FF541F]" />
                One-click export from UI Builder to Python code
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#FF541F]" />
                Full Python editing environment
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#FF541F]" />
                Complete control over strategy logic
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#FF541F]" />
                Use any Python library or custom indicator
              </li>
            </ul>
          </div>

          {/* Visual left */}
          <div className="flex-1 flex justify-start">
            <MockCodeEditor />
          </div>
        </div>
      </Container>
    </section>
  )
}
