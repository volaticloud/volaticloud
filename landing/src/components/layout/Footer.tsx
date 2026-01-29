import Container from '../ui/Container'
import Logo from '../ui/Logo'
import { footerContent } from '../../data/content'

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#0a0a0a] pt-16 pb-8">
      <Container>
        <div className="grid gap-12 md:grid-cols-4">
          <div>
            <Logo height={24} className="mb-4" />
            <h4 className="text-sm font-semibold text-white mb-3">
              {footerContent.heading}
            </h4>
            <p className="text-[13px] leading-relaxed text-gray-500">
              {footerContent.about}
            </p>
          </div>
          {footerContent.columns.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-sm font-semibold text-white">
                {col.title}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[13px] text-gray-500 transition-colors hover:text-gray-300"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 border-t border-white/5 pt-6 text-center text-xs text-gray-600">
          {footerContent.copyright}
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500/60" />
            <div className="h-2 w-2 rounded-full bg-green-500/40" />
            <div className="h-2 w-2 rounded-full bg-green-500/25" />
            <div className="h-2 w-2 rounded-full bg-green-500/15" />
          </div>
        </div>
      </Container>
    </footer>
  )
}
