import { useState } from 'react';
import { useCreateStrategyMutation } from './strategies.generated';
import { createDefaultFreqtradeConfig } from '../Freqtrade';
import { createDefaultUIBuilderConfig } from '../StrategyBuilder';
import { useActiveOrganization } from '../../contexts/OrganizationContext';
import { StrategyStrategyBuilderMode } from '../../generated/types';
import { StrategyNameDrawer } from './StrategyNameDrawer';
import { DEFAULT_STRATEGY_CODE } from './strategyDefaults';

interface CreateStrategyNameDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (strategyId: string) => void;
}

export const CreateStrategyNameDrawer = ({ open, onClose, onSuccess }: CreateStrategyNameDrawerProps) => {
  const { activeOrganizationId } = useActiveOrganization();
  const [createStrategy, { loading, error }] = useCreateStrategyMutation();
  const [submitError, setSubmitError] = useState<Error | null>(null);

  const handleSubmit = async (name: string, description: string) => {
    if (!activeOrganizationId) {
      setSubmitError(new Error('No active organization'));
      return;
    }

    setSubmitError(null);

    const defaultConfig = createDefaultFreqtradeConfig();
    const defaultUiBuilderConfig = createDefaultUIBuilderConfig();

    const result = await createStrategy({
      variables: {
        input: {
          name,
          description: description || undefined,
          code: DEFAULT_STRATEGY_CODE,
          config: {
            ...defaultConfig,
            ui_builder: defaultUiBuilderConfig,
          },
          builderMode: StrategyStrategyBuilderMode.Ui,
          ownerID: activeOrganizationId,
        },
      },
    });

    if (result.data?.createStrategy) {
      onSuccess(result.data.createStrategy.id);
      onClose();
    }
  };

  return (
    <StrategyNameDrawer
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      loading={loading}
      error={error || submitError}
      mode="create"
    />
  );
};
