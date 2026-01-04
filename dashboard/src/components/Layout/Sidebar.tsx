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
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import { Logo } from '../shared/Logo';
import { useGroupNavigate } from '../../contexts/GroupContext';
import {
  drawerWidth,
  collapsedDrawerWidth,
  type MenuItem,
  type BackButton,
} from './sidebarConfig';

interface SidebarProps {
  menuItems: MenuItem[];
  mobileOpen: boolean;
  onMobileClose: () => void;
  collapsed?: boolean;
  backButton?: BackButton;
}

export const Sidebar = ({
  menuItems,
  mobileOpen,
  onMobileClose,
  collapsed = false,
  backButton
}: SidebarProps) => {
  const groupNavigate = useGroupNavigate();
  const location = useLocation();

  const handleNavigate = (path: string) => {
    groupNavigate(path);
    onMobileClose(); // Close drawer on mobile after navigation
  };

  const currentWidth = collapsed ? collapsedDrawerWidth : drawerWidth;

  const drawerContent = (isCollapsed: boolean) => (
    <>
      <Toolbar sx={{ justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
        <Logo onClick={() => handleNavigate('/')} variant={isCollapsed ? 'icon' : 'full'} />
      </Toolbar>
      <Divider />
      {backButton && (
        <>
          <Box>
            {isCollapsed ? (
              <Tooltip title={backButton.text} placement="right" arrow>
                <ListItemButton
                  onClick={() => handleNavigate(backButton.path)}
                  sx={{
                    minHeight: 48,
                    justifyContent: 'center',
                    px: 2,
                    opacity: 0.8,
                    '&:hover': {
                      opacity: 1,
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: 'inherit',
                      minWidth: 0,
                      justifyContent: 'center',
                    }}
                  >
                    <ArrowBackIcon />
                  </ListItemIcon>
                </ListItemButton>
              </Tooltip>
            ) : (
              <ListItemButton
                onClick={() => handleNavigate(backButton.path)}
                sx={{
                  minHeight: 48,
                  px: 2.5,
                  opacity: 0.8,
                  '&:hover': {
                    opacity: 1,
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: 'inherit',
                    minWidth: 40,
                    mr: 2,
                  }}
                >
                  <ArrowBackIcon />
                </ListItemIcon>
                <ListItemText
                  primary={backButton.text}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                />
              </ListItemButton>
            )}
          </Box>
          <Divider />
        </>
      )}
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
