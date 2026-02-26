import { useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/store";
import type {
	VerificationCodeReadyEvent,
	HandshakeVerifiedEvent,
	HandshakeRejectedEvent,
	VerificationRemoteConfirmedEvent,
	VerificationStatus,
} from "@/types";

/**
 * Hook to manage the SAS (Short Authentication String) secure handshake flow.
 *
 * Responsibilities:
 * 1. Listen for Tauri events related to SAS verification lifecycle.
 * 2. Update the Zustand store with verification state changes.
 * 3. Expose imperative methods to initiate, confirm, and reject verification.
 *
 * ## Event Flow
 *
 * **Initiator side:**
 * 1. User calls `initiateVerification(deviceId)`.
 * 2. Backend derives SAS code, sends `SasVerifyRequest` to peer, emits
 *    `verification-code-ready` locally.
 * 3. Hook updates store → UI shows verification dialog with code.
 * 4. User confirms → `confirmVerification(deviceId)` → backend sends `SasConfirm`.
 * 5. When both sides confirm, backend emits `handshake-verified`.
 *
 * **Receiver side:**
 * 1. Backend receives `SasVerifyRequest`, derives same SAS code.
 * 2. Backend emits `verification-code-ready` (initiated_by_us = false).
 * 3. Hook updates store → UI shows verification dialog with code.
 * 4. Same confirm/reject flow as initiator.
 */
export function useSecureHandshake() {
	const {
		setVerificationStatus,
		markDeviceVerified,
		setActiveVerificationDeviceId,
		updateVerificationState,
		isOnboarded,
	} = useAppStore();

	useEffect(() => {
		if (!isOnboarded) return;

		let unlistenCodeReady: (() => void) | undefined;
		let unlistenVerified: (() => void) | undefined;
		let unlistenRejected: (() => void) | undefined;
		let unlistenRemoteConfirmed: (() => void) | undefined;

		const setup = async () => {
			try {
				// ── verification-code-ready ─────────────────────────────────
				// Emitted when the SAS code has been derived and is ready to
				// display to the user. Fired on both initiator and receiver.
				unlistenCodeReady = await listen<VerificationCodeReadyEvent>(
					"verification-code-ready",
					(event) => {
						const {
							device_id,
							display_name,
							verification_code,
							initiated_by_us,
						} = event.payload;

						console.log(
							`🔑 Verification code ready for ${device_id}: ${verification_code} (initiated_by_us: ${initiated_by_us})`,
						);

						// Update store with the pending verification status.
						setVerificationStatus(device_id, {
							device_id,
							display_name,
							state: "pending_confirmation",
							verification_code,
							initiated_at: Date.now(),
						});

						// Open the verification dialog for this device.
						setActiveVerificationDeviceId(device_id);
					},
				);

				// ── handshake-verified ──────────────────────────────────────
				// Emitted when both sides have confirmed the SAS code.
				unlistenVerified = await listen<HandshakeVerifiedEvent>(
					"handshake-verified",
					(event) => {
						const { device_id, verification_code } = event.payload;

						console.log(
							`✅ Handshake verified with ${device_id} (code: ${verification_code})`,
						);

						updateVerificationState(device_id, "verified");
						markDeviceVerified(device_id);

						// Close the dialog after a short delay so the user
						// sees the "Verified!" confirmation.
						setTimeout(() => {
							const store = useAppStore.getState();
							if (
								store.activeVerificationDeviceId === device_id
							) {
								setActiveVerificationDeviceId(null);
							}
						}, 2000);
					},
				);

				// ── handshake-rejected ──────────────────────────────────────
				// Emitted when either side rejects the SAS code.
				unlistenRejected = await listen<HandshakeRejectedEvent>(
					"handshake-rejected",
					(event) => {
						const { device_id, rejected_by, reason } =
							event.payload;

						console.log(
							`❌ Handshake rejected for ${device_id} by ${rejected_by} (reason: ${reason})`,
						);

						updateVerificationState(device_id, "rejected");

						// Close the dialog after a short delay.
						setTimeout(() => {
							const store = useAppStore.getState();
							if (
								store.activeVerificationDeviceId === device_id
							) {
								setActiveVerificationDeviceId(null);
							}
						}, 3000);
					},
				);

				// ── verification-remote-confirmed ───────────────────────────
				// Emitted when the remote side confirmed but local hasn't yet.
				unlistenRemoteConfirmed =
					await listen<VerificationRemoteConfirmedEvent>(
						"verification-remote-confirmed",
						(event) => {
							const { device_id } = event.payload;

							console.log(
								`🔑 Remote side confirmed verification for ${device_id} — waiting for local confirmation`,
							);

							// The state stays "pending_confirmation" in the
							// store; the UI can optionally show a hint that
							// the peer has already confirmed.
						},
					);
			} catch (error) {
				console.error(
					"Failed to set up secure handshake listeners:",
					error,
				);
			}
		};

		setup();

		return () => {
			unlistenCodeReady?.();
			unlistenVerified?.();
			unlistenRejected?.();
			unlistenRemoteConfirmed?.();
			console.log("🧹 Secure handshake listeners cleaned up");
		};
	}, [
		isOnboarded,
		setVerificationStatus,
		markDeviceVerified,
		setActiveVerificationDeviceId,
		updateVerificationState,
	]);

	/**
	 * Initiate SAS verification with a peer device.
	 *
	 * Ensures a TCP connection exists (ECDH happens automatically),
	 * derives the SAS code, sends a verify request to the peer, and
	 * emits `verification-code-ready` to the local frontend.
	 *
	 * @returns The formatted verification code (e.g. "482-991").
	 */
	const initiateVerification = useCallback(
		async (deviceId: string): Promise<string> => {
			try {
				const code = await invoke<string>("initiate_verification", {
					deviceId,
				});
				console.log(
					`🔑 Initiated verification with ${deviceId}: ${code}`,
				);
				return code;
			} catch (error) {
				console.error(
					`Failed to initiate verification with ${deviceId}:`,
					error,
				);
				throw error;
			}
		},
		[],
	);

	/**
	 * Confirm that the SAS verification code matches what the peer is showing.
	 *
	 * Sends a `SasConfirm` frame to the peer. If both sides have confirmed,
	 * the `handshake-verified` event will be emitted automatically.
	 *
	 * @returns The new verification state as a JSON string.
	 */
	const confirmVerification = useCallback(
		async (deviceId: string): Promise<string> => {
			try {
				updateVerificationState(deviceId, "local_confirmed");

				const stateStr = await invoke<string>(
					"confirm_verification",
					{ deviceId },
				);
				console.log(
					`✓ Confirmed verification for ${deviceId}: ${stateStr}`,
				);
				return stateStr;
			} catch (error) {
				console.error(
					`Failed to confirm verification for ${deviceId}:`,
					error,
				);
				throw error;
			}
		},
		[updateVerificationState],
	);

	/**
	 * Reject the SAS verification code (it doesn't match what the peer shows).
	 *
	 * Sends a `SasReject` frame to the peer and emits `handshake-rejected`.
	 */
	const rejectVerification = useCallback(
		async (deviceId: string, reason?: string): Promise<void> => {
			try {
				await invoke("reject_verification", {
					deviceId,
					reason: reason ?? null,
				});
				console.log(`❌ Rejected verification for ${deviceId}`);
			} catch (error) {
				console.error(
					`Failed to reject verification for ${deviceId}:`,
					error,
				);
				throw error;
			}
		},
		[],
	);

	/**
	 * Get the current verification status for a specific peer device.
	 */
	const getVerificationStatus = useCallback(
		async (deviceId: string): Promise<VerificationStatus> => {
			return invoke<VerificationStatus>("get_verification_status", {
				deviceId,
			});
		},
		[],
	);

	/**
	 * Get the list of all device IDs that have been successfully SAS-verified.
	 */
	const getVerifiedDevices = useCallback(async (): Promise<string[]> => {
		return invoke<string[]>("get_verified_devices");
	}, []);

	/**
	 * Revoke SAS verification for a peer device (user no longer trusts them).
	 */
	const revokeVerification = useCallback(
		async (deviceId: string): Promise<void> => {
			await invoke("revoke_verification", { deviceId });
			const store = useAppStore.getState();
			store.revokeDeviceVerification(deviceId);
			console.log(`🔓 Revoked verification for ${deviceId}`);
		},
		[],
	);

	/**
	 * Dismiss the verification dialog without confirming or rejecting.
	 * The pending verification remains in state for later.
	 */
	const dismissVerification = useCallback(() => {
		setActiveVerificationDeviceId(null);
	}, [setActiveVerificationDeviceId]);

	return {
		initiateVerification,
		confirmVerification,
		rejectVerification,
		getVerificationStatus,
		getVerifiedDevices,
		revokeVerification,
		dismissVerification,
	};
}
