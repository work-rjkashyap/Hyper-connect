import { useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/store";
import type { DeviceIdentity } from "@/types";

/**
 * Hook to manage device identity
 * Loads identity on mount and provides update functions
 */
export function useIdentity() {
  const { setDeviceIdentity, deviceIdentity } = useAppStore();

  // Load device identity from backend
  const loadIdentity = useCallback(async () => {
    try {
      const identity = await invoke<DeviceIdentity>("get_device_info");
      console.log("🆔 Device identity loaded:", identity);
      // Sync backend identity into Zustand (keeps deviceName & localDeviceId fresh)
      // NOTE: we do NOT touch isOnboarded here — that flag is owned by the
      // onboarding flow and persisted in localStorage by the Zustand store.
      setDeviceIdentity(identity);

      return identity;
    } catch (error) {
      console.error("Failed to load device identity:", error);
      return null;
    }
  }, [setDeviceIdentity]);

  // Update display name (note: backend needs Arc<Mutex<>> wrapper for this to work)
  const updateDisplayName = useCallback(
    async (name: string) => {
      try {
        await invoke("update_display_name", { name });
        console.log("✅ Display name updated:", name);

        // Reload identity so the store stays in sync
        await loadIdentity();

        return true;
      } catch (error) {
        console.error("Failed to update display name:", error);
        return false;
      }
    },
    [loadIdentity],
  );

  // Get local device ID
  const getLocalDeviceId = useCallback(async () => {
    try {
      const deviceId = await invoke<string>("get_local_device_id");
      console.log("🆔 Local device ID:", deviceId);
      return deviceId;
    } catch (error) {
      console.error("Failed to get local device ID:", error);
      return null;
    }
  }, []);

  // Initialize identity on mount
  useEffect(() => {
    loadIdentity();
  }, [loadIdentity]);

  return {
    identity: deviceIdentity,
    loadIdentity,
    updateDisplayName,
    getLocalDeviceId,
  };
}
