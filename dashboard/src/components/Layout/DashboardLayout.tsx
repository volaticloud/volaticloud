import { Box, Toolbar } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface DashboardLayoutProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const DashboardLayout = ({ darkMode, onToggleDarkMode }: DashboardLayoutProps) => {
  return (
    <Box sx={{ display: 'flex' }}>
      <Header darkMode={darkMode} onToggleDarkMode={onToggleDarkMode} />
      <Sidebar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - 260px)` },
        }}
      >
        <Toolbar /> {/* Spacer for fixed AppBar */}
        <Outlet />
      </Box>
    </Box>
  );
};
