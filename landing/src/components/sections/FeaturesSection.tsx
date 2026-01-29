import Container from '../ui/Container'
import SectionHeading from '../ui/SectionHeading'
import FeatureCard from '../ui/FeatureCard'
import Icon from '../ui/Icon'
import Divider from '../ui/Divider'
import { featuresContent, features } from '../../data/content'

function GemDecoration() {
  return (
    <div className="hidden shrink-0 lg:block">
      <div className="relative">
        <div className="absolute inset-0 scale-150 bg-green-500/8 blur-2xl rounded-full" />
        <img src="/ruby.svg" alt="" className="relative h-12 w-12 opacity-60" />
      </div>
    </div>
  )
}

export default function FeaturesSection() {
  return (
    <section className="py-20" id="product">
      <Container>
        <div className="flex items-start justify-between gap-8">
          <SectionHeading
            subtitle={featuresContent.subtitle}
            centered={false}
          >
            {featuresContent.titleLine1}
            <br />
            {featuresContent.titleLine2}{' '}
            <span className="text-green-400 text-glow-green">
              {featuresContent.titleAccent}
            </span>
          </SectionHeading>
          <GemDecoration />
        </div>

        <Divider className="mt-8" />

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <FeatureCard
              key={feature.title}
              icon={<Icon name={feature.iconName} size={16} />}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      </Container>
    </section>
  )
}
