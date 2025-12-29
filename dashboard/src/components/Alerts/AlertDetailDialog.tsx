import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Chip,
  Divider,
  Paper,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { GetAlertEventsQuery } from './alerts.generated';
import { AlertEventAlertEventStatus, AlertEventAlertSeverity } from '../../generated/types';

type AlertEvent = NonNullable<
  NonNullable<NonNullable<GetAlertEventsQuery['alertEvents']['edges']>[number]>['node']
>;

interface AlertDetailDialogProps {
  open: boolean;
  onClose: () => void;
  alert: AlertEvent | null;
}

const statusColors: Record<AlertEventAlertEventStatus, 'success' | 'error' | 'warning' | 'default'> = {
  sent: 'success',
  failed: 'error',
  pending: 'warning',
  suppressed: 'default',
};

const severityColors: Record<AlertEventAlertSeverity, 'error' | 'warning' | 'info'> = {
  critical: 'error',
  warning: 'warning',
  info: 'info',
};

export const AlertDetailDialog = ({ open, onClose, alert }: AlertDetailDialogProps) => {
  if (!alert) return null;

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString();

  // Format context for display
  const formatContext = (context: Record<string, unknown> | null | undefined) => {
    if (!context || Object.keys(context).length === 0) return null;
    return JSON.stringify(context, null, 2);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6">Alert Details</Typography>
          <Chip
            label={alert.status}
            size="small"
            color={statusColors[alert.status]}
            variant="outlined"
          />
          <Chip
            label={alert.severity}
            size="small"
            color={severityColors[alert.severity]}
            variant="outlined"
          />
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* Subject */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Subject
          </Typography>
          <Typography variant="h6">{alert.subject}</Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Metadata Grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, mb: 3 }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Alert Type
            </Typography>
            <Typography variant="body2">
              {alert.alertType.replace(/_/g, ' ')}
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Rule
            </Typography>
            <Typography variant="body2">{alert.rule.name}</Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Resource Type
            </Typography>
            <Typography variant="body2">{alert.resourceType}</Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Resource ID
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {alert.resourceID || 'N/A'}
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Channel
            </Typography>
            <Typography variant="body2">{alert.channelType}</Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Recipients
            </Typography>
            <Typography variant="body2">{alert.recipients.join(', ')}</Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Created At
            </Typography>
            <Typography variant="body2">{formatDate(alert.createdAt)}</Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Sent At
            </Typography>
            <Typography variant="body2">
              {alert.sentAt ? formatDate(alert.sentAt) : 'Not sent yet'}
            </Typography>
          </Box>
        </Box>

        {/* Error Message (if any) */}
        {alert.errorMessage && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="error" gutterBottom>
                Error Message
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: 'action.hover',
                  borderColor: 'error.main',
                }}
              >
                <Typography
                  variant="body2"
                  color="error"
                  sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}
                >
                  {alert.errorMessage}
                </Typography>
              </Paper>
            </Box>
          </>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Body */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Message Body
          </Typography>
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              bgcolor: 'action.hover',
            }}
          >
            <Typography
              variant="body2"
              sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.85rem' }}
            >
              {alert.body}
            </Typography>
          </Paper>
        </Box>

        {/* Context (if any) */}
        {alert.context && Object.keys(alert.context).length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Context Data
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: 'action.hover',
                  overflow: 'auto',
                  maxHeight: 400,
                }}
              >
                <Typography
                  component="pre"
                  variant="body2"
                  sx={{ fontFamily: 'monospace', fontSize: '0.8rem', m: 0 }}
                >
                  {formatContext(alert.context)}
                </Typography>
              </Paper>
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};