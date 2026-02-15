import { useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/store";
import type {
  Device,
  DeviceDiscoveredEvent,
  DeviceRemovedEvent,
} from "@/types";

/**
 * Hook to manage LAN peer discovery and state
 * Starts discovery on mount and listens for device events
 */
export function useLanPeers() {
  const { addDevice, removeDevice, setDevices, deviceIdentity, isOnboarded } =
    useAppStore();

  const initializeDiscovery = useCallback(async () => {
    try {
      // Get initial devices
      const initialDevices = await invoke<Device[]>("get_devices");
      console.log("📱 Initial devices:", initialDevices);
      setDevices(initialDevices);

      // Start discovery
      await invoke("start_discovery");
      console.log("🔍 Discovery started");

      // Start advertising if we have identity
      if (deviceIdentity) {
        const port = await invoke<number>("get_tcp_port");
        await invoke("start_advertising", { port });
        console.log("📡 Advertising started on port:", port);
      }
    } catch (error) {
      console.error("Failed to initialize discovery:", error);
    }
  }, [deviceIdentity, setDevices]);

  useEffect(() => {
    if (!isOnboarded || !deviceIdentity) {
      console.log("⏸️ Skipping discovery - not onboarded or no identity");
      return;
    }

    let unlistenDiscovered: (() => void) | undefined;
    let unlistenRemoved: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        // Listen for device discovered events
        unlistenDiscovered = await listen<Device>(
          "device-discovered",
          (event) => {
            console.log("🔍 Device discovered:", event.payload);
            addDevice(event.payload);
          },
        );

        // Listen for device removed events
        unlistenRemoved = await listen<string>("device-removed", (event) => {
          console.log("❌ Device removed:", event.payload);
          removeDevice(event.payload);
        });

        // Initialize discovery
        await initializeDiscovery();
      } catch (error) {
        console.error("Failed to setup discovery listeners:", error);
      }
    };

    setupListeners();

    return () => {
      if (unlistenDiscovered) unlistenDiscovered();
      if (unlistenRemoved) unlistenRemoved();
      console.log("🧹 Discovery listeners cleaned up");
    };
  }, [
    isOnboarded,
    deviceIdentity,
    addDevice,
    removeDevice,
    initializeDiscovery,
  ]);

  return {
    refreshDevices: useCallback(async () => {
      try {
        const devices = await invoke<Device[]>("get_devices");
        setDevices(devices);
      } catch (error) {
        console.error("Failed to refresh devices:", error);
      }
    }, [setDevices]),
  };
}
