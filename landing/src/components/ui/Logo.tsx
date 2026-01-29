export default function Logo({ className = '', height = 28 }: { className?: string; height?: number }) {
  return (
    <img
      src="/logo-light.svg"
      alt="VolatiCloud"
      height={height}
      className={className}
      style={{ height }}
    />
  )
}
