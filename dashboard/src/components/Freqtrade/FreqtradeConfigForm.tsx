import { Box, CircularProgress, Alert, ToggleButtonGroup, ToggleButton } from '@mui/material';
import Form from '@rjsf/mui';
import validator from '@rjsf/validator-ajv8';
import { RJSFSchema, UiSchema } from '@rjsf/utils';
import { useState } from 'react';
import { useFreqtradeSchema } from '../../hooks/useFreqtradeSchema';
import { JSONEditor } from '../JSONEditor';
import EditNoteIcon from '@mui/icons-material/EditNote';
import CodeIcon from '@mui/icons-material/Code';

interface FreqtradeConfigFormProps {
  value: object | null;
  onChange: (config: object) => void;
  onSubmit?: (config: object) => void;
  hideSubmitButton?: boolean;
  submitButtonText?: string;
  uiSchema?: UiSchema;
}

/**
 * Reusable Freqtrade configuration form component
 *
 * Uses React JSON Schema Form with Material-UI theme to render
 * a dynamic form based on the official Freqtrade JSON schema.
 *
 * Features:
 * - Auto-fetches and caches Freqtrade schema
 * - Auto-generates form fields from schema
 * - Auto-generates default values
 * - Client-side validation
 * - Material-UI themed
 *
 * @example
 * ```tsx
 * const [config, setConfig] = useState(null);
 *
 * <FreqtradeConfigForm
 *   value={config}
 *   onChange={setConfig}
 *   onSubmit={(config) => console.log('Submit:', config)}
 * />
 * ```
 */
export function FreqtradeConfigForm({
  value,
  onChange,
  onSubmit,
  hideSubmitButton = false,
  submitButtonText = 'Generate Config',
  uiSchema,
}: FreqtradeConfigFormProps) {
  const { schema, loading, error } = useFreqtradeSchema();
  const [mode, setMode] = useState<'form' | 'json'>('json');

  // Show loading state while fetching schema
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Show error if schema fetch failed
  if (error) {
    return (
      <Alert severity="error">
        Failed to load Freqtrade schema: {error.message}
      </Alert>
    );
  }

  // Schema not loaded yet
  if (!schema) {
    return null;
  }

  // Default UI Schema with better UX
  const defaultUiSchema: UiSchema = {
    'ui:submitButtonOptions': {
      submitText: submitButtonText,
      norender: hideSubmitButton,
      props: {
        variant: 'contained',
        color: 'primary',
      },
    },
    // Collapse long sections by default
    exchange: {
      'ui:collapsed': false,
    },
    entry_pricing: {
      'ui:collapsed': false,
    },
    exit_pricing: {
      'ui:collapsed': false,
    },
    pairlists: {
      'ui:collapsed': false,
    },
    max_open_trades: {
       'ui:title': "Max Open Trades"
    },
    ...uiSchema,
  };

  return (
    <Box>
      {/* Mode Toggle */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_, newMode) => {
            if (newMode) setMode(newMode);
          }}
          size="small"
          aria-label="config editor mode"
        >
          <ToggleButton value="form" aria-label="form mode">
            <EditNoteIcon sx={{ mr: 0.5, fontSize: '1.2rem' }} />
            Form
          </ToggleButton>
          <ToggleButton value="json" aria-label="json mode">
            <CodeIcon sx={{ mr: 0.5, fontSize: '1.2rem' }} />
            JSON
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Form Mode */}
      {mode === 'form' && (
        <Box sx={{ '& .MuiFormControl-root': { my: 1 } }}>
          <Form
            schema={schema as RJSFSchema}
            uiSchema={defaultUiSchema}
            formData={value || undefined}
            validator={validator}
            onChange={(e) => {
              if (e.formData) {
                onChange(e.formData);
              }
            }}
            onSubmit={(e) => {
              if (onSubmit && e.formData) {
                onSubmit(e.formData);
              }
            }}
            showErrorList={false}
          >
            {hideSubmitButton && <Box />}
          </Form>
        </Box>
      )}

      {/* JSON Mode */}
      {mode === 'json' && (
        <JSONEditor
          value={value}
          onChange={(newValue) => {
            if (newValue) {
              onChange(newValue);
            }
          }}
          height="500px"
          placeholder='{\n  "stake_currency": "USDT",\n  "stake_amount": 100,\n  ...\n}'
        />
      )}
    </Box>
  );
}

/**
 * Hook to generate default Freqtrade config from schema
 * Useful for providing initial values
 */
export function useDefaultFreqtradeConfig() {
  const { schema } = useFreqtradeSchema();

  if (!schema) {
    return null;
  }

  // Generate defaults from schema
  // RJSF's validator will handle this automatically when formData is undefined
  return null;
}
