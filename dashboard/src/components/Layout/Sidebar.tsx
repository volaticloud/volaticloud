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
import { OrganizationSwitcher } from '../shared/OrganizationSwitcher';
import { useOrganizationNavigate } from '../../contexts/OrganizationContext';
import {
  drawerWidth,
  collapsedDrawerWidth,
  type MenuItem,
  type BackButton,
} from './sidebarConfig';

interface SidebarProps {
  menuItems: MenuItem[];
  settingsMenuItems?: MenuItem[];
  mobileOpen: boolean;
  onMobileClose: () => void;
  collapsed?: boolean;
  backButton?: BackButton;
  showOrganizationSwitcher?: boolean;
}

export const Sidebar = ({
  menuItems,
  settingsMenuItems,
  mobileOpen,
  onMobileClose,
  collapsed = false,
  backButton,
  showOrganizationSwitcher = true,
}: SidebarProps) => {
  const groupNavigate = useOrganizationNavigate();
  const location = useLocation();

  const handleNavigate = (path: string) => {
    groupNavigate(path);
    onMobileClose(); // Close drawer on mobile after navigation
  };

  const currentWidth = collapsed ? collapsedDrawerWidth : drawerWidth;

  const renderMenuItems = (items: MenuItem[], isCollapsed: boolean) =>
    items.map((item) => {
      const isSelected = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
      const listItemButton = (
        <ListItemButton
          selected={isSelected}
          onClick={() => handleNavigate(item.path)}
          aria-current={isSelected ? 'page' : undefined}
          sx={{
            minHeight: 40,
            py: 0.5,
            justifyContent: isCollapsed ? 'center' : 'initial',
            px: isCollapsed ? 1.5 : 2,
            '&.Mui-selected': {
              backgroundColor: 'transparent',
              color: 'primary.main',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
              '& .MuiListItemIcon-root': {
                color: 'primary.main',
              },
            },
          }}
        >
          <ListItemIcon
            sx={{
              color: 'inherit',
              minWidth: isCollapsed ? 0 : 32,
              mr: isCollapsed ? 0 : 1.5,
              justifyContent: 'center',
              '& .MuiSvgIcon-root': {
                fontSize: '1.25rem',
              },
            }}
          >
            {item.icon}
          </ListItemIcon>
          {!isCollapsed && (
            <ListItemText
              primary={item.text}
              primaryTypographyProps={{ fontSize: '0.875rem' }}
            />
          )}
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
    });

  const drawerContent = (isCollapsed: boolean) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
        <Logo onClick={() => handleNavigate('/')} variant={isCollapsed ? 'icon' : 'full'} />
      </Toolbar>
      {showOrganizationSwitcher && !isCollapsed && (
        <Box sx={{ px: 2, py: 1.5 }}>
          <OrganizationSwitcher fullWidth />
        </Box>
      )}
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

      {/* Main menu items */}
      <List sx={{ flexGrow: 1 }}>
        {renderMenuItems(menuItems, isCollapsed)}
      </List>

      {/* Settings section at bottom */}
      {settingsMenuItems && settingsMenuItems.length > 0 && (
        <Box sx={{ pb: 2 }}>
          <Divider />
          {!isCollapsed && (
            <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
              <ListItemText
                primary="Settings"
                primaryTypographyProps={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              />
            </Box>
          )}
          <List sx={{ py: 0 }}>
            {renderMenuItems(settingsMenuItems, isCollapsed)}
          </List>
        </Box>
      )}
    </Box>
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
