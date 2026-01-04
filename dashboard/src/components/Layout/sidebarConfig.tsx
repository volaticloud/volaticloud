import {
  Dashboard as DashboardIcon,
  SmartToy as BotIcon,
  AccountBalance as ExchangeIcon,
  Psychology as StrategyIcon,
  Science as BacktestIcon,
  ShowChart as TradeIcon,
  Storage as RuntimeIcon,
  NotificationsActive as AlertsIcon,
  DataUsage as UsageIcon,
} from '@mui/icons-material';

export const drawerWidth = 260;
export const collapsedDrawerWidth = 72;

export interface MenuItem {
  text: string;
  icon: React.ReactNode;
  path: string;
}

export interface BackButton {
  text: string;
  path: string;
}

export const mainMenuItems: MenuItem[] = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'Bots', icon: <BotIcon />, path: '/bots' },
  { text: 'Exchanges', icon: <ExchangeIcon />, path: '/exchanges' },
  { text: 'Strategies', icon: <StrategyIcon />, path: '/strategies' },
  { text: 'Backtests', icon: <BacktestIcon />, path: '/backtests' },
  { text: 'Trades', icon: <TradeIcon />, path: '/trades' },
  { text: 'Runners', icon: <RuntimeIcon />, path: '/runners' },
  { text: 'Alerts', icon: <AlertsIcon />, path: '/alerts' },
  { text: 'Usage', icon: <UsageIcon />, path: '/usage' },
];