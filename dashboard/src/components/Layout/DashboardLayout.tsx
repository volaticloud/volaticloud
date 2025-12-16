import { Box, Toolbar } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { Sidebar, drawerWidth, collapsedDrawerWidth } from './Sidebar';
import { Header } from './Header';
import { useSidebar } from '../../contexts/SidebarContext';

interface DashboardLayoutProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const DashboardLayout = ({ darkMode, onToggleDarkMode }: DashboardLayoutProps) => {
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
        mobileOpen={mobileOpen}
        onMobileClose={handleMobileClose}
        collapsed={sidebarCollapsed}
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
