import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "@/store";
import { fileTransferSchema } from "@/lib/schemas";
import type { FileTransfer } from "@/types";
import { TransferStatus } from "@/types";

/**
 * Coerce Zod-parsed transfer data to the canonical FileTransfer type.
 * The Zod schema infers plain string literals for `status` and `undefined`
 * for optional fields, while the store expects `TransferStatus` enum values
 * and `null` for absent fields.
 */
function toFileTransfer(
  data: ReturnType<typeof fileTransferSchema.parse>,
): FileTransfer {
  return {
    ...data,
    status: data.status as TransferStatus,
    file_path: data.file_path ?? null,
    checksum: data.checksum ?? null,
    // Fields not present in the Zod schema get sensible defaults
    error: null,
    speed_bps: 0,
    eta_seconds: null,
  };
}

/**
 * Hook to listen for file transfer events from Tauri backend.
 * Validates transfer data with Zod and updates the app store.
 */
export function useFileTransfers() {
  const { addTransfer, updateTransfer } = useAppStore();

  useEffect(() => {
    // Listen for transfer progress updates
    const unlistenProgress = listen<unknown>("transfer-progress", (event) => {
      const result = fileTransferSchema.safeParse(event.payload);
      if (result.success) {
        const { id, ...rest } = toFileTransfer(result.data);
        updateTransfer(id, rest);
      } else {
        console.error("Invalid transfer progress data:", result.error.errors);
      }
    });

    // Listen for transfer status updates
    const unlistenStatus = listen<unknown>("transfer-status", (event) => {
      const result = fileTransferSchema.safeParse(event.payload);
      if (result.success) {
        const { id, ...rest } = toFileTransfer(result.data);
        updateTransfer(id, rest);
      } else {
        console.error("Invalid transfer status data:", result.error.errors);
      }
    });

    // Listen for new transfers
    const unlistenNew = listen<unknown>("transfer-created", (event) => {
      const result = fileTransferSchema.safeParse(event.payload);
      if (result.success) {
        addTransfer(toFileTransfer(result.data));
      } else {
        console.error("Invalid transfer creation data:", result.error.errors);
      }
    });

    // Listen for transfer completion
    const unlistenComplete = listen<{ transfer_id: string }>(
      "transfer-completed",
      (event) => {
        console.log("Transfer completed:", event.payload.transfer_id);
        updateTransfer(event.payload.transfer_id, {
          status: TransferStatus.Completed,
        });
      },
    );

    // Cleanup listeners on unmount
    return () => {
      unlistenProgress.then((fn) => fn());
      unlistenStatus.then((fn) => fn());
      unlistenNew.then((fn) => fn());
      unlistenComplete.then((fn) => fn());
    };
  }, [addTransfer, updateTransfer]);
}
