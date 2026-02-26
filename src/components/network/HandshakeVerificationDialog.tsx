import { useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	ShieldCheck,
	ShieldX,
	ShieldAlert,
	Loader2,
	Copy,
	Check,
} from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store";
import { useSecureHandshake } from "@/hooks/use-secure-handshake";
import { isVerified, isVerificationPending } from "@/types";
import { useState } from "react";

/**
 * Dialog that displays the SAS (Short Authentication String) verification code
 * during the secure handshake flow. Both peers see the same 6-digit code
 * (formatted as XXX-XXX) and must confirm it matches to complete verification.
 *
 * This component reads `activeVerificationDeviceId` from the Zustand store
 * to determine whether to show itself and which device's verification to display.
 */
export default function HandshakeVerificationDialog() {
	const activeVerificationDeviceId = useAppStore(
		(s) => s.activeVerificationDeviceId,
	);
	const verificationStatuses = useAppStore((s) => s.verificationStatuses);
	const devices = useAppStore((s) => s.devices);

	const { confirmVerification, rejectVerification, dismissVerification } =
		useSecureHandshake();

	const [copied, setCopied] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const [rejecting, setRejecting] = useState(false);

	const isOpen = activeVerificationDeviceId !== null;

	const status = useMemo(() => {
		if (!activeVerificationDeviceId) return null;
		return verificationStatuses[activeVerificationDeviceId] ?? null;
	}, [activeVerificationDeviceId, verificationStatuses]);

	const device = useMemo(() => {
		if (!activeVerificationDeviceId) return null;
		return (
			devices.find((d) => d.device_id === activeVerificationDeviceId) ??
			null
		);
	}, [activeVerificationDeviceId, devices]);

	const displayName =
		status?.display_name || device?.display_name || "Unknown Device";
	const code = status?.verification_code ?? "";
	const state = status?.state ?? "none";

	const isStateVerified = isVerified(state);
	const isStatePending = isVerificationPending(state);
	const isRejected = state === "rejected";
	const isLocalConfirmed = state === "local_confirmed";

	const handleConfirm = useCallback(async () => {
		if (!activeVerificationDeviceId) return;
		setConfirming(true);
		try {
			await confirmVerification(activeVerificationDeviceId);
		} catch (error) {
			console.error("Failed to confirm verification:", error);
		} finally {
			setConfirming(false);
		}
	}, [activeVerificationDeviceId, confirmVerification]);

	const handleReject = useCallback(async () => {
		if (!activeVerificationDeviceId) return;
		setRejecting(true);
		try {
			await rejectVerification(
				activeVerificationDeviceId,
				"Codes do not match",
			);
		} catch (error) {
			console.error("Failed to reject verification:", error);
		} finally {
			setRejecting(false);
		}
	}, [activeVerificationDeviceId, rejectVerification]);

	const handleCopyCode = useCallback(async () => {
		if (!code) return;
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard API may not be available in Tauri webview
			console.warn("Clipboard not available");
		}
	}, [code]);

	const handleOpenChange = useCallback(
		(open: boolean) => {
			if (!open) {
				dismissVerification();
				// Reset local state
				setCopied(false);
				setConfirming(false);
				setRejecting(false);
			}
		},
		[dismissVerification],
	);

	// Determine the icon and color based on state
	const stateConfig = useMemo(() => {
		if (isStateVerified) {
			return {
				icon: ShieldCheck,
				color: "text-emerald-500",
				bgColor: "bg-emerald-500/10",
				borderColor: "border-emerald-500/20",
				label: "Verified",
			};
		}
		if (isRejected) {
			return {
				icon: ShieldX,
				color: "text-red-500",
				bgColor: "bg-red-500/10",
				borderColor: "border-red-500/20",
				label: "Rejected",
			};
		}
		if (isLocalConfirmed) {
			return {
				icon: Loader2,
				color: "text-amber-500",
				bgColor: "bg-amber-500/10",
				borderColor: "border-amber-500/20",
				label: "Waiting for peer…",
			};
		}
		return {
			icon: ShieldAlert,
			color: "text-primary",
			bgColor: "bg-primary/10",
			borderColor: "border-primary/20",
			label: "Verify Connection",
		};
	}, [isStateVerified, isRejected, isLocalConfirmed]);

	const StateIcon = stateConfig.icon;

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader className="text-center sm:text-center">
					<div className="mx-auto mb-4">
						<div
							className={cn(
								"relative inline-flex items-center justify-center w-16 h-16 rounded-2xl border",
								stateConfig.bgColor,
								stateConfig.borderColor,
							)}
						>
							<StateIcon
								className={cn(
									"h-8 w-8",
									stateConfig.color,
									isLocalConfirmed && "animate-spin",
								)}
								strokeWidth={1.5}
							/>
							{isStateVerified && (
								<motion.div
									initial={{ scale: 0 }}
									animate={{ scale: 1 }}
									className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center"
								>
									<Check
										className="h-3.5 w-3.5 text-white"
										strokeWidth={3}
									/>
								</motion.div>
							)}
						</div>
					</div>

					<DialogTitle className="text-lg">
						{isStateVerified
							? "Connection Verified!"
							: isRejected
								? "Verification Failed"
								: "Verify Secure Connection"}
					</DialogTitle>
					<DialogDescription className="text-sm text-muted-foreground mt-1">
						{isStateVerified ? (
							<>
								Your connection with{" "}
								<span className="font-medium text-foreground">
									{displayName}
								</span>{" "}
								is secure and verified.
							</>
						) : isRejected ? (
							<>
								The verification codes did not match. The
								connection to{" "}
								<span className="font-medium text-foreground">
									{displayName}
								</span>{" "}
								may not be secure.
							</>
						) : (
							<>
								Compare this code with the one shown on{" "}
								<span className="font-medium text-foreground">
									{displayName}
								</span>
								. Both devices must see the same code to confirm
								the connection is secure.
							</>
						)}
					</DialogDescription>
				</DialogHeader>

				{/* Verification Code Display */}
				<AnimatePresence mode="wait">
					{code && (
						<motion.div
							key="code"
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -10 }}
							className="my-6"
						>
							<div
								className={cn(
									"relative mx-auto rounded-xl border-2 border-dashed p-6 text-center transition-colors",
									isStateVerified
										? "border-emerald-500/30 bg-emerald-500/5"
										: isRejected
											? "border-red-500/30 bg-red-500/5"
											: "border-border bg-muted/30",
								)}
							>
								<p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
									Security Code
								</p>
								<div className="flex items-center justify-center gap-2">
									<span
										className={cn(
											"font-mono text-4xl font-bold tracking-[0.25em] tabular-nums",
											isStateVerified
												? "text-emerald-500"
												: isRejected
													? "text-red-500"
													: "text-foreground",
										)}
									>
										{code}
									</span>
								</div>

								{/* Copy button */}
								{!isStateVerified && !isRejected && (
									<button
										onClick={handleCopyCode}
										className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
										title="Copy code"
									>
										{copied ? (
											<Check className="h-3.5 w-3.5 text-emerald-500" />
										) : (
											<Copy className="h-3.5 w-3.5" />
										)}
									</button>
								)}

								{/* Status badge */}
								<div className="mt-4 flex justify-center">
									<Badge
										variant="secondary"
										className={cn(
											"text-[10px] h-5 px-2 font-medium rounded-full",
											isStateVerified &&
												"bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
											isRejected &&
												"bg-red-500/10 text-red-600 dark:text-red-400",
											isLocalConfirmed &&
												"bg-amber-500/10 text-amber-600 dark:text-amber-400",
										)}
									>
										{isLocalConfirmed && (
											<Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
										)}
										{stateConfig.label}
									</Badge>
								</div>
							</div>

							{/* Instructions */}
							{isStatePending && !isLocalConfirmed && (
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{ delay: 0.3 }}
									className="mt-4 space-y-2"
								>
									<div className="flex items-start gap-2 text-xs text-muted-foreground">
										<span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
											1
										</span>
										<span>
											Check that the code above matches
											the one displayed on the other
											device.
										</span>
									</div>
									<div className="flex items-start gap-2 text-xs text-muted-foreground">
										<span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
											2
										</span>
										<span>
											If they match, tap{" "}
											<span className="font-medium text-foreground">
												Confirm
											</span>{" "}
											on both devices. If not, tap{" "}
											<span className="font-medium text-foreground">
												Reject
											</span>
											.
										</span>
									</div>
								</motion.div>
							)}
						</motion.div>
					)}
				</AnimatePresence>

				{/* Action Buttons */}
				<DialogFooter className="flex-col gap-2 sm:flex-col">
					{isStatePending && !isLocalConfirmed && (
						<>
							<Button
								onClick={handleConfirm}
								disabled={confirming || rejecting}
								className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
							>
								{confirming ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Confirming…
									</>
								) : (
									<>
										<ShieldCheck className="h-4 w-4 mr-2" />
										Codes Match — Confirm
									</>
								)}
							</Button>
							<Button
								variant="outline"
								onClick={handleReject}
								disabled={confirming || rejecting}
								className="w-full border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-500"
							>
								{rejecting ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										Rejecting…
									</>
								) : (
									<>
										<ShieldX className="h-4 w-4 mr-2" />
										Codes Don&apos;t Match — Reject
									</>
								)}
							</Button>
						</>
					)}

					{isLocalConfirmed && (
						<div className="text-center text-sm text-muted-foreground py-2">
							<Loader2 className="h-4 w-4 inline mr-2 animate-spin" />
							Waiting for{" "}
							<span className="font-medium text-foreground">
								{displayName}
							</span>{" "}
							to confirm…
						</div>
					)}

					{isStateVerified && (
						<Button
							onClick={() => handleOpenChange(false)}
							className="w-full"
						>
							<ShieldCheck className="h-4 w-4 mr-2" />
							Done
						</Button>
					)}

					{isRejected && (
						<Button
							variant="outline"
							onClick={() => handleOpenChange(false)}
							className="w-full"
						>
							Close
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
