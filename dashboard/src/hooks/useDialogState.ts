import { useState, useCallback } from 'react';

export type DialogType = 'create' | 'edit' | 'delete' | 'visibility';

interface DialogState<T> {
  /** Check if a dialog is open */
  isOpen: (type: DialogType) => boolean;
  /** Currently selected item for edit/delete/visibility */
  selected: T | null;
  /** Open a dialog, optionally with a selected item */
  open: (type: DialogType, item?: T) => void;
  /** Close a specific dialog */
  close: (type: DialogType) => void;
  /** Close all dialogs and clear selection */
  closeAll: () => void;
}

/**
 * Hook to manage dialog states for CRUD operations.
 * Replaces multiple useState calls for dialog management.
 *
 * @example
 * const dialog = useDialogState<Bot>();
 *
 * // Open create dialog
 * <Button onClick={() => dialog.open('create')}>Add</Button>
 *
 * // Open edit dialog with selected item
 * <Button onClick={() => dialog.open('edit', bot)}>Edit</Button>
 *
 * // Use in dialogs
 * <CreateDialog open={dialog.isOpen('create')} onClose={() => dialog.close('create')} />
 * <EditDialog open={dialog.isOpen('edit')} item={dialog.selected} onClose={() => dialog.close('edit')} />
 */
export function useDialogState<T>(): DialogState<T> {
  const [openDialogs, setOpenDialogs] = useState<Set<DialogType>>(new Set());
  const [selected, setSelected] = useState<T | null>(null);

  const isOpen = useCallback(
    (type: DialogType): boolean => openDialogs.has(type),
    [openDialogs]
  );

  const open = useCallback((type: DialogType, item?: T) => {
    if (item !== undefined) {
      setSelected(item);
    }
    setOpenDialogs((prev) => new Set(prev).add(type));
  }, []);

  const close = useCallback((type: DialogType) => {
    setOpenDialogs((prev) => {
      const next = new Set(prev);
      next.delete(type);
      return next;
    });
  }, []);

  const closeAll = useCallback(() => {
    setOpenDialogs(new Set());
    setSelected(null);
  }, []);

  return { isOpen, selected, open, close, closeAll };
}