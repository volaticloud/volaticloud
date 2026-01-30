import Container from '../ui/Container'
import { stats } from '../../data/content'

export default function StatsSection() {
  return (
    <section className="border-y border-white/10 py-14">
      <Container>
        <div className="grid grid-cols-1 sm:grid-cols-3 relative">
          {stats.map((stat, i) => (
            <div key={stat.label} className="relative flex flex-col items-center gap-3 py-4">
              {/* Vertical separator */}
              {i > 0 && (
                <div className="hidden sm:block absolute left-0 top-1/2 -translate-y-1/2 h-[134px] w-px bg-white/10" />
              )}
              <span className="text-[23px] text-[#079211]">{stat.label}</span>
              <span className="text-[46px] font-black text-white">{stat.value}</span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
