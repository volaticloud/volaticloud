import Container from '../ui/Container'
import StatCard from '../ui/StatCard'
import { stats } from '../../data/content'

export default function StatsSection() {
  return (
    <section className="border-y border-white/5 py-14">
      <Container>
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-white/5">
          {stats.map((stat) => (
            <StatCard
              key={stat.label}
              value={stat.value}
              label={stat.label}
              tag={stat.tag}
              tagColor={stat.tagColor}
            />
          ))}
        </div>
      </Container>
    </section>
  )
}
