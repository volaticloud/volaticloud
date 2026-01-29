import { useState } from 'react'
import Container from '../ui/Container'
import Button from '../ui/Button'
import Logo from '../ui/Logo'
import { navLinks } from '../../data/content'

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl">
      <Container className="flex h-16 items-center justify-between">
        <a href="/">
          <Logo height={26} />
        </a>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-[13px] text-gray-400 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Button variant="outline" size="sm">
            Login
          </Button>
          <Button variant="primary" size="sm">
            Sign Up
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-gray-400 cursor-pointer"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            {mobileOpen ? (
              <path strokeLinecap="round" d="M6 6l12 12M6 18L18 6" />
            ) : (
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </Container>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-white/5 bg-[#0a0a0a] px-4 pb-6 pt-4 md:hidden">
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-gray-400 transition-colors hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex gap-3">
              <Button variant="outline" size="sm" className="flex-1">
                Login
              </Button>
              <Button variant="primary" size="sm" className="flex-1">
                Sign Up
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
