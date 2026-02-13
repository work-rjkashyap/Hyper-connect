import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/store';
import { deviceSchema, type Device } from '@/lib/schemas';

/**
 * Hook to manage LAN peer discovery and state
 * Starts discovery on mount and listens for events
 */
export function useLanPeers() {
  const { addDevice, removeDevice, setDevices, deviceName } = useAppStore();

  useEffect(() => {
    let unlistenDiscovered: (() => void) | undefined;
    let unlistenRemoved: (() => void) | undefined;

    const initialize = async () => {
      try {
        // Start device discovery in backend
        await invoke('start_discovery');

        // Get initial devices
        const initialDevices = await invoke<Device[]>('get_devices');
        setDevices(initialDevices);

        // Start advertising if we have a name
        if (deviceName) {
          await invoke('start_advertising', { deviceName, port: 8080 });
        }

        // Listen for discovery events
        unlistenDiscovered = await listen<Device>('device-discovered', (event) => {
          const result = deviceSchema.safeParse(event.payload);
          if (result.success) {
            addDevice(result.data as Device);
          } else {
            console.warn('Invalid peer data received, attempting fallback:', event.payload);
            const raw = event.payload as any;
            if (raw.id && raw.name) {
              addDevice(raw as Device);
            }
          }
        });

        // Listen for removal events
        unlistenRemoved = await listen<string>('device-removed', (event) => {
          removeDevice(event.payload);
        });

      } catch (error) {
        console.error('Failed to initialize LAN discovery:', error);
      }
    };

    initialize();

    return () => {
      if (unlistenDiscovered) unlistenDiscovered();
      if (unlistenRemoved) unlistenRemoved();
    };
  }, [addDevice, removeDevice, setDevices, deviceName]);
}
