/**
 * API utilities for Tauri command invocations
 * Provides type-safe wrappers around Tauri commands
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  DeviceIdentity,
  Device,
  Message,
  Thread,
  FileTransfer,
} from "@/types";

// ============================================================================
// Identity API
// ============================================================================

export const identityApi = {
  /**
   * Get the current device identity
   */
  getDeviceInfo: async (): Promise<DeviceIdentity> => {
    return invoke<DeviceIdentity>("get_device_info");
  },

  /**
   * Update the display name
   * Note: Currently returns error in backend - requires Arc<Mutex<>> refactor
   */
  updateDisplayName: async (name: string): Promise<void> => {
    return invoke("update_display_name", { name });
  },

  /**
   * Get the local device ID
   */
  getLocalDeviceId: async (): Promise<string> => {
    return invoke<string>("get_local_device_id");
  },
};

// ============================================================================
// Discovery API
// ============================================================================

export const discoveryApi = {
  /**
   * Start mDNS discovery service
   */
  startDiscovery: async (): Promise<void> => {
    return invoke("start_discovery");
  },

  /**
   * Start advertising this device on mDNS
   */
  startAdvertising: async (port: number): Promise<void> => {
    return invoke("start_advertising", { port });
  },

  /**
   * Get all discovered devices
   */
  getDevices: async (): Promise<Device[]> => {
    return invoke<Device[]>("get_devices");
  },

  /**
   * Get the TCP port being used
   */
  getTcpPort: async (): Promise<number> => {
    return invoke<number>("get_tcp_port");
  },
};

// ============================================================================
// Messaging API
// ============================================================================

export const messagingApi = {
  /**
   * Send a text message to another device
   */
  sendMessage: async (params: {
    fromDeviceId: string;
    toDeviceId: string;
    content: string;
    peerAddress: string;
  }): Promise<Message> => {
    return invoke<Message>("send_message", {
      fromDeviceId: params.fromDeviceId,
      toDeviceId: params.toDeviceId,
      content: params.content,
      peerAddress: params.peerAddress,
    });
  },

  /**
   * Get messages between two devices
   */
  getMessages: async (
    device1: string,
    device2: string,
  ): Promise<Message[]> => {
    return invoke<Message[]>("get_messages", { device1, device2 });
  },

  /**
   * Get all message threads
   */
  getThreads: async (): Promise<Thread[]> => {
    return invoke<Thread[]>("get_threads");
  },

  /**
   * Mark a specific message as read
   */
  markAsRead: async (
    messageId: string,
    conversationKey: string,
  ): Promise<void> => {
    return invoke("mark_as_read", { messageId, conversationKey });
  },

  /**
   * Mark an entire thread as read
   */
  markThreadAsRead: async (threadId: string): Promise<void> => {
    return invoke("mark_thread_as_read", { threadId });
  },
};

// ============================================================================
// File Transfer API
// ============================================================================

export const fileTransferApi = {
  /**
   * Create a new file transfer
   */
  createTransfer: async (params: {
    filename: string;
    filePath: string;
    fromDeviceId: string;
    toDeviceId: string;
  }): Promise<FileTransfer> => {
    return invoke<FileTransfer>("create_transfer", {
      filename: params.filename,
      filePath: params.filePath,
      fromDeviceId: params.fromDeviceId,
      toDeviceId: params.toDeviceId,
    });
  },

  /**
   * Start a file transfer
   */
  startTransfer: async (
    transferId: string,
    peerAddress: string,
  ): Promise<void> => {
    return invoke("start_transfer", { transferId, peerAddress });
  },

  /**
   * Accept an incoming file transfer
   */
  acceptTransfer: async (transferId: string): Promise<void> => {
    return invoke("accept_transfer", { transferId });
  },

  /**
   * Reject an incoming file transfer
   */
  rejectTransfer: async (transferId: string): Promise<void> => {
    return invoke("reject_transfer", { transferId });
  },

  /**
   * Pause a file transfer
   */
  pauseTransfer: async (transferId: string): Promise<void> => {
    return invoke("pause_transfer", { transferId });
  },

  /**
   * Cancel a file transfer
   */
  cancelTransfer: async (transferId: string): Promise<void> => {
    return invoke("cancel_transfer", { transferId });
  },

  /**
   * Get all file transfers
   */
  getTransfers: async (): Promise<FileTransfer[]> => {
    return invoke<FileTransfer[]>("get_transfers");
  },
};

// ============================================================================
// Combined API
// ============================================================================

/**
 * Main API object combining all sub-APIs
 */
export const api = {
  identity: identityApi,
  discovery: discoveryApi,
  messaging: messagingApi,
  fileTransfer: fileTransferApi,
};

// Default export
export default api;
