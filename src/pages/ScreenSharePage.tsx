import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useScreenShare } from "@/hooks/use-screen-share";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/types";
import type { StreamQuality } from "@/types";
import Monitor from "lucide-react/dist/esm/icons/monitor";
import MonitorOff from "lucide-react/dist/esm/icons/monitor-off";
import Play from "lucide-react/dist/esm/icons/play";
import Square from "lucide-react/dist/esm/icons/square";
import Maximize2 from "lucide-react/dist/esm/icons/maximize-2";
import Minimize2 from "lucide-react/dist/esm/icons/minimize-2";
import Wifi from "lucide-react/dist/esm/icons/wifi";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Signal from "lucide-react/dist/esm/icons/signal";
import Zap from "lucide-react/dist/esm/icons/zap";
import Eye from "lucide-react/dist/esm/icons/eye";
import Radio from "lucide-react/dist/esm/icons/radio";

// ============================================================================
// QUALITY SELECTOR
// ============================================================================

interface QualitySelectorProps {
	value: StreamQuality;
	onChange: (quality: StreamQuality) => void;
	disabled?: boolean;
}

function QualitySelector({ value, onChange, disabled }: QualitySelectorProps) {
	const options: { key: StreamQuality; label: string; desc: string }[] = [
		{ key: "low", label: "Low", desc: "720p · 15fps" },
		{ key: "medium", label: "Medium", desc: "1080p · 24fps" },
		{ key: "high", label: "High", desc: "Native · 30fps" },
	];

	return (
		<div className="flex gap-2">
			{options.map((opt) => (
				<button
					key={opt.key}
					onClick={() => onChange(opt.key)}
					disabled={disabled}
					className={cn(
						"flex flex-col items-center gap-1 px-4 py-2.5 rounded-lg border transition-all text-xs",
						value === opt.key
							? "border-primary bg-primary/10 text-primary"
							: "border-border bg-card hover:bg-accent/50 text-muted-foreground",
						disabled && "opacity-50 cursor-not-allowed",
					)}
				>
					<span className="font-semibold text-sm">{opt.label}</span>
					<span className="text-[10px] text-muted-foreground">
						{opt.desc}
					</span>
				</button>
			))}
		</div>
	);
}

// ============================================================================
// STATS BAR
// ============================================================================

interface StatsBarProps {
	fps: number;
	avgFrameSize: number;
	totalBytes: number;
	droppedFrames: number;
}

function StatsBar({
	fps,
	avgFrameSize,
	totalBytes,
	droppedFrames,
}: StatsBarProps) {
	return (
		<div className="flex items-center gap-4 px-4 py-2 bg-muted/50 rounded-lg text-xs text-muted-foreground">
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<div className="flex items-center gap-1.5">
							<Zap className="h-3.5 w-3.5 text-green-500" />
							<span className="font-mono font-medium">
								{fps.toFixed(1)} fps
							</span>
						</div>
					</TooltipTrigger>
					<TooltipContent>Frames per second</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<div className="flex items-center gap-1.5">
							<Signal className="h-3.5 w-3.5 text-blue-500" />
							<span className="font-mono">
								{formatFileSize(avgFrameSize)}/frame
							</span>
						</div>
					</TooltipTrigger>
					<TooltipContent>Average frame size</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<div className="flex items-center gap-1.5">
							<Wifi className="h-3.5 w-3.5 text-purple-500" />
							<span className="font-mono">
								{formatFileSize(totalBytes)} total
							</span>
						</div>
					</TooltipTrigger>
					<TooltipContent>Total data transferred</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			{droppedFrames > 0 && (
				<div className="flex items-center gap-1.5 text-yellow-500">
					<span className="font-mono">{droppedFrames} dropped</span>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// DEVICE PICKER (select a peer to share screen with)
// ============================================================================

interface DevicePickerProps {
	onSelect: (deviceId: string, displayName: string) => void;
	disabled?: boolean;
}

function DevicePicker({ onSelect, disabled }: DevicePickerProps) {
	const devices = useAppStore((s) => s.devices);
	const connectedDevices = useAppStore((s) => s.connectedDevices);
	const deviceConnectionStatus = useAppStore(
		(s) => s.deviceConnectionStatus,
	);

	const onlineDevices = devices.filter((d) => {
		const isConnected =
			connectedDevices.has(d.device_id) ||
			deviceConnectionStatus[d.device_id] === "connected";
		const isRecent = Date.now() - d.last_seen * 1000 < 60_000;
		return isConnected || isRecent;
	});

	if (onlineDevices.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
				<MonitorOff className="h-12 w-12 mb-4 opacity-40" />
				<p className="text-sm font-medium">No devices online</p>
				<p className="text-xs mt-1">
					Discovered devices will appear here
				</p>
			</div>
		);
	}

	return (
		<div className="grid gap-2">
			{onlineDevices.map((device) => (
				<button
					key={device.device_id}
					onClick={() =>
						onSelect(device.device_id, device.display_name)
					}
					disabled={disabled}
					className={cn(
						"flex items-center gap-3 px-4 py-3 rounded-xl border border-border",
						"bg-card hover:bg-accent/50 transition-all text-left w-full",
						disabled && "opacity-50 cursor-not-allowed",
					)}
				>
					<div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 shrink-0">
						<Monitor className="h-5 w-5 text-primary" />
					</div>
					<div className="flex-1 min-w-0">
						<p className="text-sm font-semibold truncate">
							{device.display_name}
						</p>
						<p className="text-[11px] text-muted-foreground truncate">
							{device.platform} ·{" "}
							{device.addresses?.[0] || "Unknown IP"}
						</p>
					</div>
					<Badge variant="secondary" className="text-[10px] shrink-0">
						Online
					</Badge>
				</button>
			))}
		</div>
	);
}

// ============================================================================
// STREAM VIEWER (renders incoming JPEG frames)
// ============================================================================

interface StreamViewerProps {
	currentFrame: string | null;
	frameDimensions: { width: number; height: number } | null;
	isFullscreen: boolean;
	onToggleFullscreen: () => void;
}

function StreamViewer({
	currentFrame,
	frameDimensions,
	isFullscreen,
	onToggleFullscreen,
}: StreamViewerProps) {
	const imgRef = useRef<HTMLImageElement>(null);

	if (!currentFrame) {
		return (
			<div className="flex flex-col items-center justify-center h-full bg-black/90 rounded-xl text-white/60">
				<Loader2 className="h-8 w-8 animate-spin mb-3" />
				<p className="text-sm">Waiting for frames...</p>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"relative bg-black rounded-xl overflow-hidden flex items-center justify-center",
				isFullscreen
					? "fixed inset-0 z-50 rounded-none"
					: "h-full w-full",
			)}
		>
			<img
				ref={imgRef}
				src={currentFrame}
				alt="Screen share"
				className="max-w-full max-h-full object-contain"
				style={{
					imageRendering: "auto",
				}}
			/>

			{/* Overlay controls */}
			<div className="absolute top-3 right-3 flex gap-2">
				{frameDimensions && (
					<Badge
						variant="secondary"
						className="bg-black/60 text-white border-none text-[10px] backdrop-blur-sm"
					>
						{frameDimensions.width} × {frameDimensions.height}
					</Badge>
				)}
				<Button
					variant="ghost"
					size="sm"
					onClick={onToggleFullscreen}
					className="h-7 w-7 p-0 bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm"
				>
					{isFullscreen ? (
						<Minimize2 className="h-3.5 w-3.5" />
					) : (
						<Maximize2 className="h-3.5 w-3.5" />
					)}
				</Button>
			</div>

			{/* Fullscreen close hint */}
			{isFullscreen && (
				<div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white/70 text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
					Press Esc or click the minimize button to exit fullscreen
				</div>
			)}
		</div>
	);
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function ScreenSharePage() {
	const { deviceId: targetDeviceId } = useParams<{ deviceId?: string }>();
	const navigate = useNavigate();

	const devices = useAppStore((s) => s.devices);

	const {
		localState,
		activeSessionId,
		peerDisplayName,
		stats,
		currentFrame,
		frameDimensions,
		pendingOffer,
		isBroadcasting,
		isViewing,
		isActive,
		startBroadcast,
		acceptOffer,
		rejectOffer,
		stopSession,
	} = useScreenShare();

	const [quality, setQuality] = useState<StreamQuality>("medium");
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [isStarting, setIsStarting] = useState(false);

	// If a target device ID is in the URL, auto-select it
	const targetDevice = targetDeviceId
		? devices.find((d) => d.device_id === targetDeviceId)
		: null;

	// Handle fullscreen escape
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isFullscreen) {
				setIsFullscreen(false);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isFullscreen]);

	// Start broadcast to a selected device
	const handleStartBroadcast = useCallback(
		async (viewerDeviceId: string, viewerDisplayName: string) => {
			setIsStarting(true);
			try {
				await startBroadcast(
					viewerDeviceId,
					viewerDisplayName,
					quality,
					0,
				);
			} finally {
				setIsStarting(false);
			}
		},
		[startBroadcast, quality],
	);

	// Auto-start if target device is provided via URL
	useEffect(() => {
		if (targetDevice && localState === "idle" && !isStarting) {
			// Don't auto-start, just show the target device pre-selected
		}
	}, [targetDevice, localState, isStarting]);

	// ========================================================================
	// RENDER: Active streaming session
	// ========================================================================

	if (isActive && activeSessionId) {
		return (
			<div className="flex flex-col h-full">
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
					<div className="flex items-center gap-3">
						<div className="relative">
							<div
								className={cn(
									"flex items-center justify-center h-9 w-9 rounded-full",
									isBroadcasting
										? "bg-red-500/10"
										: "bg-blue-500/10",
								)}
							>
								{isBroadcasting ? (
									<Radio className="h-4 w-4 text-red-500" />
								) : (
									<Eye className="h-4 w-4 text-blue-500" />
								)}
							</div>
							<span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background animate-pulse" />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h2 className="text-sm font-semibold">
									{isBroadcasting
										? "Broadcasting"
										: "Viewing"}
								</h2>
								<Badge
									variant="secondary"
									className={cn(
										"text-[10px]",
										isBroadcasting
											? "bg-red-500/10 text-red-500"
											: "bg-blue-500/10 text-blue-500",
									)}
								>
									{isBroadcasting ? "LIVE" : "WATCHING"}
								</Badge>
							</div>
							<p className="text-xs text-muted-foreground">
								{isBroadcasting
									? `Sharing with ${peerDisplayName}`
									: `Viewing ${peerDisplayName}'s screen`}
							</p>
						</div>
					</div>

					<Button
						variant="destructive"
						size="sm"
						onClick={() => stopSession(activeSessionId)}
						className="gap-1.5"
					>
						<Square className="h-3.5 w-3.5" />
						Stop
					</Button>
				</div>

				{/* Stats bar */}
				{stats && (
					<StatsBar
						fps={stats.fps}
						avgFrameSize={stats.avgFrameSize}
						totalBytes={stats.totalBytes}
						droppedFrames={stats.droppedFrames}
					/>
				)}

				{/* Stream content */}
				<div className="flex-1 min-h-0 p-2">
					{isViewing ? (
						<StreamViewer
							currentFrame={currentFrame}
							frameDimensions={frameDimensions}
							isFullscreen={isFullscreen}
							onToggleFullscreen={() =>
								setIsFullscreen(!isFullscreen)
							}
						/>
					) : (
						/* Broadcaster view — just shows status */
						<div className="flex flex-col items-center justify-center h-full gap-4">
							<div className="relative">
								<div className="flex items-center justify-center h-24 w-24 rounded-full bg-red-500/10">
									<Radio className="h-10 w-10 text-red-500 animate-pulse" />
								</div>
								<span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 animate-pulse" />
							</div>
							<div className="text-center">
								<h3 className="text-lg font-semibold">
									Broadcasting Your Screen
								</h3>
								<p className="text-sm text-muted-foreground mt-1">
									{peerDisplayName} is viewing your screen
								</p>
							</div>
							{stats && (
								<div className="flex gap-6 text-sm text-muted-foreground mt-2">
									<span>{stats.fps.toFixed(1)} fps</span>
									<span>
										{formatFileSize(stats.totalBytes)} sent
									</span>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		);
	}

	// ========================================================================
	// RENDER: Offering state (waiting for answer)
	// ========================================================================

	if (localState === "offering") {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-6 px-4">
				<div className="flex items-center justify-center h-20 w-20 rounded-full bg-primary/10">
					<Loader2 className="h-10 w-10 text-primary animate-spin" />
				</div>
				<div className="text-center">
					<h2 className="text-lg font-semibold">
						Waiting for Response
					</h2>
					<p className="text-sm text-muted-foreground mt-1">
						Waiting for {peerDisplayName || "the viewer"} to accept
						your screen share...
					</p>
				</div>
				{activeSessionId && (
					<Button
						variant="outline"
						onClick={() => stopSession(activeSessionId)}
						className="gap-1.5"
					>
						<Square className="h-3.5 w-3.5" />
						Cancel
					</Button>
				)}
			</div>
		);
	}

	// ========================================================================
	// RENDER: Idle state — device picker + start
	// ========================================================================

	return (
		<div className="flex flex-col h-full">
			{/* Incoming offer dialog */}
			<AlertDialog
				open={!!pendingOffer}
				onOpenChange={(open) => {
					if (!open && pendingOffer) {
						rejectOffer(pendingOffer.session_id);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="flex items-center gap-2">
							<Monitor className="h-5 w-5 text-primary" />
							Screen Share Request
						</AlertDialogTitle>
						<AlertDialogDescription>
							<span className="font-semibold text-foreground">
								{pendingOffer?.from_display_name}
							</span>{" "}
							wants to share their screen with you.
							{pendingOffer?.screen_width &&
								pendingOffer?.screen_height && (
									<span className="block mt-1 text-xs">
										Resolution: {pendingOffer.screen_width}{" "}
										× {pendingOffer.screen_height} ·
										Quality: {pendingOffer.quality}
									</span>
								)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							onClick={() =>
								pendingOffer &&
								rejectOffer(pendingOffer.session_id)
							}
						>
							Decline
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() =>
								pendingOffer &&
								acceptOffer(pendingOffer.session_id)
							}
						>
							Accept
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Header */}
			<div className="flex items-center gap-3 px-4 py-3 border-b border-border">
				<Button
					variant="ghost"
					size="sm"
					className="h-8 w-8 p-0"
					onClick={() => navigate(-1)}
				>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<div>
					<h1 className="text-lg font-bold flex items-center gap-2">
						<Monitor className="h-5 w-5 text-primary" />
						Screen Share
					</h1>
					<p className="text-xs text-muted-foreground">
						Share your screen with a device on your network
					</p>
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-auto p-4 space-y-6">
				{/* Quality selector */}
				<Card className="p-4 space-y-3">
					<div className="flex items-center gap-2">
						<Zap className="h-4 w-4 text-primary" />
						<h3 className="text-sm font-semibold">
							Stream Quality
						</h3>
					</div>
					<QualitySelector
						value={quality}
						onChange={setQuality}
						disabled={isStarting}
					/>
				</Card>

				{/* Device selection */}
				<Card className="p-4 space-y-3">
					<div className="flex items-center gap-2">
						<Wifi className="h-4 w-4 text-primary" />
						<h3 className="text-sm font-semibold">
							Select a Device
						</h3>
					</div>
					<p className="text-xs text-muted-foreground">
						Choose a device to share your screen with
					</p>

					{/* If we have a target device from URL, show it prominently */}
					{targetDevice && (
						<div className="mb-3">
							<button
								onClick={() =>
									handleStartBroadcast(
										targetDevice.device_id,
										targetDevice.display_name,
									)
								}
								disabled={isStarting}
								className={cn(
									"flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-primary",
									"bg-primary/5 hover:bg-primary/10 transition-all text-left w-full",
									isStarting &&
										"opacity-50 cursor-not-allowed",
								)}
							>
								<div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 shrink-0">
									{isStarting ? (
										<Loader2 className="h-5 w-5 text-primary animate-spin" />
									) : (
										<Play className="h-5 w-5 text-primary" />
									)}
								</div>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-semibold truncate">
										{isStarting
											? "Starting..."
											: `Share with ${targetDevice.display_name}`}
									</p>
									<p className="text-[11px] text-muted-foreground truncate">
										{targetDevice.platform} ·{" "}
										{targetDevice.addresses?.[0] ||
											"Unknown IP"}
									</p>
								</div>
								<Badge className="text-[10px] shrink-0">
									Start
								</Badge>
							</button>
							<div className="my-3 border-t border-border/50" />
							<p className="text-xs text-muted-foreground mb-2">
								Or choose another device:
							</p>
						</div>
					)}

					<DevicePicker
						onSelect={handleStartBroadcast}
						disabled={isStarting}
					/>
				</Card>

				{/* Info card */}
				<Card className="p-4 bg-muted/30 border-dashed">
					<div className="flex gap-3">
						<Monitor className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
						<div className="text-xs text-muted-foreground space-y-1.5">
							<p className="font-medium text-foreground/80">
								How it works
							</p>
							<p>
								Screen share captures your screen and streams
								JPEG frames directly over your local network
								(UDP). No internet required.
							</p>
							<p>
								The viewer must accept the screen share request
								before streaming begins. Either side can stop
								the session at any time.
							</p>
						</div>
					</div>
				</Card>
			</div>
		</div>
	);
}
