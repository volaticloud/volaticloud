import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  CreditCard as CreditCardIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useActiveOrganization } from '../../contexts/OrganizationContext';
import {
  useGetAvailablePlansQuery,
  useCreateSubscriptionSessionMutation,
} from './billing.generated';

const featureLabels: Record<string, string> = {
  live_trading: 'Live Trading',
  backtesting: 'Backtesting',
  code_mode: 'Code Mode',
  alerting: 'Alerting',
  multi_exchange: 'Multi-Exchange',
  team_management: 'Team Management',
  custom_infrastructure: 'Custom Infrastructure',
};

export function NoSubscriptionView() {
  const { activeOrganizationId } = useActiveOrganization();
  const [searchParams] = useSearchParams();
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'error' | 'success' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const { data: plansData, loading: plansLoading } = useGetAvailablePlansQuery({
    skip: !activeOrganizationId,
  });
  const [createSubscriptionSession, { loading: subscribeLoading }] = useCreateSubscriptionSessionMutation();

  const plans = plansData?.availablePlans ?? [];

  // Check for subscription=success return from Stripe
  const subscriptionResult = searchParams.get('subscription');
  if (subscriptionResult === 'success') {
    // Parent SubscriptionGate will refetch and unblock
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography>Activating subscription...</Typography>
      </Box>
    );
  }

  const handleSubscribe = async (priceID: string) => {
    if (!activeOrganizationId) return;
    try {
      const { data, errors } = await createSubscriptionSession({
        variables: { ownerID: activeOrganizationId, priceID },
        errorPolicy: 'all',
      });
      if (errors?.length) throw new Error(errors[0].message);
      if (data?.createSubscriptionSession) {
        window.location.href = data.createSubscriptionSession;
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to create subscription session',
        severity: 'error',
      });
    }
  };

  return (
    <>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <Container maxWidth="md">
          <Paper elevation={3} sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
            <CreditCardIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom fontWeight="bold">
              Subscription Required
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Choose a plan to get started with VolatiCloud. All plans include a monthly credit deposit.
            </Typography>

            {plansLoading ? (
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mt: 3 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} variant="rectangular" width={240} height={300} sx={{ borderRadius: 2 }} />
                ))}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mt: 3 }}>
                {plans.map((plan) => (
                  <Card
                    key={plan.priceId}
                    variant="outlined"
                    sx={{ flex: '1 1 220px', maxWidth: 300, minWidth: 220 }}
                  >
                    <CardContent>
                      <Typography variant="h6" fontWeight="bold" gutterBottom>
                        {plan.displayName}
                      </Typography>
                      <Typography variant="h4" fontWeight="bold" sx={{ mb: 0.5 }}>
                        {plan.priceAmount === 0 ? 'Free' : `$${plan.priceAmount}/mo`}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        ${plan.monthlyDeposit} monthly credits
                      </Typography>
                      {plan.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {plan.description}
                        </Typography>
                      )}
                      <List dense disablePadding>
                        {plan.features.map((feature) => (
                          <ListItem key={feature} disableGutters sx={{ py: 0.25 }}>
                            <ListItemIcon sx={{ minWidth: 28 }}>
                              <CheckIcon fontSize="small" color="success" />
                            </ListItemIcon>
                            <ListItemText
                              primary={featureLabels[feature] ?? feature}
                              primaryTypographyProps={{ variant: 'body2' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                    <CardActions sx={{ px: 2, pb: 2 }}>
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={() => handleSubscribe(plan.priceId)}
                        disabled={subscribeLoading}
                      >
                        Subscribe
                      </Button>
                    </CardActions>
                  </Card>
                ))}
              </Box>
            )}

          </Paper>
        </Container>
      </Box>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
