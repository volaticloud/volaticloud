import { useState } from 'react';
import { Box, Toolbar } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { Sidebar, drawerWidth } from './Sidebar';
import { Header } from './Header';

interface DashboardLayoutProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const DashboardLayout = ({ darkMode, onToggleDarkMode }: DashboardLayoutProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleMobileToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const handleMobileClose = () => {
    setMobileOpen(false);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', overflowX: 'hidden' }}>
      <Header
        darkMode={darkMode}
        onToggleDarkMode={onToggleDarkMode}
        onToggleMobileMenu={handleMobileToggle}
      />
      <Sidebar mobileOpen={mobileOpen} onMobileClose={handleMobileClose} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          width: { xs: '100%', sm: `calc(100% - ${drawerWidth}px)` },
          minWidth: 0, // Critical: Prevents flex item from overflowing
        }}
      >
        <Toolbar /> {/* Spacer for fixed AppBar */}
        <Outlet />
      </Box>
    </Box>
  );
};
