import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "@/store";
import type {
	FileTransfer,
	TransferProgressEvent,
	TransferCompletedEvent,
	TransferFailedEvent,
	FileCancelledEvent,
	FileRejectedEvent,
	TransferResumedEvent,
} from "@/types";
import { TransferStatus } from "@/types";
import { toast } from "@/hooks/use-toast";

/**
 * Payload emitted by the backend when the receiver accepts a file transfer.
 * The sender receives this so it knows to start streaming data.
 */
interface FileAcceptedEvent {
	transfer_id: string;
}

/**
 * Global hook that listens for ALL file transfer events from the Tauri backend.
 *
 * This hook is mounted once in RootLayout so events are captured regardless of
 * which page the user is on.  The per-chat `useFileTransfer()` hook only
 * exposes action functions (create, start, accept, reject, etc.) — it no
 * longer registers its own event listeners to avoid duplicate handling.
 */
export function useFileTransfers() {
	const { addTransfer, updateTransfer } = useAppStore();

	useEffect(() => {
		let unlistenRequest: (() => void) | undefined;
		let unlistenProgress: (() => void) | undefined;
		let unlistenAccepted: (() => void) | undefined;
		let unlistenCompleted: (() => void) | undefined;
		let unlistenFailed: (() => void) | undefined;
		let unlistenCancelled: (() => void) | undefined;
		let unlistenRejected: (() => void) | undefined;
		let unlistenResumed: (() => void) | undefined;

		const setup = async () => {
			try {
				// ── Incoming file request ────────────────────────────────
				// The Rust backend emits the FileTransfer struct directly
				// as the event payload (not wrapped in { transfer: ... }).
				unlistenRequest = await listen<FileTransfer>(
					"file-request-received",
					(event) => {
						console.log("📥 File request received:", event.payload);
						const transfer = event.payload;
						addTransfer(transfer);

						const devices = useAppStore.getState().devices;
						const sender = devices.find(
							(d) => d.device_id === transfer.from_device_id,
						);
						const senderName =
							sender?.display_name || "Unknown Device";

						toast({
							title: "File Transfer Request",
							description: `${senderName} wants to send ${transfer.filename}`,
							duration: 10000,
						});
					},
				);

				// ── Transfer progress ────────────────────────────────────
				unlistenProgress = await listen<TransferProgressEvent>(
					"transfer-progress",
					(event) => {
						const {
							transfer_id,
							transferred,
							speed_bps,
							eta_seconds,
							compression_ratio,
						} = event.payload;

						updateTransfer(transfer_id, {
							transferred,
							speed_bps,
							eta_seconds,
							status: TransferStatus.InProgress,
							compression_ratio: compression_ratio ?? null,
						});
					},
				);

				// ── File accepted (sender side) ──────────────────────────
				// Receiver accepted our file — sender's backend will start
				// streaming automatically; update the UI status.
				unlistenAccepted = await listen<FileAcceptedEvent>(
					"file-accepted",
					(event) => {
						console.log(
							"✅ File accepted by receiver:",
							event.payload,
						);
						const { transfer_id } = event.payload;

						updateTransfer(transfer_id, {
							status: TransferStatus.InProgress,
						});

						toast({
							title: "Transfer accepted",
							description:
								"Receiver accepted — file transfer starting",
						});
					},
				);

				// ── Transfer completed ────────────────────────────────────
				unlistenCompleted = await listen<TransferCompletedEvent>(
					"transfer-completed",
					(event) => {
						console.log("✅ Transfer completed:", event.payload);
						const { transfer_id, checksum } = event.payload;

						updateTransfer(transfer_id, {
							status: TransferStatus.Completed,
							checksum,
						});

						toast({
							title: "Transfer Complete",
							description: "File transfer finished successfully",
						});
					},
				);

				// ── Transfer failed ──────────────────────────────────────
				unlistenFailed = await listen<TransferFailedEvent>(
					"transfer-failed",
					(event) => {
						console.error("❌ Transfer failed:", event.payload);
						const { transfer_id, error } = event.payload;

						updateTransfer(transfer_id, {
							status: TransferStatus.Failed,
							error,
						});

						toast({
							title: "Transfer Failed",
							description: error,
							variant: "destructive",
						});
					},
				);

				// ── Transfer cancelled ────────────────────────────────────
				unlistenCancelled = await listen<FileCancelledEvent>(
					"file-cancelled",
					(event) => {
						console.log("🛑 Transfer cancelled:", event.payload);
						const { transfer_id } = event.payload;

						updateTransfer(transfer_id, {
							status: TransferStatus.Cancelled,
						});
					},
				);

				// ── Transfer rejected ─────────────────────────────────────
				unlistenRejected = await listen<FileRejectedEvent>(
					"file-rejected",
					(event) => {
						console.log("❌ Transfer rejected:", event.payload);
						const { transfer_id } = event.payload;

						updateTransfer(transfer_id, {
							status: TransferStatus.Rejected,
						});

						toast({
							title: "Transfer Declined",
							description:
								"The receiver declined the file transfer",
						});
					},
				);

				// ── Transfer resumed ──────────────────────────────────────
				unlistenResumed = await listen<TransferResumedEvent>(
					"transfer-resumed",
					(event) => {
						console.log("↻ Transfer resumed:", event.payload);
						const { transfer_id, resume_offset } = event.payload;

						updateTransfer(transfer_id, {
							status: TransferStatus.InProgress,
							transferred: resume_offset,
						});

						toast({
							title: "Transfer Resumed",
							description:
								"File transfer resumed from where it left off",
						});
					},
				);

				console.log("✅ Global file transfer listeners setup complete");
			} catch (error) {
				console.error(
					"Failed to setup file transfer listeners:",
					error,
				);
			}
		};

		setup();

		return () => {
			unlistenRequest?.();
			unlistenProgress?.();
			unlistenAccepted?.();
			unlistenCompleted?.();
			unlistenFailed?.();
			unlistenCancelled?.();
			unlistenRejected?.();
			unlistenResumed?.();
			console.log("🧹 Global file transfer listeners cleaned up");
		};
	}, [addTransfer, updateTransfer]);
}
