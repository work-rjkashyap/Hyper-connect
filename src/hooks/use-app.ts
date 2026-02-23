import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "@/store";
import { useIdentity } from "./use-identity";
import { useLanPeers } from "./use-lan-peers";
import { useMessaging } from "./use-messaging";
import { useFileTransfer } from "./use-file-transfer";
import type {
  DeviceConnectedEvent,
  DeviceDisconnectedEvent,
  SecurityErrorEvent,
} from "@/types";
import { toast } from "./use-toast";

/**
 * Main app hook that initializes all services and listeners
 * Use this hook in the main App component
 */
export function useApp() {
  const { isOnboarded, setDeviceConnected, setDeviceDisconnected } =
    useAppStore();

  // Initialize all sub-hooks
  const identity = useIdentity();
  const lanPeers = useLanPeers();
  const messaging = useMessaging();
  const fileTransfer = useFileTransfer();

  // Setup global event listeners (connection status, security errors, etc.)
  useEffect(() => {
    if (!isOnboarded) {
      console.log("⏸️ Skipping global listeners - not onboarded");
      return;
    }

    let unlistenConnected: (() => void) | undefined;
    let unlistenDisconnected: (() => void) | undefined;
    let unlistenSecurityError: (() => void) | undefined;
    let cancelled = false;

    const setupGlobalListeners = async () => {
      try {
        // Listen for device connection events
        const _unlistenConnected = await listen<DeviceConnectedEvent>(
          "device-connected",
          (event) => {
            console.log("🔌 Device connected:", event.payload);
            const { device_id } = event.payload;
            setDeviceConnected(device_id);

            toast({
              title: "Device Connected",
              description: `Connected to ${device_id}`,
            });
          },
        );

        // Listen for device disconnection events
        const _unlistenDisconnected = await listen<DeviceDisconnectedEvent>(
          "device-disconnected",
          (event) => {
            console.log("🔌 Device disconnected:", event.payload);
            const { device_id } = event.payload;
            setDeviceDisconnected(device_id);

            toast({
              title: "Device Disconnected",
              description: `Disconnected from ${device_id}`,
            });
          },
        );

        // Listen for security errors
        const _unlistenSecurityError = await listen<SecurityErrorEvent>(
          "security-error",
          (event) => {
            console.error("🔒 Security error:", event.payload);
            const { device_id, error } = event.payload;

            toast({
              title: "Security Error",
              description: `Error with ${device_id}: ${error}`,
              variant: "destructive",
            });
          },
        );

        // If the component unmounted before setup completed, clean up immediately.
        if (cancelled) {
          _unlistenConnected();
          _unlistenDisconnected();
          _unlistenSecurityError();
          return;
        }

        unlistenConnected = _unlistenConnected;
        unlistenDisconnected = _unlistenDisconnected;
        unlistenSecurityError = _unlistenSecurityError;

        console.log("✅ Global listeners setup complete");
      } catch (error) {
        console.error("Failed to setup global listeners:", error);
      }
    };

    setupGlobalListeners();

    return () => {
      cancelled = true;
      if (unlistenConnected) unlistenConnected();
      if (unlistenDisconnected) unlistenDisconnected();
      if (unlistenSecurityError) unlistenSecurityError();
      console.log("🧹 Global listeners cleaned up");
    };
  }, [isOnboarded, setDeviceConnected, setDeviceDisconnected]);

  return {
    // Identity
    identity: identity.identity,
    loadIdentity: identity.loadIdentity,
    updateDisplayName: identity.updateDisplayName,
    getLocalDeviceId: identity.getLocalDeviceId,

    // Discovery
    refreshDevices: lanPeers.refreshDevices,

    // Messaging
    sendMessage: messaging.sendMessage,
    loadMessages: messaging.loadMessages,
    loadThreads: messaging.loadThreads,
    markRead: messaging.markRead,
    markThreadRead: messaging.markThreadRead,

    // File Transfer
    createTransfer: fileTransfer.createTransfer,
    startTransfer: fileTransfer.startTransfer,
    acceptTransfer: fileTransfer.acceptTransfer,
    rejectTransfer: fileTransfer.rejectTransfer,
    pauseTransfer: fileTransfer.pauseTransfer,
    cancelTransfer: fileTransfer.cancelTransfer,
    loadTransfers: fileTransfer.loadTransfers,
  };
}
