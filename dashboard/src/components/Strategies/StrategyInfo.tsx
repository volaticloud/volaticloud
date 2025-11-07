import {
  Box,
  Typography,
  Divider,
  Card,
  CardContent,
} from '@mui/material';

interface StrategyInfoProps {
  version: string;
  botsCount: number;
  hasBacktest: boolean;
  createdAt: string;
  updatedAt: string;
}

export const StrategyInfo = ({ version, botsCount, hasBacktest, createdAt, updatedAt }: StrategyInfoProps) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Strategy Information
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Version
            </Typography>
            <Typography variant="body2">{version || 'N/A'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Bots Using
            </Typography>
            <Typography variant="body2">{botsCount}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Backtest
            </Typography>
            <Typography variant="body2">{hasBacktest ? 'Yes' : 'No'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Created
            </Typography>
            <Typography variant="body2">
              {new Date(createdAt).toLocaleDateString()}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Last Updated
            </Typography>
            <Typography variant="body2">
              {new Date(updatedAt).toLocaleDateString()}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};