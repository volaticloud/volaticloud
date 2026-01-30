import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import HeroSection from './HeroSection'
import StatsSection from './StatsSection'
import FeaturesSection from './FeaturesSection'
import PricingSection from './PricingSection'
import FAQSection from './FAQSection'
import CTASection from './CTASection'
import StrategyBuilderSection from './StrategyBuilderSection'
import CodeModeSection from './CodeModeSection'
import BacktestingSection from './BacktestingSection'
import TeamManagementSection from './TeamManagementSection'
import AlertingSection from './AlertingSection'

function renderWithRouter(ui: React.ReactNode) {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('HeroSection', () => {
  it('renders heading and CTA buttons', () => {
    renderWithRouter(<HeroSection />)
    expect(screen.getByText('Start Trading')).toBeInTheDocument()
    expect(screen.getByText('See How It Works')).toBeInTheDocument()
    expect(screen.getByText('Platform Online')).toBeInTheDocument()
  })

  it('links to console URL', () => {
    renderWithRouter(<HeroSection />)
    const links = screen.getAllByText('Start Trading')
    const anchor = links[0].closest('a')
    expect(anchor).toHaveAttribute('href', expect.stringContaining('console.volaticloud.com'))
    expect(anchor).toHaveAttribute('rel', 'noopener noreferrer')
  })
})

describe('StatsSection', () => {
  it('renders stat values', () => {
    renderWithRouter(<StatsSection />)
    expect(screen.getByText('20+')).toBeInTheDocument()
    expect(screen.getByText('10+')).toBeInTheDocument()
    expect(screen.getByText('24/7')).toBeInTheDocument()
  })
})

describe('FeaturesSection', () => {
  it('renders feature cards', () => {
    renderWithRouter(<FeaturesSection />)
    expect(screen.getByText('Visual Strategy Builder')).toBeInTheDocument()
    expect(screen.getByText('Intelligent Backtesting')).toBeInTheDocument()
    expect(screen.getByText('Multi-Exchange Support')).toBeInTheDocument()
    expect(screen.getByText('Real-Time Monitoring')).toBeInTheDocument()
  })
})

describe('PricingSection', () => {
  it('renders pricing tiers', () => {
    renderWithRouter(<PricingSection />)
    expect(screen.getByText('Starter')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('Team')).toBeInTheDocument()
  })

  it('renders billing toggle', () => {
    renderWithRouter(<PricingSection />)
    const monthly = screen.getAllByText('Monthly')
    expect(monthly.length).toBeGreaterThan(0)
    const yearly = screen.getAllByText('Yearly')
    expect(yearly.length).toBeGreaterThan(0)
  })

  it('pricing CTAs are links to console', () => {
    renderWithRouter(<PricingSection />)
    const links = screen.getAllByRole('link', { name: /Start|Get Started|Contact Sales/ })
    expect(links.length).toBeGreaterThan(0)
    links.forEach((anchor) => {
      expect(anchor).toHaveAttribute('href', expect.stringContaining('console.volaticloud.com'))
    })
  })
})

describe('FAQSection', () => {
  it('renders FAQ questions', () => {
    renderWithRouter(<FAQSection />)
    expect(screen.getByText('What is VolatiCloud?')).toBeInTheDocument()
    expect(screen.getByText('Which exchanges are supported?')).toBeInTheDocument()
  })
})

describe('CTASection', () => {
  it('renders CTA banner', () => {
    renderWithRouter(<CTASection />)
    expect(screen.getByText('Ready to Automate Your Trading?')).toBeInTheDocument()
    expect(screen.getByText('Start Trading Free')).toBeInTheDocument()
  })
})

describe('StrategyBuilderSection', () => {
  it('renders heading and mock UI', () => {
    renderWithRouter(<StrategyBuilderSection />)
    expect(screen.getByText(/No Code Required/)).toBeInTheDocument()
    expect(screen.getAllByText('RSI').length).toBeGreaterThan(0)
    expect(screen.getByText('BUY LONG')).toBeInTheDocument()
  })
})

describe('CodeModeSection', () => {
  it('renders heading and code snippet', () => {
    renderWithRouter(<CodeModeSection />)
    expect(screen.getByText(/Code Mode/)).toBeInTheDocument()
    expect(screen.getByText('strategy.py')).toBeInTheDocument()
  })
})

describe('BacktestingSection', () => {
  it('renders heading and metrics', () => {
    renderWithRouter(<BacktestingSection />)
    expect(screen.getByText(/Backtesting Engine/)).toBeInTheDocument()
    expect(screen.getByText('67.3%')).toBeInTheDocument()
    expect(screen.getByText('Win Rate')).toBeInTheDocument()
  })
})

describe('TeamManagementSection', () => {
  it('renders heading and team mock', () => {
    renderWithRouter(<TeamManagementSection />)
    expect(screen.getByText(/Team Management/)).toBeInTheDocument()
    expect(screen.getByText('Acme Trading')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })
})

describe('AlertingSection', () => {
  it('renders heading and alert rules', () => {
    renderWithRouter(<AlertingSection />)
    expect(screen.getByText(/Never Miss a Signal/)).toBeInTheDocument()
    expect(screen.getByText('Bot Stopped')).toBeInTheDocument()
    expect(screen.getByText('Drawdown > 5%')).toBeInTheDocument()
  })
})
