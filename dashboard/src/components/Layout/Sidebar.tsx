import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Box,
  Divider,
  Tooltip,
} from '@mui/material';
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
import { useLocation } from 'react-router-dom';
import { Logo } from '../shared/Logo';
import { useGroupNavigate } from '../../contexts/GroupContext';

export const drawerWidth = 260;
export const collapsedDrawerWidth = 72;

const menuItems = [
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

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  collapsed?: boolean;
}

export const Sidebar = ({ mobileOpen, onMobileClose, collapsed = false }: SidebarProps) => {
  const navigate = useGroupNavigate();
  const location = useLocation();

  const handleNavigate = (path: string) => {
    navigate(path);
    onMobileClose(); // Close drawer on mobile after navigation
  };

  const currentWidth = collapsed ? collapsedDrawerWidth : drawerWidth;

  const drawerContent = (isCollapsed: boolean) => (
    <>
      <Toolbar sx={{ justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
        <Logo onClick={() => handleNavigate('/')} variant={isCollapsed ? 'icon' : 'full'} />
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => {
          const listItemButton = (
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigate(item.path)}
              sx={{
                minHeight: 48,
                justifyContent: isCollapsed ? 'center' : 'initial',
                px: isCollapsed ? 2 : 2.5,
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'primary.contrastText',
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: 'inherit',
                  minWidth: isCollapsed ? 0 : 40,
                  mr: isCollapsed ? 0 : 2,
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </ListItemIcon>
              {!isCollapsed && <ListItemText primary={item.text} />}
            </ListItemButton>
          );

          return (
            <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
              {isCollapsed ? (
                <Tooltip title={item.text} placement="right" arrow>
                  {listItemButton}
                </Tooltip>
              ) : (
                listItemButton
              )}
            </ListItem>
          );
        })}
      </List>
    </>
  );

  return (
    <Box
      component="nav"
      sx={{
        width: { sm: currentWidth },
        flexShrink: { sm: 0 },
        transition: 'width 0.2s ease-in-out',
      }}
    >
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{
          keepMounted: true, // Better mobile performance
        }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        {drawerContent(false)}
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': {
            width: currentWidth,
            boxSizing: 'border-box',
            transition: 'width 0.2s ease-in-out',
            overflowX: 'hidden',
          },
        }}
        open
      >
        {drawerContent(collapsed)}
      </Drawer>
    </Box>
  );
};
