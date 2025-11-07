import {
  Box,
  Typography,
  Card,
  CardContent,
} from '@mui/material';
import { Code as CodeIcon } from '@mui/icons-material';

interface StrategyCodeProps {
  code: string;
}

export const StrategyCode = ({ code }: StrategyCodeProps) => {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CodeIcon />
          <Typography variant="h6">Strategy Code</Typography>
        </Box>
        <Box
          component="pre"
          sx={{
            p: 2,
            bgcolor: 'background.default',
            borderRadius: 1,
            overflow: 'auto',
            maxHeight: 400,
            fontSize: '0.875rem',
            fontFamily: 'monospace',
          }}
        >
          {code}
        </Box>
      </CardContent>
    </Card>
  );
};