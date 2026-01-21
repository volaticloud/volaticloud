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
  FormHelperText,
  Box,
  Typography,
  Divider,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
  InputAdornment,
  Collapse,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useState, useMemo } from 'react';
import { useCreateRunnerMutation, useTestRunnerConnectionMutation, useTestS3ConnectionMutation } from './runners.generated';
import type { DockerConfigInput, KubernetesConfigInput, LocalConfigInput, DataDownloadConfigInput, S3ConfigInput } from '../../generated/types';
import { DataDownloadConfigEditor } from './DataDownloadConfigEditor';
import { useActiveOrganization } from '../../contexts/OrganizationContext';
import { useDialogUnsavedChanges } from '../../hooks';
import { UnsavedChangesDialog } from '../shared';

interface BillingConfig {
  billingEnabled: boolean;
  cpuPricePerCoreHour: number | null;
  memoryPricePerGBHour: number | null;
  networkPricePerGB: number | null;
  storagePricePerGB: number | null;
}

interface CreateRunnerDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateRunnerDialog = ({ open, onClose, onSuccess }: CreateRunnerDialogProps) => {
  const { activeOrganizationId } = useActiveOrganization();
  const [name, setName] = useState('');
  const [type, setType] = useState<'docker' | 'kubernetes' | 'local'>('docker');

  // Docker config state
  const [dockerConfig, setDockerConfig] = useState<DockerConfigInput>({
    host: 'unix:///var/run/docker.sock',
  });

  // Kubernetes config state - namespace is required
  const [kubernetesConfig, setKubernetesConfig] = useState<KubernetesConfigInput>({
    namespace: 'volaticloud', // Default namespace
  });

  // Local config state
  const [localConfig, setLocalConfig] = useState<LocalConfigInput>({});

  // Data download config state
  const [dataDownloadConfig, setDataDownloadConfig] = useState<DataDownloadConfigInput | null>(null);

  // S3 config state
  const [s3Enabled, setS3Enabled] = useState(false);
  const [s3Config, setS3Config] = useState<S3ConfigInput>({
    endpoint: '',
    bucket: '',
    accessKeyId: '',
    secretAccessKey: '',
    region: 'us-east-1',
    forcePathStyle: true,
    useSSL: true,
  });
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [s3TestResult, setS3TestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Billing config state
  const [billingConfig, setBillingConfig] = useState<BillingConfig>({
    billingEnabled: false,
    cpuPricePerCoreHour: null,
    memoryPricePerGBHour: null,
    networkPricePerGB: null,
    storagePricePerGB: null,
  });

  // Test connection state
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Track if form has been modified
  const hasChanges = useMemo(() => {
    // Check if any field differs from initial values
    if (name !== '') return true;
    if (type !== 'docker') return true;
    if (dockerConfig.host !== 'unix:///var/run/docker.sock') return true;
    if (dockerConfig.tlsVerify || dockerConfig.certPEM || dockerConfig.keyPEM || dockerConfig.caPEM) return true;
    if (dockerConfig.apiVersion || dockerConfig.network) return true;
    if (kubernetesConfig.namespace !== 'volaticloud') return true;
    if (kubernetesConfig.kubeconfig || kubernetesConfig.context || kubernetesConfig.freqtradeImage) return true;
    if (kubernetesConfig.ingressHost || kubernetesConfig.ingressClass || kubernetesConfig.ingressTls) return true;
    if (kubernetesConfig.prometheusUrl) return true;
    if (Object.keys(localConfig).length > 0 && localConfig.basePath) return true;
    if (dataDownloadConfig !== null) return true;
    if (s3Enabled) return true;
    if (billingConfig.billingEnabled) return true;
    return false;
  }, [name, type, dockerConfig, kubernetesConfig, localConfig, dataDownloadConfig, s3Enabled, billingConfig]);

  const { handleClose, confirmDialogOpen, cancelClose, confirmClose } = useDialogUnsavedChanges({
    hasChanges,
    onClose,
  });

  const [createRunner, { loading, error }] = useCreateRunnerMutation({
    refetchQueries: ['GetRunners'],
  });

  const [testConnection, { loading: testLoading }] = useTestRunnerConnectionMutation();
  const [testS3, { loading: testS3Loading }] = useTestS3ConnectionMutation();

  const handleTestS3Connection = async () => {
    setS3TestResult(null);

    // Validate required fields
    if (!s3Config.endpoint || !s3Config.bucket || !s3Config.accessKeyId || !s3Config.secretAccessKey) {
      setS3TestResult({
        success: false,
        message: 'Please fill in all required S3 fields',
      });
      return;
    }

    try {
      const result = await testS3({
        variables: {
          config: s3Config,
        },
      });

      if (result.data?.testS3Connection) {
        setS3TestResult({
          success: result.data.testS3Connection.success,
          message: result.data.testS3Connection.message,
        });
      }
    } catch (err: any) {
      setS3TestResult({
        success: false,
        message: err.message || 'Failed to test S3 connection',
      });
    }
  };

  const handleTestConnection = async () => {
    // Clear previous test result
    setTestResult(null);

    // Build config based on type
    const config = type === 'docker'
      ? { docker: dockerConfig }
      : type === 'kubernetes'
      ? { kubernetes: kubernetesConfig }
      : { local: localConfig };

    try {
      const result = await testConnection({
        variables: {
          type: type as any, // GraphQL will handle the enum conversion
          config,
        },
      });

      if (result.data?.testRunnerConnection) {
        setTestResult({
          success: result.data.testRunnerConnection.success,
          message: result.data.testRunnerConnection.message,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to test connection',
      });
    }
  };

  const handleSubmit = async () => {
    if (!name || !activeOrganizationId) {
      return;
    }

    // Build config based on type
    const config = type === 'docker'
      ? { docker: dockerConfig }
      : type === 'kubernetes'
      ? { kubernetes: kubernetesConfig }
      : { local: localConfig };

    try {
      const result = await createRunner({
        variables: {
          input: {
            name,
            type: type as any,
            config,
            dataDownloadConfig,
            s3Config: s3Enabled ? s3Config : null,
            ownerID: activeOrganizationId,
            billingEnabled: billingConfig.billingEnabled,
            cpuPricePerCoreHour: billingConfig.billingEnabled ? billingConfig.cpuPricePerCoreHour : null,
            memoryPricePerGBHour: billingConfig.billingEnabled ? billingConfig.memoryPricePerGBHour : null,
            networkPricePerGB: billingConfig.billingEnabled ? billingConfig.networkPricePerGB : null,
            storagePricePerGB: billingConfig.billingEnabled ? billingConfig.storagePricePerGB : null,
          },
        },
      });

      // Only close and reset if mutation was successful
      if (result.data?.createBotRunner) {
        // Reset form
        setName('');
        setType('docker');
        setDockerConfig({ host: 'unix:///var/run/docker.sock' });
        setKubernetesConfig({ namespace: 'volaticloud' });
        setLocalConfig({});
        setDataDownloadConfig(null);
        setS3Enabled(false);
        setS3Config({
          endpoint: '',
          bucket: '',
          accessKeyId: '',
          secretAccessKey: '',
          region: 'us-east-1',
          forcePathStyle: true,
          useSSL: true,
        });
        setS3TestResult(null);
        setBillingConfig({
          billingEnabled: false,
          cpuPricePerCoreHour: null,
          memoryPricePerGBHour: null,
          networkPricePerGB: null,
          storagePricePerGB: null,
        });

        onSuccess();
        onClose();
      }
      // If there are errors, they will be displayed via the error state
    } catch (err) {
      console.error('Failed to create runner:', err);
      // Error will be displayed via the error state from the mutation hook
    }
  };

  return (
    <>
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Create New Runner</DialogTitle>
      <DialogContent dividers sx={{ maxHeight: '70vh' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Runner Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            autoFocus
          />

          <FormControl fullWidth required>
            <InputLabel>Type</InputLabel>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as 'docker' | 'kubernetes' | 'local')}
              label="Type"
            >
              <MenuItem value="docker">Docker</MenuItem>
              <MenuItem value="kubernetes">Kubernetes</MenuItem>
              <MenuItem value="local">Local</MenuItem>
            </Select>
            <FormHelperText>The runtime environment for this runner</FormHelperText>
          </FormControl>

          <Divider sx={{ my: 1 }} />

          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Configuration
          </Typography>

          {/* Docker Configuration */}
          {type === 'docker' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Docker Host"
                value={dockerConfig.host}
                onChange={(e) => setDockerConfig({ ...dockerConfig, host: e.target.value })}
                required
                fullWidth
                helperText="Docker daemon socket (e.g., unix:///var/run/docker.sock or tcp://host:2375)"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={dockerConfig.tlsVerify ?? false}
                    onChange={(e) => setDockerConfig({ ...dockerConfig, tlsVerify: e.target.checked })}
                  />
                }
                label="Enable TLS Verification"
              />

              {dockerConfig.tlsVerify && (
                <>
                  <TextField
                    label="Client Certificate (PEM)"
                    value={dockerConfig.certPEM ?? ''}
                    onChange={(e) => setDockerConfig({ ...dockerConfig, certPEM: e.target.value || undefined })}
                    fullWidth
                    multiline
                    rows={4}
                    helperText="Paste PEM-encoded client certificate (-----BEGIN CERTIFICATE-----)"
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  />

                  <TextField
                    label="Client Key (PEM)"
                    value={dockerConfig.keyPEM ?? ''}
                    onChange={(e) => setDockerConfig({ ...dockerConfig, keyPEM: e.target.value || undefined })}
                    fullWidth
                    multiline
                    rows={4}
                    helperText="Paste PEM-encoded client key (-----BEGIN PRIVATE KEY-----)"
                    placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                  />

                  <TextField
                    label="CA Certificate (PEM)"
                    value={dockerConfig.caPEM ?? ''}
                    onChange={(e) => setDockerConfig({ ...dockerConfig, caPEM: e.target.value || undefined })}
                    fullWidth
                    multiline
                    rows={4}
                    helperText="Paste PEM-encoded CA certificate (-----BEGIN CERTIFICATE-----)"
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  />
                </>
              )}

              <TextField
                label="API Version (optional)"
                value={dockerConfig.apiVersion ?? ''}
                onChange={(e) => setDockerConfig({ ...dockerConfig, apiVersion: e.target.value || undefined })}
                fullWidth
                helperText="Docker API version (leave empty for auto-detect)"
              />

              <TextField
                label="Network (optional)"
                value={dockerConfig.network ?? ''}
                onChange={(e) => setDockerConfig({ ...dockerConfig, network: e.target.value || undefined })}
                fullWidth
                helperText="Docker network to use for containers"
              />
            </Box>
          )}

          {/* Kubernetes Configuration */}
          {type === 'kubernetes' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Namespace"
                value={kubernetesConfig.namespace}
                onChange={(e) => setKubernetesConfig({ ...kubernetesConfig, namespace: e.target.value })}
                required
                fullWidth
                helperText="Kubernetes namespace for all resources (required)"
              />

              <Divider sx={{ my: 1 }}>
                <Typography variant="caption" color="text.secondary">Ingress Configuration</Typography>
              </Divider>

              <TextField
                label="Ingress Host"
                value={kubernetesConfig.ingressHost ?? ''}
                onChange={(e) => setKubernetesConfig({ ...kubernetesConfig, ingressHost: e.target.value || undefined })}
                fullWidth
                helperText="Hostname for Ingress-based bot access with path routing (e.g., bots.example.com). Bot URL: http(s)://host/bot/{botID}/"
                placeholder="bots.example.com"
              />

              <TextField
                label="Ingress Class"
                value={kubernetesConfig.ingressClass ?? ''}
                onChange={(e) => setKubernetesConfig({ ...kubernetesConfig, ingressClass: e.target.value || undefined })}
                fullWidth
                helperText="Ingress class to use (e.g., nginx, traefik). Leave empty for cluster default."
                placeholder="nginx"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={kubernetesConfig.ingressTls ?? false}
                    onChange={(e) => setKubernetesConfig({ ...kubernetesConfig, ingressTls: e.target.checked })}
                  />
                }
                label="Enable TLS for Ingress"
              />
              <FormHelperText sx={{ mt: -1, ml: 4 }}>
                Requires cert-manager or pre-created TLS secret named {'{ingressHost}-tls'}
              </FormHelperText>

              <Divider sx={{ my: 1 }} />

              <TextField
                label="Kubeconfig (YAML)"
                value={kubernetesConfig.kubeconfig ?? ''}
                onChange={(e) => setKubernetesConfig({ ...kubernetesConfig, kubeconfig: e.target.value || undefined })}
                fullWidth
                multiline
                rows={6}
                helperText="Paste kubeconfig YAML content (leave empty for in-cluster config)"
                placeholder="apiVersion: v1&#10;kind: Config&#10;clusters:&#10;- cluster:&#10;    server: https://..."
              />

              <TextField
                label="Context"
                value={kubernetesConfig.context ?? ''}
                onChange={(e) => setKubernetesConfig({ ...kubernetesConfig, context: e.target.value || undefined })}
                fullWidth
                helperText="Kubernetes context to use (leave empty for current context)"
              />

              <TextField
                label="Freqtrade Image"
                value={kubernetesConfig.freqtradeImage ?? ''}
                onChange={(e) => setKubernetesConfig({ ...kubernetesConfig, freqtradeImage: e.target.value || undefined })}
                fullWidth
                helperText="Default Freqtrade Docker image (default: freqtradeorg/freqtrade:stable)"
              />

              <TextField
                label="Prometheus URL"
                value={kubernetesConfig.prometheusUrl ?? ''}
                onChange={(e) => setKubernetesConfig({ ...kubernetesConfig, prometheusUrl: e.target.value || undefined })}
                fullWidth
                helperText="Prometheus URL for network/disk I/O metrics (optional)"
              />
            </Box>
          )}

          {/* Local Configuration */}
          {type === 'local' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Base Path (optional)"
                value={localConfig.basePath ?? ''}
                onChange={(e) => setLocalConfig({ ...localConfig, basePath: e.target.value || undefined })}
                fullWidth
                helperText="Base directory for local bot processes"
              />

              <FormHelperText sx={{ color: 'warning.main' }}>
                Note: Local runner is not yet fully supported
              </FormHelperText>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          <DataDownloadConfigEditor
            value={dataDownloadConfig}
            onChange={setDataDownloadConfig}
          />

          <Divider sx={{ my: 2 }} />

          {/* S3 Data Distribution Configuration */}
          <Typography variant="subtitle2" color="text.secondary">
            S3 Data Distribution
          </Typography>

          <FormControlLabel
            control={
              <Checkbox
                checked={s3Enabled}
                onChange={(e) => setS3Enabled(e.target.checked)}
              />
            }
            label="Enable S3 data distribution"
          />
          <FormHelperText sx={{ mt: -1, ml: 4 }}>
            Store OHLCV data in S3-compatible storage. Data is downloaded at container startup via presigned URLs.
          </FormHelperText>

          <Collapse in={s3Enabled}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField
                label="S3 Endpoint"
                value={s3Config.endpoint}
                onChange={(e) => setS3Config({ ...s3Config, endpoint: e.target.value })}
                required
                fullWidth
                helperText="S3 endpoint URL (e.g., s3.amazonaws.com, minio.example.com:9000)"
                placeholder="s3.amazonaws.com"
              />

              <TextField
                label="Bucket Name"
                value={s3Config.bucket}
                onChange={(e) => setS3Config({ ...s3Config, bucket: e.target.value })}
                required
                fullWidth
                helperText="S3 bucket for storing runner data"
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Access Key ID"
                  value={s3Config.accessKeyId}
                  onChange={(e) => setS3Config({ ...s3Config, accessKeyId: e.target.value })}
                  required
                  fullWidth
                />

                <TextField
                  label="Secret Access Key"
                  type={showSecretKey ? 'text' : 'password'}
                  value={s3Config.secretAccessKey}
                  onChange={(e) => setS3Config({ ...s3Config, secretAccessKey: e.target.value })}
                  required
                  fullWidth
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={showSecretKey ? 'Hide' : 'Show'}>
                          <IconButton
                            onClick={() => setShowSecretKey(!showSecretKey)}
                            edge="end"
                            size="small"
                          >
                            {showSecretKey ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              <TextField
                label="Region"
                value={s3Config.region ?? 'us-east-1'}
                onChange={(e) => setS3Config({ ...s3Config, region: e.target.value || undefined })}
                fullWidth
                helperText="AWS region (default: us-east-1)"
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={s3Config.forcePathStyle ?? true}
                      onChange={(e) => setS3Config({ ...s3Config, forcePathStyle: e.target.checked })}
                    />
                  }
                  label="Force Path Style"
                />
                <FormHelperText sx={{ mt: 1 }}>
                  Enable for MinIO/non-AWS S3 (http://endpoint/bucket/key)
                </FormHelperText>
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={s3Config.useSSL ?? true}
                      onChange={(e) => setS3Config({ ...s3Config, useSSL: e.target.checked })}
                    />
                  }
                  label="Use SSL/HTTPS"
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Button
                  onClick={handleTestS3Connection}
                  disabled={testS3Loading || loading}
                  startIcon={testS3Loading && <CircularProgress size={16} />}
                  variant="outlined"
                  size="small"
                >
                  {testS3Loading ? 'Testing...' : 'Test S3 Connection'}
                </Button>
                {s3TestResult && (
                  <Alert severity={s3TestResult.success ? 'success' : 'error'} sx={{ flex: 1 }}>
                    {s3TestResult.message}
                  </Alert>
                )}
              </Box>
            </Box>
          </Collapse>

          <Divider sx={{ my: 2 }} />

          {/* Billing Configuration */}
          <Typography variant="subtitle2" color="text.secondary">
            Billing Configuration
          </Typography>

          <FormControlLabel
            control={
              <Checkbox
                checked={billingConfig.billingEnabled}
                onChange={(e) => setBillingConfig({ ...billingConfig, billingEnabled: e.target.checked })}
              />
            }
            label="Enable usage tracking and billing"
          />
          <FormHelperText sx={{ mt: -1, ml: 4 }}>
            When enabled, resource usage (CPU, memory, network, storage) will be tracked for billing purposes
          </FormHelperText>

          <Collapse in={billingConfig.billingEnabled}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Set pricing rates for this runner. Leave empty to use default rates.
              </Typography>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="CPU Price"
                  type="number"
                  value={billingConfig.cpuPricePerCoreHour ?? ''}
                  onChange={(e) => setBillingConfig({
                    ...billingConfig,
                    cpuPricePerCoreHour: e.target.value ? parseFloat(e.target.value) : null,
                  })}
                  fullWidth
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    endAdornment: <InputAdornment position="end">/core-hour</InputAdornment>,
                  }}
                  inputProps={{ step: '0.001', min: '0' }}
                />

                <TextField
                  label="Memory Price"
                  type="number"
                  value={billingConfig.memoryPricePerGBHour ?? ''}
                  onChange={(e) => setBillingConfig({
                    ...billingConfig,
                    memoryPricePerGBHour: e.target.value ? parseFloat(e.target.value) : null,
                  })}
                  fullWidth
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    endAdornment: <InputAdornment position="end">/GB-hour</InputAdornment>,
                  }}
                  inputProps={{ step: '0.001', min: '0' }}
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Network Price"
                  type="number"
                  value={billingConfig.networkPricePerGB ?? ''}
                  onChange={(e) => setBillingConfig({
                    ...billingConfig,
                    networkPricePerGB: e.target.value ? parseFloat(e.target.value) : null,
                  })}
                  fullWidth
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    endAdornment: <InputAdornment position="end">/GB</InputAdornment>,
                  }}
                  inputProps={{ step: '0.001', min: '0' }}
                />

                <TextField
                  label="Storage I/O Price"
                  type="number"
                  value={billingConfig.storagePricePerGB ?? ''}
                  onChange={(e) => setBillingConfig({
                    ...billingConfig,
                    storagePricePerGB: e.target.value ? parseFloat(e.target.value) : null,
                  })}
                  fullWidth
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    endAdornment: <InputAdornment position="end">/GB</InputAdornment>,
                  }}
                  inputProps={{ step: '0.001', min: '0' }}
                />
              </Box>
            </Box>
          </Collapse>

          {/* Test Connection Result */}
          {testResult && (
            <Alert severity={testResult.success ? 'success' : 'error'}>
              {testResult.message}
            </Alert>
          )}

          {error && (
            <FormHelperText error>
              Error creating runner: {error.message}
            </FormHelperText>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleTestConnection}
          disabled={testLoading || loading}
          startIcon={testLoading && <CircularProgress size={16} />}
        >
          {testLoading ? 'Testing...' : 'Test Connection'}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !name || (type === 'kubernetes' && !kubernetesConfig.namespace)}
        >
          {loading ? 'Creating...' : 'Create Runner'}
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