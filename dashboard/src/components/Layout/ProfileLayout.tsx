import { Box, Toolbar } from '@mui/material';
import { Outlet } from 'react-router-dom';
import {
  Person as PersonIcon,
  Lock as LockIcon,
  Devices as DevicesIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { Sidebar } from './Sidebar';
import { drawerWidth, collapsedDrawerWidth, type MenuItem } from './sidebarConfig';
import { Header } from './Header';
import { useSidebar } from '../../contexts/SidebarContext';

const profileMenuItems: MenuItem[] = [
  { text: 'Profile Information', icon: <PersonIcon />, path: '/profile' },
  { text: 'Password', icon: <LockIcon />, path: '/profile/credentials' },
  { text: 'Active Sessions', icon: <DevicesIcon />, path: '/profile/sessions' },
  { text: 'Two-Factor Auth', icon: <SecurityIcon />, path: '/profile/two-factor' },
];

interface ProfileLayoutProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const ProfileLayout = ({ darkMode, onToggleDarkMode }: ProfileLayoutProps) => {
  const {
    collapsed: sidebarCollapsed,
    mobileOpen,
    toggleCollapsed: handleSidebarCollapse,
    toggleMobileOpen: handleMobileToggle,
    setMobileOpen,
  } = useSidebar();

  const handleMobileClose = () => {
    setMobileOpen(false);
  };

  const currentDrawerWidth = sidebarCollapsed ? collapsedDrawerWidth : drawerWidth;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', overflowX: 'hidden' }}>
      <Header
        darkMode={darkMode}
        onToggleDarkMode={onToggleDarkMode}
        onToggleMobileMenu={handleMobileToggle}
        onToggleSidebar={handleSidebarCollapse}
        sidebarCollapsed={sidebarCollapsed}
        currentDrawerWidth={currentDrawerWidth}
      />
      <Sidebar
        menuItems={profileMenuItems}
        mobileOpen={mobileOpen}
        onMobileClose={handleMobileClose}
        collapsed={sidebarCollapsed}
        backButton={{ text: 'Back to Dashboard', path: '/' }}
        showGroupSwitcher={false}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          width: { xs: '100%', sm: `calc(100% - ${currentDrawerWidth}px)` },
          minWidth: 0, // Critical: Prevents flex item from overflowing
          transition: 'width 0.2s ease-in-out',
        }}
      >
        <Toolbar /> {/* Spacer for fixed AppBar */}
        <Outlet />
      </Box>
    </Box>
  );
};
