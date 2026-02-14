import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Device, Message, FileTransfer } from '@/lib/schemas';

interface Thread {
  id: string;
  participants: string[];
  last_message_timestamp: number;
  unread_count: number;
}

interface AppStore {
  // User state
  localDeviceId: string | null;
  deviceName: string | null;
  isOnboarded: boolean;

  // Discovery state
  devices: Device[];

  // Messaging state
  messages: Record<string, Message[]>;
  threads: Thread[];
  activeThread: string | null;

  // File transfer state
  transfers: FileTransfer[];

  // Theme state
  theme: 'light' | 'dark';

  // Actions
  setLocalDeviceId: (id: string) => void;
  setDeviceName: (name: string) => void;
  setOnboarded: (value: boolean) => void;

  addDevice: (device: Device) => void;
  removeDevice: (deviceId: string) => void;
  setDevices: (devices: Device[]) => void;

  addMessage: (conversationKey: string, message: Message) => void;
  setMessages: (conversationKey: string, messages: Message[]) => void;
  setThreads: (threads: Thread[]) => void;
  setActiveThread: (threadId: string | null) => void;

  addTransfer: (transfer: FileTransfer) => void;
  updateTransfer: (transfer: FileTransfer) => void;
  setTransfers: (transfers: FileTransfer[]) => void;

  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // Initial state
      localDeviceId: null,
      deviceName: null,
      isOnboarded: false,
      devices: [],
      messages: {},
      threads: [],
      activeThread: null,
      transfers: [],
      theme: 'dark',

      // Actions
      setLocalDeviceId: (id) => set({ localDeviceId: id }),
      setDeviceName: (name) => set({ deviceName: name }),
      setOnboarded: (value) => set({ isOnboarded: value }),

      addDevice: (device) => set((state) => ({
        devices: [...state.devices.filter(d => d.id !== device.id), device],
      })),

      removeDevice: (deviceId) => set((state) => ({
        devices: state.devices.filter(d => d.id !== deviceId),
      })),

      setDevices: (devices) => set({ devices }),

      addMessage: (conversationKey, message) => set((state) => {
        console.log('🗂️ Adding message to store:', conversationKey, message);
        const existingMessages = state.messages[conversationKey] || [];

        // Check for duplicates
        const isDuplicate = existingMessages.some(m => m.id === message.id);
        if (isDuplicate) {
          console.log('⚠️ Duplicate message, skipping:', message.id);
          return state;
        }

        const updatedMessages = {
          ...state.messages,
          [conversationKey]: [...existingMessages, message],
        };

        console.log('✅ Message added. Total messages:', updatedMessages[conversationKey].length);
        return { messages: updatedMessages };
      }),

      setMessages: (conversationKey, messages) => set((state) => ({
        messages: {
          ...state.messages,
          [conversationKey]: messages,
        },
      })),

      setThreads: (threads) => set({ threads }),
      setActiveThread: (threadId) => set({ activeThread: threadId }),

      addTransfer: (transfer) => set((state) => ({
        transfers: [...state.transfers, transfer],
      })),

      updateTransfer: (transfer) => set((state) => ({
        transfers: state.transfers.map((t) => t.id === transfer.id ? transfer : t),
      })),

      setTransfers: (transfers) => set({ transfers }),

      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'hyper-connect-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        localDeviceId: state.localDeviceId,
        deviceName: state.deviceName,
        isOnboarded: state.isOnboarded,
        theme: state.theme,
        messages: state.messages, // Persist messages for chat history
      }),
    }
  )
);
