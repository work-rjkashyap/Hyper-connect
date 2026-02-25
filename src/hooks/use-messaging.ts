import React, { useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/store";
import type {
	Message,
	Thread,
	TextMessagePayload,
	MessageDeliveredEvent,
	MessageReadEvent,
} from "@/types";
import {
	getConversationKey,
	getMessageContent,
	isSystemMessage,
	getSystemMessageType,
} from "@/types";
import type { MessageStatus } from "@/types";
import { toast } from "@/hooks/use-toast";
import { playNotificationSound } from "@/lib/notificationSound";

/**
 * Hook to listen for real-time messaging events from Tauri backend.
 *
 * Privacy Layer integration:
 * - Incoming messages from unknown devices auto-add them to startedChats
 *   so they appear in the sidebar as pending chat requests.
 * - System messages (__SYS:CHAT_ACCEPTED__, __SYS:CHAT_DECLINED__) are
 *   intercepted and routed to the privacy store instead of being displayed.
 * - Toast notifications are suppressed for system messages.
 */
export function useMessaging() {
	const {
		addMessage,
		setMessages,
		setThreads,
		markMessageAsRead,
		markConversationAsRead,
		updateMessageStatus,
		markSentMessagesAsRead,
		localDeviceId,
		isOnboarded,
		// Privacy layer
		addToStartedChats,
		setChatRequestStatus,
	} = useAppStore();

	// Track shown toasts to prevent duplicates (use ref to persist across renders)
	const shownToastsRef = React.useRef(new Set<string>());

	// Helper to get device name - reads directly from store to avoid stale closures
	const getDeviceName = (deviceId: string): string => {
		const devices = useAppStore.getState().devices;
		const device = devices.find((d) => d.device_id === deviceId);
		return device?.display_name || "Unknown Device";
	};

	// Load messages for a conversation
	const loadMessages = useCallback(
		async (device1: string, device2: string) => {
			try {
				const messages = await invoke<Message[]>("get_messages", {
					device1,
					device2,
				});
				const conversationKey = getConversationKey(device1, device2);
				setMessages(conversationKey, messages);
				console.log(
					`📥 Loaded ${messages.length} messages for ${conversationKey}`,
				);
				return messages;
			} catch (error) {
				console.error("Failed to load messages:", error);
				return [];
			}
		},
		[setMessages],
	);

	// Load all threads
	const loadThreads = useCallback(async () => {
		try {
			const threads = await invoke<Thread[]>("get_threads");
			setThreads(threads);
			console.log(`📋 Loaded ${threads.length} threads`);
			return threads;
		} catch (error) {
			console.error("Failed to load threads:", error);
			return [];
		}
	}, [setThreads]);

	// Send a message
	const sendMessage = useCallback(
		async (
			toDeviceId: string,
			content: string,
			peerAddress: string,
			peerPort?: number,
		) => {
			if (!localDeviceId) {
				console.error("Cannot send message: no local device ID");
				return null;
			}

			try {
				const message = await invoke<Message>("send_message", {
					fromDeviceId: localDeviceId,
					toDeviceId,
					content,
					peerAddress,
					peerPort: peerPort ?? null,
				});

				console.log("📤 Message sent:", message);

				// Add to store
				const conversationKey = getConversationKey(
					localDeviceId,
					toDeviceId,
				);
				addMessage(conversationKey, message);

				return message;
			} catch (error) {
				console.error("Failed to send message:", error);
				toast({
					title: "Failed to send message",
					description: String(error),
					variant: "destructive",
				});
				return null;
			}
		},
		[localDeviceId, addMessage],
	);

	// Mark a single message as read
	const markRead = useCallback(
		async (messageId: string, conversationKey: string) => {
			try {
				await invoke("mark_as_read", {
					messageId,
					conversationKey,
				});
				markMessageAsRead(conversationKey, messageId);
			} catch (error) {
				console.error("Failed to mark message as read:", error);
			}
		},
		[markMessageAsRead],
	);

	// Mark every received message in a conversation as read (clears the unread badge)
	const markConversationRead = useCallback(
		async (conversationKey: string, readerDeviceId: string) => {
			// Optimistic local update first so the badge clears immediately
			markConversationAsRead(conversationKey, readerDeviceId);
			try {
				await invoke("mark_conversation_as_read", {
					conversationKey,
					readerDeviceId,
				});
			} catch (error) {
				console.warn(
					"mark_conversation_as_read backend call failed:",
					error,
				);
			}
		},
		[markConversationAsRead],
	);

	// Mark entire thread as read (legacy helper kept for compatibility)
	const markThreadRead = useCallback(async (threadId: string) => {
		try {
			await invoke("mark_thread_as_read", { threadId });
			console.log(`✅ Thread ${threadId} marked as read`);
		} catch (error) {
			console.error("Failed to mark thread as read:", error);
		}
	}, []);

	/**
	 * Handle an incoming message – this is where the privacy layer logic lives.
	 *
	 * 1. Check if it's a system message (CHAT_ACCEPTED / CHAT_DECLINED).
	 *    If so, route to privacy store and do NOT display in chat.
	 * 2. If the sender is unknown (not in startedChats), auto-add them so the
	 *    sidebar shows them as a pending chat request.
	 * 3. Normal messages are added to the store and a toast is shown.
	 */
	const handleIncomingMessage = useCallback(
		(msg: Message) => {
			if (!localDeviceId) return;

			const conversationKey = getConversationKey(
				msg.from_device_id,
				msg.to_device_id,
			);

			// ── System message interception ──────────────────────────────
			if (isSystemMessage(msg)) {
				const sysType = getSystemMessageType(msg);
				console.log(
					`🔒 System message from ${msg.from_device_id}: ${sysType}`,
				);

				if (sysType === "CHAT_ACCEPTED") {
					setChatRequestStatus(msg.from_device_id, "accepted");
					toast({
						title: "Chat request accepted",
						description: `${getDeviceName(msg.from_device_id)} accepted your chat request.`,
						duration: 5000,
					});
				} else if (sysType === "CHAT_DECLINED") {
					setChatRequestStatus(msg.from_device_id, "declined");
					toast({
						title: "Chat request declined",
						description: `${getDeviceName(msg.from_device_id)} declined your chat request.`,
						variant: "destructive",
						duration: 5000,
					});
				}

				// Still store the system message (so backend is in sync), but
				// the UI will filter it out when rendering.
				addMessage(conversationKey, msg);
				return;
			}

			// ── Privacy layer: auto-add unknown senders to startedChats ──
			// Read the latest state directly to avoid stale closures
			const state = useAppStore.getState();
			if (
				msg.from_device_id !== localDeviceId &&
				!state.startedChats.includes(msg.from_device_id)
			) {
				console.log(
					`🔔 New chat request from ${msg.from_device_id} – adding to startedChats`,
				);
				addToStartedChats(msg.from_device_id);
			}

			// ── Auto-accept: if we already approved them (e.g. both users
			// clicked "start chat" from Discovery), treat any real incoming
			// message as implicit acceptance of our outgoing request so
			// neither side gets stuck in "waiting for approval". ────────────
			if (
				msg.from_device_id !== localDeviceId &&
				state.approvedDevices.includes(msg.from_device_id) &&
				state.chatRequestStatus[msg.from_device_id] !== "accepted"
			) {
				console.log(
					`🤝 Auto-accepting outgoing request for ${msg.from_device_id} (they sent us a real message and we already approved them)`,
				);
				setChatRequestStatus(msg.from_device_id, "accepted");
			}

			// ── Normal message handling ──────────────────────────────────
			addMessage(conversationKey, msg);

			// Play sound and show toast for received messages (not from local device).
			// - Chat open   → play new-message.mp3 (subtle in-chat ping, no toast)
			// - Chat closed → play notification-sound.mp3 + show toast
			const { activeChatDeviceId: activeChatId, notificationsEnabled } =
				useAppStore.getState();

			const isChatOpen = msg.from_device_id === activeChatId;

			if (
				msg.from_device_id !== localDeviceId &&
				!shownToastsRef.current.has(msg.id)
			) {
				shownToastsRef.current.add(msg.id);

				// Clean up old toast IDs after 10 seconds to prevent memory leak
				setTimeout(() => {
					shownToastsRef.current.delete(msg.id);
				}, 10000);

				if (isChatOpen) {
					// Chat is open: play subtle in-chat ping (respects soundEnabled internally)
					playNotificationSound(true);
				} else if (notificationsEnabled) {
					// Chat is closed: play notification sound + show toast
					const senderName = getDeviceName(msg.from_device_id);
					const content = getMessageContent(msg.message_type);

					// Check if this is a pending request (sender not approved yet)
					const isApproved = state.approvedDevices.includes(
						msg.from_device_id,
					);

					// Play notification sound (respects soundEnabled setting internally)
					playNotificationSound(false);

					toast({
						title: isApproved
							? senderName
							: `💬 Chat request from ${senderName}`,
						description: isApproved
							? content.length > 100
								? content.substring(0, 100) + "..."
								: content
							: "Tap to view and accept or decline.",
						duration: 5000,
					});
				}
			}
		},
		[localDeviceId, addMessage, addToStartedChats, setChatRequestStatus],
	);

	// Listen for messaging events
	useEffect(() => {
		if (!isOnboarded || !localDeviceId) {
			console.log(
				"⏸️ Skipping messaging setup - not onboarded or no identity",
			);
			return;
		}

		let unlistenSent: (() => void) | undefined;
		let unlistenReceived: (() => void) | undefined;
		let unlistenDelivered: (() => void) | undefined;
		let unlistenRead: (() => void) | undefined;
		let unlistenQueued: (() => void) | undefined;
		let unlistenFlushed: (() => void) | undefined;
		let cancelled = false;

		const setupListeners = async () => {
			try {
				// Listen for sent messages
				const _unlistenSent = await listen<Message>(
					"message-sent",
					(event) => {
						console.log("📤 Message sent event:", event.payload);
						const msg = event.payload;
						const conversationKey = getConversationKey(
							msg.from_device_id,
							msg.to_device_id,
						);
						addMessage(conversationKey, msg);
					},
				);

				// Listen for received messages.
				// The backend now emits a full Message object (with status:"delivered")
				// from MessagingService.  We also accept the legacy TextMessagePayload
				// shape (no message_type / status fields) and normalise it.
				const _unlistenReceived = await listen<
					Message | TextMessagePayload
				>("message-received", (event) => {
					console.log("📥 Message received event:", event.payload);
					const raw = event.payload as unknown as Record<
						string,
						unknown
					>;

					// Normalise: if the payload has a top-level `content` string it is
					// a TextMessagePayload (legacy / plaintext path); otherwise it is a
					// full Message (encrypted path via MessagingService).
					let msg: Message;
					if (typeof raw.content === "string") {
						// Legacy TextMessagePayload shape
						const payload = raw as unknown as TextMessagePayload;
						msg = {
							id: payload.id,
							from_device_id: payload.from_device_id,
							to_device_id: payload.to_device_id,
							message_type: {
								type: "Text",
								content: payload.content,
							},
							timestamp: payload.timestamp,
							thread_id: payload.thread_id,
							status: "delivered" as MessageStatus,
						};
					} else {
						// Full Message shape from MessagingService
						msg = raw as unknown as Message;
						// Guarantee status is set
						if (!msg.status) {
							msg = {
								...msg,
								status: "delivered" as MessageStatus,
							};
						}
					}

					// Route through the privacy-aware handler
					handleIncomingMessage(msg);
				});

				// ── Delivery ACK ──────────────────────────────────────────────────
				const _unlistenDelivered = await listen<MessageDeliveredEvent>(
					"message-delivered",
					(event) => {
						const { conversation_key, message_id } = event.payload;
						console.log("📬 Delivery ACK for message:", message_id);
						updateMessageStatus(
							conversation_key,
							message_id,
							"delivered",
						);
					},
				);

				// ── Read receipt ──────────────────────────────────────────────────
				const _unlistenRead = await listen<MessageReadEvent>(
					"message-read",
					(event) => {
						const { conversation_key, to_device_id } =
							event.payload;
						console.log(
							"👁️  Read receipt for conversation:",
							conversation_key,
						);
						markSentMessagesAsRead(conversation_key, to_device_id);
					},
				);

				// ── Message queued (offline) ─────────────────────────────────────
				const _unlistenQueued = await listen<Message>(
					"message-queued",
					(event) => {
						console.log(
							"⏳ Message queued (peer offline):",
							event.payload.id,
						);
						const msg = event.payload;
						const conversationKey = getConversationKey(
							msg.from_device_id,
							msg.to_device_id,
						);
						// Update existing message status to queued (it was already
						// added optimistically with "sent" status by ChatPage)
						updateMessageStatus(conversationKey, msg.id, "queued");
					},
				);

				// ── Queue flushed (message retried successfully) ─────────────────
				const _unlistenFlushed = await listen<Message>(
					"message-queue-flushed",
					(event) => {
						console.log(
							"📬 Queued message flushed:",
							event.payload.id,
						);
						const msg = event.payload;
						const conversationKey = getConversationKey(
							msg.from_device_id,
							msg.to_device_id,
						);
						// Flip status from queued → sent
						updateMessageStatus(conversationKey, msg.id, "sent");
					},
				);

				// If the component unmounted before we finished setting up,
				// immediately clean up the listeners we just registered.
				if (cancelled) {
					_unlistenSent();
					_unlistenReceived();
					_unlistenDelivered();
					_unlistenRead();
					_unlistenQueued();
					_unlistenFlushed();
					return;
				}

				unlistenSent = _unlistenSent;
				unlistenReceived = _unlistenReceived;
				unlistenDelivered = _unlistenDelivered;
				unlistenRead = _unlistenRead;
				unlistenQueued = _unlistenQueued;
				unlistenFlushed = _unlistenFlushed;

				console.log("✅ Messaging listeners setup complete");
			} catch (error) {
				console.error("Failed to setup messaging listeners:", error);
			}
		};

		setupListeners();

		return () => {
			cancelled = true;
			if (unlistenSent) unlistenSent();
			if (unlistenReceived) unlistenReceived();
			if (unlistenDelivered) unlistenDelivered();
			if (unlistenRead) unlistenRead();
			if (unlistenQueued) unlistenQueued();
			if (unlistenFlushed) unlistenFlushed();
			// Clear toast tracking on cleanup
			shownToastsRef.current.clear();
			console.log("🧹 Messaging listeners cleaned up");
		};
		// Only re-run when onboarding status or localDeviceId changes
	}, [isOnboarded, localDeviceId]);

	return {
		sendMessage,
		loadMessages,
		loadThreads,
		markRead,
		markConversationRead,
		markThreadRead,
	};
}
