import { useState } from 'react'
import Container from '../ui/Container'
import Logo from '../ui/Logo'
import { navLinks } from '../../data/content'
import { CONSOLE_URL } from '../../config'

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="fixed top-0 z-50 w-full bg-[#010101]/80 backdrop-blur-xl">
      <Container className="flex h-[100px] items-center justify-between">
        <a href="/" className="flex items-center">
          <Logo height={26} />
        </a>

        {/* Desktop nav */}
        <div className="hidden items-center gap-16 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="relative text-lg text-white transition-colors hover:text-white"
            >
              {link.label}
              {'active' in link && link.active && (
                <span className="absolute -bottom-1 left-0 right-0 h-[2px] rounded-full bg-[#079211]" />
              )}
            </a>
          ))}
        </div>

        <div className="hidden md:block">
          <a
            href={CONSOLE_URL}
            className="inline-flex items-center justify-center rounded-[10px] bg-[#079211] px-9 py-4 text-lg font-medium text-white transition-colors hover:bg-[#068a0f]"
          >
            Login
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-gray-400 cursor-pointer"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
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
        <div className="border-t border-white/5 bg-[#010101] px-4 pb-6 pt-4 md:hidden">
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
            <a
              href={CONSOLE_URL}
              className="mt-2 inline-flex items-center justify-center rounded-[10px] bg-[#079211] px-9 py-4 text-lg font-medium text-white"
            >
              Login
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
