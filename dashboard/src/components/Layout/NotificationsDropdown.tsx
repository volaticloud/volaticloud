import { useState } from 'react';
import {
  IconButton,
  Popover,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Button,
  Badge,
  Chip,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  DoneAll as MarkReadIcon,
} from '@mui/icons-material';
import {
  useGetAlertEventsQuery,
  useGetUnreadAlertCountQuery,
  useMarkAlertEventAsReadMutation,
  useMarkAllAlertEventsAsReadMutation,
} from '../Alerts/alerts.generated';
import { useActiveOrganization, useOrganizationNavigate } from '../../contexts/OrganizationContext';
import { OrderDirection, AlertEventOrderField, AlertEventAlertSeverity, AlertEventAlertEventStatus } from '../../generated/types';
import { formatRelativeTime } from '../shared/charts/utils/formatters';

const severityIcons: Record<AlertEventAlertSeverity, React.ReactNode> = {
  critical: <ErrorIcon color="error" fontSize="small" />,
  warning: <WarningIcon color="warning" fontSize="small" />,
  info: <InfoIcon color="info" fontSize="small" />,
};

const statusColors: Record<AlertEventAlertEventStatus, 'success' | 'error' | 'warning' | 'default'> = {
  sent: 'success',
  failed: 'error',
  pending: 'warning',
  suppressed: 'default',
};

export const NotificationsDropdown = () => {
  const navigate = useOrganizationNavigate();
  const { activeOrganizationId } = useActiveOrganization();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  // Query for recent alerts (both read and unread)
  const { data, loading, refetch } = useGetAlertEventsQuery({
    variables: {
      first: 10,
      where: {
        ownerID: activeOrganizationId || undefined,
      },
      orderBy: {
        direction: OrderDirection.Desc,
        field: AlertEventOrderField.CreatedAt,
      },
    },
    skip: !activeOrganizationId,
    pollInterval: 30000, // Poll every 30 seconds for new alerts
  });

  // Separate query for total unread count (not limited to page size)
  const { data: unreadData, refetch: refetchUnread } = useGetUnreadAlertCountQuery({
    variables: {
      where: {
        ownerID: activeOrganizationId || undefined,
        readAtIsNil: true,
      },
    },
    skip: !activeOrganizationId,
    pollInterval: 30000,
  });

  const [markAsRead] = useMarkAlertEventAsReadMutation();
  const [markAllAsRead, { loading: markingAllRead }] = useMarkAllAlertEventsAsReadMutation();

  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleViewAll = () => {
    handleClose();
    navigate('/alerts?tab=history');
  };

  const handleMarkAsRead = async (alertId: string) => {
    if (!activeOrganizationId) return;
    try {
      await markAsRead({
        variables: { id: alertId, ownerID: activeOrganizationId },
      });
      refetch();
      refetchUnread();
    } catch (error) {
      console.error('Failed to mark alert as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!activeOrganizationId) return;
    try {
      await markAllAsRead({
        variables: { ownerID: activeOrganizationId },
      });
      refetch();
      refetchUnread();
    } catch (error) {
      console.error('Failed to mark all alerts as read:', error);
    }
  };

  const open = Boolean(anchorEl);
  const alerts = data?.alertEvents?.edges?.map(edge => edge?.node).filter(Boolean) || [];
  // Use total unread count from separate query (not limited to page size)
  const unreadCount = unreadData?.alertEvents?.totalCount || 0;
  const totalCount = data?.alertEvents?.totalCount || 0;

  return (
    <>
      <IconButton color="inherit" onClick={handleOpen}>
        <Badge badgeContent={unreadCount > 99 ? '99+' : unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 380,
            maxHeight: 480,
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Notifications</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {unreadCount > 0 && (
              <Tooltip title="Mark all as read">
                <span>
                  <IconButton
                    size="small"
                    onClick={handleMarkAllAsRead}
                    disabled={markingAllRead}
                  >
                    <MarkReadIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            <Chip
              label={unreadCount > 0 ? `${unreadCount} unread` : `${totalCount} total`}
              size="small"
              variant="outlined"
              color={unreadCount > 0 ? 'primary' : 'default'}
            />
          </Box>
        </Box>

        <Divider />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : alerts.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <NotificationsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">No notifications yet</Typography>
          </Box>
        ) : (
          <List sx={{ p: 0, maxHeight: 320, overflow: 'auto' }}>
            {alerts.map((alert) => {
              const isUnread = !alert?.readAt;
              return (
                <ListItem
                  key={alert!.id}
                  onClick={() => isUnread && handleMarkAsRead(alert!.id)}
                  sx={{
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: isUnread ? 'action.hover' : 'transparent',
                    cursor: isUnread ? 'pointer' : 'default',
                    '&:hover': {
                      bgcolor: isUnread ? 'action.selected' : 'action.hover',
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {severityIcons[alert!.severity]}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          component="span"
                          variant="body2"
                          sx={{
                            fontWeight: isUnread ? 600 : 400,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {alert!.subject}
                        </Typography>
                        <Chip
                          label={alert!.status}
                          size="small"
                          color={statusColors[alert!.status]}
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      </Box>
                    }
                    secondary={
                      <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                        <Typography component="span" variant="caption" color="text.secondary">
                          {alert!.rule?.name || alert!.alertType.replace(/_/g, ' ')}
                        </Typography>
                        <Typography component="span" variant="caption" color="text.secondary">
                          {formatRelativeTime(alert!.createdAt)}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        )}

        <Divider />

        <Box sx={{ p: 1 }}>
          <Button fullWidth onClick={handleViewAll} size="small">
            View all notifications
          </Button>
        </Box>
      </Popover>
    </>
  );
};