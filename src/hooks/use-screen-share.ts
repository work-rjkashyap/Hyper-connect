import { useEffect, useCallback, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "@/hooks/use-toast";
import type {
	ScreenShareSession,
	ScreenShareOfferEvent,
	ScreenShareAnswerEvent,
	ScreenShareStoppedEvent,
	ScreenShareStatsEvent,
	ScreenShareStateChangedEvent,
	ScreenShareFrameEvent,
	ScreenShareState,
	StreamQuality,
} from "@/types";

// ============================================================================
// TYPES
// ============================================================================

export interface ScreenShareStats {
	fps: number;
	avgFrameSize: number;
	totalBytes: number;
	latencyMs: number;
	droppedFrames: number;
}

export interface ScreenShareHook {
	/** All active screen share sessions */
	sessions: ScreenShareSession[];
	/** Current local screen share state */
	localState: ScreenShareState;
	/** Current role: broadcaster, viewer, or null */
	role: "broadcaster" | "viewer" | null;
	/** The active session ID (if any) */
	activeSessionId: string | null;
	/** Peer device ID in the active session */
	peerDeviceId: string | null;
	/** Peer display name in the active session */
	peerDisplayName: string | null;
	/** Current streaming stats */
	stats: ScreenShareStats | null;
	/** Latest frame as a data URL (viewer only) */
	currentFrame: string | null;
	/** Frame dimensions */
	frameDimensions: { width: number; height: number } | null;
	/** Pending offer waiting for user acceptance */
	pendingOffer: ScreenShareOfferEvent | null;
	/** Whether we are currently broadcasting */
	isBroadcasting: boolean;
	/** Whether we are currently viewing */
	isViewing: boolean;
	/** Whether any session is active */
	isActive: boolean;

	// Actions
	/** Start broadcasting screen to a specific device */
	startBroadcast: (
		viewerDeviceId: string,
		viewerDisplayName: string,
		quality?: StreamQuality,
		displayIndex?: number,
	) => Promise<string>;
	/** Accept an incoming screen share offer */
	acceptOffer: (sessionId: string) => Promise<void>;
	/** Reject an incoming screen share offer */
	rejectOffer: (sessionId: string) => Promise<void>;
	/** Stop the current screen share session */
	stopSession: (sessionId: string) => Promise<void>;
	/** Refresh sessions from backend */
	refreshSessions: () => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useScreenShare(): ScreenShareHook {
	const [sessions, setSessions] = useState<ScreenShareSession[]>([]);
	const [localState, setLocalState] = useState<ScreenShareState>("idle");
	const [role, setRole] = useState<"broadcaster" | "viewer" | null>(null);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
	const [peerDeviceId, setPeerDeviceId] = useState<string | null>(null);
	const [peerDisplayName, setPeerDisplayName] = useState<string | null>(null);
	const [stats, setStats] = useState<ScreenShareStats | null>(null);
	const [currentFrame, setCurrentFrame] = useState<string | null>(null);
	const [frameDimensions, setFrameDimensions] = useState<{
		width: number;
		height: number;
	} | null>(null);
	const [pendingOffer, setPendingOffer] =
		useState<ScreenShareOfferEvent | null>(null);

	// Ref to track the latest frame sequence to avoid stale frame rendering
	const latestFrameSeq = useRef<number>(0);

	// Derived state
	const isBroadcasting = localState === "streaming" && role === "broadcaster";
	const isViewing = localState === "streaming" && role === "viewer";
	const isActive = localState === "streaming";

	// ========================================================================
	// ACTIONS
	// ========================================================================

	const refreshSessions = useCallback(async () => {
		try {
			const result = await invoke<ScreenShareSession[]>(
				"get_screen_share_sessions",
			);
			setSessions(result);
		} catch (err) {
			console.error("Failed to get screen share sessions:", err);
		}
	}, []);

	const startBroadcast = useCallback(
		async (
			viewerDeviceId: string,
			viewerDisplayName: string,
			quality: StreamQuality = "medium",
			displayIndex: number = 0,
		): Promise<string> => {
			try {
				const sessionId = await invoke<string>("start_screen_share", {
					viewerDeviceId,
					viewerDisplayName,
					quality,
					displayIndex,
				});

				setActiveSessionId(sessionId);
				setLocalState("offering");
				setRole("broadcaster");
				setPeerDeviceId(viewerDeviceId);
				setPeerDisplayName(viewerDisplayName);

				toast({
					title: "Screen share offer sent",
					description: `Waiting for ${viewerDisplayName} to accept...`,
				});

				return sessionId;
			} catch (err) {
				toast({
					title: "Screen share failed",
					description: String(err),
					variant: "destructive",
				});
				throw err;
			}
		},
		[],
	);

	const acceptOffer = useCallback(async (sessionId: string) => {
		try {
			await invoke("answer_screen_share", {
				sessionId,
				accepted: true,
			});
			setPendingOffer(null);
			setActiveSessionId(sessionId);
			setLocalState("streaming");
			setRole("viewer");
			latestFrameSeq.current = 0;
			setCurrentFrame(null);

			toast({
				title: "Screen share accepted",
				description: "Receiving screen stream...",
			});
		} catch (err) {
			toast({
				title: "Failed to accept screen share",
				description: String(err),
				variant: "destructive",
			});
		}
	}, []);

	const rejectOffer = useCallback(async (sessionId: string) => {
		try {
			await invoke("answer_screen_share", {
				sessionId,
				accepted: false,
			});
			setPendingOffer(null);

			toast({
				title: "Screen share declined",
			});
		} catch (err) {
			console.error("Failed to reject screen share:", err);
		}
	}, []);

	const stopSession = useCallback(
		async (sessionId: string) => {
			try {
				await invoke("stop_screen_share", { sessionId });

				// Reset all local state
				setActiveSessionId(null);
				setLocalState("idle");
				setRole(null);
				setPeerDeviceId(null);
				setPeerDisplayName(null);
				setStats(null);
				setCurrentFrame(null);
				setFrameDimensions(null);
				latestFrameSeq.current = 0;

				toast({
					title: "Screen share stopped",
				});

				refreshSessions();
			} catch (err) {
				toast({
					title: "Failed to stop screen share",
					description: String(err),
					variant: "destructive",
				});
			}
		},
		[refreshSessions],
	);

	// ========================================================================
	// EVENT LISTENERS
	// ========================================================================

	useEffect(() => {
		const unlisteners: Array<() => void> = [];
		let cancelled = false;

		// Screen share offer received (viewer side)
		listen<ScreenShareOfferEvent>("screen-share-offer", (event) => {
			if (cancelled) return;
			console.log("📺 Screen share offer received:", event.payload);
			setPendingOffer(event.payload);

			toast({
				title: "Screen share request",
				description: `${event.payload.from_display_name} wants to share their screen`,
			});
		}).then((fn) => {
			if (!cancelled) unlisteners.push(fn);
		});

		// Screen share answer received (broadcaster side)
		listen<ScreenShareAnswerEvent>("screen-share-answer", (event) => {
			if (cancelled) return;
			const { accepted, reason } = event.payload;
			console.log("📺 Screen share answer:", event.payload);

			if (accepted) {
				setLocalState("streaming");
				toast({
					title: "Screen share accepted",
					description: "Broadcasting your screen...",
				});
			} else {
				setActiveSessionId(null);
				setLocalState("idle");
				setRole(null);
				setPeerDeviceId(null);
				setPeerDisplayName(null);
				toast({
					title: "Screen share declined",
					description:
						reason || "The viewer declined your screen share",
					variant: "destructive",
				});
			}
		}).then((fn) => {
			if (!cancelled) unlisteners.push(fn);
		});

		// Screen share stopped (either side)
		listen<ScreenShareStoppedEvent>("screen-share-stopped", (event) => {
			if (cancelled) return;
			console.log("📺 Screen share stopped:", event.payload);

			setActiveSessionId(null);
			setLocalState("idle");
			setRole(null);
			setPeerDeviceId(null);
			setPeerDisplayName(null);
			setStats(null);
			setCurrentFrame(null);
			setFrameDimensions(null);
			latestFrameSeq.current = 0;
			setPendingOffer(null);

			toast({
				title: "Screen share ended",
				description:
					event.payload.reason === "user_stopped"
						? "The session was ended"
						: event.payload.reason || "Screen share stopped",
			});

			refreshSessions();
		}).then((fn) => {
			if (!cancelled) unlisteners.push(fn);
		});

		// Screen share state changed
		listen<ScreenShareStateChangedEvent>(
			"screen-share-state-changed",
			(event) => {
				if (cancelled) return;
				const {
					state,
					role: eventRole,
					peer_device_id,
					peer_display_name,
					session_id,
				} = event.payload;
				console.log("📺 Screen share state changed:", event.payload);

				setLocalState(state);
				setRole(eventRole);
				setActiveSessionId(session_id);
				setPeerDeviceId(peer_device_id);
				setPeerDisplayName(peer_display_name);

				if (state === "idle") {
					setStats(null);
					setCurrentFrame(null);
					setFrameDimensions(null);
					latestFrameSeq.current = 0;
				}

				refreshSessions();
			},
		).then((fn) => {
			if (!cancelled) unlisteners.push(fn);
		});

		// Streaming stats
		listen<ScreenShareStatsEvent>("screen-share-stats", (event) => {
			if (cancelled) return;
			setStats({
				fps: event.payload.fps,
				avgFrameSize: event.payload.avg_frame_size,
				totalBytes: event.payload.total_bytes,
				latencyMs: event.payload.latency_ms,
				droppedFrames: event.payload.dropped_frames,
			});
		}).then((fn) => {
			if (!cancelled) unlisteners.push(fn);
		});

		// Screen frames (viewer only)
		listen<ScreenShareFrameEvent>("screen-share-frame", (event) => {
			if (cancelled) return;

			const { frame_seq, width, height, jpeg_base64 } = event.payload;

			// Only render if this frame is newer than the last one
			if (frame_seq >= latestFrameSeq.current) {
				latestFrameSeq.current = frame_seq + 1;
				setCurrentFrame(`data:image/jpeg;base64,${jpeg_base64}`);
				setFrameDimensions({ width, height });
			}
		}).then((fn) => {
			if (!cancelled) unlisteners.push(fn);
		});

		// Initial load
		refreshSessions();

		return () => {
			cancelled = true;
			unlisteners.forEach((fn) => fn());
		};
	}, [refreshSessions]);

	return {
		sessions,
		localState,
		role,
		activeSessionId,
		peerDeviceId,
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
		refreshSessions,
	};
}
