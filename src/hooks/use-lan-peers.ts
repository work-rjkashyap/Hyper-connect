import { useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/store";
import type { Device } from "@/types";

/**
 * Hook to manage LAN peer discovery and state.
 *
 * The Rust backend automatically starts mDNS discovery and advertising during
 * app setup (lib.rs).  This hook therefore only needs to:
 *  1. Register Tauri event listeners so live updates flow into the Zustand store.
 *  2. Fetch the initial device snapshot that was already discovered before the
 *     frontend listeners were ready.
 *
 * Calling start_discovery / start_advertising from here as well would spawn
 * duplicate browse tasks on the mDNS daemon and cause double registrations,
 * so those calls have been removed.
 */
export function useLanPeers() {
  const { addDevice, removeDevice, setDevices, isOnboarded } = useAppStore();

  /**
   * Fetch the current device list from the backend and hydrate the store.
   * Called once on mount (after listeners are in place) so that any devices
   * discovered before the frontend was ready are not missed.
   */
  const loadInitialDevices = useCallback(async () => {
    try {
      const devices = await invoke<Device[]>("get_devices");
      console.log("📱 Initial device snapshot:", devices);
      setDevices(devices);
    } catch (error) {
      console.error("Failed to load initial devices:", error);
    }
  }, [setDevices]);

  useEffect(() => {
    if (!isOnboarded) {
      console.log("⏸️ Skipping discovery listeners – not yet onboarded");
      return;
    }

    let unlistenDiscovered: (() => void) | undefined;
    let unlistenRemoved: (() => void) | undefined;

    const setup = async () => {
      try {
        // Register listeners BEFORE fetching the snapshot so no events are
        // lost between the two operations.
        unlistenDiscovered = await listen<Device>(
          "device-discovered",
          (event) => {
            console.log("🔍 Device discovered:", event.payload);
            addDevice(event.payload);
          },
        );

        unlistenRemoved = await listen<string>("device-removed", (event) => {
          console.log("❌ Device removed:", event.payload);
          removeDevice(event.payload);
        });

        // Hydrate the store with devices that were already found.
        await loadInitialDevices();
      } catch (error) {
        console.error("Failed to set up discovery listeners:", error);
      }
    };

    setup();

    return () => {
      unlistenDiscovered?.();
      unlistenRemoved?.();
      console.log("🧹 Discovery listeners cleaned up");
    };
  }, [isOnboarded, addDevice, removeDevice, loadInitialDevices]);

  /**
   * Manually refresh the device list on demand (e.g. pull-to-refresh).
   */
  const refreshDevices = useCallback(async () => {
    try {
      const devices = await invoke<Device[]>("get_devices");
      setDevices(devices);
    } catch (error) {
      console.error("Failed to refresh devices:", error);
    }
  }, [setDevices]);

  return { refreshDevices };
}
