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
import { useState, useEffect } from 'react';
import { useUpdateRunnerMutation, useTestRunnerConnectionMutation, useTestS3ConnectionMutation } from './runners.generated';
import type { DockerConfigInput, KubernetesConfigInput, LocalConfigInput, DataDownloadConfigInput, S3ConfigInput } from '../../generated/types';
import { DataDownloadConfigEditor } from './DataDownloadConfigEditor';

interface BillingConfig {
  billingEnabled: boolean;
  cpuPricePerCoreHour: number | null;
  memoryPricePerGBHour: number | null;
  networkPricePerGB: number | null;
  storagePricePerGB: number | null;
}

interface EditRunnerDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  runner: any; // Full runner data from GetRunnerWithSecrets query
}

export const EditRunnerDialog = ({ open, onClose, onSuccess, runner }: EditRunnerDialogProps) => {
  const [name, setName] = useState(runner.name);
  const [type, setType] = useState<'docker' | 'kubernetes' | 'local'>(runner.type);

  // Docker config state
  const [dockerConfig, setDockerConfig] = useState<DockerConfigInput>({
    host: 'unix:///var/run/docker.sock',
  });

  // Kubernetes config state
  const [kubernetesConfig, setKubernetesConfig] = useState<KubernetesConfigInput>({
    namespace: 'volaticloud',
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
    billingEnabled: runner.billingEnabled ?? false,
    cpuPricePerCoreHour: runner.cpuPricePerCoreHour ?? null,
    memoryPricePerGBHour: runner.memoryPricePerGBHour ?? null,
    networkPricePerGB: runner.networkPricePerGB ?? null,
    storagePricePerGB: runner.storagePricePerGB ?? null,
  });

  // Test connection state
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [updateRunner, { loading, error }] = useUpdateRunnerMutation({
    refetchQueries: ['GetRunners'],
  });

  const [testConnection, { loading: testLoading }] = useTestRunnerConnectionMutation();
  const [testS3, { loading: testS3Loading }] = useTestS3ConnectionMutation();

  const handleTestS3Connection = async () => {
    setS3TestResult(null);

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
    setTestResult(null);

    const config = type === 'docker'
      ? { docker: dockerConfig }
      : type === 'kubernetes'
      ? { kubernetes: kubernetesConfig }
      : { local: localConfig };

    try {
      const result = await testConnection({
        variables: {
          type: type as any,
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

  // Reset form when runner changes or dialog opens
  useEffect(() => {
    if (open) {
      setName(runner.name);
      setType(runner.type);

      // Load existing config based on type
      if (runner.config) {
        if (runner.type === 'docker' && runner.config.docker) {
          setDockerConfig(runner.config.docker);
        } else if (runner.type === 'kubernetes' && runner.config.kubernetes) {
          setKubernetesConfig(runner.config.kubernetes);
        } else if (runner.type === 'local' && runner.config.local) {
          setLocalConfig(runner.config.local);
        }
      }

      // Load data download config
      setDataDownloadConfig(runner.dataDownloadConfig || null);

      // Load S3 config
      if (runner.s3Config) {
        setS3Enabled(true);
        setS3Config({
          endpoint: runner.s3Config.endpoint || '',
          bucket: runner.s3Config.bucket || '',
          accessKeyId: runner.s3Config.accessKeyId || '',
          secretAccessKey: runner.s3Config.secretAccessKey || '',
          region: runner.s3Config.region || 'us-east-1',
          forcePathStyle: runner.s3Config.forcePathStyle ?? true,
          useSSL: runner.s3Config.useSSL ?? true,
        });
      } else {
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
      }

      // Load billing config
      setBillingConfig({
        billingEnabled: runner.billingEnabled ?? false,
        cpuPricePerCoreHour: runner.cpuPricePerCoreHour ?? null,
        memoryPricePerGBHour: runner.memoryPricePerGBHour ?? null,
        networkPricePerGB: runner.networkPricePerGB ?? null,
        storagePricePerGB: runner.storagePricePerGB ?? null,
      });

      // Clear test results
      setTestResult(null);
      setS3TestResult(null);
    }
  }, [runner, open]);

  const handleSubmit = async () => {
    if (!name) {
      return;
    }

    const config = type === 'docker'
      ? { docker: dockerConfig }
      : type === 'kubernetes'
      ? { kubernetes: kubernetesConfig }
      : { local: localConfig };

    try {
      const result = await updateRunner({
        variables: {
          id: runner.id,
          input: {
            name,
            type: type as any,
            config,
            dataDownloadConfig,
            s3Config: s3Enabled ? s3Config : null,
            billingEnabled: billingConfig.billingEnabled,
            cpuPricePerCoreHour: billingConfig.billingEnabled ? billingConfig.cpuPricePerCoreHour : null,
            memoryPricePerGBHour: billingConfig.billingEnabled ? billingConfig.memoryPricePerGBHour : null,
            networkPricePerGB: billingConfig.billingEnabled ? billingConfig.networkPricePerGB : null,
            storagePricePerGB: billingConfig.billingEnabled ? billingConfig.storagePricePerGB : null,
            clearCPUPricePerCoreHour: !billingConfig.billingEnabled,
            clearMemoryPricePerGBHour: !billingConfig.billingEnabled,
            clearNetworkPricePerGB: !billingConfig.billingEnabled,
            clearStoragePricePerGB: !billingConfig.billingEnabled,
          },
        },
      });

      if (result.data?.updateBotRunner) {
        onSuccess();
        onClose();
      }
    } catch (err) {
      console.error('Failed to update runner:', err);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Runner</DialogTitle>
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
                    helperText="Paste PEM-encoded client certificate"
                  />

                  <TextField
                    label="Client Key (PEM)"
                    value={dockerConfig.keyPEM ?? ''}
                    onChange={(e) => setDockerConfig({ ...dockerConfig, keyPEM: e.target.value || undefined })}
                    fullWidth
                    multiline
                    rows={4}
                    helperText="Paste PEM-encoded client key"
                  />

                  <TextField
                    label="CA Certificate (PEM)"
                    value={dockerConfig.caPEM ?? ''}
                    onChange={(e) => setDockerConfig({ ...dockerConfig, caPEM: e.target.value || undefined })}
                    fullWidth
                    multiline
                    rows={4}
                    helperText="Paste PEM-encoded CA certificate"
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

              <TextField
                label="Kubeconfig (YAML)"
                value={kubernetesConfig.kubeconfig ?? ''}
                onChange={(e) => setKubernetesConfig({ ...kubernetesConfig, kubeconfig: e.target.value || undefined })}
                fullWidth
                multiline
                rows={6}
                helperText="Paste kubeconfig YAML content (leave empty for in-cluster config)"
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
                  Enable for MinIO/non-AWS S3
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
              Error updating runner: {error.message}
            </FormHelperText>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
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
          {loading ? 'Updating...' : 'Update Runner'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};