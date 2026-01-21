import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Box,
  FormHelperText,
  Chip,
  Typography,
  CircularProgress,
  Slider,
  Checkbox,
  ListItemText,
  Alert,
} from '@mui/material';
import {
  useCreateAlertRuleMutation,
  useUpdateAlertRuleMutation,
  useGetAlertTypesForResourceQuery,
  GetAlertRulesQuery,
  GetAlertTypesForResourceQuery,
} from './alerts.generated';
import {
  AlertRuleAlertType,
  AlertRuleAlertSeverity,
  AlertRuleAlertResourceType,
  AlertRuleAlertDeliveryMode,
  AlertRuleAlertBotModeFilter,
} from '../../generated/types';
import { useActiveOrganization } from '../../contexts/OrganizationContext';
import { BotSelector } from '../shared/BotSelector';
import { StrategySelector } from '../shared/StrategySelector';
import { RunnerSelector } from '../shared/RunnerSelector';
import { usePermissions } from '../../hooks/usePermissions';
import { useDialogUnsavedChanges } from '../../hooks';
import { UnsavedChangesDialog } from '../shared';

type AlertRule = NonNullable<
  NonNullable<NonNullable<GetAlertRulesQuery['alertRules']['edges']>[number]>['node']
>;

type AlertTypeInfo = GetAlertTypesForResourceQuery['alertTypesForResource'][number];

interface AlertRuleDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  rule?: AlertRule | null;
}

const resourceTypeLabels: Record<AlertRuleAlertResourceType, string> = {
  organization: 'All Resources (Organization-wide)',
  bot: 'Specific Bot',
  strategy: 'Specific Strategy',
  runner: 'Specific Runner',
};

const severityLabels: Record<AlertRuleAlertSeverity, string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
};

const deliveryModeLabels: Record<AlertRuleAlertDeliveryMode, string> = {
  immediate: 'Immediate',
  batched: 'Batched (Digest)',
};

const botModeFilterLabels: Record<AlertRuleAlertBotModeFilter, string> = {
  all: 'All Bots (Live + Dry-run)',
  live: 'Live Trading Only',
  dry_run: 'Dry-run Only',
};

// Alert types that are related to bot trading (should show bot mode filter)
const botRelatedAlertTypes: AlertRuleAlertType[] = [
  AlertRuleAlertType.StatusChange,
  AlertRuleAlertType.TradeOpened,
  AlertRuleAlertType.TradeClosed,
  AlertRuleAlertType.LargeProfitLoss,
  AlertRuleAlertType.DailyLossLimit,
  AlertRuleAlertType.DrawdownThreshold,
  AlertRuleAlertType.ProfitTarget,
  AlertRuleAlertType.ConnectionIssue,
];

export const AlertRuleDialog = ({
  open,
  onClose,
  onSuccess,
  rule,
}: AlertRuleDialogProps) => {
  const { activeOrganizationId } = useActiveOrganization();
  const isEdit = !!rule;

  // Permission checks
  const { can, loading: permissionsLoading } = usePermissions();

  // Step 1: Resource selection (required first)
  const [resourceType, setResourceType] = useState<AlertRuleAlertResourceType>(AlertRuleAlertResourceType.Organization);
  const [resourceId, setResourceId] = useState<string>('');

  // Step 2: Alert type selection (depends on resource)
  const [alertType, setAlertType] = useState<AlertRuleAlertType | ''>('');
  const [severity, setSeverity] = useState<AlertRuleAlertSeverity>(AlertRuleAlertSeverity.Warning);

  // Step 3: Conditions (depends on alert type)
  const [conditions, setConditions] = useState<Record<string, unknown>>({});

  // Other form fields
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [deliveryMode, setDeliveryMode] = useState<AlertRuleAlertDeliveryMode>(AlertRuleAlertDeliveryMode.Immediate);
  const [batchIntervalMinutes, setBatchIntervalMinutes] = useState(60);
  const [cooldownMinutes, setCooldownMinutes] = useState(5);
  const [recipientInput, setRecipientInput] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [botModeFilter, setBotModeFilter] = useState<AlertRuleAlertBotModeFilter>(AlertRuleAlertBotModeFilter.All);

  // Fetch alert types for selected resource - this is the key new feature
  const { data: alertTypesData, loading: loadingAlertTypes } = useGetAlertTypesForResourceQuery({
    variables: {
      resourceType,
      resourceID: resourceId || undefined,
    },
    skip: !open,
  });

  const availableAlertTypes = useMemo(
    () => alertTypesData?.alertTypesForResource || [],
    [alertTypesData]
  );

  // Get the selected alert type info
  const selectedAlertTypeInfo = useMemo(
    () => availableAlertTypes.find((at) => at.type === alertType),
    [availableAlertTypes, alertType]
  );

  const [createRule, { loading: creating, error: createError }] =
    useCreateAlertRuleMutation();
  const [updateRule, { loading: updating, error: updateError }] =
    useUpdateAlertRuleMutation();

  const loading = creating || updating;
  const error = createError || updateError;

  // Track if form has been modified
  const hasChanges = useMemo(() => {
    if (isEdit && rule) {
      // Compare against original values for edit mode
      if (name !== rule.name) return true;
      if (resourceType !== rule.resourceType) return true;
      if (resourceId !== (rule.resourceID || '')) return true;
      if (alertType !== rule.alertType) return true;
      if (severity !== rule.severity) return true;
      if (JSON.stringify(conditions) !== JSON.stringify(rule.conditions || {})) return true;
      if (enabled !== rule.enabled) return true;
      if (deliveryMode !== rule.deliveryMode) return true;
      if (batchIntervalMinutes !== rule.batchIntervalMinutes) return true;
      if (cooldownMinutes !== rule.cooldownMinutes) return true;
      if (JSON.stringify(recipients) !== JSON.stringify(rule.recipients || [])) return true;
      if (botModeFilter !== (rule.botModeFilter || AlertRuleAlertBotModeFilter.All)) return true;
      return false;
    }
    // For create mode, check if any field has been filled
    if (name !== '') return true;
    if (resourceId !== '') return true;
    if (alertType !== '') return true;
    if (recipients.length > 0) return true;
    if (Object.keys(conditions).length > 0) return true;
    return false;
  }, [isEdit, rule, name, resourceType, resourceId, alertType, severity, conditions, enabled, deliveryMode, batchIntervalMinutes, cooldownMinutes, recipients, botModeFilter]);

  const { handleClose, confirmDialogOpen, cancelClose, confirmClose } = useDialogUnsavedChanges({
    hasChanges,
    onClose,
  });

  // Populate form when editing
  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setResourceType(rule.resourceType);
      setResourceId(rule.resourceID || '');
      setAlertType(rule.alertType);
      setSeverity(rule.severity);
      setConditions(rule.conditions || {});
      setEnabled(rule.enabled);
      setDeliveryMode(rule.deliveryMode);
      setBatchIntervalMinutes(rule.batchIntervalMinutes);
      setCooldownMinutes(rule.cooldownMinutes);
      setRecipients(rule.recipients || []);
      setRecipientInput('');
      setBotModeFilter(rule.botModeFilter || AlertRuleAlertBotModeFilter.All);
    } else {
      // Reset for create
      setName('');
      setResourceType(AlertRuleAlertResourceType.Organization);
      setResourceId('');
      setAlertType('');
      setSeverity(AlertRuleAlertSeverity.Warning);
      setConditions({});
      setEnabled(true);
      setDeliveryMode(AlertRuleAlertDeliveryMode.Immediate);
      setBatchIntervalMinutes(60);
      setCooldownMinutes(5);
      setRecipients([]);
      setRecipientInput('');
      setBotModeFilter(AlertRuleAlertBotModeFilter.All);
    }
  }, [rule, open]);

  // Reset alert type when resource type changes (available types may differ)
  useEffect(() => {
    if (!isEdit) {
      setAlertType('');
      setConditions({});
    }
  }, [resourceType, isEdit]);

  // Set default severity when alert type changes
  useEffect(() => {
    if (selectedAlertTypeInfo && !isEdit) {
      setSeverity(selectedAlertTypeInfo.defaultSeverity);
      // Initialize conditions with defaults
      const defaultConditions: Record<string, unknown> = {};
      selectedAlertTypeInfo.conditionFields.forEach((field) => {
        if (field.default !== null && field.default !== undefined) {
          defaultConditions[field.name] = field.default;
        }
      });
      setConditions(defaultConditions);
    }
  }, [selectedAlertTypeInfo, isEdit]);

  const handleAddRecipient = () => {
    const email = recipientInput.trim();
    if (email && !recipients.includes(email) && email.includes('@')) {
      setRecipients([...recipients, email]);
      setRecipientInput('');
    }
  };

  const handleRemoveRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddRecipient();
    }
  };

  const handleConditionChange = (fieldName: string, value: unknown) => {
    setConditions((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = async () => {
    if (!name || !activeOrganizationId || recipients.length === 0 || !alertType) return;

    // Require resourceId for non-organization scope
    const requiresResourceIdFlag = resourceType !== AlertRuleAlertResourceType.Organization;
    if (requiresResourceIdFlag && !resourceId) return;

    // Always save resourceID - for organization type, save the activeOrganizationId
    const effectiveResId = resourceType === AlertRuleAlertResourceType.Organization
      ? activeOrganizationId
      : resourceId;

    try {
      // Only include botModeFilter for bot-related alert types
      const isBotRelatedAlert = botRelatedAlertTypes.includes(alertType as AlertRuleAlertType);

      if (isEdit && rule) {
        const result = await updateRule({
          variables: {
            id: rule.id,
            input: {
              name,
              alertType: alertType as AlertRuleAlertType,
              severity,
              enabled,
              resourceType,
              resourceID: effectiveResId,
              conditions: Object.keys(conditions).length > 0 ? conditions : undefined,
              deliveryMode,
              batchIntervalMinutes: deliveryMode === AlertRuleAlertDeliveryMode.Batched ? batchIntervalMinutes : undefined,
              cooldownMinutes,
              recipients,
              botModeFilter: isBotRelatedAlert ? botModeFilter : undefined,
            },
          },
        });
        if (result.data?.updateAlertRule) {
          onSuccess();
          onClose();
        }
      } else {
        const result = await createRule({
          variables: {
            input: {
              name,
              alertType: alertType as AlertRuleAlertType,
              severity,
              enabled,
              resourceType,
              resourceID: effectiveResId,
              conditions: Object.keys(conditions).length > 0 ? conditions : undefined,
              deliveryMode,
              batchIntervalMinutes: deliveryMode === AlertRuleAlertDeliveryMode.Batched ? batchIntervalMinutes : undefined,
              cooldownMinutes,
              recipients,
              ownerID: activeOrganizationId,
              botModeFilter: isBotRelatedAlert ? botModeFilter : undefined,
            },
          },
        });
        if (result.data?.createAlertRule) {
          onSuccess();
          onClose();
        }
      }
    } catch (err) {
      console.error('Failed to save rule:', err);
    }
  };

  // Determine the effective resource ID for permission checking
  // For organization type, use activeOrganizationId; for others, use the selected resourceId
  const effectiveResourceId = useMemo(() => {
    if (resourceType === AlertRuleAlertResourceType.Organization) {
      return activeOrganizationId || '';
    }
    return resourceId;
  }, [resourceType, resourceId, activeOrganizationId]);

  // Check if user has permission to create/update alert rule on the selected resource
  const hasAlertPermission = useMemo(() => {
    if (!effectiveResourceId) return false;
    const scope = isEdit ? 'update-alert-rule' : 'create-alert-rule';
    return can(effectiveResourceId, scope);
  }, [effectiveResourceId, isEdit, can]);

  // Require resourceId when resourceType is not 'organization'
  const requiresResourceId = resourceType !== AlertRuleAlertResourceType.Organization;
  const canSubmit =
    name &&
    recipients.length > 0 &&
    alertType &&
    (!requiresResourceId || resourceId) &&
    hasAlertPermission &&
    !permissionsLoading;

  // Render condition field based on type
  const renderConditionField = (field: AlertTypeInfo['conditionFields'][number]) => {
    const value = conditions[field.name];

    switch (field.type) {
      case 'number':
        return (
          <Box key={field.name}>
            <Typography variant="subtitle2" gutterBottom>
              {field.label} {field.unit && `(${field.unit})`}
              {field.required && ' *'}
            </Typography>
            <Slider
              value={typeof value === 'number' ? value : (field.default ?? field.min ?? 0)}
              onChange={(_, newValue) => handleConditionChange(field.name, newValue)}
              min={field.min ?? 0}
              max={field.max ?? 100}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${v}${field.unit || ''}`}
              marks={[
                { value: field.min ?? 0, label: `${field.min ?? 0}${field.unit || ''}` },
                { value: field.max ?? 100, label: `${field.max ?? 100}${field.unit || ''}` },
              ]}
            />
            <FormHelperText>{field.description}</FormHelperText>
          </Box>
        );

      case 'select':
        return (
          <FormControl key={field.name} fullWidth required={field.required}>
            <InputLabel>{field.label}</InputLabel>
            <Select
              value={value || ''}
              label={field.label}
              onChange={(e) => handleConditionChange(field.name, e.target.value)}
            >
              {field.options?.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{field.description}</FormHelperText>
          </FormControl>
        );

      case 'multi_select': {
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <FormControl key={field.name} fullWidth>
            <InputLabel>{field.label}</InputLabel>
            <Select
              multiple
              value={selectedValues}
              label={field.label}
              onChange={(e) => handleConditionChange(field.name, e.target.value)}
              renderValue={(selected) =>
                (selected as string[])
                  .map((v) => field.options?.find((o) => o.value === v)?.label || v)
                  .join(', ')
              }
            >
              {field.options?.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  <Checkbox checked={selectedValues.includes(opt.value)} />
                  <ListItemText primary={opt.label} />
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{field.description}</FormHelperText>
          </FormControl>
        );
      }

      default:
        return null;
    }
  };

  return (
    <>
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Edit Alert Rule' : 'Create Alert Rule'}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
          {/* Step 1: Resource Selection */}
          <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 600 }}>
            1. Select Resource to Monitor
          </Typography>

          <FormControl fullWidth>
            <InputLabel>Resource Scope</InputLabel>
            <Select
              value={resourceType}
              label="Resource Scope"
              onChange={(e) => {
                setResourceType(e.target.value as AlertRuleAlertResourceType);
                setResourceId('');
              }}
            >
              {Object.entries(resourceTypeLabels).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>Choose what you want to monitor</FormHelperText>
          </FormControl>

          {resourceType === 'bot' && (
            <BotSelector
              value={resourceId}
              onChange={setResourceId}
              label="Select Bot"
              required
              helperText="Choose the specific bot to monitor"
            />
          )}

          {resourceType === 'strategy' && (
            <StrategySelector
              value={resourceId}
              onChange={setResourceId}
              label="Select Strategy"
              required
              helperText="Monitor all bots using this strategy"
            />
          )}

          {resourceType === 'runner' && (
            <RunnerSelector
              value={resourceId}
              onChange={setResourceId}
              label="Select Runner"
              required
              helperText="Monitor connection issues for this runner"
            />
          )}

          {/* Step 2: Alert Type Selection */}
          <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 600, mt: 1 }}>
            2. Choose Alert Type
          </Typography>

          {loadingAlertTypes ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Loading available alert types...
              </Typography>
            </Box>
          ) : (
            <FormControl fullWidth required>
              <InputLabel>Alert Type</InputLabel>
              <Select
                value={alertType}
                label="Alert Type"
                onChange={(e) => setAlertType(e.target.value as AlertRuleAlertType)}
              >
                {availableAlertTypes.map((at) => (
                  <MenuItem key={at.type} value={at.type}>
                    <Box>
                      <Typography>{at.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {at.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <FormControl fullWidth>
            <InputLabel>Severity</InputLabel>
            <Select
              value={severity}
              label="Severity"
              onChange={(e) => setSeverity(e.target.value as AlertRuleAlertSeverity)}
            >
              {Object.entries(severityLabels).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Bot Mode Filter - only show for bot-related alert types */}
          {alertType && botRelatedAlertTypes.includes(alertType as AlertRuleAlertType) && (
            <FormControl fullWidth>
              <InputLabel>Bot Trading Mode</InputLabel>
              <Select
                value={botModeFilter}
                label="Bot Trading Mode"
                onChange={(e) => setBotModeFilter(e.target.value as AlertRuleAlertBotModeFilter)}
              >
                {Object.entries(botModeFilterLabels).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                Filter alerts by bot trading mode (live trading vs dry-run)
              </FormHelperText>
            </FormControl>
          )}

          {/* Condition Fields (dynamic based on alert type) */}
          {selectedAlertTypeInfo && selectedAlertTypeInfo.conditionFields.length > 0 && (
            <>
              <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 600, mt: 1 }}>
                3. Configure Conditions
              </Typography>
              {selectedAlertTypeInfo.conditionFields.map(renderConditionField)}
            </>
          )}

          {/* Step 3/4: Delivery Settings */}
          <Typography
            variant="subtitle1"
            color="primary"
            sx={{ fontWeight: 600, mt: 1 }}
          >
            {selectedAlertTypeInfo?.conditionFields.length ? '4' : '3'}. Delivery Settings
          </Typography>

          <TextField
            label="Rule Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            autoComplete="off"
            placeholder="e.g., Bot Error Alert, Trade Notifications"
            helperText="A descriptive name for this alert rule"
          />

          <FormControl fullWidth>
            <InputLabel>Delivery Mode</InputLabel>
            <Select
              value={deliveryMode}
              label="Delivery Mode"
              onChange={(e) => setDeliveryMode(e.target.value as AlertRuleAlertDeliveryMode)}
            >
              {Object.entries(deliveryModeLabels).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {deliveryMode === 'batched' && (
            <TextField
              label="Batch Interval (minutes)"
              type="number"
              value={batchIntervalMinutes}
              onChange={(e) => setBatchIntervalMinutes(parseInt(e.target.value) || 60)}
              fullWidth
              inputProps={{ min: 1 }}
              helperText="Group alerts into digest emails at this interval"
            />
          )}

          <TextField
            label="Cooldown (minutes)"
            type="number"
            value={cooldownMinutes}
            onChange={(e) => setCooldownMinutes(parseInt(e.target.value) || 0)}
            fullWidth
            inputProps={{ min: 0 }}
            helperText="Minimum time between alerts of the same type (0 = no cooldown)"
          />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Recipients *
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                size="small"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="email@example.com"
                fullWidth
                autoComplete="off"
              />
              <Button
                variant="outlined"
                onClick={handleAddRecipient}
                disabled={!recipientInput.includes('@')}
              >
                Add
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, minHeight: 32 }}>
              {recipients.map((email) => (
                <Chip
                  key={email}
                  label={email}
                  size="small"
                  onDelete={() => handleRemoveRecipient(email)}
                />
              ))}
              {recipients.length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  Add at least one recipient email
                </Typography>
              )}
            </Box>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
            }
            label="Enabled"
          />

          {/* Permission warning */}
          {!permissionsLoading && effectiveResourceId && !hasAlertPermission && (
            <Alert severity="warning">
              You don't have permission to {isEdit ? 'update' : 'create'} alert rules on this resource.
            </Alert>
          )}

          {error && (
            <FormHelperText error>
              Error: {error.message}
            </FormHelperText>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !canSubmit}
        >
          {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Rule'}
        </Button>
      </DialogActions>
    </Dialog>
    <UnsavedChangesDialog
      open={confirmDialogOpen}
      onCancel={cancelClose}
      onDiscard={confirmClose}
    />
    </>
  );
};