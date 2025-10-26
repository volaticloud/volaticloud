import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { Box, Typography, Paper, useTheme } from '@mui/material';

interface JSONEditorProps {
  value: object | null;
  onChange: (value: object | null) => void;
  label?: string;
  helperText?: string;
  error?: boolean;
  height?: string;
  placeholder?: string;
}

export const JSONEditor: React.FC<JSONEditorProps> = ({
  value,
  onChange,
  label,
  helperText,
  error: externalError = false,
  height = '300px',
  placeholder = '{}',
}) => {
  const theme = useTheme();
  const [textValue, setTextValue] = useState('');
  const [internalError, setInternalError] = useState<string | null>(null);

  // Initialize text value from object
  useEffect(() => {
    try {
      if (value) {
        setTextValue(JSON.stringify(value, null, 2));
      } else {
        setTextValue('');
      }
    } catch {
      setTextValue('');
    }
  }, [value]);

  const handleChange = (val: string) => {
    setTextValue(val);

    // Validate JSON
    if (!val.trim()) {
      setInternalError(null);
      onChange(null);
      return;
    }

    try {
      const parsed = JSON.parse(val);
      setInternalError(null);
      onChange(parsed);
    } catch (err) {
      setInternalError((err as Error).message);
      // Don't update the parent value if JSON is invalid
    }
  };

  const hasError = externalError || !!internalError;

  return (
    <Box>
      {label && (
        <Typography
          variant="subtitle2"
          sx={{
            mb: 1,
            color: hasError ? 'error.main' : 'text.primary',
            fontWeight: 500,
          }}
        >
          {label}
        </Typography>
      )}
      <Paper
        variant="outlined"
        sx={{
          border: hasError ? `2px solid ${theme.palette.error.main}` : undefined,
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <CodeMirror
          value={textValue}
          height={height}
          extensions={[json()]}
          onChange={handleChange}
          placeholder={placeholder}
          theme={theme.palette.mode === 'dark' ? 'dark' : 'light'}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
          }}
        />
      </Paper>
      {(internalError || helperText) && (
        <Typography
          variant="caption"
          sx={{
            mt: 0.5,
            ml: 1.5,
            display: 'block',
            color: internalError ? 'error.main' : 'text.secondary',
          }}
        >
          {internalError || helperText}
        </Typography>
      )}
    </Box>
  );
};