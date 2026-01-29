import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import HeroSection from '../components/sections/HeroSection'
import StatsSection from '../components/sections/StatsSection'
import FeaturesSection from '../components/sections/FeaturesSection'
import SocialProofSection from '../components/sections/SocialProofSection'
import PricingSection from '../components/sections/PricingSection'
import FAQSection from '../components/sections/FAQSection'
import CTASection from '../components/sections/CTASection'
import Divider from '../components/ui/Divider'

function BackgroundDecorations() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Large green semi-circle arcs on edges */}
      <div className="absolute top-[52%] -right-[250px] h-[600px] w-[600px] rounded-full border-[3px] border-green-500/20 bg-green-500/[0.03] blur-[2px]" />
      <div className="absolute top-[52%] -right-[250px] h-[600px] w-[600px] rounded-full bg-green-500/[0.04] blur-[40px]" />
      <div className="absolute top-[68%] -left-[250px] h-[600px] w-[600px] rounded-full border-[3px] border-green-500/20 bg-green-500/[0.03] blur-[2px]" />
      <div className="absolute top-[68%] -left-[250px] h-[600px] w-[600px] rounded-full bg-green-500/[0.04] blur-[40px]" />

      {/* Faint filled ellipses */}
      <div className="absolute top-[30%] right-[5%] h-[500px] w-[300px] rotate-12 rounded-full bg-white/[0.008]" />
      <div className="absolute top-[65%] right-[10%] h-[350px] w-[250px] rotate-[20deg] rounded-full bg-white/[0.006]" />

      {/* Faint filled rounded rectangles */}
      <div className="absolute top-[45%] -left-20 h-[400px] w-[200px] -rotate-6 rounded-3xl bg-white/[0.008]" />
      <div className="absolute top-[75%] left-[8%] h-[300px] w-[180px] -rotate-12 rounded-3xl bg-white/[0.006]" />

      {/* Bottom warm/red gradient glow */}
      <div className="absolute bottom-0 left-0 right-0 h-[800px]">
        <div className="absolute inset-0 bg-gradient-to-t from-red-950/25 via-red-950/8 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-orange-950/15 via-transparent to-transparent" />
        {/* Shadowed curved lines at bottom */}
        <svg className="absolute bottom-0 left-0 right-0 h-full w-full opacity-30" viewBox="0 0 1440 800" fill="none" preserveAspectRatio="none">
          <path d="M0 600 Q360 550 720 580 Q1080 610 1440 560" stroke="rgba(127,29,29,0.15)" strokeWidth="1" />
          <path d="M0 650 Q360 610 720 640 Q1080 670 1440 620" stroke="rgba(127,29,29,0.12)" strokeWidth="1" />
          <path d="M0 700 Q360 670 720 695 Q1080 720 1440 680" stroke="rgba(127,29,29,0.08)" strokeWidth="1" />
          <path d="M0 740 Q360 720 720 738 Q1080 756 1440 730" stroke="rgba(127,29,29,0.05)" strokeWidth="1" />
        </svg>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-white">
      <BackgroundDecorations />
      <div className="relative">
        <Navbar />
        <main>
          <HeroSection />
          <StatsSection />
          <FeaturesSection />
          <Divider className="py-2" />
          <SocialProofSection />
          <Divider className="py-2" />
          <PricingSection />
          <Divider className="py-2" />
          <FAQSection />
          <CTASection />
        </main>
        <Footer />
      </div>
    </div>
  )
}
