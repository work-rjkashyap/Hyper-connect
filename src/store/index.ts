import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
	Device,
	Message,
	FileTransfer,
	Thread,
	DeviceIdentity,
	MessageStatus,
	ConnectionStatusEvent,
	GroupChat,
	GroupMessage,
	GroupMember,
} from "@/types";

export type DeviceConnectionState =
	| "idle"
	| "connecting"
	| "connected"
	| "unreachable";

export type ChatRequestStatus = "pending" | "accepted" | "declined";

interface AppStore {
	// User/Identity state
	localDeviceId: string | null;
	deviceName: string | null;
	isOnboarded: boolean;
	deviceIdentity: DeviceIdentity | null;

	// Discovery state
	devices: Device[];
	connectedDevices: Set<string>;

	// Messaging state
	messages: Record<string, Message[]>; // Keyed by conversation_key
	threads: Thread[];
	activeThread: string | null;

	// File transfer state
	transfers: FileTransfer[];
	activeTransfers: Set<string>;

	// Group chat state
	groups: GroupChat[];
	groupMessages: Record<string, GroupMessage[]>; // Keyed by group_id
	groupMembers: Record<string, GroupMember[]>; // Keyed by group_id
	activeGroupId: string | null;

	// Download directory (persisted)
	downloadDir: string | null;

	// Connection health state (per device)
	deviceConnectionStatus: Record<string, DeviceConnectionState>;
	deviceLatencyMs: Record<string, number>;

	// ============================================================================
	// Privacy Layer State
	// ============================================================================

	/** Device IDs the user has explicitly started a chat with (from Discovery). */
	startedChats: string[];

	/** Device IDs whose incoming messages this user has approved (accepted). */
	approvedDevices: string[];

	/** Device IDs whose incoming messages this user has declined. */
	declinedDevices: string[];

	/**
	 * Tracks the approval status of our OUTGOING chat requests.
	 * Key = remote device ID, Value = status.
	 *
	 * - 'pending'  → we sent a message, waiting for remote to accept/decline.
	 * - 'accepted' → remote accepted our request, we can send freely.
	 * - 'declined' → remote declined our request, sending is blocked.
	 */
	chatRequestStatus: Record<string, ChatRequestStatus>;

	// Download directory actions
	setDownloadDir: (path: string) => void;

	// UI state
	theme: "light" | "dark";
	accentColor: string;
	sidebarOpen: boolean;
	/** The device ID of the chat currently open on screen (null if no chat is open). */
	activeChatDeviceId: string | null;

	// Notification settings (persisted)
	/** Whether push/toast notifications are enabled globally. */
	notificationsEnabled: boolean;
	/** Whether sound feedback is played on incoming messages. */
	soundEnabled: boolean;

	// App settings (persisted)
	appSettings: {
		autoDiscovery: boolean;
		autoUpdate: boolean;
		visibleToAll: boolean;
		hardwareAcceleration: boolean;
		requireApproval: boolean;
		blockUnknown: boolean;
		port: string;
		cacheSize: string;
	};

	// Identity Actions
	setLocalDeviceId: (id: string) => void;
	setDeviceName: (name: string) => void;
	setOnboarded: (value: boolean) => void;
	setDeviceIdentity: (identity: DeviceIdentity) => void;

	// Discovery Actions
	addDevice: (device: Device) => void;
	removeDevice: (deviceId: string) => void;
	updateDevice: (device: Device) => void;
	setDevices: (devices: Device[]) => void;
	clearDevices: () => void;

	// Connection state
	setDeviceConnected: (deviceId: string) => void;
	setDeviceDisconnected: (deviceId: string) => void;
	isDeviceConnected: (deviceId: string) => boolean;

	// Messaging Actions
	addMessage: (conversationKey: string, message: Message) => void;
	setMessages: (conversationKey: string, messages: Message[]) => void;
	markMessageAsRead: (conversationKey: string, messageId: string) => void;
	markConversationAsRead: (
		conversationKey: string,
		readerDeviceId: string,
	) => void;
	updateMessageStatus: (
		conversationKey: string,
		messageId: string,
		status: MessageStatus,
	) => void;
	/** Flip all messages we *sent* in a conversation to "read" (triggered by an
	 *  incoming read-receipt from the peer). */
	markSentMessagesAsRead: (
		conversationKey: string,
		senderDeviceId: string,
	) => void;
	clearMessages: (conversationKey: string) => void;
	getUnreadCount: (conversationKey: string, readerDeviceId: string) => number;

	// Thread Actions
	setThreads: (threads: Thread[]) => void;
	setActiveThread: (threadId: string | null) => void;
	updateThreadUnreadCount: (threadId: string, count: number) => void;

	// File Transfer Actions
	addTransfer: (transfer: FileTransfer) => void;
	updateTransfer: (
		transferId: string,
		updates: Partial<FileTransfer>,
	) => void;
	removeTransfer: (transferId: string) => void;
	setTransfers: (transfers: FileTransfer[]) => void;
	getTransferById: (transferId: string) => FileTransfer | undefined;

	// Group Chat Actions
	addGroup: (group: GroupChat) => void;
	updateGroup: (group: GroupChat) => void;
	removeGroup: (groupId: string) => void;
	setGroups: (groups: GroupChat[]) => void;
	addGroupMessage: (groupId: string, message: GroupMessage) => void;
	setGroupMessages: (groupId: string, messages: GroupMessage[]) => void;
	setGroupMembers: (groupId: string, members: GroupMember[]) => void;
	updateGroupHost: (groupId: string, hostDeviceId: string) => void;
	setActiveGroupId: (groupId: string | null) => void;
	clearGroupMessages: (groupId: string) => void;

	// Connection Health Actions
	setConnectionStatus: (event: ConnectionStatusEvent) => void;
	setDeviceConnecting: (deviceId: string) => void;

	// ============================================================================
	// Privacy Layer Actions
	// ============================================================================

	/** Mark a device as "started chat" so it appears in the sidebar.
	 *  Also implicitly approves the device (you initiated contact). */
	startChat: (deviceId: string) => void;

	/** Accept an incoming chat request — adds to approvedDevices, ensures it's
	 *  in startedChats, and removes from declinedDevices if present. */
	approveDevice: (deviceId: string) => void;

	/** Decline an incoming chat request — adds to declinedDevices and removes
	 *  from approvedDevices if present. */
	declineDevice: (deviceId: string) => void;

	/** Update the status of an outgoing chat request (called when we receive
	 *  a system response from the remote device). */
	setChatRequestStatus: (deviceId: string, status: ChatRequestStatus) => void;

	/** Check whether a device has been approved by the local user. */
	isDeviceApproved: (deviceId: string) => boolean;

	/** Check whether a chat with a device has been explicitly started. */
	hasChatStarted: (deviceId: string) => boolean;

	/** Check whether a device has been declined by the local user. */
	isDeviceDeclined: (deviceId: string) => boolean;

	/** Add a device to startedChats without approving (used when receiving
	 *  an incoming message from an unknown device). */
	addToStartedChats: (deviceId: string) => void;

	// UI Actions
	toggleTheme: () => void;
	setTheme: (theme: "light" | "dark") => void;
	setAccentColor: (color: string) => void;
	toggleSidebar: () => void;
	setSidebarOpen: (open: boolean) => void;
	/** Set the device ID of the currently open chat (null to clear). */
	setActiveChatDeviceId: (deviceId: string | null) => void;

	// Notification Settings Actions
	setNotificationsEnabled: (enabled: boolean) => void;
	setSoundEnabled: (enabled: boolean) => void;

	// App Settings Actions
	updateAppSettings: (updates: Partial<AppStore["appSettings"]>) => void;

	// Utility Actions
	reset: () => void;
}

const initialState = {
	localDeviceId: null,
	deviceName: null,
	isOnboarded: false,
	deviceIdentity: null,
	devices: [],
	connectedDevices: new Set<string>(),
	messages: {},
	threads: [],
	activeThread: null,
	transfers: [],
	activeTransfers: new Set<string>(),
	groups: [] as GroupChat[],
	groupMessages: {} as Record<string, GroupMessage[]>,
	groupMembers: {} as Record<string, GroupMember[]>,
	activeGroupId: null as string | null,
	deviceConnectionStatus: {},
	deviceLatencyMs: {},
	// Privacy layer
	startedChats: [] as string[],
	approvedDevices: [] as string[],
	declinedDevices: [] as string[],
	chatRequestStatus: {} as Record<string, ChatRequestStatus>,
	// Download directory
	downloadDir: null as string | null,
	// UI
	theme: "dark" as const,
	accentColor: "Violet",
	sidebarOpen: true,
	activeChatDeviceId: null,
	// Notification settings
	notificationsEnabled: true,
	soundEnabled: true,
	// App settings
	appSettings: {
		autoDiscovery: true,
		autoUpdate: true,
		visibleToAll: true,
		hardwareAcceleration: true,
		requireApproval: true,
		blockUnknown: false,
		port: "5353",
		cacheSize: "500",
	},
};

export const useAppStore = create<AppStore>()(
	persist(
		(set, get) => ({
			...initialState,

			// ============================================================================
			// Identity Actions
			// ============================================================================

			setLocalDeviceId: (id) => set({ localDeviceId: id }),

			setDeviceName: (name) => set({ deviceName: name }),

			setOnboarded: (value) => set({ isOnboarded: value }),

			setDeviceIdentity: (identity) =>
				set({
					deviceIdentity: identity,
					localDeviceId: identity.device_id,
					deviceName: identity.display_name,
				}),

			// ============================================================================
			// Discovery Actions
			// ============================================================================

			addDevice: (device) =>
				set((state) => {
					// Don't add self
					if (device.device_id === state.localDeviceId) {
						return state;
					}

					// Update if exists, otherwise add
					const exists = state.devices.some(
						(d) => d.device_id === device.device_id,
					);
					if (exists) {
						return {
							devices: state.devices.map((d) =>
								d.device_id === device.device_id ? device : d,
							),
						};
					}

					return {
						devices: [...state.devices, device],
					};
				}),

			removeDevice: (deviceId) =>
				set((state) => {
					const hasChat = state.startedChats.includes(deviceId);
					return {
						devices: hasChat
							? state.devices.map((d) =>
									d.device_id === deviceId
										? { ...d, last_seen: 0 }
										: d,
								)
							: state.devices.filter(
									(d) => d.device_id !== deviceId,
								),
						connectedDevices: new Set(
							[...state.connectedDevices].filter(
								(id) => id !== deviceId,
							),
						),
					};
				}),

			updateDevice: (device) =>
				set((state) => ({
					devices: state.devices.map((d) =>
						d.device_id === device.device_id ? device : d,
					),
				})),

			setDevices: (devices) =>
				set((state) => ({
					devices: devices.filter(
						(d) => d.device_id !== state.localDeviceId,
					),
				})),

			clearDevices: () =>
				set({
					devices: [],
					connectedDevices: new Set(),
				}),

			// ============================================================================
			// Connection State
			// ============================================================================

			setDeviceConnected: (deviceId) =>
				set((state) => ({
					connectedDevices: new Set([
						...state.connectedDevices,
						deviceId,
					]),
				})),

			setDeviceDisconnected: (deviceId) =>
				set((state) => {
					const updated = new Set(state.connectedDevices);
					updated.delete(deviceId);
					return { connectedDevices: updated };
				}),

			isDeviceConnected: (deviceId) => {
				return get().connectedDevices.has(deviceId);
			},

			// ============================================================================
			// Messaging Actions
			// ============================================================================

			addMessage: (conversationKey, message) =>
				set((state) => {
					const existingMessages =
						state.messages[conversationKey] || [];

					// Check for duplicates
					const isDuplicate = existingMessages.some(
						(m) => m.id === message.id,
					);
					if (isDuplicate) {
						console.log(
							"⚠️ Duplicate message, skipping:",
							message.id,
						);
						return state;
					}

					const updatedMessages = {
						...state.messages,
						[conversationKey]: [...existingMessages, message].sort(
							(a, b) => a.timestamp - b.timestamp,
						),
					};

					return { messages: updatedMessages };
				}),

			setMessages: (conversationKey, messages) =>
				set((state) => ({
					messages: {
						...state.messages,
						[conversationKey]: messages.sort(
							(a, b) => a.timestamp - b.timestamp,
						),
					},
				})),

			markMessageAsRead: (conversationKey, messageId) =>
				set((state) => {
					const messages = state.messages[conversationKey];
					if (!messages) return state;

					return {
						messages: {
							...state.messages,
							[conversationKey]: messages.map((m) =>
								m.id === messageId
									? { ...m, status: "read" as MessageStatus }
									: m,
							),
						},
					};
				}),

			markConversationAsRead: (conversationKey, readerDeviceId) =>
				set((state) => {
					const messages = state.messages[conversationKey];
					if (!messages) return state;

					const updated = messages.map((m) => {
						// Only mark messages from the OTHER device that are not yet read.
						if (
							m.from_device_id !== readerDeviceId &&
							m.status !== "read"
						) {
							return { ...m, status: "read" as MessageStatus };
						}
						return m;
					});

					return {
						messages: {
							...state.messages,
							[conversationKey]: updated,
						},
					};
				}),

			updateMessageStatus: (conversationKey, messageId, status) =>
				set((state) => {
					const messages = state.messages[conversationKey];
					if (!messages) return state;

					return {
						messages: {
							...state.messages,
							[conversationKey]: messages.map((m) =>
								m.id === messageId ? { ...m, status } : m,
							),
						},
					};
				}),

			markSentMessagesAsRead: (conversationKey, senderDeviceId) =>
				set((state) => {
					const messages = state.messages[conversationKey];
					if (!messages) return state;

					const updated = messages.map((m) => {
						// Only touch messages that we sent and that haven't been marked read yet
						if (
							m.from_device_id === senderDeviceId &&
							m.status !== "read"
						) {
							return { ...m, status: "read" as MessageStatus };
						}
						return m;
					});

					return {
						messages: {
							...state.messages,
							[conversationKey]: updated,
						},
					};
				}),

			getUnreadCount: (conversationKey, readerDeviceId) => {
				const messages = get().messages[conversationKey] || [];
				return messages.filter(
					(m) =>
						m.from_device_id !== readerDeviceId &&
						m.status !== "read",
				).length;
			},

			clearMessages: (conversationKey) =>
				set((state) => {
					const { [conversationKey]: _, ...rest } = state.messages;
					return { messages: rest };
				}),

			// ============================================================================
			// Thread Actions
			// ============================================================================

			setThreads: (threads) => set({ threads }),

			setActiveThread: (threadId) => set({ activeThread: threadId }),

			updateThreadUnreadCount: (threadId, count) =>
				set((state) => ({
					threads: state.threads.map((t) =>
						t.id === threadId ? { ...t, unread_count: count } : t,
					),
				})),

			// ============================================================================
			// File Transfer Actions
			// ============================================================================

			addTransfer: (transfer) =>
				set((state) => ({
					transfers: [...state.transfers, transfer],
				})),

			updateTransfer: (transferId, updates) =>
				set((state) => ({
					transfers: state.transfers.map((t) =>
						t.id === transferId
							? {
									...t,
									...updates,
									updated_at: Math.floor(Date.now() / 1000),
								}
							: t,
					),
				})),

			removeTransfer: (transferId) =>
				set((state) => ({
					transfers: state.transfers.filter(
						(t) => t.id !== transferId,
					),
				})),

			setTransfers: (transfers) => set({ transfers }),

			getTransferById: (transferId) => {
				return get().transfers.find((t) => t.id === transferId);
			},

			// ============================================================================
			// Group Chat Actions
			// ============================================================================

			addGroup: (group) =>
				set((state) => ({
					groups: [
						...state.groups.filter((g) => g.id !== group.id),
						group,
					].sort((a, b) => b.updated_at - a.updated_at),
				})),

			updateGroup: (group) =>
				set((state) => ({
					groups: state.groups
						.map((g) => (g.id === group.id ? group : g))
						.sort((a, b) => b.updated_at - a.updated_at),
				})),

			removeGroup: (groupId) =>
				set((state) => {
					const { [groupId]: _msgs, ...restMessages } =
						state.groupMessages;
					const { [groupId]: _members, ...restMembers } =
						state.groupMembers;
					return {
						groups: state.groups.filter((g) => g.id !== groupId),
						groupMessages: restMessages,
						groupMembers: restMembers,
						activeGroupId:
							state.activeGroupId === groupId
								? null
								: state.activeGroupId,
					};
				}),

			setGroups: (groups) =>
				set({
					groups: [...groups].sort(
						(a, b) => b.updated_at - a.updated_at,
					),
				}),

			addGroupMessage: (groupId, message) =>
				set((state) => {
					const existing = state.groupMessages[groupId] || [];
					if (existing.some((m) => m.id === message.id)) {
						return state;
					}
					return {
						groupMessages: {
							...state.groupMessages,
							[groupId]: [...existing, message],
						},
						groups: state.groups
							.map((g) =>
								g.id === groupId
									? { ...g, updated_at: message.timestamp }
									: g,
							)
							.sort((a, b) => b.updated_at - a.updated_at),
					};
				}),

			setGroupMessages: (groupId, messages) =>
				set((state) => ({
					groupMessages: {
						...state.groupMessages,
						[groupId]: messages,
					},
				})),

			setGroupMembers: (groupId, members) =>
				set((state) => ({
					groupMembers: {
						...state.groupMembers,
						[groupId]: members,
					},
				})),

			updateGroupHost: (groupId, hostDeviceId) =>
				set((state) => ({
					groups: state.groups.map((g) =>
						g.id === groupId
							? { ...g, host_device_id: hostDeviceId }
							: g,
					),
					groupMembers: {
						...state.groupMembers,
						[groupId]: (state.groupMembers[groupId] || []).map(
							(m) => ({
								...m,
								role:
									m.device_id === hostDeviceId
										? ("host" as const)
										: ("member" as const),
							}),
						),
					},
				})),

			setActiveGroupId: (groupId) => set({ activeGroupId: groupId }),

			clearGroupMessages: (groupId) =>
				set((state) => {
					const { [groupId]: _, ...rest } = state.groupMessages;
					return { groupMessages: rest };
				}),

			// ============================================================================
			// Connection Health Actions
			// ============================================================================

			setConnectionStatus: (event) =>
				set((state) => ({
					deviceConnectionStatus: {
						...state.deviceConnectionStatus,
						[event.device_id]: event.connected
							? "connected"
							: "unreachable",
					},
					deviceLatencyMs:
						event.connected && event.latency_ms != null
							? {
									...state.deviceLatencyMs,
									[event.device_id]: event.latency_ms,
								}
							: state.deviceLatencyMs,
				})),

			setDeviceConnecting: (deviceId) =>
				set((state) => ({
					deviceConnectionStatus: {
						...state.deviceConnectionStatus,
						[deviceId]: "connecting",
					},
				})),

			// ============================================================================
			// Privacy Layer Actions
			// ============================================================================

			startChat: (deviceId) =>
				set((state) => {
					const alreadyStarted =
						state.startedChats.includes(deviceId);
					const alreadyApproved =
						state.approvedDevices.includes(deviceId);

					return {
						// Add to startedChats if not already present
						startedChats: alreadyStarted
							? state.startedChats
							: [...state.startedChats, deviceId],
						// Initiator implicitly approves the device for incoming messages
						approvedDevices: alreadyApproved
							? state.approvedDevices
							: [...state.approvedDevices, deviceId],
						// Remove from declined if it was previously declined
						declinedDevices: state.declinedDevices.filter(
							(id) => id !== deviceId,
						),
						// Set outgoing request status to pending (they haven't approved us yet)
						// unless they already accepted
						chatRequestStatus: {
							...state.chatRequestStatus,
							[deviceId]:
								state.chatRequestStatus[deviceId] === "accepted"
									? "accepted"
									: "pending",
						},
					};
				}),

			approveDevice: (deviceId) =>
				set((state) => ({
					approvedDevices: state.approvedDevices.includes(deviceId)
						? state.approvedDevices
						: [...state.approvedDevices, deviceId],
					// Also ensure it's in startedChats
					startedChats: state.startedChats.includes(deviceId)
						? state.startedChats
						: [...state.startedChats, deviceId],
					// Remove from declined
					declinedDevices: state.declinedDevices.filter(
						(id) => id !== deviceId,
					),
				})),

			declineDevice: (deviceId) =>
				set((state) => ({
					declinedDevices: state.declinedDevices.includes(deviceId)
						? state.declinedDevices
						: [...state.declinedDevices, deviceId],
					// Remove from approved
					approvedDevices: state.approvedDevices.filter(
						(id) => id !== deviceId,
					),
				})),

			setChatRequestStatus: (deviceId, status) =>
				set((state) => ({
					chatRequestStatus: {
						...state.chatRequestStatus,
						[deviceId]: status,
					},
				})),

			isDeviceApproved: (deviceId) => {
				return get().approvedDevices.includes(deviceId);
			},

			hasChatStarted: (deviceId) => {
				return get().startedChats.includes(deviceId);
			},

			isDeviceDeclined: (deviceId) => {
				return get().declinedDevices.includes(deviceId);
			},

			addToStartedChats: (deviceId) =>
				set((state) => ({
					startedChats: state.startedChats.includes(deviceId)
						? state.startedChats
						: [...state.startedChats, deviceId],
				})),

			// ============================================================================
			// UI Actions
			// ============================================================================

			setDownloadDir: (path) => set({ downloadDir: path }),

			toggleTheme: () =>
				set((state) => ({
					theme: state.theme === "light" ? "dark" : "light",
				})),

			setTheme: (theme) => set({ theme }),

			setAccentColor: (color) => set({ accentColor: color }),

			toggleSidebar: () =>
				set((state) => ({
					sidebarOpen: !state.sidebarOpen,
				})),

			setSidebarOpen: (open) => set({ sidebarOpen: open }),

			setActiveChatDeviceId: (deviceId) =>
				set({ activeChatDeviceId: deviceId }),

			// ============================================================================
			// Notification Settings Actions
			// ============================================================================

			setNotificationsEnabled: (enabled) =>
				set({ notificationsEnabled: enabled }),

			setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),

			updateAppSettings: (updates) =>
				set((state) => ({
					appSettings: { ...state.appSettings, ...updates },
				})),

			// ============================================================================
			// Utility Actions
			// ============================================================================

			reset: () => set(initialState),
		}),
		{
			name: "hyper-connect-storage",
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({
				localDeviceId: state.localDeviceId,
				deviceName: state.deviceName,
				isOnboarded: state.isOnboarded,
				deviceIdentity: state.deviceIdentity,
				theme: state.theme,
				accentColor: state.accentColor,
				sidebarOpen: state.sidebarOpen,
				messages: state.messages, // Persist chat history
				// Privacy layer — persisted so approvals survive app restart
				startedChats: state.startedChats,
				approvedDevices: state.approvedDevices,
				declinedDevices: state.declinedDevices,
				chatRequestStatus: state.chatRequestStatus,
				// Download directory — persisted
				downloadDir: state.downloadDir,
				// Notification settings — persisted
				notificationsEnabled: state.notificationsEnabled,
				soundEnabled: state.soundEnabled,
				// App settings — persisted
				appSettings: state.appSettings,
			}),
		},
	),
);
