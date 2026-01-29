import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'outline'
type Size = 'sm' | 'md' | 'lg'

type BaseProps = {
  variant?: Variant
  size?: Size
}

type ButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined }
type AnchorProps = BaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }

type Props = ButtonProps | AnchorProps

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-green-500 hover:bg-green-400 text-white shadow-[0_0_20px_-4px_rgba(34,197,94,0.4)] hover:shadow-[0_0_24px_-4px_rgba(34,197,94,0.5)]',
  secondary:
    'bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20',
  outline:
    'bg-transparent hover:bg-white/5 text-gray-300 hover:text-white border border-gray-700 hover:border-gray-600',
}

const sizeClasses: Record<Size, string> = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3 text-sm',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: Props) {
  const classes = `inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 cursor-pointer ${variantClasses[variant]} ${sizeClasses[size]} ${className}`

  if ('href' in props && props.href) {
    const { ...rest } = props as AnchorProps
    return <a className={classes} {...rest} />
  }

  const { ...rest } = props as ButtonProps
  return <button className={classes} {...rest} />
}
