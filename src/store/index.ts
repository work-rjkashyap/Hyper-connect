import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Device,
  Message,
  FileTransfer,
  Thread,
  DeviceIdentity,
} from "@/types";

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

  // UI state
  theme: "light" | "dark";
  sidebarOpen: boolean;

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
  clearMessages: (conversationKey: string) => void;

  // Thread Actions
  setThreads: (threads: Thread[]) => void;
  setActiveThread: (threadId: string | null) => void;
  updateThreadUnreadCount: (threadId: string, count: number) => void;

  // File Transfer Actions
  addTransfer: (transfer: FileTransfer) => void;
  updateTransfer: (transferId: string, updates: Partial<FileTransfer>) => void;
  removeTransfer: (transferId: string) => void;
  setTransfers: (transfers: FileTransfer[]) => void;
  getTransferById: (transferId: string) => FileTransfer | undefined;

  // UI Actions
  toggleTheme: () => void;
  setTheme: (theme: "light" | "dark") => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

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
  theme: "dark" as const,
  sidebarOpen: true,
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
        set((state) => ({
          devices: state.devices.filter((d) => d.device_id !== deviceId),
          connectedDevices: new Set(
            [...state.connectedDevices].filter((id) => id !== deviceId),
          ),
        })),

      updateDevice: (device) =>
        set((state) => ({
          devices: state.devices.map((d) =>
            d.device_id === device.device_id ? device : d,
          ),
        })),

      setDevices: (devices) =>
        set((state) => ({
          devices: devices.filter((d) => d.device_id !== state.localDeviceId),
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
          connectedDevices: new Set([...state.connectedDevices, deviceId]),
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
          const existingMessages = state.messages[conversationKey] || [];

          // Check for duplicates
          const isDuplicate = existingMessages.some((m) => m.id === message.id);
          if (isDuplicate) {
            console.log("⚠️ Duplicate message, skipping:", message.id);
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
                m.id === messageId ? { ...m, read: true } : m,
              ),
            },
          };
        }),

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
              ? { ...t, ...updates, updated_at: Date.now() }
              : t,
          ),
        })),

      removeTransfer: (transferId) =>
        set((state) => ({
          transfers: state.transfers.filter((t) => t.id !== transferId),
        })),

      setTransfers: (transfers) => set({ transfers }),

      getTransferById: (transferId) => {
        return get().transfers.find((t) => t.id === transferId);
      },

      // ============================================================================
      // UI Actions
      // ============================================================================

      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === "light" ? "dark" : "light",
        })),

      setTheme: (theme) => set({ theme }),

      toggleSidebar: () =>
        set((state) => ({
          sidebarOpen: !state.sidebarOpen,
        })),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

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
        sidebarOpen: state.sidebarOpen,
        messages: state.messages, // Persist chat history
      }),
    },
  ),
);
