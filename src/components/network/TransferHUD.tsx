import { useState, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	TransferStatus,
	formatFileSize,
	formatSpeed,
	formatETA,
} from "@/types";
import type { FileTransfer } from "@/types";
import FileIcon from "lucide-react/dist/esm/icons/file";
import ArrowUpFromLine from "lucide-react/dist/esm/icons/arrow-up-from-line";
import ArrowDownToLine from "lucide-react/dist/esm/icons/arrow-down-to-line";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import X from "lucide-react/dist/esm/icons/x";
import Pause from "lucide-react/dist/esm/icons/pause";
import Play from "lucide-react/dist/esm/icons/play";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import Minimize2 from "lucide-react/dist/esm/icons/minimize-2";
import Zap from "lucide-react/dist/esm/icons/zap";
import EyeOff from "lucide-react/dist/esm/icons/eye-off";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronUp from "lucide-react/dist/esm/icons/chevron-up";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import FolderOpen from "lucide-react/dist/esm/icons/folder-open";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Bell from "lucide-react/dist/esm/icons/bell";
/** Statuses considered "active" — shown in the HUD. */
const ACTIVE_STATUSES = new Set<string>([
	TransferStatus.Pending,
	TransferStatus.InProgress,
	TransferStatus.Paused,
	TransferStatus.AwaitingAcceptance,
]);
/** Statuses that linger briefly after finishing so the user can see the result. */
const RECENT_STATUSES = new Set<string>([
	TransferStatus.Completed,
	TransferStatus.Failed,
	TransferStatus.Cancelled,
	TransferStatus.Rejected,
]);
/** How long (ms) to keep completed/failed transfers visible in the HUD. */
const RECENT_LINGER_MS = 8_000;
/** Check if a transfer is resumable (paused/failed with partial data). */
function isResumable(t: FileTransfer): boolean {
	return (
		(t.status === TransferStatus.Paused ||
			t.status === TransferStatus.Failed) &&
		t.transferred > 0 &&
		t.transferred < t.size
	);
}
function isActive(t: FileTransfer): boolean {
	// Resumable transfers stay visible as "active" so the user can click Resume
	return ACTIVE_STATUSES.has(t.status) || isResumable(t);
}
function isRecent(t: FileTransfer): boolean {
	if (!RECENT_STATUSES.has(t.status)) return false;
	// Resumable transfers are handled by isActive — don't double-count them
	if (isResumable(t)) return false;
	const age = Date.now() - t.updated_at * 1000;
	return age < RECENT_LINGER_MS;
}
function transferProgress(t: FileTransfer): number {
	if (t.size === 0) return 0;
	return Math.round((t.transferred / t.size) * 100);
}
function statusIcon(
	t: FileTransfer,
	localDeviceId: string | null,
): React.ReactNode {
	const isSender = t.from_device_id === localDeviceId;
	switch (t.status as TransferStatus) {
		case TransferStatus.InProgress:
			return isSender ? (
				<ArrowUpFromLine className="h-3.5 w-3.5 text-blue-500 shrink-0" />
			) : (
				<ArrowDownToLine className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
			);
		case TransferStatus.Completed:
			return (
				<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
			);
		case TransferStatus.Failed:
			return (
				<AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
			);
		case TransferStatus.Cancelled:
		case TransferStatus.Rejected:
			return (
				<XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
			);
		case TransferStatus.Paused:
			return <Pause className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
		case TransferStatus.Pending:
		case TransferStatus.AwaitingAcceptance:
			return (
				<Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />
			);
		default:
			return <FileIcon className="h-3.5 w-3.5 shrink-0" />;
	}
}
function statusLabel(t: FileTransfer, localDeviceId: string | null): string {
	const isSender = t.from_device_id === localDeviceId;
	switch (t.status as TransferStatus) {
		case TransferStatus.InProgress:
			return `${transferProgress(t)}%`;
		case TransferStatus.Completed:
			return "Complete";
		case TransferStatus.Failed:
			return "Failed";
		case TransferStatus.Cancelled:
			return "Cancelled";
		case TransferStatus.Rejected:
			return "Rejected";
		case TransferStatus.Paused:
			return "Paused";
		case TransferStatus.AwaitingAcceptance:
			return isSender ? "Awaiting…" : "Incoming";
		case TransferStatus.Pending:
			return isSender ? "Preparing…" : "Incoming";
		default:
			return "";
	}
}
function TransferItem({
	transfer,
	localDeviceId,
	onPause,
	onCancel,
	onAccept,
	onReject,
	onResume,
	onOpenLocation,
}: {
	transfer: FileTransfer;
	localDeviceId: string | null;
	onPause: (id: string) => void;
	onCancel: (id: string) => void;
	onAccept: (id: string) => void;
	onReject: (id: string) => void;
	onResume: (id: string) => void;
	onOpenLocation: (path: string) => void;
}) {
	const progress = transferProgress(transfer);
	const status = transfer.status as TransferStatus;
	const isInProgress = status === TransferStatus.InProgress;
	const isPaused = status === TransferStatus.Paused;
	const isCompleted = status === TransferStatus.Completed;
	const isFailed = status === TransferStatus.Failed;
	const isCancelled = status === TransferStatus.Cancelled;
	const isRejected = status === TransferStatus.Rejected;
	const isPending =
		status === TransferStatus.Pending ||
		status === TransferStatus.AwaitingAcceptance;
	const isSender = transfer.from_device_id === localDeviceId;
	const isReceiver = transfer.to_device_id === localDeviceId;
	const showAcceptReject =
		isReceiver &&
		(status === TransferStatus.Pending ||
			status === TransferStatus.AwaitingAcceptance);
	const canResume =
		isSender &&
		(isPaused || isFailed) &&
		transfer.transferred > 0 &&
		transfer.transferred < transfer.size;
	const isDone = isCompleted || isFailed || isCancelled || isRejected;
	const hasCompression =
		transfer.compression != null &&
		transfer.compression_ratio != null &&
		transfer.compression_ratio > 1.0;
	const isParallel = transfer.parallel_streams > 1;
	return (
		<div
			className={cn(
				"px-3 py-2.5 transition-colors",
				isDone ? "opacity-60" : "hover:bg-accent/30",
				showAcceptReject &&
					"bg-primary/5 border-l-2 border-primary/50",
			)}
		>
			{/* Row 1: icon + filename + status + actions */}
			<div className="flex items-center gap-2 min-w-0">
				{statusIcon(transfer, localDeviceId)}
				<div className="flex-1 min-w-0">
					<Tooltip>
						<TooltipTrigger asChild>
							<p className="text-xs font-medium truncate leading-tight cursor-default">
								{transfer.filename}
							</p>
						</TooltipTrigger>
						<TooltipContent
							side="left"
							className="text-xs max-w-64"
						>
							<p className="break-all">{transfer.filename}</p>
							<p className="text-muted-foreground mt-1">
								{formatFileSize(transfer.size)}
								{hasCompression && (
									<span className="ml-1 text-primary">
										· {transfer.compression}{" "}
										{transfer.compression_ratio!.toFixed(1)}
										x
									</span>
								)}
								{isParallel && (
									<span className="ml-1 text-amber-500">
										· {transfer.parallel_streams} streams
									</span>
								)}
							</p>
						</TooltipContent>
					</Tooltip>
				</div>
				{/* Status text */}
				<span
					className={cn(
						"text-[10px] font-medium tabular-nums shrink-0",
						isInProgress && "text-blue-500",
						isPaused && "text-amber-500",
						isCompleted && "text-emerald-500",
						isFailed && "text-destructive",
						(isCancelled || isRejected) && "text-muted-foreground",
						isPending && "text-primary",
					)}
				>
					{statusLabel(transfer, localDeviceId)}
				</span>
				{/* Inline action buttons (non-accept/reject) */}
				{!showAcceptReject && (
					<div className="flex items-center gap-0.5 shrink-0">
						{isInProgress && (
							<>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6 rounded-md"
											onClick={() => onPause(transfer.id)}
										>
											<Pause className="h-3 w-3" />
										</Button>
									</TooltipTrigger>
									<TooltipContent side="left" className="text-xs">
										Pause
									</TooltipContent>
								</Tooltip>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6 rounded-md text-destructive hover:text-destructive"
											onClick={() => onCancel(transfer.id)}
										>
											<X className="h-3 w-3" />
										</Button>
									</TooltipTrigger>
									<TooltipContent side="left" className="text-xs">
										Cancel
									</TooltipContent>
								</Tooltip>
							</>
						)}
						{isPaused && (
							<>
								{canResume && (
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												className="h-6 w-6 rounded-md text-blue-500 hover:text-blue-600"
												onClick={() => onResume(transfer.id)}
											>
												<Play className="h-3 w-3" />
											</Button>
										</TooltipTrigger>
										<TooltipContent side="left" className="text-xs">
											Resume
										</TooltipContent>
									</Tooltip>
								)}
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6 rounded-md text-destructive hover:text-destructive"
											onClick={() => onCancel(transfer.id)}
										>
											<X className="h-3 w-3" />
										</Button>
									</TooltipTrigger>
									<TooltipContent side="left" className="text-xs">
										Cancel
									</TooltipContent>
								</Tooltip>
							</>
						)}
						{isFailed && canResume && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-6 rounded-md text-blue-500 hover:text-blue-600"
										onClick={() => onResume(transfer.id)}
									>
										<RotateCcw className="h-3 w-3" />
									</Button>
								</TooltipTrigger>
								<TooltipContent side="left" className="text-xs">
									Retry
								</TooltipContent>
							</Tooltip>
						)}
						{isCompleted && transfer.file_path && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-6 rounded-md"
										onClick={() => onOpenLocation(transfer.file_path!)}
									>
										<FolderOpen className="h-3 w-3" />
									</Button>
								</TooltipTrigger>
								<TooltipContent side="left" className="text-xs">
									Open location
								</TooltipContent>
							</Tooltip>
						)}
					</div>
				)}
			</div>
			{/* Incoming transfer: prominent accept / reject row */}
			{showAcceptReject && (
				<div className="mt-2 flex items-center gap-2">
					<p className="flex-1 text-[10px] text-muted-foreground truncate">
						{formatFileSize(transfer.size)}
					</p>
					<Button
						size="sm"
						variant="outline"
						className="h-7 px-3 text-xs text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
						onClick={() => onReject(transfer.id)}
					>
						<X className="h-3 w-3 mr-1" />
						Reject
					</Button>
					<Button
						size="sm"
						className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600"
						onClick={() => onAccept(transfer.id)}
					>
						<ArrowDownToLine className="h-3 w-3 mr-1" />
						Accept
					</Button>
				</div>
			)}
			{/* Progress bar + speed + ETA */}
			{(isInProgress || isPaused) && (
				<div className="mt-2 space-y-1">
					<Progress value={progress} className="h-1.5 rounded-full" />
					<div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
						<span className="flex items-center gap-1">
							{formatFileSize(transfer.transferred)} /{" "}
							{formatFileSize(transfer.size)}
							{isParallel && (
								<Tooltip>
									<TooltipTrigger asChild>
										<span className="inline-flex items-center gap-0.5 px-1 py-px rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium cursor-default">
											<Zap className="h-2.5 w-2.5" />
											{transfer.parallel_streams}×
										</span>
									</TooltipTrigger>
									<TooltipContent side="left" className="text-xs">
										{transfer.parallel_streams} parallel streams
									</TooltipContent>
								</Tooltip>
							)}
							{transfer.compression &&
								transfer.compression_ratio != null &&
								transfer.compression_ratio > 1.0 && (
									<Tooltip>
										<TooltipTrigger asChild>
											<span className="inline-flex items-center gap-0.5 px-1 py-px rounded-full bg-primary/15 text-primary font-medium cursor-default">
												<Minimize2 className="h-2.5 w-2.5" />
												{transfer.compression_ratio.toFixed(1)}x
											</span>
										</TooltipTrigger>
										<TooltipContent side="left" className="text-xs">
											Compressed with {transfer.compression} (
											{transfer.compression_ratio.toFixed(1)}x ratio)
										</TooltipContent>
									</Tooltip>
								)}
						</span>
						<span>
							{isInProgress && transfer.speed_bps > 0
								? `${formatSpeed(transfer.speed_bps)} · ${formatETA(transfer.eta_seconds)}`
								: isPaused
									? "Paused"
									: "Starting…"}
						</span>
					</div>
				</div>
			)}
		</div>
	);
}
/** Three visibility states for the HUD panel */
type HudView = "expanded" | "collapsed" | "hidden";
export default function TransferHUD() {
	const [view, setView] = useState<HudView>("expanded");
	const transfers = useAppStore((s) => s.transfers);
	const localDeviceId = useAppStore((s) => s.localDeviceId);
	const updateTransfer = useAppStore((s) => s.updateTransfer);
	const hudTransfers = useMemo(() => {
		return transfers
			.filter((t) => isActive(t) || isRecent(t))
			.sort((a, b) => {
				const aActive = isActive(a) ? 0 : 1;
				const bActive = isActive(b) ? 0 : 1;
				if (aActive !== bActive) return aActive - bActive;
				return b.updated_at - a.updated_at;
			});
	}, [transfers]);
	const activeCount = useMemo(
		() => hudTransfers.filter(isActive).length,
		[hudTransfers],
	);
	const incomingCount = useMemo(
		() =>
			hudTransfers.filter(
				(t) =>
					t.to_device_id === localDeviceId &&
					(t.status === TransferStatus.Pending ||
						t.status === TransferStatus.AwaitingAcceptance),
			).length,
		[hudTransfers, localDeviceId],
	);
	const totalProgress = useMemo(() => {
		const inProgress = hudTransfers.filter(
			(t) => t.status === TransferStatus.InProgress,
		);
		if (inProgress.length === 0) return null;
		const totalSize = inProgress.reduce((sum, t) => sum + t.size, 0);
		const totalTransferred = inProgress.reduce(
			(sum, t) => sum + t.transferred,
			0,
		);
		return totalSize > 0
			? Math.round((totalTransferred / totalSize) * 100)
			: 0;
	}, [hudTransfers]);
	const handlePause = useCallback(
		async (transferId: string) => {
			try {
				await invoke("pause_transfer", { transferId });
				updateTransfer(transferId, {
					status: TransferStatus.Paused as unknown as TransferStatus,
				});
			} catch (err) {
				console.error("Failed to pause transfer:", err);
			}
		},
		[updateTransfer],
	);
	const handleCancel = useCallback(
		async (transferId: string) => {
			try {
				await invoke("cancel_transfer", { transferId });
				updateTransfer(transferId, {
					status: TransferStatus.Cancelled as unknown as TransferStatus,
				});
			} catch (err) {
				console.error("Failed to cancel transfer:", err);
			}
		},
		[updateTransfer],
	);
	const handleResume = useCallback(
		async (transferId: string) => {
			const transfer = transfers.find((t) => t.id === transferId);
			if (!transfer) return;
			const peerDeviceId = transfer.to_device_id;
			const devices = useAppStore.getState().devices;
			const peer = devices.find((d) => d.device_id === peerDeviceId);
			const peerAddress = peer?.addresses?.[0];
			if (!peerAddress) {
				console.error("Cannot resume: peer not found or no address available");
				return;
			}
			try {
				await invoke("resume_transfer", { transferId, peerAddress });
				updateTransfer(transferId, {
					status: TransferStatus.AwaitingAcceptance as unknown as TransferStatus,
				});
			} catch (err) {
				console.error("Failed to resume transfer:", err);
			}
		},
		[transfers, updateTransfer],
	);
	const handleAccept = useCallback(
		async (transferId: string) => {
			try {
				await invoke("accept_transfer", { transferId });
				updateTransfer(transferId, {
					status: TransferStatus.InProgress as unknown as TransferStatus,
				});
			} catch (err) {
				console.error("Failed to accept transfer:", err);
			}
		},
		[updateTransfer],
	);
	const handleReject = useCallback(
		async (transferId: string) => {
			try {
				await invoke("reject_transfer", { transferId });
				updateTransfer(transferId, {
					status: TransferStatus.Rejected as unknown as TransferStatus,
				});
			} catch (err) {
				console.error("Failed to reject transfer:", err);
			}
		},
		[updateTransfer],
	);
	const handleOpenLocation = useCallback(async (path: string) => {
		try {
			await invoke("open_file_location", { path });
		} catch (err) {
			console.error("Failed to open file location:", err);
		}
	}, []);
	// Auto-restore from hidden when a new incoming transfer arrives
	const prevIncoming = useMemo(() => incomingCount, [incomingCount]);
	if (view === "hidden" && incomingCount > 0 && prevIncoming === 0) {
		setView("expanded");
	}
	if (hudTransfers.length === 0) return null;
	// ── Hidden pill ──────────────────────────────────────────────────────────
	if (view === "hidden") {
		return (
			<TooltipProvider delayDuration={300}>
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={() => setView("expanded")}
							className={cn(
						"fixed top-[13%] right-2 z-50",
						"flex items-center gap-2 px-3 py-2",
						"rounded-full border shadow-lg",
						"bg-card/95 backdrop-blur-sm text-card-foreground",
						"hover:bg-card transition-all duration-200",
						"animate-in slide-in-from-right-4 fade-in duration-300",
								incomingCount > 0 &&
									"ring-2 ring-primary ring-offset-1 ring-offset-background",
							)}
						>
							{incomingCount > 0 ? (
								<Bell className="h-4 w-4 text-primary animate-pulse shrink-0" />
							) : (
								<FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
							)}
							<span className="text-xs font-semibold">
								{incomingCount > 0
									? `${incomingCount} incoming`
									: `${activeCount} transfer${activeCount !== 1 ? "s" : ""}`}
							</span>
							{totalProgress !== null && (
								<>
									<div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
										<div
											className="h-full rounded-full bg-primary transition-all duration-500"
											style={{ width: `${totalProgress}%` }}
										/>
									</div>
									<span className="text-[10px] text-muted-foreground tabular-nums">
										{totalProgress}%
									</span>
								</>
							)}
						</button>
					</TooltipTrigger>
					<TooltipContent side="bottom" className="text-xs">
						Show transfers
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	}
	// ── Full / collapsed panel ────────────────────────────────────────────────
	return (
		<TooltipProvider delayDuration={300}>
			<div
				className={cn(
				"fixed top-[13%] right-2 z-50",
				"w-88 sm:w-96",
				"rounded-2xl border shadow-2xl",
				"bg-card/95 backdrop-blur-sm text-card-foreground",
				"animate-in slide-in-from-right-4 fade-in duration-300",
					"flex flex-col overflow-hidden",
					// Pulse ring when there's an incoming request waiting
					incomingCount > 0 &&
						"ring-2 ring-primary/60 ring-offset-1 ring-offset-background",
				)}
			>
				{/* ── Header ─────────────────────────────────────────────── */}
				<div className="flex items-center gap-2 px-3 py-2.5 bg-muted/40 border-b border-border/50 select-none">
					{/* Left: icon + title */}
					<div
						className="flex flex-1 items-center gap-2 min-w-0 cursor-pointer"
						onClick={() =>
							setView(view === "expanded" ? "collapsed" : "expanded")
						}
					>
						<div className="relative shrink-0">
							<FileIcon className="h-4 w-4 text-primary" />
							{activeCount > 0 && (
								<span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[8px] font-bold leading-none">
									{Math.min(activeCount, 9)}
								</span>
							)}
						</div>
						<span className="text-xs font-semibold tracking-tight">
							Transfers
						</span>
						{view === "collapsed" && totalProgress !== null && (
							<>
								<div className="flex-1 h-1 rounded-full bg-muted overflow-hidden min-w-0">
									<div
										className="h-full rounded-full bg-primary transition-all duration-500"
										style={{ width: `${totalProgress}%` }}
									/>
								</div>
								<span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
									{totalProgress}%
								</span>
							</>
						)}
					</div>
					{/* Right: collapse + hide controls */}
					<div className="flex items-center gap-0.5 shrink-0">
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									onClick={() =>
										setView(
											view === "expanded"
												? "collapsed"
												: "expanded",
										)
									}
									className="flex items-center justify-center h-6 w-6 rounded-md hover:bg-accent/70 transition-colors text-muted-foreground"
								>
									{view === "expanded" ? (
										<ChevronDown className="h-3.5 w-3.5" />
									) : (
										<ChevronUp className="h-3.5 w-3.5" />
									)}
								</button>
							</TooltipTrigger>
							<TooltipContent side="left" className="text-xs">
								{view === "expanded" ? "Collapse" : "Expand"}
							</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									onClick={() => setView("hidden")}
									className="flex items-center justify-center h-6 w-6 rounded-md hover:bg-accent/70 transition-colors text-muted-foreground"
								>
									<EyeOff className="h-3.5 w-3.5" />
								</button>
							</TooltipTrigger>
							<TooltipContent side="left" className="text-xs">
								Hide (minimise to pill)
							</TooltipContent>
						</Tooltip>
					</div>
				</div>
				{/* ── Incoming alert banner ───────────────────────────────── */}
				{incomingCount > 0 && view === "expanded" && (
					<div className="flex items-center gap-2 px-3 py-1.5 bg-primary/8 border-b border-primary/20">
						<Bell className="h-3 w-3 text-primary animate-pulse shrink-0" />
						<span className="text-[11px] font-medium text-primary">
							{incomingCount} incoming transfer
							{incomingCount !== 1 ? "s" : ""} waiting
						</span>
					</div>
				)}
				{/* ── Transfer list ───────────────────────────────────────── */}
				{view === "expanded" && (
					<div className="max-h-72 overflow-y-auto divide-y divide-border/50">
						{hudTransfers.map((transfer) => (
							<TransferItem
								key={transfer.id}
								transfer={transfer}
								localDeviceId={localDeviceId}
								onPause={handlePause}
								onCancel={handleCancel}
								onAccept={handleAccept}
								onReject={handleReject}
								onResume={handleResume}
								onOpenLocation={handleOpenLocation}
							/>
						))}
					</div>
				)}
				{/* ── Footer summary ──────────────────────────────────────── */}
				{view === "expanded" && activeCount > 0 && (
					<div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border-t border-border/50 text-[10px] text-muted-foreground">
						<span>
							{activeCount} active transfer
							{activeCount !== 1 ? "s" : ""}
						</span>
						{totalProgress !== null && (
							<span className="tabular-nums font-medium">
								Overall&nbsp;{totalProgress}%
							</span>
						)}
					</div>
				)}
			</div>
		</TooltipProvider>
	);
}
