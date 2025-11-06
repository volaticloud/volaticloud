import {
  AppBar,
  Toolbar,
  IconButton,
  Box,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { Logo } from '../shared/Logo';
import { drawerWidth } from './Sidebar';

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onToggleMobileMenu: () => void;
}

export const Header = ({ darkMode, onToggleDarkMode, onToggleMobileMenu }: HeaderProps) => {
  return (
    <AppBar
      position="fixed"
      sx={{
        width: { sm: `calc(100% - ${drawerWidth}px)` },
        ml: { sm: `${drawerWidth}px` },
        backgroundColor: (theme) =>
          darkMode ? theme.palette.background.paper : theme.palette.primary.main,
      }}
    >
      <Toolbar>
        {/* Mobile menu button */}
        <IconButton
          color="inherit"
          edge="start"
          onClick={onToggleMobileMenu}
          sx={{ mr: 2, display: { sm: 'none' } }}
        >
          <MenuIcon />
        </IconButton>

        {/* Mobile logo (only show on small screens) */}
        <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexGrow: 1 }}>
          <Logo size="small" />
        </Box>

        {/* Spacer for desktop */}
        <Box sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' } }} />

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title={darkMode ? 'Light mode' : 'Dark mode'}>
            <IconButton color="inherit" onClick={onToggleDarkMode}>
              {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Notifications">
            <IconButton color="inherit">
              <NotificationsIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Settings">
            <IconButton color="inherit">
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
