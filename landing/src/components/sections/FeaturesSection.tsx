import Container from '../ui/Container'
import FeatureCard from '../ui/FeatureCard'
import Icon from '../ui/Icon'
import { featuresContent, features } from '../../data/content'

function GemDecoration() {
  return (
    <div className="hidden shrink-0 lg:block">
      <div className="relative">
        <div className="absolute inset-0 scale-150 bg-green-500/8 blur-2xl rounded-full" />
        <img src="/ruby.svg" alt="" className="relative h-16 w-16 opacity-60 rotate-[36.93deg]" />
      </div>
    </div>
  )
}

export default function FeaturesSection() {
  return (
    <section className="py-20" id="features">
      <Container>
        <div className="flex items-start justify-between gap-8">
          <div>
            <div className="max-w-[731px]">
              <h2 className="text-3xl sm:text-[48px] lg:text-[64px] font-black leading-tight lg:leading-[70.4px] text-white">
                {featuresContent.titleLine1}
                <br />
                {featuresContent.titleLine2}{' '}
                <span className="text-[#079211] text-glow-green">
                  {featuresContent.titleAccent}
                </span>
              </h2>
            </div>

            <p className="mt-6 max-w-[661px] text-lg leading-[21.6px] text-white/85">
              {featuresContent.subtitle}
            </p>
          </div>
          <GemDecoration />
        </div>

        {/* Asymmetric 2x2 grid: row 1 = small/large, row 2 = large/small */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-[39%_1fr] gap-5">
          <FeatureCard
            icon={<Icon name={features[0].iconName} size={20} />}
            title={features[0].title}
            description={features[0].description}
            highlighted={features[0].highlighted}
          />
          <FeatureCard
            icon={<Icon name={features[1].iconName} size={20} />}
            title={features[1].title}
            description={features[1].description}
            highlighted={features[1].highlighted}
          />
        </div>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_39%] gap-5">
          <FeatureCard
            icon={<Icon name={features[2].iconName} size={20} />}
            title={features[2].title}
            description={features[2].description}
            highlighted={features[2].highlighted}
          />
          <FeatureCard
            icon={<Icon name={features[3].iconName} size={20} />}
            title={features[3].title}
            description={features[3].description}
            highlighted={features[3].highlighted}
          />
        </div>
      </Container>
    </section>
  )
}
