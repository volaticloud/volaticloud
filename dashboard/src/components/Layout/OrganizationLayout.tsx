import { Box, Toolbar } from '@mui/material';
import { Outlet } from 'react-router-dom';
import {
  Business as BusinessIcon,
  People as PeopleIcon,
  BarChart as BarChartIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';
import { Sidebar } from './Sidebar';
import { drawerWidth, collapsedDrawerWidth, type MenuItem } from './sidebarConfig';
import { Header } from './Header';
import { useSidebar } from '../../contexts/SidebarContext';
import { SuspendedBanner } from '../Billing/SuspendedBanner';

const organizationMenuItems: MenuItem[] = [
  { text: 'Organization Details', icon: <BusinessIcon />, path: '/organization/details' },
  { text: 'Users & Access', icon: <PeopleIcon />, path: '/organization/users' },
  { text: 'Usage & Metrics', icon: <BarChartIcon />, path: '/organization/usage' },
  { text: 'Billing & Plans', icon: <PaymentIcon />, path: '/organization/billing' },
];

interface OrganizationLayoutProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const OrganizationLayout = ({ darkMode, onToggleDarkMode }: OrganizationLayoutProps) => {
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
        menuItems={organizationMenuItems}
        mobileOpen={mobileOpen}
        onMobileClose={handleMobileClose}
        collapsed={sidebarCollapsed}
        backButton={{ text: 'Back to Dashboard', path: '/' }}
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
        <SuspendedBanner />
        <Outlet />
      </Box>
    </Box>
  );
};