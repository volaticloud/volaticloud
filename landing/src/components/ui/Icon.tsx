import type { SVGProps } from 'react'

type IconName =
  | 'zap'
  | 'brain'
  | 'bar-chart'
  | 'refresh'
  | 'check'
  | 'chevron-down'
  | 'gem'
  | 'quote'

const paths: Record<IconName, { d: string; fill?: boolean }[]> = {
  zap: [{ d: 'M13 2L3 14h9l-1 10 10-12h-9l1-10z' }],
  brain: [
    {
      d: 'M12 2a7 7 0 0 0-4.6 12.3A4 4 0 0 0 8 18v2h8v-2a4 4 0 0 0 .6-3.7A7 7 0 0 0 12 2zm0 2a5 5 0 0 1 3.4 8.7l-.4.3V18h-6v-5l-.4-.3A5 5 0 0 1 12 4z',
      fill: true,
    },
  ],
  'bar-chart': [
    { d: 'M12 20V10M18 20V4M6 20v-4' },
  ],
  refresh: [
    { d: 'M1 4v6h6M23 20v-6h-6' },
    { d: 'M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15' },
  ],
  check: [{ d: 'M5 13l4 4L19 7' }],
  'chevron-down': [{ d: 'M19 9l-7 7-7-7' }],
  gem: [
    { d: 'M6 3l-3 7 9 11 9-11-3-7H6zm0 0h12M3 10h18M12 21L8 10m4 11l4-11' },
  ],
  quote: [
    { d: 'M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z' },
    { d: 'M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z' },
  ],
}

export default function Icon({
  name,
  className = '',
  size = 24,
  ...props
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  const iconPaths = paths[name]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {iconPaths.map((p, i) =>
        p.fill ? (
          <path key={i} d={p.d} fill="currentColor" stroke="none" />
        ) : (
          <path key={i} d={p.d} />
        ),
      )}
    </svg>
  )
}
