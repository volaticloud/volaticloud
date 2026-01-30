import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import HeroSection from '../components/sections/HeroSection'
import StatsSection from '../components/sections/StatsSection'
import FeaturesSection from '../components/sections/FeaturesSection'
import StrategyBuilderSection from '../components/sections/StrategyBuilderSection'
import CodeModeSection from '../components/sections/CodeModeSection'
import BacktestingSection from '../components/sections/BacktestingSection'
import TeamManagementSection from '../components/sections/TeamManagementSection'
import AlertingSection from '../components/sections/AlertingSection'
import PricingSection from '../components/sections/PricingSection'
import FAQSection from '../components/sections/FAQSection'
import CTASection from '../components/sections/CTASection'

function BackgroundDecorations() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Green rounded rectangle - left side, rotated 90deg */}
      <div className="hidden lg:block absolute top-[65%] -left-[176px] h-[226px] w-[423px] rotate-90 rounded-[117px] border-[23px] border-[rgba(7,146,17,0.55)]" />

      {/* Green circle - right side */}
      <div className="hidden lg:block absolute top-[52%] -right-[347px] h-[445px] w-[445px] rounded-full border-[23px] border-[#079211]" />

      {/* White rounded rectangle - bottom left */}
      <div className="hidden lg:block absolute top-[78%] -left-[413px] h-[226px] w-[636px] rounded-[117px] border-[23px] border-[#f6f6f6]" />

      {/* Two bold diagonal ray lines — \ direction, 45deg, full width */}
      <div className="hidden lg:block absolute bottom-[25%] h-[45px] w-[99999%] rotate-[45deg] origin-left bg-gradient-to-r from-white/3 via-white/10 to-white/25" />
      <div className="hidden lg:block absolute bottom-[23%] h-[45px] w-[99999%] rotate-[45deg] origin-left bg-gradient-to-r from-white/2 via-white/7 to-white/18" />

      {/* Warm ambient glow around pricing area */}
      <div className="absolute top-[48%] left-1/2 -translate-x-1/2 h-[925px] w-[1483px] opacity-60">
        <div className="h-full w-full bg-gradient-to-b from-transparent via-orange-950/8 to-transparent rounded-full blur-[100px]" />
      </div>

      {/* Large vivid red/orange glow — bottom of page, global */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[1200px] w-[1800px] rounded-full bg-[#ff541f] opacity-[0.12] blur-[200px]" />
      <div className="absolute bottom-[2%] left-1/2 -translate-x-1/2 h-[700px] w-[1100px] rounded-full bg-[#e84e1b] opacity-[0.15] blur-[120px]" />
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-[#010101] text-white">
      <BackgroundDecorations />
      <div className="relative">
        <Navbar />
        <main>
          <HeroSection />
          <StatsSection />
          <FeaturesSection />
          <StrategyBuilderSection />
          <CodeModeSection />
          <BacktestingSection />
          <TeamManagementSection />
          <AlertingSection />
          <PricingSection />
          <FAQSection />
          <CTASection />
        </main>
        <Footer />
      </div>
    </div>
  )
}
