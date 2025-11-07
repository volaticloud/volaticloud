import {
  Box,
  Typography,
  Card,
  CardContent,
} from '@mui/material';
import {
  SmartToy as BotIcon,
  ShowChart as TradeIcon,
  AccountBalance as ExchangeIcon,
  Psychology as StrategyIcon,
} from '@mui/icons-material';

// Placeholder component - will be enhanced after codegen
export const Dashboard = () => {
  return (
    <Box sx={{ width: '100%', maxWidth: '100%' }}>
      <Typography variant="h4" gutterBottom fontWeight={600}>
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Welcome to AnyTrade Control Plane
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 3, mt: 3 }}>
        {/* Summary Cards */}
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <BotIcon sx={{ fontSize: 40, color: 'primary.main' }} />
              <Box>
                <Typography variant="h4" fontWeight={700}>
                  0
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active Bots
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TradeIcon sx={{ fontSize: 40, color: 'success.main' }} />
              <Box>
                <Typography variant="h4" fontWeight={700}>
                  0
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Trades
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ExchangeIcon sx={{ fontSize: 40, color: 'info.main' }} />
              <Box>
                <Typography variant="h4" fontWeight={700}>
                  0
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Exchanges
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <StrategyIcon sx={{ fontSize: 40, color: 'secondary.main' }} />
              <Box>
                <Typography variant="h4" fontWeight={700}>
                  0
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Strategies
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Recent Activity Section */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight={600}>
            Recent Activity
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No recent activity. Start by creating an exchange and a strategy.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};