import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'

function renderWithRouter(ui: React.ReactNode) {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('Navbar', () => {
  it('renders nav links', () => {
    renderWithRouter(<Navbar />)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Features')).toBeInTheDocument()
    expect(screen.getByText('Pricing')).toBeInTheDocument()
    expect(screen.getByText('FAQ')).toBeInTheDocument()
  })

  it('renders login button with console link', () => {
    renderWithRouter(<Navbar />)
    const loginLinks = screen.getAllByText('Login')
    const desktopLogin = loginLinks[0].closest('a')
    expect(desktopLogin).toHaveAttribute('href', expect.stringContaining('console.volaticloud.com'))
    expect(desktopLogin).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('toggles mobile menu', () => {
    renderWithRouter(<Navbar />)
    const toggles = screen.getAllByLabelText('Toggle menu')
    const toggle = toggles[0]
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('Footer', () => {
  it('renders footer content', () => {
    renderWithRouter(<Footer />)
    expect(screen.getByText('VolatiCloud')).toBeInTheDocument()
    expect(screen.getByText('Product')).toBeInTheDocument()
    expect(screen.getByText('Resources')).toBeInTheDocument()
  })
})
