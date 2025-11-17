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
} from '@mui/material';
import { useState, useEffect } from 'react';
import { useUpdateRunnerMutation, useTestRunnerConnectionMutation } from './runners.generated';
import type { DockerConfigInput, KubernetesConfigInput, LocalConfigInput, DataDownloadConfigInput, BotRunnerRunnerType } from '../../generated/types';
import { DataDownloadConfigEditor } from './DataDownloadConfigEditor';

interface EditRunnerDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  runner: any; // Full runner data from GetRunners query
}

export const EditRunnerDialog = ({ open, onClose, onSuccess, runner }: EditRunnerDialogProps) => {
  const [name, setName] = useState(runner.name);
  const [type, setType] = useState<'docker' | 'kubernetes' | 'local'>(runner.type);

  // Docker config state
  const [dockerConfig, setDockerConfig] = useState<DockerConfigInput>({
    host: 'unix:///var/run/docker.sock',
  });

  // Kubernetes config state
  const [kubernetesConfig, setKubernetesConfig] = useState<KubernetesConfigInput>({});

  // Local config state
  const [localConfig, setLocalConfig] = useState<LocalConfigInput>({});

  // Data download config state
  const [dataDownloadConfig, setDataDownloadConfig] = useState<DataDownloadConfigInput | null>(null);

  // Test connection state
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [updateRunner, { loading, error }] = useUpdateRunnerMutation({
    refetchQueries: ['GetRunners'],
  });

  const [testConnection, { loading: testLoading }] = useTestRunnerConnectionMutation();

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

      // Load data download config if available
      setDataDownloadConfig(runner.dataDownloadConfig || null);
    }
  }, [runner, open]);

  const handleSubmit = async () => {
    if (!name) {
      return;
    }

    // Build config based on type
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
          },
        },
      });

      // Only close if mutation was successful
      if (result.data?.updateBotRunner) {
        onSuccess();
        onClose();
      }
      // If there are errors, they will be displayed via the error state
    } catch (err) {
      console.error('Failed to update runner:', err);
      // Error will be displayed via the error state from the mutation hook
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
                label="Kubeconfig Path (optional)"
                value={kubernetesConfig.kubeconfigPath ?? ''}
                onChange={(e) => setKubernetesConfig({ ...kubernetesConfig, kubeconfigPath: e.target.value || undefined })}
                fullWidth
                helperText="Path to kubeconfig file (leave empty for default ~/.kube/config)"
              />

              <TextField
                label="Namespace (optional)"
                value={kubernetesConfig.namespace ?? ''}
                onChange={(e) => setKubernetesConfig({ ...kubernetesConfig, namespace: e.target.value || undefined })}
                fullWidth
                helperText="Kubernetes namespace (leave empty for 'default')"
              />

              <TextField
                label="Context (optional)"
                value={kubernetesConfig.context ?? ''}
                onChange={(e) => setKubernetesConfig({ ...kubernetesConfig, context: e.target.value || undefined })}
                fullWidth
                helperText="Kubernetes context to use"
              />

              <FormHelperText sx={{ color: 'warning.main' }}>
                Note: Kubernetes runner is not yet fully supported
              </FormHelperText>
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
          disabled={loading || !name}
        >
          {loading ? 'Updating...' : 'Update Runner'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};