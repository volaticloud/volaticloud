import Editor from '@monaco-editor/react';
import { Box, Typography, useTheme } from '@mui/material';

interface PythonCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string | number;
  label?: string;
  placeholder?: string;
}

export const PythonCodeEditor = ({
  value,
  onChange,
  height = '400px',
  label = 'Python Strategy Code',
  placeholder = '# Enter your Freqtrade strategy code here...',
}: PythonCodeEditorProps) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const handleEditorChange = (newValue: string | undefined) => {
    onChange(newValue ?? '');
  };

  return (
    <Box sx={{ height: height === '100%' ? '100%' : 'auto', display: 'flex', flexDirection: 'column' }}>
      {label && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 1 }}
        >
          {label} *
        </Typography>
      )}
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          flex: height === '100%' ? 1 : 'none',
          height: height === '100%' ? '100%' : 'auto',
        }}
      >
        <Editor
          height={height}
          defaultLanguage="python"
          value={value || placeholder}
          onChange={handleEditorChange}
          theme={isDarkMode ? 'vs-dark' : 'light'}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            wordWrap: 'on',
            folding: true,
            renderLineHighlight: 'line',
          }}
        />
      </Box>
    </Box>
  );
};