import { useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/store";
import type {
  FileTransfer,
  TransferStatus,
  FileRequestReceivedEvent,
  TransferProgressEvent,
  TransferCompletedEvent,
  TransferFailedEvent,
  FileCancelledEvent,
  FileRejectedEvent,
} from "@/types";
import { toast } from "@/hooks/use-toast";

/**
 * Hook to manage file transfer operations and listen for transfer events
 */
export function useFileTransfer() {
  const {
    addTransfer,
    updateTransfer,
    setTransfers,
    devices,
    localDeviceId,
    isOnboarded,
  } = useAppStore();

  const getDeviceName = useCallback(
    (deviceId: string): string => {
      const device = devices.find((d) => d.device_id === deviceId);
      return device?.display_name || "Unknown Device";
    },
    [devices],
  );

  // Load all transfers
  const loadTransfers = useCallback(async () => {
    try {
      const transfers = await invoke<FileTransfer[]>("get_transfers");
      setTransfers(transfers);
      console.log(`📦 Loaded ${transfers.length} transfers`);
      return transfers;
    } catch (error) {
      console.error("Failed to load transfers:", error);
      return [];
    }
  }, [setTransfers]);

  // Create a new file transfer (filePath must be provided by UI file picker)
  const createTransfer = useCallback(
    async (toDeviceId: string, filePath: string) => {
      if (!localDeviceId) {
        console.error("Cannot create transfer: no local device ID");
        return null;
      }

      if (!filePath) {
        console.error("File path is required");
        return null;
      }

      try {
        // Extract filename from path
        const filename = filePath.split(/[\\/]/).pop() || "unknown";

        console.log(`📤 Creating transfer for: ${filename}`);

        const transfer = await invoke<FileTransfer>("create_transfer", {
          filename,
          filePath,
          fromDeviceId: localDeviceId,
          toDeviceId,
        });

        console.log("📦 Transfer created:", transfer);
        addTransfer(transfer);

        return transfer;
      } catch (error) {
        console.error("Failed to create transfer:", error);
        toast({
          title: "Failed to create transfer",
          description: String(error),
          variant: "destructive",
        });
        return null;
      }
    },
    [localDeviceId, addTransfer],
  );

  // Start a transfer (actually send the file)
  const startTransfer = useCallback(
    async (transferId: string, peerAddress: string) => {
      try {
        await invoke("start_transfer", {
          transferId,
          peerAddress,
        });

        console.log(`🚀 Transfer started: ${transferId}`);

        updateTransfer(transferId, {
          status: "InProgress" as TransferStatus,
        });
      } catch (error) {
        console.error("Failed to start transfer:", error);
        toast({
          title: "Failed to start transfer",
          description: String(error),
          variant: "destructive",
        });
      }
    },
    [updateTransfer],
  );

  // Accept an incoming transfer
  const acceptTransfer = useCallback(
    async (transferId: string) => {
      try {
        await invoke("accept_transfer", { transferId });
        console.log(`✅ Transfer accepted: ${transferId}`);

        updateTransfer(transferId, {
          status: "InProgress" as TransferStatus,
        });

        toast({
          title: "Transfer accepted",
          description: "File transfer started",
        });
      } catch (error) {
        console.error("Failed to accept transfer:", error);
        toast({
          title: "Failed to accept transfer",
          description: String(error),
          variant: "destructive",
        });
      }
    },
    [updateTransfer],
  );

  // Reject an incoming transfer
  const rejectTransfer = useCallback(
    async (transferId: string) => {
      try {
        await invoke("reject_transfer", { transferId });
        console.log(`❌ Transfer rejected: ${transferId}`);

        updateTransfer(transferId, {
          status: "Rejected" as TransferStatus,
        });

        toast({
          title: "Transfer rejected",
          description: "File transfer declined",
        });
      } catch (error) {
        console.error("Failed to reject transfer:", error);
        toast({
          title: "Failed to reject transfer",
          description: String(error),
          variant: "destructive",
        });
      }
    },
    [updateTransfer],
  );

  // Pause a transfer
  const pauseTransfer = useCallback(
    async (transferId: string) => {
      try {
        await invoke("pause_transfer", { transferId });
        console.log(`⏸️ Transfer paused: ${transferId}`);

        updateTransfer(transferId, {
          status: "Paused" as TransferStatus,
        });
      } catch (error) {
        console.error("Failed to pause transfer:", error);
        toast({
          title: "Failed to pause transfer",
          description: String(error),
          variant: "destructive",
        });
      }
    },
    [updateTransfer],
  );

  // Cancel a transfer
  const cancelTransfer = useCallback(
    async (transferId: string) => {
      try {
        await invoke("cancel_transfer", { transferId });
        console.log(`🛑 Transfer cancelled: ${transferId}`);

        updateTransfer(transferId, {
          status: "Cancelled" as TransferStatus,
        });

        toast({
          title: "Transfer cancelled",
          description: "File transfer stopped",
        });
      } catch (error) {
        console.error("Failed to cancel transfer:", error);
        toast({
          title: "Failed to cancel transfer",
          description: String(error),
          variant: "destructive",
        });
      }
    },
    [updateTransfer],
  );

  // Listen for file transfer events
  useEffect(() => {
    if (!isOnboarded || !localDeviceId) {
      console.log(
        "⏸️ Skipping file transfer setup - not onboarded or no identity",
      );
      return;
    }

    let unlistenRequest: (() => void) | undefined;
    let unlistenProgress: (() => void) | undefined;
    let unlistenCompleted: (() => void) | undefined;
    let unlistenFailed: (() => void) | undefined;
    let unlistenCancelled: (() => void) | undefined;
    let unlistenRejected: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        // Listen for incoming file transfer requests
        unlistenRequest = await listen<FileRequestReceivedEvent>(
          "file-request-received",
          (event) => {
            console.log("📥 File request received:", event.payload);
            const transfer = event.payload.transfer;
            addTransfer(transfer);

            const senderName = getDeviceName(transfer.from_device_id);
            toast({
              title: "File Transfer Request",
              description: `${senderName} wants to send ${transfer.filename}`,
              duration: 10000,
            });
          },
        );

        // Listen for transfer progress updates
        unlistenProgress = await listen<TransferProgressEvent>(
          "transfer-progress",
          (event) => {
            const { transfer_id, transferred, speed_bps, eta_seconds } =
              event.payload;

            updateTransfer(transfer_id, {
              transferred,
              speed_bps,
              eta_seconds,
              status: "InProgress" as TransferStatus,
            });
          },
        );

        // Listen for transfer completion
        unlistenCompleted = await listen<TransferCompletedEvent>(
          "transfer-completed",
          (event) => {
            console.log("✅ Transfer completed:", event.payload);
            const { transfer_id, checksum } = event.payload;

            updateTransfer(transfer_id, {
              status: "Completed" as TransferStatus,
              checksum,
              transferred: 100,
            });

            toast({
              title: "Transfer Complete",
              description: "File transfer finished successfully",
            });
          },
        );

        // Listen for transfer failures
        unlistenFailed = await listen<TransferFailedEvent>(
          "transfer-failed",
          (event) => {
            console.error("❌ Transfer failed:", event.payload);
            const { transfer_id, error } = event.payload;

            updateTransfer(transfer_id, {
              status: "Failed" as TransferStatus,
              error,
            });

            toast({
              title: "Transfer Failed",
              description: error,
              variant: "destructive",
            });
          },
        );

        // Listen for transfer cancellations
        unlistenCancelled = await listen<FileCancelledEvent>(
          "file-cancelled",
          (event) => {
            console.log("🛑 Transfer cancelled:", event.payload);
            const { transfer_id } = event.payload;

            updateTransfer(transfer_id, {
              status: "Cancelled" as TransferStatus,
            });
          },
        );

        // Listen for transfer rejections
        unlistenRejected = await listen<FileRejectedEvent>(
          "file-rejected",
          (event) => {
            console.log("❌ Transfer rejected:", event.payload);
            const { transfer_id } = event.payload;

            updateTransfer(transfer_id, {
              status: "Rejected" as TransferStatus,
            });
          },
        );

        console.log("✅ File transfer listeners setup complete");
      } catch (error) {
        console.error("Failed to setup file transfer listeners:", error);
      }
    };

    setupListeners();

    return () => {
      if (unlistenRequest) unlistenRequest();
      if (unlistenProgress) unlistenProgress();
      if (unlistenCompleted) unlistenCompleted();
      if (unlistenFailed) unlistenFailed();
      if (unlistenCancelled) unlistenCancelled();
      if (unlistenRejected) unlistenRejected();
      console.log("🧹 File transfer listeners cleaned up");
    };
  }, [isOnboarded, localDeviceId, addTransfer, updateTransfer, getDeviceName]);

  return {
    createTransfer,
    startTransfer,
    acceptTransfer,
    rejectTransfer,
    pauseTransfer,
    cancelTransfer,
    loadTransfers,
  };
}
