import { useUpdateStrategyMutation } from './strategies.generated';
import { StrategyNameDrawer } from './StrategyNameDrawer';

interface RenameStrategyDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (newName: string, newDescription: string) => void;
  strategyId: string;
  currentName: string;
  currentDescription: string;
}

export const RenameStrategyDrawer = ({
  open,
  onClose,
  onSuccess,
  strategyId,
  currentName,
  currentDescription,
}: RenameStrategyDrawerProps) => {
  const [updateStrategy, { loading, error }] = useUpdateStrategyMutation();

  const handleSubmit = async (name: string, description: string) => {
    const result = await updateStrategy({
      variables: {
        id: strategyId,
        input: {
          name,
          description: description || undefined,
        },
      },
    });

    if (result.data?.updateStrategy) {
      onSuccess(name, description);
      onClose();
    }
  };

  return (
    <StrategyNameDrawer
      open={open}
      onClose={onClose}
      initialName={currentName}
      initialDescription={currentDescription}
      onSubmit={handleSubmit}
      loading={loading}
      error={error}
      mode="rename"
    />
  );
};
