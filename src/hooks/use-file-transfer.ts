import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/store";
import type { FileTransfer, TransferStatus } from "@/types";
import { toast } from "@/hooks/use-toast";

/**
 * Hook that exposes file transfer action functions.
 *
 * Event listeners are handled globally by the `useFileTransfers()` hook
 * (mounted in RootLayout), so this hook only provides imperative actions
 * for creating, starting, accepting, rejecting, pausing, and cancelling
 * file transfers.
 */
export function useFileTransfer() {
	const { addTransfer, updateTransfer, setTransfers, localDeviceId } =
		useAppStore();

	// Load all transfers from the backend
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
					status: "AwaitingAcceptance" as TransferStatus,
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
