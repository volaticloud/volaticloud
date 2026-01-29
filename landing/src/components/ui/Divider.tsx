export default function Divider({ className = '' }: { className?: string }) {
  return (
    <div className={`flex justify-center ${className}`}>
      <div className="h-px w-full max-w-md bg-gradient-to-r from-transparent via-gray-700/70 to-transparent" />
    </div>
  )
}
