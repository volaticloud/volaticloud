import {
  AppBar,
  Toolbar,
  IconButton,
  Box,
  Tooltip,
  Avatar,
  Menu,
  MenuItem,
  Typography,
  Divider,
} from '@mui/material';
import {
  Menu as MenuIcon,
  MenuOpen as MenuOpenIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Logo } from '../shared/Logo';
import { GroupSwitcher } from '../shared/GroupSwitcher';
import { NotificationsDropdown } from './NotificationsDropdown';

interface HeaderProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onToggleMobileMenu: () => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
  currentDrawerWidth: number;
}

export const Header = ({
  darkMode,
  onToggleDarkMode,
  onToggleMobileMenu,
  onToggleSidebar,
  sidebarCollapsed,
  currentDrawerWidth,
}: HeaderProps) => {
  const auth = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    // Simple logout - signoutRedirect handles everything
    auth.signoutRedirect();
  };

  // Get user info from auth
  const user = auth.user;
  const userName = user?.profile?.name || user?.profile?.preferred_username || 'User';
  const userEmail = user?.profile?.email || '';

  return (
    <AppBar
      position="fixed"
      sx={{
        width: { sm: `calc(100% - ${currentDrawerWidth}px)` },
        ml: { sm: `${currentDrawerWidth}px` },
        backgroundColor: (theme) =>
          darkMode ? theme.palette.background.paper : theme.palette.primary.main,
        transition: 'width 0.2s ease-in-out, margin-left 0.2s ease-in-out',
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

        {/* Desktop sidebar toggle button */}
        <Tooltip title={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={onToggleSidebar}
            sx={{ mr: 2, display: { xs: 'none', sm: 'flex' } }}
          >
            {sidebarCollapsed ? <MenuIcon /> : <MenuOpenIcon />}
          </IconButton>
        </Tooltip>

        {/* Mobile logo (only show on small screens) */}
        <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexGrow: 1 }}>
          <Logo size="small" />
        </Box>

        {/* Spacer for desktop */}
        <Box sx={{ flexGrow: 1, display: { xs: 'none', sm: 'block' } }} />

        {/* Group Switcher */}
        <Box sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>
          <GroupSwitcher />
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Tooltip title={darkMode ? 'Light mode' : 'Dark mode'}>
            <IconButton color="inherit" onClick={onToggleDarkMode}>
              {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>

          <NotificationsDropdown />

          <Tooltip title="Settings">
            <IconButton color="inherit">
              <SettingsIcon />
            </IconButton>
          </Tooltip>

          {/* User menu */}
          <Tooltip title="Account">
            <IconButton onClick={handleMenuOpen} sx={{ ml: 1 }}>
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: 'primary.dark',
                }}
              >
                {userName.charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle2" noWrap>
                {userName}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {userEmail}
              </Typography>
            </Box>
            <Divider />
            <MenuItem>
              <PersonIcon sx={{ mr: 1 }} fontSize="small" />
              Profile
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <LogoutIcon sx={{ mr: 1 }} fontSize="small" />
              Logout
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
