import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Skeleton,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Card,
  CardContent,
  CardActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  Tooltip,
  Link,
} from '@mui/material';
import {
  Payment as PaymentIcon,
  AccountBalanceWallet as WalletIcon,
  Add as AddIcon,
  Warning as WarningIcon,
  Check as CheckIcon,
  ExpandMore as ExpandMoreIcon,
  HelpOutline as HelpIcon,
  OpenInNew as OpenInNewIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { useActiveOrganization } from '../../contexts/OrganizationContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { CreditTransactionType } from '../../generated/types';
import {
  useGetCreditBalanceQuery,
  useGetCreditTransactionsQuery,
  useGetSubscriptionInfoQuery,
  useGetAvailablePlansQuery,
  useCreateDepositSessionMutation,
  useCreateSubscriptionSessionMutation,
  useChangeSubscriptionPlanMutation,
  useCancelSubscriptionMutation,
  useGetPaymentHistoryQuery,
} from '../../components/Billing/billing.generated';

const TX_PAGE_SIZE = 10;
const INVOICE_PAGE_SIZE = 10;

const txTypeLabel: Record<CreditTransactionType, string> = {
  [CreditTransactionType.SubscriptionDeposit]: 'Subscription Deposit',
  [CreditTransactionType.ManualDeposit]: 'Manual Deposit',
  [CreditTransactionType.UsageDeduction]: 'Usage Deduction',
  [CreditTransactionType.AdminAdjustment]: 'Admin Adjustment',
};

const txTypeColor: Record<CreditTransactionType, 'success' | 'info' | 'warning' | 'default'> = {
  [CreditTransactionType.SubscriptionDeposit]: 'success',
  [CreditTransactionType.ManualDeposit]: 'info',
  [CreditTransactionType.UsageDeduction]: 'warning',
  [CreditTransactionType.AdminAdjustment]: 'default',
};

const featureLabels: Record<string, string> = {
  live_trading: 'Live Trading',
  backtesting: 'Backtesting',
  code_mode: 'Code Mode',
  alerting: 'Alerting',
  multi_exchange: 'Multi-Exchange',
  team_management: 'Team Management',
  custom_infrastructure: 'Custom Infrastructure',
};

export const OrganizationBillingPage = () => {
  useDocumentTitle('Billing & Plans');
  const { activeOrganizationId } = useActiveOrganization();
  const [txPage, setTxPage] = useState(0);
  const [historyTab, setHistoryTab] = useState(0);
  const [invoicePage, setInvoicePage] = useState(0);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('10');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'error' | 'success';
  }>({ open: false, message: '', severity: 'success' });

  const [searchParams, setSearchParams] = useSearchParams();
  const depositResult = searchParams.get('deposit');
  const subscriptionResult = searchParams.get('subscription');

  const skip = !activeOrganizationId;

  const { data: balanceData, loading: balanceLoading, refetch: refetchBalance } = useGetCreditBalanceQuery({
    variables: { ownerID: activeOrganizationId || '' },
    skip,
    pollInterval: 30000,
  });

  const { data: subData, loading: subLoading, refetch: refetchSub } = useGetSubscriptionInfoQuery({
    variables: { ownerID: activeOrganizationId || '' },
    skip,
  });

  const { data: txData, loading: txLoading, refetch: refetchTx } = useGetCreditTransactionsQuery({
    variables: {
      ownerID: activeOrganizationId || '',
      limit: TX_PAGE_SIZE,
      offset: txPage * TX_PAGE_SIZE,
    },
    skip,
  });

  const { data: plansData, loading: plansLoading } = useGetAvailablePlansQuery({ skip });

  const { data: invoiceData, loading: invoiceLoading } = useGetPaymentHistoryQuery({
    variables: { ownerID: activeOrganizationId || '', limit: 50 },
    skip,
  });

  const [createDeposit, { loading: depositLoading }] = useCreateDepositSessionMutation();
  const [createSubscriptionSession, { loading: subscribeLoading }] = useCreateSubscriptionSessionMutation();
  const [changeSubscriptionPlan, { loading: changePlanLoading }] = useChangeSubscriptionPlanMutation();
  const [cancelSubscription, { loading: cancelLoading }] = useCancelSubscriptionMutation();

  // Handle return from Stripe Checkout (deposit)
  useEffect(() => {
    if (depositResult === 'success') {
      setSnackbar({ open: true, message: 'Payment successful! Credits will appear shortly.', severity: 'success' });
      const timer = setTimeout(() => {
        refetchBalance();
        refetchTx();
      }, 3000);
      searchParams.delete('deposit');
      setSearchParams(searchParams, { replace: true });
      return () => clearTimeout(timer);
    } else if (depositResult === 'cancel') {
      setSnackbar({ open: true, message: 'Payment was cancelled.', severity: 'error' });
      searchParams.delete('deposit');
      setSearchParams(searchParams, { replace: true });
    }
  }, [depositResult]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle return from Stripe Checkout (subscription)
  useEffect(() => {
    if (subscriptionResult === 'success') {
      setSnackbar({ open: true, message: 'Subscription activated! Your plan will appear shortly.', severity: 'success' });
      const timer = setTimeout(() => {
        refetchSub();
        refetchBalance();
        refetchTx();
      }, 3000);
      searchParams.delete('subscription');
      setSearchParams(searchParams, { replace: true });
      return () => clearTimeout(timer);
    } else if (subscriptionResult === 'cancel') {
      setSnackbar({ open: true, message: 'Subscription checkout was cancelled.', severity: 'error' });
      searchParams.delete('subscription');
      setSearchParams(searchParams, { replace: true });
    }
  }, [subscriptionResult]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!activeOrganizationId || isNaN(amount) || amount <= 0) return;
    try {
      const { data, errors } = await createDeposit({
        variables: { ownerID: activeOrganizationId, amount },
        errorPolicy: 'all',
      });
      if (errors?.length) {
        throw new Error(errors[0].message);
      }
      if (data?.createDepositSession) {
        window.location.href = data.createDepositSession;
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to create deposit session',
        severity: 'error',
      });
    }
    setDepositOpen(false);
  };

  const handleSubscribe = async (priceID: string) => {
    if (!activeOrganizationId) return;
    try {
      const { data, errors } = await createSubscriptionSession({
        variables: { ownerID: activeOrganizationId, priceID },
        errorPolicy: 'all',
      });
      if (errors?.length) {
        throw new Error(errors[0].message);
      }
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

  const handleChangePlan = async (newPriceID: string, planName: string) => {
    setConfirmDialog({
      open: true,
      title: 'Switch Plan',
      message: `Are you sure you want to switch to the ${planName} plan? Prorated charges will apply.`,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        if (!activeOrganizationId) return;
        try {
          const { errors } = await changeSubscriptionPlan({
            variables: { ownerID: activeOrganizationId, newPriceID },
            errorPolicy: 'all',
          });
          if (errors?.length) {
            throw new Error(errors[0].message);
          }
          setSnackbar({ open: true, message: `Switched to ${planName} plan.`, severity: 'success' });
          refetchSub();
        } catch (err) {
          setSnackbar({
            open: true,
            message: err instanceof Error ? err.message : 'Failed to change plan',
            severity: 'error',
          });
        }
      },
    });
  };

  const handleCancelSubscription = () => {
    setConfirmDialog({
      open: true,
      title: 'Cancel Subscription',
      message: `Are you sure you want to cancel your subscription? It will remain active until ${sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'the end of the current billing period'}. Your credits will be retained and remain usable. No refund is issued for the current period.`,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        if (!activeOrganizationId) return;
        try {
          const { errors } = await cancelSubscription({
            variables: { ownerID: activeOrganizationId },
            errorPolicy: 'all',
          });
          if (errors?.length) {
            throw new Error(errors[0].message);
          }
          setSnackbar({ open: true, message: 'Subscription will cancel at the end of the billing period.', severity: 'success' });
          refetchSub();
        } catch (err) {
          setSnackbar({
            open: true,
            message: err instanceof Error ? err.message : 'Failed to cancel subscription',
            severity: 'error',
          });
        }
      },
    });
  };

  if (!activeOrganizationId) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>Billing & Plans</Typography>
        <Alert severity="info" sx={{ mt: 2 }}>
          Please select an organization from the header to view billing.
        </Alert>
      </Box>
    );
  }

  const balance = balanceData?.creditBalance;
  const sub = subData?.subscriptionInfo;
  const transactions = txData?.creditTransactions ?? [];
  const plans = plansData?.availablePlans ?? [];
  const allInvoices = invoiceData?.paymentHistory ?? [];
  const invoices = allInvoices.slice(invoicePage * INVOICE_PAGE_SIZE, (invoicePage + 1) * INVOICE_PAGE_SIZE);
  const hasActiveSub = sub && (sub.status === 'active' || sub.status === 'canceling');

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Billing & Plans</Typography>

      {/* Suspension Banner */}
      {balance?.suspended && (
        <Alert severity="error" icon={<WarningIcon />} sx={{ mb: 3 }}>
          Your organization is suspended due to insufficient credits. Running bots have been stopped.
          Add credits to resume operations.
        </Alert>
      )}

      {/* Top Cards Row */}
      <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
        {/* Balance Card */}
        <Paper sx={{ p: 3, flex: '1 1 280px', minWidth: 280 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <WalletIcon color="primary" />
            <Typography variant="subtitle2" color="text.secondary">Credit Balance</Typography>
          </Box>
          {balanceLoading ? (
            <Skeleton variant="text" width={120} height={48} />
          ) : (
            <Typography variant="h3" fontWeight="bold" color={balance?.suspended ? 'error.main' : 'text.primary'}>
              ${balance?.balance.toFixed(2) ?? '0.00'}
            </Typography>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            sx={{ mt: 2 }}
            onClick={() => setDepositOpen(true)}
          >
            Add Credits
          </Button>
        </Paper>

        {/* Plan Card */}
        <Paper sx={{ p: 3, flex: '1 1 280px', minWidth: 280 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PaymentIcon color="primary" />
            <Typography variant="subtitle2" color="text.secondary">Current Subscription</Typography>
          </Box>
          {subLoading ? (
            <Skeleton variant="text" width={100} height={48} />
          ) : sub ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="h4" fontWeight="bold" sx={{ textTransform: 'capitalize' }}>
                  {sub.planName ?? 'Custom'}
                </Typography>
                <Chip
                  label={sub.status === 'canceling' ? 'Canceling' : sub.status}
                  size="small"
                  color={sub.status === 'active' ? 'success' : 'warning'}
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                ${sub.monthlyDeposit.toFixed(2)} monthly deposit
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {sub.status === 'canceling'
                  ? `Cancels ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
                  : `Renews ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`}
              </Typography>
              {sub.status === 'active' && (
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  sx={{ mt: 1.5 }}
                  onClick={handleCancelSubscription}
                  disabled={cancelLoading}
                >
                  Cancel Subscription
                </Button>
              )}
            </>
          ) : (
            <Typography variant="body1" color="text.secondary">No active subscription</Typography>
          )}
        </Paper>
      </Box>

      {/* Available Plans */}
      {plans.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>Available Plans</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {plansLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} variant="rectangular" width={280} height={300} sx={{ borderRadius: 2 }} />
              ))
            ) : (
              plans.map((plan) => {
                const isCurrentPlan = sub?.planName?.toLowerCase() === plan.displayName.toLowerCase();
                const canSwitch = hasActiveSub && !isCurrentPlan;
                const canSubscribe = !hasActiveSub;

                return (
                  <Card
                    key={plan.priceId}
                    variant="outlined"
                    sx={{
                      flex: '1 1 240px',
                      maxWidth: 320,
                      minWidth: 240,
                      border: isCurrentPlan ? 2 : 1,
                      borderColor: isCurrentPlan ? 'primary.main' : 'divider',
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="h6" fontWeight="bold">
                          {plan.displayName}
                        </Typography>
                        {isCurrentPlan && <Chip label="Current" size="small" color="primary" />}
                      </Box>
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
                      {isCurrentPlan ? (
                        <Button variant="outlined" fullWidth disabled>
                          Current Plan
                        </Button>
                      ) : canSwitch ? (
                        <Button
                          variant="contained"
                          fullWidth
                          onClick={() => handleChangePlan(plan.priceId, plan.displayName)}
                          disabled={changePlanLoading}
                        >
                          Switch Plan
                        </Button>
                      ) : canSubscribe ? (
                        <Button
                          variant="contained"
                          fullWidth
                          onClick={() => handleSubscribe(plan.priceId)}
                          disabled={subscribeLoading}
                        >
                          Subscribe
                        </Button>
                      ) : (
                        <Button variant="outlined" fullWidth disabled>
                          Contact Us
                        </Button>
                      )}
                    </CardActions>
                  </Card>
                );
              })
            )}
          </Box>
        </Box>
      )}

      {/* Billing FAQ */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <HelpIcon color="primary" />
          <Typography variant="h6">Billing FAQ</Typography>
        </Box>
        <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight="medium">What happens when I cancel my subscription?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary">
              Your subscription remains active until the end of the current billing period. You can continue using
              all features and your remaining credits during this time. No further charges will be made.
              Credits in your balance are retained and remain usable. There are no refunds for the current period
              since credits are prepaid. You can re-subscribe to any plan at any time after cancellation.
            </Typography>
          </AccordionDetails>
        </Accordion>
        <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight="medium">What happens when I switch plans?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary">
              Plan changes take effect immediately. Stripe automatically prorates the price difference:
              upgrading charges you for the remaining days at the new price, and downgrading credits
              the difference to your next invoice. Your existing credit balance is not affected &mdash; only future
              monthly deposits change to match the new plan. If you were canceling, switching plans re-activates
              your subscription.
            </Typography>
          </AccordionDetails>
        </Accordion>
        <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight="medium">How do monthly credit deposits work?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary">
              Each billing period, your plan&apos;s full credit deposit is added to your balance. Manual deposits
              (via &quot;Add Credits&quot;) are completely independent and do not affect your subscription deposit.
              Both sources of credits stack, giving you full control over your balance.
            </Typography>
          </AccordionDetails>
        </Accordion>
        <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight="medium">What happens when my credits run out?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary">
              When your credit balance reaches zero, your organization is suspended. Running bots are stopped
              and new resource creation is blocked. You can add credits manually at any time using the &quot;Add
              Credits&quot; button to resume operations. Your subscription and data remain intact.
            </Typography>
          </AccordionDetails>
        </Accordion>
        <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight="medium">Can I re-subscribe after canceling?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary">
              Yes. After your subscription ends, the plan cards will show &quot;Subscribe&quot; buttons again.
              You can choose any plan &mdash; it doesn&apos;t have to be the same one. Your existing credit
              balance carries over and a new subscription deposit is added on top.
            </Typography>
          </AccordionDetails>
        </Accordion>
        <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight="medium">How is usage billed?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary">
              Compute resources (CPU, memory, network, storage) consumed by your bots and backtests are
              metered and deducted from your credit balance hourly. 1 credit = $1. You can monitor usage
              on the Usage &amp; Metrics page.
            </Typography>
          </AccordionDetails>
        </Accordion>
        <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight="medium">Are manual deposits refundable?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary">
              Credits are prepaid and non-refundable. Both subscription deposits and manual deposits
              remain in your balance until consumed by usage. Make sure to add only what you need.
            </Typography>
          </AccordionDetails>
        </Accordion>
      </Paper>

      {/* Transaction & Payment History */}
      <Paper sx={{ p: 3 }}>
        <Tabs value={historyTab} onChange={(_, v) => setHistoryTab(v)} sx={{ mb: 2 }}>
          <Tab label="Credit Transactions" />
          <Tab label="Payment History" />
        </Tabs>

        {historyTab === 0 && (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Reference</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">Balance After</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {txLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j}><Skeleton /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                          No transactions yet
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>{new Date(tx.createdAt).toLocaleString()}</TableCell>
                        <TableCell>
                          <Chip
                            label={txTypeLabel[tx.type]}
                            size="small"
                            color={txTypeColor[tx.type]}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>{tx.description || '-'}</TableCell>
                        <TableCell>
                          {tx.referenceID ? (
                            <Tooltip title={tx.referenceID}>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                {tx.referenceID.length > 20 ? `${tx.referenceID.slice(0, 20)}...` : tx.referenceID}
                              </Typography>
                            </Tooltip>
                          ) : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{
                          color: tx.amount >= 0 ? 'success.main' : 'error.main',
                          fontWeight: 'bold',
                        }}>
                          {tx.amount >= 0 ? '+' : '-'}${Math.abs(tx.amount).toFixed(2)}
                        </TableCell>
                        <TableCell align="right">${tx.balanceAfter.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={-1}
              page={txPage}
              onPageChange={(_, newPage) => setTxPage(newPage)}
              rowsPerPage={TX_PAGE_SIZE}
              rowsPerPageOptions={[TX_PAGE_SIZE]}
              labelDisplayedRows={({ from, to }) => `${from}-${to}`}
              nextIconButtonProps={{ disabled: transactions.length < TX_PAGE_SIZE }}
            />
          </>
        )}

        {historyTab === 1 && (
          <>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Invoice #</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoiceLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}><Skeleton /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                        No invoices yet
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{new Date(inv.created).toLocaleDateString()}</TableCell>
                      <TableCell>{inv.number || '-'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                        ${inv.amountPaid.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={inv.status}
                          size="small"
                          color={
                            inv.status === 'paid' ? 'success' :
                            inv.status === 'open' ? 'warning' :
                            inv.status === 'void' ? 'error' : 'default'
                          }
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {inv.billingReason?.replace(/_/g, ' ') || '-'}
                      </TableCell>
                      <TableCell>
                        {new Date(inv.periodStart).toLocaleDateString()} - {new Date(inv.periodEnd).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          {inv.hostedInvoiceUrl && (
                            <Tooltip title="View invoice">
                              <Link href={inv.hostedInvoiceUrl} target="_blank" rel="noopener">
                                <Button size="small" startIcon={<OpenInNewIcon />}>View</Button>
                              </Link>
                            </Tooltip>
                          )}
                          {inv.invoicePdf && (
                            <Tooltip title="Download PDF">
                              <Link href={inv.invoicePdf} target="_blank" rel="noopener">
                                <Button size="small" startIcon={<DownloadIcon />}>PDF</Button>
                              </Link>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {allInvoices.length > INVOICE_PAGE_SIZE && (
            <TablePagination
              component="div"
              count={allInvoices.length}
              page={invoicePage}
              onPageChange={(_, newPage) => setInvoicePage(newPage)}
              rowsPerPage={INVOICE_PAGE_SIZE}
              rowsPerPageOptions={[INVOICE_PAGE_SIZE]}
            />
          )}
          </>
        )}
      </Paper>

      {/* Deposit Dialog */}
      <Dialog open={depositOpen} onClose={() => setDepositOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Credits</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            You will be redirected to Stripe to complete the payment. Credits are added instantly after payment.
          </Typography>
          <TextField
            label="Amount ($)"
            type="number"
            fullWidth
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            slotProps={{ htmlInput: { min: 5, step: 5 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDepositOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleDeposit}
            disabled={depositLoading || parseFloat(depositAmount) < 5}
          >
            Continue to Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}>
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirmDialog.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}>Cancel</Button>
          <Button variant="contained" onClick={confirmDialog.onConfirm} autoFocus>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
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
    </Box>
  );
};
