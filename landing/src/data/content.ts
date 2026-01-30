export const navLinks = [
  { label: 'Home', href: '#', active: true },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
]

export const heroContent = {
  titleLine1: 'Automate your',
  titleAccent: 'trading strategies.',
  titleLine2: 'Dominate the markets.',
  description:
    'Deploy, manage, and monitor AI-powered crypto trading bots across major exchanges. Build strategies visually, backtest with real data, and go live with confidence — all from a single control plane.',
  primaryCta: 'Start Trading',
  secondaryCta: 'See How It Works',
}

export const stats = [
  { value: '20+', label: 'Indicators' },
  { value: '10+', label: 'Exchanges' },
  { value: '24/7', label: 'Bot Uptime' },
]

export const featuresContent = {
  titleLine1: 'Built for Traders.',
  titleLine2: 'Powered by',
  titleAccent: 'AI.',
  subtitle:
    'From strategy creation to live execution — every tool you need to trade smarter, faster, and with full control over your portfolio.',
}

export const features = [
  {
    iconName: 'zap' as const,
    title: 'Visual Strategy Builder',
    description:
      'Design complex trading strategies without writing a single line of code. Combine 20+ technical indicators like RSI, MACD, Bollinger Bands, and more using an intuitive drag-and-drop condition tree.',
    highlighted: true,
  },
  {
    iconName: 'brain' as const,
    title: 'Intelligent Backtesting',
    description:
      'Validate every strategy against historical market data before risking real capital. Get detailed performance metrics — win rate, Sharpe ratio, max drawdown, profit factor — and optimize with confidence.',
    highlighted: false,
  },
  {
    iconName: 'bar-chart' as const,
    title: 'Multi-Exchange Support',
    description:
      'Connect to Binance, Kraken, Coinbase, KuCoin, Bybit, Bitget, OKX, and more. Manage all your exchange connections from one dashboard with encrypted credential storage.',
    highlighted: false,
  },
  {
    iconName: 'refresh' as const,
    title: 'Real-Time Monitoring',
    description:
      'Track every bot\'s performance, open trades, and P&L in real time. Get instant alerts, view detailed logs, and take action — start, stop, or adjust any bot with a single click.',
    highlighted: true,
  },
]

export const socialProof = {
  yearLabel: '2024',
  description:
    "Whether you're a solo trader testing new ideas, a quant team managing dozens of bots, or an organization scaling automated trading operations — VolatiCloud gives you the infrastructure to execute with precision. And our track record speaks for itself.",
  stats: [
    { value: '20+', label: 'Technical indicators', sublabel: 'RSI, MACD, EMA, Bollinger Bands & more' },
    { value: '10+', label: 'Supported exchanges', sublabel: 'Binance, Kraken, Coinbase, KuCoin...' },
    { value: '99.9%', label: 'Platform uptime', sublabel: 'Enterprise-grade reliability' },
    { value: '<50ms', label: 'Signal execution', sublabel: 'Low-latency order placement' },
  ],
  cta: 'Start Trading',
  ctaNote: 'Free tier available',
}

export interface PricingTier {
  name: string
  price: number
  period: string
  description: string
  features: string[]
  highlighted: boolean
  ctaLabel: string
  discount?: string
}

export const pricingContent = {
  titleLine1: 'Choose the Plan',
  titleLine2: "That's Right for You",
  subtitle:
    'Start free with essential bot management tools. Upgrade to Pro for unlimited strategies, advanced backtesting, and priority execution across all supported exchanges. Enterprise plans include custom server infrastructure.',
}

export const pricingTiers: PricingTier[] = [
  {
    name: 'Starter',
    price: 0,
    period: '/ month',
    description: 'Perfect for learning and testing your first trading strategies.',
    features: [
      '2 active bots',
      '5 strategies',
      'Dry-run mode only',
      'Basic backtesting',
      'Community support',
    ],
    highlighted: false,
    ctaLabel: 'Get Started',
  },
  {
    name: 'Pro',
    price: 29,
    period: '/ month',
    description: 'For serious traders who need full control and live execution.',
    features: [
      'Unlimited active bots',
      'Unlimited strategies',
      'Live & dry-run trading',
      'Advanced backtesting & optimization',
      'All 10+ exchanges',
      'Real-time alerts & monitoring',
      'Priority support',
    ],
    highlighted: true,
    ctaLabel: 'Start Pro Trial',
    discount: '-20%',
  },
  {
    name: 'Team',
    price: 79,
    period: '/ month',
    description: 'For teams and organizations managing trading operations at scale.',
    features: [
      'Everything in Pro',
      'Multi-user organizations',
      'Role-based access control',
      'Shared strategies & bots',
      'Dedicated infrastructure',
    ],
    highlighted: false,
    ctaLabel: 'Contact Sales',
    discount: '-20%',
  },
]

export const faqItems = [
  {
    question: 'What is VolatiCloud?',
    answer:
      'VolatiCloud is a cloud-based control plane for managing automated cryptocurrency trading bots. It lets you build strategies visually, backtest them against historical data, deploy bots across major exchanges, and monitor everything in real time — all from a single dashboard.',
  },
  {
    question: 'Which exchanges are supported?',
    answer:
      'We support 10+ major exchanges including Binance, Binance US, Kraken, Coinbase, KuCoin, Bybit, Bitget, OKX, and GateIO. New exchanges are added regularly based on user demand.',
  },
  {
    question: 'Do I need coding experience to create strategies?',
    answer:
      'Not at all. Our Visual Strategy Builder lets you create sophisticated trading strategies using a drag-and-drop interface with 20+ built-in technical indicators. For advanced users, we also support direct Python code editing.',
  },
  {
    question: 'Is my exchange API key secure?',
    answer:
      'Absolutely. All exchange credentials are encrypted at rest using industry-standard encryption. We use Keycloak-based authentication with UMA 2.0 fine-grained authorization, ensuring only you can access your sensitive data.',
  },
  {
    question: 'Can I test strategies before going live?',
    answer:
      'Yes — and we strongly recommend it. Every strategy can be backtested against real historical market data. You\'ll see detailed metrics including win rate, Sharpe ratio, maximum drawdown, profit factor, and more. You can also run bots in dry-run mode to simulate live trading without risking capital.',
  },
]

export const ctaBanner = {
  title: 'Ready to Automate Your Trading?',
  description:
    "Join traders who are already using VolatiCloud to build, test, and deploy automated strategies across the world's top crypto exchanges.",
  cta: 'Start Trading Free',
}

export const footerContent = {
  heading: 'VolatiCloud',
  about:
    'The intelligent control plane for automated crypto trading. Build strategies visually, backtest with confidence, and deploy bots across 10+ exchanges — all from one platform.',
  columns: [
    {
      title: 'Product',
      links: [
        { label: 'Strategy Builder', href: '#features' },
        { label: 'Backtesting', href: '#features' },
        { label: 'Bot Management', href: '#features' },
        { label: 'Pricing', href: '#pricing' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { label: 'Documentation', href: '#' },
        { label: 'API Reference', href: '#' },
        { label: 'Privacy Policy', href: '#' },
        { label: 'Terms of Service', href: '#' },
      ],
    },
  ],
  contact: {
    title: 'Get in Touch',
    address: '',
    phone: '',
    email: 'support@volaticloud.com',
  },
  copyright: '\u00A9 2025 VolatiCloud. All rights reserved.',
}
