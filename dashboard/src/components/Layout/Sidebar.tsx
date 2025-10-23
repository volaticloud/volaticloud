import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Box,
  Divider,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  SmartToy as BotIcon,
  AccountBalance as ExchangeIcon,
  Psychology as StrategyIcon,
  Science as BacktestIcon,
  ShowChart as TradeIcon,
  Storage as RuntimeIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const drawerWidth = 260;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'Bots', icon: <BotIcon />, path: '/bots' },
  { text: 'Exchanges', icon: <ExchangeIcon />, path: '/exchanges' },
  { text: 'Strategies', icon: <StrategyIcon />, path: '/strategies' },
  { text: 'Backtests', icon: <BacktestIcon />, path: '/backtests' },
  { text: 'Trades', icon: <TradeIcon />, path: '/trades' },
  { text: 'Runners', icon: <RuntimeIcon />, path: '/runners' },
];

export const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
        },
      }}
    >
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BotIcon sx={{ color: 'primary.main', fontSize: 32 }} />
          <Typography variant="h6" noWrap component="div" fontWeight={700}>
            AnyTrade
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              sx={{
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
              <ListItemIcon sx={{ color: 'inherit' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
};
