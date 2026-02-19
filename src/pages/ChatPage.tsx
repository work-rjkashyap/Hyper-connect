import { useParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useCallback, useState, useMemo } from "react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { useAppStore } from "@/store";
import type { Message, ConnectionStatusEvent } from "@/types";
import {
	getMessageContent,
	isSystemMessage,
	SYS_CHAT_ACCEPTED,
	SYS_CHAT_DECLINED,
} from "@/types";

type ConnectionState = "idle" | "connecting" | "connected" | "unreachable";

/**
 * Determines the "approval state" for the chat from the local user's perspective.
 *
 * - `approved`          → Both sides can freely chat.
 * - `incoming_pending`  → The remote device sent us a message but we haven't
 *                         accepted / declined yet.  Show Accept / Decline banner.
 * - `outgoing_pending`  → We sent the first message and are waiting for the
 *                         remote to accept.  Input is disabled.
 * - `outgoing_declined` → The remote declined our chat request.  Input disabled.
 * - `none`              → No messages yet in either direction.  Allow sending
 *                         the first message (this will create the request).
 */
type ApprovalState =
	| "approved"
	| "incoming_pending"
	| "outgoing_pending"
	| "outgoing_declined"
	| "none";

export default function ChatPage() {
	const { deviceId } = useParams<{ deviceId: string }>();
	const {
		devices,
		messages,
		localDeviceId,
		addMessage,
		setMessages,
		markConversationAsRead,
		setConnectionStatus,
		setDeviceConnecting,
		setActiveChatDeviceId,
		// Privacy layer
		approvedDevices,
		declinedDevices,
		chatRequestStatus,
		startChat,
		approveDevice,
		declineDevice,
		setChatRequestStatus,
		startedChats,
	} = useAppStore();

	const [connectionState, setConnectionState] =
		useState<ConnectionState>("idle");
	const [latencyMs, setLatencyMs] = useState<number | null>(null);

	const selectedDevice = devices.find((d) => d.device_id === deviceId);

	const getConversationKey = (device1: string, device2: string): string =>
		[device1, device2].sort().join("_");

	const conversationKey =
		localDeviceId && selectedDevice
			? getConversationKey(localDeviceId, selectedDevice.device_id)
			: null;

	// Filter out system messages for display
	const currentMessages = useMemo((): Message[] => {
		if (!selectedDevice || !localDeviceId) return [];
		const key = getConversationKey(localDeviceId, selectedDevice.device_id);
		const allMessages = messages[key] || [];
		return allMessages.filter((m) => !isSystemMessage(m));
	}, [messages, selectedDevice, localDeviceId]);

	// ── Determine approval state ───────────────────────────────────────────
	const approvalState: ApprovalState = useMemo(() => {
		if (!selectedDevice || !localDeviceId) return "none";

		const remoteId = selectedDevice.device_id;
		const isApprovedByUs = approvedDevices.includes(remoteId);
		const isDeclinedByUs = declinedDevices.includes(remoteId);
		const outgoingStatus = chatRequestStatus[remoteId]; // 'pending' | 'accepted' | 'declined' | undefined

		// If we approved them AND they accepted us (or we initiated) → fully approved
		if (isApprovedByUs && outgoingStatus === "accepted") {
			return "approved";
		}

		// If we approved them (we initiated from Discovery) but they haven't responded yet
		if (isApprovedByUs && outgoingStatus === "pending") {
			// Check if we've already sent a message
			const key = getConversationKey(localDeviceId, remoteId);
			const allMsgs = messages[key] || [];
			const sentByUs = allMsgs.filter(
				(m) =>
					m.from_device_id === localDeviceId && !isSystemMessage(m),
			);
			if (sentByUs.length > 0) {
				return "outgoing_pending";
			}
			// We started the chat but haven't sent anything yet — allow first message
			return "none";
		}

		// If we approved them and outgoing status is declined
		if (isApprovedByUs && outgoingStatus === "declined") {
			return "outgoing_declined";
		}

		// If we approved them but no outgoing status exists (maybe we initiated
		// AND they also messaged us first — mutual approval)
		if (isApprovedByUs) {
			return "approved";
		}

		// If we declined them
		if (isDeclinedByUs) {
			return "approved"; // Show as declined but let them see messages (read-only handled by declined state)
		}

		// If we have NOT approved them, check if they sent us messages
		const key = getConversationKey(localDeviceId, remoteId);
		const allMsgs = messages[key] || [];
		const fromThem = allMsgs.filter(
			(m) => m.from_device_id === remoteId && !isSystemMessage(m),
		);
		if (fromThem.length > 0) {
			return "incoming_pending";
		}

		// No interaction yet — we can send the first message (creates a request)
		return "none";
	}, [
		selectedDevice,
		localDeviceId,
		approvedDevices,
		declinedDevices,
		chatRequestStatus,
		messages,
	]);

	// ── Pre-connect: ping the peer the moment the chat opens ─────────────
	const preConnect = useCallback(async () => {
		if (!selectedDevice || !localDeviceId) return;

		const peerAddress =
			selectedDevice.addresses && selectedDevice.addresses.length > 0
				? selectedDevice.addresses[0]
				: null;

		if (!peerAddress) {
			setConnectionState("unreachable");
			return;
		}

		setConnectionState("connecting");
		setDeviceConnecting(selectedDevice.device_id);

		try {
			const latency = await invoke<number>("ping_device", {
				deviceId: selectedDevice.device_id,
				peerAddress,
				peerPort: selectedDevice.port,
			});
			setConnectionState("connected");
			setLatencyMs(latency);
			setConnectionStatus({
				device_id: selectedDevice.device_id,
				connected: true,
				latency_ms: latency,
			});
		} catch (err) {
			console.warn("ping_device failed:", err);
			setConnectionState("unreachable");
			setConnectionStatus({
				device_id: selectedDevice.device_id,
				connected: false,
				error: String(err),
			});
		}
	}, [
		selectedDevice,
		localDeviceId,
		setConnectionStatus,
		setDeviceConnecting,
	]);

	// ── Listen for backend connection-status events ─────────────────────
	useEffect(() => {
		let unlisten: (() => void) | undefined;

		listen<ConnectionStatusEvent>("connection-status", (event) => {
			if (event.payload.device_id !== selectedDevice?.device_id) return;

			setConnectionStatus(event.payload);

			if (event.payload.connected) {
				setConnectionState("connected");
				if (event.payload.latency_ms != null) {
					setLatencyMs(event.payload.latency_ms);
				}
			} else {
				setConnectionState("unreachable");
			}
		}).then((fn) => {
			unlisten = fn;
		});

		return () => unlisten?.();
	}, [selectedDevice?.device_id, setConnectionStatus]);

	// ── Run pre-connect whenever the target device changes ──────────────
	useEffect(() => {
		setConnectionState("idle");
		setLatencyMs(null);
		preConnect();
	}, [selectedDevice?.device_id]); // eslint-disable-line react-hooks/exhaustive-deps

	// ── Track which chat is currently open (suppresses toast for active chat) ──
	useEffect(() => {
		if (deviceId) {
			setActiveChatDeviceId(deviceId);
		}
		return () => {
			setActiveChatDeviceId(null);
		};
	}, [deviceId, setActiveChatDeviceId]);

	// ── Load messages from backend when chat opens ──────────────────────
	useEffect(() => {
		if (!selectedDevice || !localDeviceId) return;

		const loadMessages = async () => {
			try {
				const backendMessages = await invoke<Message[]>(
					"get_messages",
					{
						device1: localDeviceId,
						device2: selectedDevice.device_id,
					},
				);

				if (backendMessages && backendMessages.length > 0) {
					const key = getConversationKey(
						localDeviceId,
						selectedDevice.device_id,
					);
					const existingMessages = messages[key] || [];
					const existingIds = new Set(
						existingMessages.map((m) => m.id),
					);
					const newMessages = backendMessages.filter(
						(m) => !existingIds.has(m.id),
					);
					if (newMessages.length > 0) {
						setMessages(key, [...existingMessages, ...newMessages]);
					}
				}
			} catch (error) {
				console.error("Failed to load messages from backend:", error);
			}
		};

		loadMessages();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedDevice?.device_id, localDeviceId]);

	// ── Mark conversation as read when chat is active ───────────────────
	const markAsRead = useCallback(async () => {
		if (!selectedDevice || !localDeviceId) return;
		const key = getConversationKey(localDeviceId, selectedDevice.device_id);
		markConversationAsRead(key, localDeviceId);
		try {
			await invoke("mark_conversation_as_read", {
				conversationKey: key,
				readerDeviceId: localDeviceId,
			});
		} catch (error) {
			console.warn(
				"mark_conversation_as_read backend call failed:",
				error,
			);
		}
	}, [selectedDevice, localDeviceId, markConversationAsRead]);

	useEffect(() => {
		markAsRead();
	}, [markAsRead]);

	// ── Auto-mark as read when new messages arrive while chat is open ───
	const incomingMessageCount =
		conversationKey !== null
			? (messages[conversationKey] || []).filter(
					(m) => m.from_device_id !== localDeviceId,
				).length
			: 0;

	useEffect(() => {
		if (!conversationKey || !localDeviceId) return;
		markAsRead();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [incomingMessageCount, conversationKey]);

	// ── Send a system message (accept / decline) ────────────────────────
	const sendSystemMessage = useCallback(
		async (content: string) => {
			if (!selectedDevice || !localDeviceId) return;

			const peerAddress =
				selectedDevice.addresses && selectedDevice.addresses.length > 0
					? selectedDevice.addresses[0]
					: null;

			if (!peerAddress) return;

			try {
				const message = await invoke<Message>("send_message", {
					fromDeviceId: localDeviceId,
					toDeviceId: selectedDevice.device_id,
					content,
					peerAddress,
					peerPort: selectedDevice.port,
				});

				const key = getConversationKey(
					localDeviceId,
					selectedDevice.device_id,
				);
				addMessage(key, message);
			} catch (error) {
				console.error("Failed to send system message:", error);
			}
		},
		[selectedDevice, localDeviceId, addMessage],
	);

	// ── Handle Accept ───────────────────────────────────────────────────
	const handleAccept = useCallback(async () => {
		if (!selectedDevice) return;
		// 1. Update local privacy store
		approveDevice(selectedDevice.device_id);
		// 2. Also set our own outgoing status to accepted (mutual approval)
		setChatRequestStatus(selectedDevice.device_id, "accepted");
		// 3. Send system message so the sender knows
		await sendSystemMessage(SYS_CHAT_ACCEPTED);
		console.log(
			`✅ Accepted chat request from ${selectedDevice.display_name}`,
		);
	}, [
		selectedDevice,
		approveDevice,
		setChatRequestStatus,
		sendSystemMessage,
	]);

	// ── Handle Decline ──────────────────────────────────────────────────
	const handleDecline = useCallback(async () => {
		if (!selectedDevice) return;
		// 1. Update local privacy store
		declineDevice(selectedDevice.device_id);
		// 2. Send system message so the sender knows
		await sendSystemMessage(SYS_CHAT_DECLINED);
		console.log(
			`❌ Declined chat request from ${selectedDevice.display_name}`,
		);
	}, [selectedDevice, declineDevice, sendSystemMessage]);

	// ── Send a regular message ──────────────────────────────────────────
	const handleSendMessage = async (text: string) => {
		if (!selectedDevice || !localDeviceId) {
			console.error("Missing device or local device ID");
			return;
		}

		const peerAddress =
			selectedDevice.addresses && selectedDevice.addresses.length > 0
				? selectedDevice.addresses[0]
				: null;

		if (!peerAddress) {
			alert(
				"Device has no available network address. Make sure both devices are on the same network.",
			);
			return;
		}

		// If connection is not yet confirmed, wait for it (up to 4 s)
		if (connectionState !== "connected") {
			try {
				await invoke("ping_device", {
					deviceId: selectedDevice.device_id,
					peerAddress,
					peerPort: selectedDevice.port,
				});
				setConnectionState("connected");
			} catch {
				// Let send_message attempt anyway; it will reconnect internally
			}
		}

		try {
			const message = await invoke<Message>("send_message", {
				fromDeviceId: localDeviceId,
				toDeviceId: selectedDevice.device_id,
				content: text,
				peerAddress,
				peerPort: selectedDevice.port,
			});

			// Optimistically add to store; 'message-sent' event will deduplicate
			const key = getConversationKey(
				localDeviceId,
				selectedDevice.device_id,
			);
			addMessage(key, message);

			// If this is the first message we're sending and we initiated from
			// Discovery (approvalState is 'none'), set outgoing status to 'pending'
			if (approvalState === "none") {
				// Ensure the device is in startedChats
				if (!startedChats.includes(selectedDevice.device_id)) {
					startChat(selectedDevice.device_id);
				}
				// Mark our outgoing request as pending (they haven't approved yet)
				const currentStatus =
					chatRequestStatus[selectedDevice.device_id];
				if (!currentStatus || currentStatus === "pending") {
					setChatRequestStatus(selectedDevice.device_id, "pending");
				}
			}
		} catch (error) {
			console.error("Failed to send message:", error);
			alert(
				`Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	};

	// ── Render ───────────────────────────────────────────────────────────
	if (!selectedDevice) {
		return (
			<div className="flex items-center justify-center h-full">
				<p className="text-muted-foreground">Device not found</p>
			</div>
		);
	}

	return (
		<ChatWindow
			recipientName={selectedDevice.display_name}
			recipientStatus={
				Date.now() - selectedDevice.last_seen * 1000 < 60_000
					? "online"
					: "offline"
			}
			connectionState={connectionState}
			latencyMs={latencyMs}
			messages={currentMessages.map((msg) => ({
				id: msg.id,
				content: getMessageContent(msg.message_type),
				sender: msg.from_device_id === localDeviceId ? "me" : "them",
				timestamp: new Date(msg.timestamp * 1000).toLocaleTimeString(
					[],
					{
						hour: "2-digit",
						minute: "2-digit",
					},
				),
				rawTimestamp: msg.timestamp,
				status: msg.status as "sent" | "delivered" | "read",
				type: "text",
			}))}
			onSendMessage={handleSendMessage}
			// Privacy layer props
			approvalState={approvalState}
			onAcceptRequest={handleAccept}
			onDeclineRequest={handleDecline}
		/>
	);
}
