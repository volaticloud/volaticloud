import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Snackbar,
} from '@mui/material';
import {
  Refresh,
  ContentCopy,
  Code,
  CheckCircle,
} from '@mui/icons-material';
import { UIBuilderConfig } from './types';
import { usePreviewStrategyCodeMutation } from '../Strategies/strategy-studio.generated';
import Editor from '@monaco-editor/react';

interface CodePreviewProps {
  config: UIBuilderConfig;
  className: string;
  timeframe: string;
  stakeCurrency: string;
  stakeAmount: number;
}

export function CodePreview({
  config,
  className,
  timeframe,
  stakeCurrency,
  stakeAmount,
}: CodePreviewProps) {
  const [previewCode, { loading, error }] = usePreviewStrategyCodeMutation();
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);

  const generatePreview = useCallback(async () => {
    setPreviewError(null);

    // Build the full config object matching what the backend expects
    const fullConfig = {
      stake_currency: stakeCurrency,
      stake_amount: stakeAmount,
      timeframe: timeframe,
      ui_builder: config,
    };

    try {
      const result = await previewCode({
        variables: {
          config: fullConfig,
          className: className || 'MyStrategy',
        },
      });

      if (result.data?.previewStrategyCode.success) {
        setGeneratedCode(result.data.previewStrategyCode.code);
        setLastGenerated(new Date());
      } else {
        setPreviewError(result.data?.previewStrategyCode.error || 'Failed to generate code');
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to generate code');
    }
  }, [config, className, timeframe, stakeCurrency, stakeAmount, previewCode]);

  // Auto-generate on first render
  useEffect(() => {
    if (!generatedCode && !loading) {
      generatePreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally only run once on mount

  const handleCopy = async () => {
    if (generatedCode) {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
    }
  };

  const handleCloseCopied = () => {
    setCopied(false);
  };

  return (
    <Paper variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Code color="primary" />
        <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
          Generated Python Code
        </Typography>
        {lastGenerated && (
          <Typography variant="caption" color="text.secondary">
            Generated: {lastGenerated.toLocaleTimeString()}
          </Typography>
        )}
        <Tooltip title="Copy code">
          <span>
            <IconButton
              size="small"
              onClick={handleCopy}
              disabled={!generatedCode}
            >
              <ContentCopy fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Regenerate preview">
          <span>
            <IconButton
              size="small"
              onClick={generatePreview}
              disabled={loading}
            >
              {loading ? <CircularProgress size={18} /> : <Refresh fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Box sx={{ flex: 1, position: 'relative', minHeight: 400 }}>
        {loading && !generatedCode && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'background.paper',
            }}
          >
            <CircularProgress />
          </Box>
        )}

        {(previewError || error) && (
          <Alert severity="error" sx={{ m: 2 }}>
            {previewError || error?.message || 'Failed to generate code preview'}
          </Alert>
        )}

        {generatedCode && (
          <Editor
            height="100%"
            defaultLanguage="python"
            value={generatedCode}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
            }}
          />
        )}

        {!generatedCode && !loading && !previewError && !error && (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              p: 3,
            }}
          >
            <Code sx={{ fontSize: 48, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Click the button below to generate a preview of your strategy code.
            </Typography>
            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={generatePreview}
            >
              Generate Preview
            </Button>
          </Box>
        )}
      </Box>

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={handleCloseCopied}
        message={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircle fontSize="small" color="success" />
            Code copied to clipboard
          </Box>
        }
      />
    </Paper>
  );
}
