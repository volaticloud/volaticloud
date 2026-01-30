import Container from '../ui/Container'
import { footerContent } from '../../data/content'

const socialIcons = [
  { label: 'Facebook', path: 'M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z' },
  { label: 'GitHub', path: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22' },
  { label: 'Twitter', path: 'M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z' },
  { label: 'Google', path: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 014.24 10.24L12 12V6z' },
]

export default function Footer() {
  return (
    <footer className="bg-white/[0.06] pt-16 pb-8">
      <Container>
        <div className="grid gap-12 md:grid-cols-4" style={{ padding: '0 1px' }}>
          {/* About Us column */}
          <div>
            <h4 className="text-[32px] font-medium text-white tracking-tight">
              {footerContent.heading}
            </h4>
            <p className="mt-10 text-lg leading-relaxed text-[#bcbcbc]" style={{ maxWidth: '307px' }}>
              {footerContent.about}
            </p>
          </div>

          {/* Link columns */}
          {footerContent.columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-2xl font-bold text-[#079211] tracking-tight">
                {col.title}
              </h4>
              <ul className="mt-6 space-y-4">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-lg leading-relaxed text-[#bcbcbc] transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Connect With Us column */}
          <div>
            <h4 className="text-2xl font-bold text-[#079211] tracking-tight">
              {footerContent.contact.title}
            </h4>
            <ul className="mt-6 space-y-4 text-lg leading-relaxed text-[#bcbcbc]">
              {footerContent.contact.address && <li>{footerContent.contact.address}</li>}
              {footerContent.contact.phone && <li>{footerContent.contact.phone}</li>}
              {footerContent.contact.email && <li>{footerContent.contact.email}</li>}
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-12 h-px w-full bg-white/10" />

        {/* Bottom bar */}
        <div className="mt-8 flex items-center justify-between">
          <span className="text-lg text-white">{footerContent.copyright}</span>
          <div className="flex items-center gap-2">
            {socialIcons.map((icon) => (
              <a
                key={icon.label}
                href="#"
                className="flex h-[31px] w-[31px] items-center justify-center rounded-full border border-[#079211] text-white transition-colors hover:bg-[#079211]/20"
                aria-label={icon.label}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={icon.path} />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  )
}
