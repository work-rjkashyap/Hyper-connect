import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useAppStore } from '@/store';
import { fileTransferSchema } from '@/lib/schemas';

/**
 * Hook to listen for file transfer events from Tauri backend
 * Validates transfer data with Zod and updates the app store
 */
export function useFileTransfers() {
  const { addTransfer, updateTransfer } = useAppStore();

  useEffect(() => {
    // Listen for transfer progress updates
    const unlistenProgress = listen<unknown>('transfer-progress', (event) => {
      const result = fileTransferSchema.safeParse(event.payload);

      if (result.success) {
        updateTransfer(result.data);
      } else {
        console.error('Invalid transfer progress data:', result.error.errors);
      }
    });

    // Listen for transfer status updates
    const unlistenStatus = listen<unknown>('transfer-status', (event) => {
      const result = fileTransferSchema.safeParse(event.payload);

      if (result.success) {
        updateTransfer(result.data);
      } else {
        console.error('Invalid transfer status data:', result.error.errors);
      }
    });

    // Listen for new transfers
    const unlistenNew = listen<unknown>('transfer-created', (event) => {
      const result = fileTransferSchema.safeParse(event.payload);

      if (result.success) {
        addTransfer(result.data);
      } else {
        console.error('Invalid transfer creation data:', result.error.errors);
      }
    });

    // Listen for transfer completion/removal
    const unlistenComplete = listen<{ transfer_id: string }>('transfer-completed', (event) => {
      // Optionally remove completed transfers after a delay
      // For now, just log
      console.log('Transfer completed:', event.payload.transfer_id);
    });

    // Cleanup listeners on unmount
    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenStatus.then((fn) => fn());
      unlistenNew.then((fn) => fn());
      unlistenComplete.then((fn) => fn());
    };
  }, [addTransfer, updateTransfer]);
}
