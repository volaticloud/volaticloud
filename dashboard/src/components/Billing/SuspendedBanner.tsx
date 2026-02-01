import { Alert, Button } from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { useActiveOrganization, useOrganizationNavigate } from '../../contexts/OrganizationContext';
import { useGetCreditBalanceQuery } from './billing.generated';

export const SuspendedBanner = () => {
  const { activeOrganizationId } = useActiveOrganization();
  const navigate = useOrganizationNavigate();

  const { data } = useGetCreditBalanceQuery({
    variables: { ownerID: activeOrganizationId || '' },
    skip: !activeOrganizationId,
    pollInterval: 30000,
  });

  if (!data?.creditBalance?.suspended) return null;

  return (
    <Alert
      severity="error"
      icon={<WarningIcon />}
      sx={{ mb: 2, borderRadius: 0 }}
      action={
        <Button color="inherit" size="small" onClick={() => navigate('/organization/billing')}>
          Add Credits
        </Button>
      }
    >
      Organization suspended: insufficient credits. Running bots have been stopped.
    </Alert>
  );
};
