import { ReactNode } from 'react';
import { Box, Drawer, IconButton, Tooltip } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';

interface CollapsibleSidebarProps {
  open: boolean;
  onToggle: () => void;
  width?: number;
  side?: 'left' | 'right';
  children: ReactNode;
  toggleButtonLabel?: string;
}

export const CollapsibleSidebar = ({
  open,
  onToggle,
  width = 450,
  side = 'right',
  children,
  toggleButtonLabel = 'Toggle sidebar',
}: CollapsibleSidebarProps) => {
  const toggleIcon = side === 'right'
    ? (open ? <ChevronRight /> : <ChevronLeft />)
    : (open ? <ChevronLeft /> : <ChevronRight />);

  return (
    <>
      {/* Toggle Button - Fixed position */}
      <Tooltip title={toggleButtonLabel}>
        <IconButton
          onClick={onToggle}
          sx={{
            position: 'fixed',
            [side]: open ? width : 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: (theme) => theme.zIndex.drawer + 2,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: side === 'right' ? '8px 0 0 8px' : '0 8px 8px 0',
            boxShadow: 2,
            '&:hover': {
              bgcolor: 'action.hover',
            },
            transition: (theme) =>
              theme.transitions.create([side], {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
          }}
        >
          {toggleIcon}
        </IconButton>
      </Tooltip>

      {/* Drawer */}
      <Drawer
        anchor={side}
        open={open}
        variant="persistent"
        sx={{
          width: open ? width : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: width,
            boxSizing: 'border-box',
            top: 64, // Height of app header
            height: 'calc(100% - 64px)',
            borderLeft: side === 'right' ? 1 : 0,
            borderRight: side === 'left' ? 1 : 0,
            borderColor: 'divider',
          },
        }}
      >
        <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
          {children}
        </Box>
      </Drawer>
    </>
  );
};