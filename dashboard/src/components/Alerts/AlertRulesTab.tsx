import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Switch,
  Chip,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material';
import { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as TestIcon,
} from '@mui/icons-material';
import {
  useGetAlertRulesQuery,
  useToggleAlertRuleMutation,
  useDeleteAlertRuleMutation,
  useTestAlertRuleMutation,
  GetAlertRulesQuery,
} from './alerts.generated';
import { PaginatedDataGrid } from '../shared/PaginatedDataGrid';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { useActiveOrganization } from '../../contexts/OrganizationContext';
import { AlertRuleAlertSeverity, AlertRuleAlertType } from '../../generated/types';
import { AlertRuleDialog } from './AlertRuleDialog';
import { usePermissions } from '../../hooks/usePermissions';

// Extract AlertRule type from generated query
type AlertRule = NonNullable<
  NonNullable<NonNullable<GetAlertRulesQuery['alertRules']['edges']>[number]>['node']
>;

const severityColors: Record<AlertRuleAlertSeverity, 'error' | 'warning' | 'info'> = {
  critical: 'error',
  warning: 'warning',
  info: 'info',
};

const alertTypeLabels: Record<AlertRuleAlertType, string> = {
  status_change: 'Status Change',
  trade_opened: 'Trade Opened',
  trade_closed: 'Trade Closed',
  large_profit_loss: 'Large Profit/Loss',
  daily_loss_limit: 'Daily Loss Limit',
  drawdown_threshold: 'Drawdown Threshold',
  profit_target: 'Profit Target',
  connection_issue: 'Connection Issue',
  backtest_completed: 'Backtest Completed',
  backtest_failed: 'Backtest Failed',
};

/**
 * Get the resource ID to check permissions against for an alert rule.
 * For organization-scoped rules, use the owner (group) ID.
 * For resource-specific rules, use the resource ID.
 */
const getPermissionResourceId = (rule: AlertRule, fallbackGroupId: string): string => {
  if (rule.resourceType === 'organization') {
    // For organization-scoped rules, check permission on the group/organization
    return rule.resourceID || fallbackGroupId;
  }
  // For resource-specific rules, check permission on that resource
  return rule.resourceID || fallbackGroupId;
};

export const AlertRulesTab = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<AlertRule | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'error' | 'success';
  }>({ open: false, message: '', severity: 'success' });

  const { activeOrganizationId } = useActiveOrganization();

  // Permission checks via backend proxy (with self-healing)
  // Permissions are auto-fetched when can() is called
  const { can, loading: permissionsLoading } = usePermissions();

  // Check if user can create alert rules on the organization - auto-fetched!
  const canCreateAlertRule = activeOrganizationId ? can(activeOrganizationId, 'create-alert-rule') : false;

  const showSnackbar = (message: string, severity: 'error' | 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const pagination = useCursorPagination<AlertRule>({ initialPageSize: 10 });
  const { setLoading, updateFromResponse, reset } = pagination;

  const { data, loading, refetch } = useGetAlertRulesQuery({
    variables: {
      first: pagination.pageSize,
      after: pagination.cursor,
      where: {
        ownerID: activeOrganizationId || undefined,
        deletedAtIsNil: true,
      },
    },
    skip: !activeOrganizationId,
  });

  const [toggleRule] = useToggleAlertRuleMutation();
  const [deleteRule] = useDeleteAlertRuleMutation();
  const [testRule] = useTestAlertRuleMutation();

  useEffect(() => {
    setLoading(loading);
    if (data?.alertRules) {
      updateFromResponse(data.alertRules);
    }
  }, [data, loading, setLoading, updateFromResponse]);

  useEffect(() => {
    reset();
  }, [activeOrganizationId, reset]);

  const handleToggle = async (rule: AlertRule) => {
    try {
      await toggleRule({
        variables: {
          id: rule.id,
          enabled: !rule.enabled,
        },
      });
      showSnackbar(`Rule ${rule.enabled ? 'disabled' : 'enabled'}`, 'success');
      refetch();
    } catch (error) {
      showSnackbar(`Failed to toggle rule: ${error}`, 'error');
    }
  };

  const handleDelete = async (rule: AlertRule) => {
    if (!confirm(`Delete alert rule "${rule.name}"?`)) return;
    try {
      await deleteRule({ variables: { id: rule.id } });
      showSnackbar('Rule deleted', 'success');
      refetch();
    } catch (error) {
      showSnackbar(`Failed to delete rule: ${error}`, 'error');
    }
  };

  const handleTest = async (rule: AlertRule) => {
    try {
      await testRule({ variables: { id: rule.id } });
      showSnackbar('Test alert sent', 'success');
    } catch (error) {
      showSnackbar(`Failed to send test alert: ${error}`, 'error');
    }
  };

  const columns: GridColDef<AlertRule>[] = [
    {
      field: 'enabled',
      headerName: '',
      width: 60,
      renderCell: (params: GridRenderCellParams<AlertRule>) => {
        const resourceId = getPermissionResourceId(params.row, activeOrganizationId || '');
        const canUpdate = can(resourceId, 'update-alert-rule');
        return (
          <Tooltip title={!canUpdate ? 'No permission to toggle this rule' : ''}>
            <span>
              <Switch
                checked={params.row.enabled}
                onChange={() => handleToggle(params.row)}
                size="small"
                onClick={(e) => e.stopPropagation()}
                disabled={!canUpdate || permissionsLoading}
              />
            </span>
          </Tooltip>
        );
      },
    },
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams<AlertRule>) => (
        <Typography variant="body2" fontWeight={600}>
          {params.row.name}
        </Typography>
      ),
    },
    {
      field: 'alertType',
      headerName: 'Type',
      width: 180,
      renderCell: (params: GridRenderCellParams<AlertRule>) => (
        <Typography variant="body2">
          {alertTypeLabels[params.row.alertType] || params.row.alertType}
        </Typography>
      ),
    },
    {
      field: 'severity',
      headerName: 'Severity',
      width: 100,
      renderCell: (params: GridRenderCellParams<AlertRule>) => (
        <Chip
          label={params.row.severity}
          size="small"
          color={severityColors[params.row.severity]}
          variant="outlined"
        />
      ),
    },
    {
      field: 'recipients',
      headerName: 'Recipients',
      width: 150,
      renderCell: (params: GridRenderCellParams<AlertRule>) => (
        <Typography variant="caption" color="text.secondary">
          {params.row.recipients.length} recipient(s)
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 140,
      sortable: false,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams<AlertRule>) => {
        const resourceId = getPermissionResourceId(params.row, activeOrganizationId || '');
        const canUpdate = can(resourceId, 'update-alert-rule');
        const canDelete = can(resourceId, 'delete-alert-rule');

        return (
          <Box onClick={(e) => e.stopPropagation()}>
            <Tooltip title={canUpdate ? 'Test' : 'No permission to test this rule'}>
              <span>
                <IconButton
                  size="small"
                  onClick={() => handleTest(params.row)}
                  color="primary"
                  disabled={!canUpdate || permissionsLoading}
                >
                  <TestIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={canUpdate ? 'Edit' : 'No permission to edit this rule'}>
              <span>
                <IconButton
                  size="small"
                  onClick={() => {
                    setSelectedRule(params.row);
                    setDialogOpen(true);
                  }}
                  color="primary"
                  disabled={!canUpdate || permissionsLoading}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={canDelete ? 'Delete' : 'No permission to delete this rule'}>
              <span>
                <IconButton
                  size="small"
                  onClick={() => handleDelete(params.row)}
                  color="error"
                  disabled={!canDelete || permissionsLoading}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        );
      },
    },
  ];

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {pagination.totalCount || 0} alert rules
        </Typography>
        <Tooltip
          title={
            permissionsLoading
              ? 'Loading permissions...'
              : !canCreateAlertRule
                ? 'No permission to create alert rules'
                : ''
          }
        >
          <span>
            <Button
              variant="contained"
              startIcon={
                permissionsLoading ? <CircularProgress size={16} color="inherit" /> : <AddIcon />
              }
              onClick={() => {
                setSelectedRule(null);
                setDialogOpen(true);
              }}
              size="small"
              disabled={!canCreateAlertRule || permissionsLoading}
            >
              Add Rule
            </Button>
          </span>
        </Tooltip>
      </Box>

      <PaginatedDataGrid<AlertRule>
        columns={columns}
        pagination={pagination}
        emptyMessage="No alert rules configured. Add a rule to receive notifications."
      />

      <AlertRuleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => {
          showSnackbar(selectedRule ? 'Rule updated' : 'Rule created', 'success');
          refetch();
        }}
        rule={selectedRule}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};