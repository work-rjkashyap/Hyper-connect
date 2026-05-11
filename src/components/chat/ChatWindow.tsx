import { useRef, useEffect, useState, useCallback } from "react";
import MoreVertical from "lucide-react/dist/esm/icons/more-vertical";
import Phone from "lucide-react/dist/esm/icons/phone";
import Video from "lucide-react/dist/esm/icons/video";
import Info from "lucide-react/dist/esm/icons/info";
import Search from "lucide-react/dist/esm/icons/search";
import Wifi from "lucide-react/dist/esm/icons/wifi";
import WifiOff from "lucide-react/dist/esm/icons/wifi-off";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import ShieldX from "lucide-react/dist/esm/icons/shield-x";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import Clock from "lucide-react/dist/esm/icons/clock";
import UserCheck from "lucide-react/dist/esm/icons/user-check";
import UserX from "lucide-react/dist/esm/icons/user-x";
import Lock from "lucide-react/dist/esm/icons/lock";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import FileText from "lucide-react/dist/esm/icons/file-text";
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import X from "lucide-react/dist/esm/icons/x";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import MessageBubble from "./MessageBubble";
import FileMessageBubble from "./FileMessageBubble";
import ChatInput from "./ChatInput";
import DateSeparator, { getDateKey } from "./DateSeparator";
import type { FileTransfer } from "@/types";

export interface UIMessage {
	id: string;
	content: string;
	sender: "me" | "them";
	timestamp: string;
	/** Unix timestamp in seconds – used for date separator grouping */
	rawTimestamp: number;
	status: "sent" | "delivered" | "read";
	type: "text" | "image" | "file";
	imageUrl?: string;
	/** File transfer record – present when `type === "file"`. */
	fileTransfer?: FileTransfer;
}

type ConnectionState = "idle" | "connecting" | "connected" | "unreachable";

type ApprovalState =
	| "approved"
	| "incoming_pending"
	| "outgoing_pending"
	| "outgoing_declined"
	| "none";

interface ChatWindowProps {
	messages: UIMessage[];
	onSendMessage: (text: string) => void;
	onFileSelect?: (file?: File) => void;
	recipientName?: string;
	recipientAvatar?: string;
	recipientStatus?: "online" | "offline";
	connectionState?: ConnectionState;
	latencyMs?: number | null;
	className?: string;
	// Privacy layer props
	approvalState?: ApprovalState;
	onAcceptRequest?: () => void;
	onDeclineRequest?: () => void;
	// File transfer action callbacks
	onAcceptFile?: (transferId: string) => void;
	onRejectFile?: (transferId: string) => void;
	onCancelFile?: (transferId: string) => void;
	onPauseFile?: (transferId: string) => void;
	onBack?: () => void;
	// Secure handshake / SAS verification props
	isVerified?: boolean;
	onVerify?: () => void;
	// Screen share
	onScreenShare?: () => void;
	// AI features
	smartReplies?: string[];
	isLoadingSmartReplies?: boolean;
	onRequestSmartReplies?: () => void;
	onSummarize?: () => void;
	onAnalyze?: () => void;
	isAiReady?: boolean;
	summaryText?: string | null;
	isLoadingSummary?: boolean;
	analysisData?: {
		tone: string;
		topics: string[];
		activity: string;
		insights: string[];
	} | null;
	isLoadingAnalysis?: boolean;
}

// ── Connection badge ──────────────────────────────────────────────────────────

function ConnectionBadge({
	state,
	latencyMs,
}: {
	state: ConnectionState;
	latencyMs?: number | null;
}) {
	if (state === "idle") return null;

	if (state === "connecting") {
		return (
			<span className="flex items-center gap-1 text-[10px] text-amber-500 font-medium animate-pulse select-none">
				<Loader2 className="h-3 w-3 animate-spin" />
				Connecting…
			</span>
		);
	}

	if (state === "unreachable") {
		return (
			<span className="flex items-center gap-1 text-[10px] text-destructive font-medium select-none">
				<WifiOff className="h-3 w-3" />
				Unreachable
			</span>
		);
	}

	// connected
	return (
		<span className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium select-none">
			<Wifi className="h-3 w-3" />
			{latencyMs != null ? `${latencyMs} ms` : "Connected"}
		</span>
	);
}

// ── Approval banner for incoming pending requests ─────────────────────────────

function IncomingRequestBanner({
	recipientName,
	onAccept,
	onDecline,
}: {
	recipientName: string;
	onAccept: () => void;
	onDecline: () => void;
}) {
	return (
		<div className="flex flex-col gap-3 px-4 py-4 bg-amber-500/10 border-b border-amber-500/20 animate-in slide-in-from-top-2 duration-300">
			<div className="flex items-start gap-3">
				<div className="p-2 rounded-xl bg-amber-500/15 shrink-0">
					<ShieldAlert className="h-5 w-5 text-amber-500" />
				</div>
				<div className="flex-1 min-w-0">
					<p className="text-sm font-semibold text-foreground">
						Chat request from {recipientName}
					</p>
					<p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
						This device wants to start a conversation with you.
						Accept to allow messaging, or decline to block.
					</p>
				</div>
			</div>
			<div className="flex items-center gap-2 ml-11">
				<Button
					size="sm"
					className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg px-4"
					onClick={onAccept}
				>
					<UserCheck className="h-3.5 w-3.5" />
					Accept
				</Button>
				<Button
					size="sm"
					variant="outline"
					className="h-8 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive font-semibold text-xs rounded-lg px-4"
					onClick={onDecline}
				>
					<UserX className="h-3.5 w-3.5" />
					Decline
				</Button>
			</div>
		</div>
	);
}

// ── Disabled input replacement for various states ─────────────────────────────

function DisabledInputBanner({
	state,
	recipientName,
}: {
	state: "outgoing_pending" | "outgoing_declined" | "incoming_pending";
	recipientName: string;
}) {
	if (state === "outgoing_pending") {
		return (
			<div
				className="flex items-center justify-center gap-2.5 border-t border-border bg-muted/50 px-4 py-4"
				style={{
					paddingBottom:
						"max(calc(0.75rem + var(--safe-area-bottom, 0px)), 0.75rem)",
				}}
			>
				<div className="p-1.5 rounded-lg bg-amber-500/15">
					<Clock className="h-4 w-4 text-amber-500" />
				</div>
				<div className="text-center">
					<p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
						Waiting for approval
					</p>
					<p className="text-[11px] text-muted-foreground mt-0.5">
						{recipientName} needs to accept your chat request before
						you can send more messages.
					</p>
				</div>
			</div>
		);
	}

	if (state === "outgoing_declined") {
		return (
			<div
				className="flex items-center justify-center gap-2.5 border-t border-border bg-destructive/5 px-4 py-4"
				style={{
					paddingBottom:
						"max(calc(0.75rem + var(--safe-area-bottom, 0px)), 0.75rem)",
				}}
			>
				<div className="p-1.5 rounded-lg bg-destructive/15">
					<ShieldX className="h-4 w-4 text-destructive" />
				</div>
				<div className="text-center">
					<p className="text-xs font-semibold text-destructive">
						Request declined
					</p>
					<p className="text-[11px] text-muted-foreground mt-0.5">
						{recipientName} declined your chat request. You cannot
						send messages to this device.
					</p>
				</div>
			</div>
		);
	}

	// incoming_pending — show a locked input with hint
	return (
		<div
			className="flex items-center justify-center gap-2.5 border-t border-border bg-muted/50 px-4 py-4"
			style={{
				paddingBottom:
					"max(calc(0.75rem + var(--safe-area-bottom, 0px)), 0.75rem)",
			}}
		>
			<div className="p-1.5 rounded-lg bg-amber-500/15">
				<Lock className="h-4 w-4 text-amber-500" />
			</div>
			<div className="text-center">
				<p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
					Accept or decline to respond
				</p>
				<p className="text-[11px] text-muted-foreground mt-0.5">
					Accept this chat request above to start messaging.
				</p>
			</div>
		</div>
	);
}

// ── Main component ────────────────────────────────────────────────────────────

export function ChatWindow({
	messages,
	onSendMessage,
	onFileSelect,
	recipientName = "Select a Chat",
	recipientAvatar,
	recipientStatus = "offline",
	connectionState = "idle",
	latencyMs = null,
	className,
	approvalState = "approved",
	onAcceptRequest,
	onDeclineRequest,
	onAcceptFile,
	onRejectFile,
	onCancelFile,
	onPauseFile,
	onBack,
	isVerified = false,
	onVerify,
	onScreenShare,
	// AI features
	smartReplies = [],
	isLoadingSmartReplies = false,
	onRequestSmartReplies,
	onSummarize,
	onAnalyze,
	isAiReady = false,
	summaryText = null,
	isLoadingSummary = false,
	analysisData = null,
	isLoadingAnalysis = false,
}: ChatWindowProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [showSmartReplies, setShowSmartReplies] = useState(false);
	const [showSummary, setShowSummary] = useState(false);
	const [showAnalysis, setShowAnalysis] = useState(false);
	// Track the visual viewport height so the layout shrinks when the soft
	// keyboard opens on mobile WebView (WKWebView does NOT resize on keyboard).
	const [vvHeight, setVvHeight] = useState<number | null>(null);

	useEffect(() => {
		const vv = window.visualViewport;
		if (!vv) return;
		const onResize = () => setVvHeight(vv.height);
		onResize();
		vv.addEventListener("resize", onResize);
		return () => vv.removeEventListener("resize", onResize);
	}, []);

	// When smart replies arrive, show the bar
	useEffect(() => {
		if (smartReplies.length > 0) {
			setShowSmartReplies(true);
		}
	}, [smartReplies]);

	// Show summary when it arrives
	useEffect(() => {
		if (summaryText) setShowSummary(true);
	}, [summaryText]);

	// Show analysis when it arrives
	useEffect(() => {
		if (analysisData) setShowAnalysis(true);
	}, [analysisData]);

	const handleSmartReplyClick = useCallback(
		(reply: string) => {
			onSendMessage(reply);
			setShowSmartReplies(false);
		},
		[onSendMessage],
	);

	const isOffline = recipientStatus === "offline";
	const mobileHeaderHeight = "calc(4rem + var(--safe-area-top, 0px))";

	// Whether the standard chat input should be shown
	const showChatInput =
		approvalState === "approved" || approvalState === "none";

	// Auto-scroll to bottom on new message
	useEffect(() => {
		if (scrollRef.current) {
			const viewport = scrollRef.current.querySelector(
				"[data-radix-scroll-area-viewport]",
			);
			if (viewport) {
				viewport.scrollTop = viewport.scrollHeight;
			}
		}
	}, [messages]);


	return (
		<div
			className={cn(
				"relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-background text-foreground",
				className,
			)}
			style={vvHeight != null ? { height: `${vvHeight}px` } : undefined}
		>
			{/* ── Header ──────────────────────────────────────────────────── */}
			<header
				className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card/95 px-3 backdrop-blur-sm sm:px-6 sm:pt-6 sm:h-20 sm:bg-card/50 sm:backdrop-blur-0"
				style={{
					minHeight: mobileHeaderHeight,
					paddingTop:
						"max(calc(0.5rem + var(--safe-area-top, 0px)), 0.5rem)",
				}}
			>
				{/* Left: avatar + name + connection badge */}
				<div className="flex items-center gap-2 sm:gap-4 min-w-0">
					{onBack && (
						<Button
							variant="ghost"
							size="sm"
							onClick={onBack}
							className="h-8 w-8 shrink-0 rounded-xl sm:hidden"
						>
							<ArrowLeft className="h-4 w-4" />
							<span className="sr-only">Go back</span>
						</Button>
					)}
					<div className="relative shrink-0">
						<Avatar className="h-8 w-8 sm:h-10 sm:w-10">
							<AvatarImage
								src={recipientAvatar}
								alt={recipientName}
							/>
							<AvatarFallback>
								{recipientName.substring(0, 2).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						{recipientStatus === "online" && (
							<span className="absolute bottom-0 right-0 h-2 w-2 sm:h-3 sm:w-3 rounded-full border-2 border-background bg-green-500" />
						)}
					</div>

					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<h3 className="font-semibold leading-none tracking-tight text-sm sm:text-base truncate">
								{recipientName}
							</h3>
							{/* Approval state indicator in header */}
							{approvalState === "approved" && (
								<ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
							)}
							{approvalState === "incoming_pending" && (
								<ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0" />
							)}
							{approvalState === "outgoing_declined" && (
								<ShieldX className="h-3.5 w-3.5 text-destructive shrink-0" />
							)}
						</div>

						{/* Status row: mDNS presence + TCP connection badge */}
						<div className="flex items-center gap-2 mt-1 flex-wrap">
							<p className="text-xs text-muted-foreground">
								{recipientStatus === "online"
									? "Online"
									: "Last seen recently"}
							</p>

							{/* Divider dot */}
							{connectionState !== "idle" && (
								<span className="text-muted-foreground/40 text-xs select-none">
									·
								</span>
							)}

							<ConnectionBadge
								state={connectionState}
								latencyMs={latencyMs}
							/>

							{/* SAS Verification badge */}
							{connectionState === "connected" && (
								<>
									<span className="text-muted-foreground/40 text-xs select-none">
										·
									</span>
									{isVerified ? (
										<span className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium select-none">
											<Lock className="h-3 w-3" />
											Verified
										</span>
									) : (
										<button
											onClick={onVerify}
											className="flex items-center gap-1 text-[10px] text-amber-500 font-medium select-none hover:text-amber-400 transition-colors"
										>
											<ShieldAlert className="h-3 w-3" />
											Unverified
										</button>
									)}
								</>
							)}
						</div>
					</div>
				</div>

				{/* Right: action buttons */}
				<div className="flex items-center gap-1 shrink-0">
					<Button
						variant="ghost"
						size="sm"
						className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-foreground"
						onClick={onScreenShare}
						title="Screen Share"
					>
						<Video className="h-4 w-4 sm:h-5 sm:w-5" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-foreground"
					>
						<Phone className="h-4 w-4 sm:h-5 sm:w-5" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="hidden sm:flex h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-foreground"
					>
						<Search className="h-4 w-4 sm:h-5 sm:w-5" />
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-foreground"
							>
								<MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem>
								<Info className="mr-2 h-4 w-4" />
								<span>View Info</span>
							</DropdownMenuItem>
							{isAiReady && onRequestSmartReplies && (
								<DropdownMenuItem
									onClick={() => {
										onRequestSmartReplies();
										setShowSmartReplies(true);
									}}
								>
									<Sparkles className="mr-2 h-4 w-4" />
									<span>Smart Replies</span>
								</DropdownMenuItem>
							)}
							{isAiReady && onSummarize && (
								<DropdownMenuItem
									onClick={() => {
										onSummarize();
									}}
								>
									<FileText className="mr-2 h-4 w-4" />
									<span>Summarize Chat</span>
								</DropdownMenuItem>
							)}
							{isAiReady && onAnalyze && (
								<DropdownMenuItem
									onClick={() => {
										onAnalyze();
									}}
								>
									<BarChart3 className="mr-2 h-4 w-4" />
									<span>Analyze Chat</span>
								</DropdownMenuItem>
							)}
							{onVerify && !isVerified && (
								<DropdownMenuItem onClick={onVerify}>
									<ShieldAlert className="mr-2 h-4 w-4" />
									<span>Verify Connection</span>
								</DropdownMenuItem>
							)}
							{isVerified && (
								<DropdownMenuItem disabled>
									<ShieldCheck className="mr-2 h-4 w-4 text-emerald-500" />
									<span className="text-emerald-500">
										Verified
									</span>
								</DropdownMenuItem>
							)}
							<DropdownMenuItem className="text-destructive focus:text-destructive">
								Block Contact
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</header>

			{/* ── Incoming chat request banner ────────────────────────────── */}
			{approvalState === "incoming_pending" &&
				onAcceptRequest &&
				onDeclineRequest && (
					<IncomingRequestBanner
						recipientName={recipientName}
						onAccept={onAcceptRequest}
						onDecline={onDeclineRequest}
					/>
				)}

			{/* ── Unreachable banner ──────────────────────────────────────── */}
			{connectionState === "unreachable" && (
				<div className="flex items-center justify-center gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs font-medium animate-in slide-in-from-top-1 duration-200">
					<WifiOff className="h-3.5 w-3.5 shrink-0" />
					Device is unreachable. Messages will be sent once the
					connection is restored.
				</div>
			)}

			{/* ── Connecting banner ───────────────────────────────────────── */}
			{connectionState === "connecting" && (
				<div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium animate-in slide-in-from-top-1 duration-200">
					<Loader2 className="h-3 w-3 shrink-0 animate-spin" />
					Establishing secure connection…
				</div>
			)}

			{/* ── Message feed ────────────────────────────────────────────── */}
			<ScrollArea
				className="min-h-0 flex-1 bg-background p-3 sm:p-4"
				ref={scrollRef}
			>
				{messages.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-center py-8">
						<p className="text-muted-foreground text-sm">
							No messages yet
						</p>
						<p className="text-muted-foreground/70 text-xs mt-2">
							Send a message to start the conversation
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-3 sm:gap-4 pb-4">
						{messages.map((msg, index) => {
							// Show a date separator when the calendar day changes
							const prevMsg =
								index > 0 ? messages[index - 1] : null;
							const showDateSeparator =
								!prevMsg ||
								getDateKey(msg.rawTimestamp) !==
									getDateKey(prevMsg.rawTimestamp);

							return (
								<div key={msg.id}>
									{showDateSeparator && (
										<DateSeparator
											timestamp={msg.rawTimestamp}
										/>
									)}
									{msg.type === "file" && msg.fileTransfer ? (
										<FileMessageBubble
											transfer={msg.fileTransfer}
											sender={msg.sender}
											timestamp={msg.timestamp}
											messageStatus={msg.status}
											recipientName={recipientName}
											recipientAvatar={recipientAvatar}
											animationDelay={index * 50}
											onAccept={onAcceptFile}
											onReject={onRejectFile}
											onCancel={onCancelFile}
											onPause={onPauseFile}
										/>
									) : (
										<MessageBubble
											id={msg.id}
											content={msg.content}
											sender={msg.sender}
											timestamp={msg.timestamp}
											status={msg.status}
											type={
												msg.type === "file"
													? "text"
													: msg.type
											}
											imageUrl={msg.imageUrl}
											recipientName={recipientName}
											recipientAvatar={recipientAvatar}
											animationDelay={index * 50}
										/>
									)}
								</div>
							);
						})}
					</div>
				)}
			</ScrollArea>

			{/* ── AI Summary overlay ────────────────────────────────────── */}
			{showSummary && (summaryText || isLoadingSummary) && (
				<div className="mx-3 mb-2 p-3 rounded-xl border border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-bottom-2 duration-200">
					<div className="flex items-center justify-between mb-2">
						<div className="flex items-center gap-1.5">
							<FileText className="h-3.5 w-3.5 text-primary" />
							<span className="text-xs font-semibold text-primary">
								Summary
							</span>
						</div>
						<button
							onClick={() => setShowSummary(false)}
							className="text-muted-foreground hover:text-foreground"
						>
							<X className="h-3.5 w-3.5" />
						</button>
					</div>
					{isLoadingSummary ? (
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<Loader2 className="h-3 w-3 animate-spin" />
							Summarizing conversation...
						</div>
					) : (
						<p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
							{summaryText}
						</p>
					)}
				</div>
			)}

			{/* ── AI Analysis overlay ───────────────────────────────────── */}
			{showAnalysis && (analysisData || isLoadingAnalysis) && (
				<div className="mx-3 mb-2 p-3 rounded-xl border border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-bottom-2 duration-200">
					<div className="flex items-center justify-between mb-2">
						<div className="flex items-center gap-1.5">
							<BarChart3 className="h-3.5 w-3.5 text-primary" />
							<span className="text-xs font-semibold text-primary">
								Analysis
							</span>
						</div>
						<button
							onClick={() => setShowAnalysis(false)}
							className="text-muted-foreground hover:text-foreground"
						>
							<X className="h-3.5 w-3.5" />
						</button>
					</div>
					{isLoadingAnalysis ? (
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<Loader2 className="h-3 w-3 animate-spin" />
							Analyzing conversation...
						</div>
					) : analysisData ? (
						<div className="space-y-2">
							<div className="flex gap-4 text-xs">
								<div>
									<span className="text-muted-foreground">
										Tone:
									</span>{" "}
									<span className="font-medium capitalize">
										{analysisData.tone}
									</span>
								</div>
								<div>
									<span className="text-muted-foreground">
										Activity:
									</span>{" "}
									<span className="font-medium">
										{analysisData.activity}
									</span>
								</div>
							</div>
							{analysisData.topics.length > 0 && (
								<div className="flex flex-wrap gap-1">
									{analysisData.topics.map((t, i) => (
										<span
											key={i}
											className="px-1.5 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary font-medium"
										>
											{t}
										</span>
									))}
								</div>
							)}
							{analysisData.insights.length > 0 && (
								<ul className="space-y-0.5">
									{analysisData.insights.map((ins, i) => (
										<li
											key={i}
											className="text-[11px] text-foreground/80 flex items-start gap-1"
										>
											<span className="text-primary">
												•
											</span>
											{ins}
										</li>
									))}
								</ul>
							)}
						</div>
					) : null}
				</div>
			)}

			<div className="shrink-0 bg-background">
				{/* ── AI Smart Reply suggestions ────────────────────────────── */}
				{showSmartReplies &&
					showChatInput &&
					(smartReplies.length > 0 || isLoadingSmartReplies) && (
						<div className="flex items-center gap-2 overflow-x-auto border-t border-border/50 px-3 py-2 scrollbar-none">
							<Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
							{isLoadingSmartReplies ? (
								<div className="flex items-center gap-2 text-xs text-muted-foreground">
									<Loader2 className="h-3 w-3 animate-spin" />
									Generating replies...
								</div>
							) : (
								<>
									{smartReplies.map((reply, i) => (
										<button
											key={i}
											onClick={() =>
												handleSmartReplyClick(reply)
											}
											className="shrink-0 whitespace-nowrap rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-primary/10"
										>
											{reply}
										</button>
									))}
									<button
										onClick={() => setShowSmartReplies(false)}
										className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
									>
										<X className="h-3 w-3" />
									</button>
								</>
							)}
						</div>
					)}

				{/* ── Offline notice ─────────────────────────────────────────── */}
				{showChatInput && isOffline && (
					<div className="flex items-center justify-center gap-2 border-t border-border bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground">
						<WifiOff className="h-3 w-3 shrink-0" />
						Device is offline — messages and files are disabled
					</div>
				)}

				{/* ── Input area or disabled banner ──────────────────────────── */}
				{showChatInput ? (
					<ChatInput
						onSendMessage={onSendMessage}
						onFileSelect={onFileSelect}
						disabled={isOffline}
					/>
				) : (
					<DisabledInputBanner
						state={
							approvalState as
								| "outgoing_pending"
								| "outgoing_declined"
								| "incoming_pending"
						}
						recipientName={recipientName}
					/>
				)}
			</div>
		</div>
	);
}
