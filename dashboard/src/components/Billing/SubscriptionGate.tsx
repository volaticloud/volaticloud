import { type ReactNode } from 'react';
import { Box, Skeleton } from '@mui/material';
import { useActiveOrganization } from '../../contexts/OrganizationContext';
import { useGetSubscriptionInfoQuery } from './billing.generated';
import { NoSubscriptionView } from './NoSubscriptionView';

const SUBSCRIPTION_POLL_INTERVAL_MS = 60_000; // 1 minute — catches webhook-driven status changes

interface SubscriptionGateProps {
  children: ReactNode;
}

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { activeOrganizationId } = useActiveOrganization();

  const { data, loading } = useGetSubscriptionInfoQuery({
    variables: { ownerID: activeOrganizationId || '' },
    skip: !activeOrganizationId,
    pollInterval: SUBSCRIPTION_POLL_INTERVAL_MS,
  });

  // No org selected — let other gates handle this
  if (!activeOrganizationId) return <>{children}</>;

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  const status = data?.subscriptionInfo?.status;
  const hasAccess = status === 'active' || status === 'canceling';

  if (!hasAccess) {
    return <NoSubscriptionView />;
  }

  return <>{children}</>;
}
