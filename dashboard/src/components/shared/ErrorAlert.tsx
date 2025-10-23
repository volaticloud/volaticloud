import { Alert, AlertTitle, Box } from '@mui/material';

interface ErrorAlertProps {
  error: Error | string;
  title?: string;
}

export const ErrorAlert = ({ error, title = 'Error' }: ErrorAlertProps) => {
  const errorMessage = typeof error === 'string' ? error : error.message;

  return (
    <Box sx={{ my: 2 }}>
      <Alert severity="error">
        <AlertTitle>{title}</AlertTitle>
        {errorMessage}
      </Alert>
    </Box>
  );
};
