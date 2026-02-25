import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Clock from "lucide-react/dist/esm/icons/clock";
import FileIcon from "lucide-react/dist/esm/icons/file";
import Download from "lucide-react/dist/esm/icons/download";
import Upload from "lucide-react/dist/esm/icons/upload";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import FolderOpen from "lucide-react/dist/esm/icons/folder-open";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Pause from "lucide-react/dist/esm/icons/pause";
import X from "lucide-react/dist/esm/icons/x";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Check from "lucide-react/dist/esm/icons/check";
import CheckCheck from "lucide-react/dist/esm/icons/check-check";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
	TransferStatus,
	formatFileSize,
	formatSpeed,
	formatETA,
} from "@/types";
import type { FileTransfer } from "@/types";

function MessageStatusIcon({
	status,
}: {
	status: "queued" | "sent" | "delivered" | "read";
}) {
	if (status === "queued") {
		return (
			<Clock
				className="h-3 w-3 shrink-0 opacity-60"
				aria-label="Queued — will send when device is online"
			/>
		);
	}
	if (status === "read") {
		return (
			<CheckCheck
				className="h-3 w-3 shrink-0"
				style={{ color: "#60a5fa" }}
				aria-label="Read"
			/>
		);
	}
	if (status === "delivered") {
		return (
			<CheckCheck
				className="h-3 w-3 shrink-0 opacity-60"
				aria-label="Delivered"
			/>
		);
	}
	return <Check className="h-3 w-3 shrink-0 opacity-60" aria-label="Sent" />;
}

/** Maps a file extension to a user-friendly category label. */
function getFileCategory(filename: string): string {
	const ext = filename.split(".").pop()?.toLowerCase() || "";
	const imageExts = [
		"png",
		"jpg",
		"jpeg",
		"gif",
		"webp",
		"bmp",
		"svg",
		"tiff",
		"ico",
	];
	const videoExts = ["mp4", "mov", "avi", "mkv", "webm", "flv", "wmv"];
	const audioExts = ["mp3", "wav", "ogg", "flac", "aac", "m4a", "wma"];
	const docExts = [
		"pdf",
		"doc",
		"docx",
		"xls",
		"xlsx",
		"ppt",
		"pptx",
		"txt",
		"rtf",
		"odt",
	];
	const archiveExts = ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"];

	if (imageExts.includes(ext)) return "Image";
	if (videoExts.includes(ext)) return "Video";
	if (audioExts.includes(ext)) return "Audio";
	if (docExts.includes(ext)) return "Document";
	if (archiveExts.includes(ext)) return "Archive";
	return "File";
}

export interface FileMessageBubbleProps {
	/** The file transfer record. */
	transfer: FileTransfer;
	/** Whether this message was sent by the local user ("me") or received ("them"). */
	sender: "me" | "them";
	/** Display timestamp string (e.g. "2:34 PM") */
	timestamp: string;
	/** Message delivery status. */
	messageStatus?: "queued" | "sent" | "delivered" | "read";
	/** Recipient display name (shown for "them" avatar). */
	recipientName?: string;
	/** Recipient avatar URL. */
	recipientAvatar?: string;
	/** Animation delay in ms. */
	animationDelay?: number;
	/** Called when the user clicks "Accept". */
	onAccept?: (transferId: string) => void;
	/** Called when the user clicks "Reject". */
	onReject?: (transferId: string) => void;
	/** Called when the user clicks "Cancel". */
	onCancel?: (transferId: string) => void;
	/** Called when the user clicks "Pause". */
	onPause?: (transferId: string) => void;
}

export default function FileMessageBubble({
	transfer,
	sender,
	timestamp,
	messageStatus = "sent",
	recipientName = "User",
	recipientAvatar,
	animationDelay = 0,
	onAccept,
	onReject,
	onCancel,
	onPause,
}: FileMessageBubbleProps) {
	const [isOpening, setIsOpening] = useState(false);

	const status = transfer.status as TransferStatus;
	const progress =
		transfer.size > 0
			? Math.round((transfer.transferred / transfer.size) * 100)
			: 0;

	const isAwaitingAcceptance = status === TransferStatus.AwaitingAcceptance;
	const isPending = status === TransferStatus.Pending || isAwaitingAcceptance;
	const isInProgress = status === TransferStatus.InProgress;
	const isCompleted = status === TransferStatus.Completed;
	const isFailed = status === TransferStatus.Failed;
	const isCancelled = status === TransferStatus.Cancelled;
	const isRejected = status === TransferStatus.Rejected;
	const isPaused = status === TransferStatus.Paused;

	const isReceiver = sender === "them";
	const showAcceptReject = isReceiver && isPending;
	const showProgress = isInProgress || isPaused;
	const showOpenFile = isCompleted && transfer.file_path;

	const fileCategory = getFileCategory(transfer.filename);

	const handleOpenLocation = async () => {
		if (!transfer.file_path) return;
		setIsOpening(true);
		try {
			await invoke("open_file_location", { path: transfer.file_path });
		} catch (err) {
			console.error("Failed to open file location:", err);
		} finally {
			setIsOpening(false);
		}
	};

	// Status-dependent color accents
	const statusColor = (() => {
		if (isCompleted) return "text-emerald-500";
		if (isFailed || isRejected) return "text-destructive";
		if (isCancelled) return "text-muted-foreground";
		if (isInProgress) return "text-blue-500";
		if (isPaused) return "text-amber-500";
		return "text-primary";
	})();

	const statusLabel = (() => {
		if (isCompleted) return "Completed";
		if (isFailed) return transfer.error || "Failed";
		if (isRejected) return "Rejected";
		if (isCancelled) return "Cancelled";
		if (isPaused) return "Paused";
		if (isInProgress) return `${progress}%`;
		if (isPending && isReceiver) return "Awaiting your response";
		if (isAwaitingAcceptance && !isReceiver)
			return "Waiting for acceptance…";
		if (isPending && !isReceiver) return "Sending…";
		return "";
	})();

	return (
		<div
			className={cn(
				"flex w-full max-w-[85%] sm:max-w-[75%] items-end gap-1.5 sm:gap-2",
				"animate-in slide-in-from-bottom-2 fade-in duration-300",
				sender === "me" ? "ml-auto flex-row-reverse" : "",
			)}
			style={{
				animationDelay: `${animationDelay}ms`,
				animationFillMode: "both",
			}}
		>
			{/* Avatar — only for the other person */}
			{sender === "them" && (
				<Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 shadow-sm transition-transform hover:scale-105">
					<AvatarImage src={recipientAvatar} alt={recipientName} />
					<AvatarFallback className="text-[10px]">
						{recipientName.substring(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
			)}

			<div
				className={cn(
					"relative rounded-2xl shadow-sm transition-all hover:shadow-md w-full max-w-xs sm:max-w-sm",
					sender === "me"
						? "bg-primary text-primary-foreground rounded-br-none"
						: "bg-secondary text-secondary-foreground rounded-bl-none",
				)}
			>
				{/* ── File info header ─────────────────────────────────────── */}
				<div className="flex items-start gap-3 px-3 sm:px-4 pt-2.5 sm:pt-3 pb-1">
					<div
						className={cn(
							"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
							sender === "me"
								? "bg-primary-foreground/15"
								: "bg-primary/10",
						)}
					>
						{isInProgress ? (
							sender === "me" ? (
								<Upload className="h-5 w-5" />
							) : (
								<Download className="h-5 w-5 text-primary" />
							)
						) : isCompleted ? (
							<CheckCircle2
								className={cn(
									"h-5 w-5",
									sender === "me"
										? "text-primary-foreground"
										: "text-emerald-500",
								)}
							/>
						) : isFailed || isRejected ? (
							<AlertCircle
								className={cn(
									"h-5 w-5",
									sender === "me"
										? "text-primary-foreground"
										: "text-destructive",
								)}
							/>
						) : (
							<FileIcon
								className={cn(
									"h-5 w-5",
									sender === "me"
										? "text-primary-foreground"
										: "text-primary",
								)}
							/>
						)}
					</div>

					<div className="flex-1 min-w-0">
						<p className="text-xs sm:text-sm font-semibold leading-tight truncate">
							{transfer.filename}
						</p>
						<div className="flex items-center gap-1.5 mt-0.5">
							<span
								className={cn(
									"text-[10px] sm:text-xs",
									sender === "me"
										? "text-primary-foreground/70"
										: "text-muted-foreground",
								)}
							>
								{formatFileSize(transfer.size)}
							</span>
							<span
								className={cn(
									"text-[10px]",
									sender === "me"
										? "text-primary-foreground/40"
										: "text-muted-foreground/40",
								)}
							>
								·
							</span>
							<span
								className={cn(
									"text-[10px] sm:text-xs",
									sender === "me"
										? "text-primary-foreground/70"
										: "text-muted-foreground",
								)}
							>
								{fileCategory}
							</span>
						</div>
					</div>
				</div>

				{/* ── Progress bar ─────────────────────────────────────────── */}
				{showProgress && (
					<div className="px-3 sm:px-4 pt-1.5 pb-1 space-y-1">
						<Progress
							value={progress}
							className={cn(
								"h-1.5",
								sender === "me"
									? "[&>div]:bg-primary-foreground/80"
									: "",
							)}
						/>
						<div className="flex items-center justify-between">
							<span
								className={cn(
									"text-[10px]",
									sender === "me"
										? "text-primary-foreground/60"
										: "text-muted-foreground",
								)}
							>
								{transfer.speed_bps > 0
									? formatSpeed(transfer.speed_bps)
									: isPaused
										? "Paused"
										: "Calculating…"}
							</span>
							<span
								className={cn(
									"text-[10px]",
									sender === "me"
										? "text-primary-foreground/60"
										: "text-muted-foreground",
								)}
							>
								{isPaused
									? `${progress}%`
									: transfer.eta_seconds != null
										? formatETA(transfer.eta_seconds)
										: `${progress}%`}
							</span>
						</div>

						{/* Pause / Cancel controls */}
						{sender === "me" && (
							<div className="flex items-center gap-1 pt-0.5">
								{onPause && isInProgress && (
									<Button
										variant="ghost"
										size="sm"
										className="h-6 px-2 text-[10px] text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
										onClick={() => onPause(transfer.id)}
									>
										<Pause className="h-3 w-3 mr-1" />
										Pause
									</Button>
								)}
								{onCancel && (
									<Button
										variant="ghost"
										size="sm"
										className="h-6 px-2 text-[10px] text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
										onClick={() => onCancel(transfer.id)}
									>
										<X className="h-3 w-3 mr-1" />
										Cancel
									</Button>
								)}
							</div>
						)}
					</div>
				)}

				{/* ── Status label for non-progress states ─────────────────── */}
				{!showProgress && !showAcceptReject && statusLabel && (
					<div className="px-3 sm:px-4 pt-0.5 pb-0.5">
						<span
							className={cn(
								"text-[10px] sm:text-xs font-medium flex items-center gap-1",
								sender === "me"
									? isCompleted
										? "text-primary-foreground/80"
										: isFailed || isRejected
											? "text-primary-foreground/70"
											: "text-primary-foreground/60"
									: statusColor,
							)}
						>
							{isCompleted && (
								<CheckCircle2 className="h-3 w-3" />
							)}
							{(isFailed || isRejected) && (
								<XCircle className="h-3 w-3" />
							)}
							{isPending && !isReceiver && (
								<Loader2 className="h-3 w-3 animate-spin" />
							)}
							{statusLabel}
						</span>
					</div>
				)}

				{/* ── Accept / Reject buttons for receiver ──────────────────── */}
				{showAcceptReject && (
					<div className="flex items-center gap-2 px-3 sm:px-4 pt-2 pb-1">
						{onAccept && (
							<Button
								size="sm"
								className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded-lg px-3"
								onClick={() => onAccept(transfer.id)}
							>
								<Download className="h-3 w-3" />
								Accept
							</Button>
						)}
						{onReject && (
							<Button
								size="sm"
								variant="outline"
								className="h-7 gap-1 border-destructive/30 text-destructive hover:bg-destructive/10 text-[11px] font-semibold rounded-lg px-3"
								onClick={() => onReject(transfer.id)}
							>
								<XCircle className="h-3 w-3" />
								Reject
							</Button>
						)}
					</div>
				)}

				{/* ── Open file / folder (completed transfers) ──────────────── */}
				{showOpenFile && (
					<div className="flex items-center gap-1.5 px-3 sm:px-4 pt-1 pb-1">
						<Button
							size="sm"
							variant="ghost"
							className={cn(
								"h-7 gap-1 text-[11px] font-medium rounded-lg px-2.5",
								sender === "me"
									? "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
									: "text-primary hover:bg-primary/10",
							)}
							onClick={handleOpenLocation}
							disabled={isOpening}
						>
							{isOpening ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								<FolderOpen className="h-3 w-3" />
							)}
							Open Location
						</Button>
					</div>
				)}

				{/* ── Timestamp + status ─────────────────────────────────────── */}
				<div
					className={cn(
						"flex items-center gap-1 px-3 sm:px-4 pb-2 pt-0.5 text-[9px] sm:text-[10px]",
						sender === "me"
							? "text-primary-foreground/70 justify-end"
							: "text-muted-foreground justify-start",
					)}
				>
					<span className="leading-none">{timestamp}</span>
					{sender === "me" && (
						<MessageStatusIcon status={messageStatus} />
					)}
				</div>
			</div>
		</div>
	);
}
