import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useAppStore } from '@/store';
import { messageSchema } from '@/lib/schemas';
import type { Message } from '@/lib/schemas';

/**
 * Hook to listen for real-time messaging events from Tauri backend
 */
export function useMessaging() {
  const { addMessage } = useAppStore();

  const getConversationKey = (device1: string, device2: string): string => {
    const participants = [device1, device2].sort();
    return participants.join('_');
  };

  useEffect(() => {
    // Listen for sent messages
    const unlistenSent = listen<Message>('message-sent', (event) => {
      const msg = event.payload;
      const result = messageSchema.safeParse(msg);

      if (result.success) {
        const conversationKey = getConversationKey(msg.from_device_id, msg.to_device_id);
        addMessage(conversationKey, msg);
      } else {
        console.error('Invalid message-sent data:', result.error.errors);
      }
    });

    // Listen for received messages
    const unlistenReceived = listen<Message>('message-received', (event) => {
      const msg = event.payload;
      const result = messageSchema.safeParse(msg);

      if (result.success) {
        const conversationKey = getConversationKey(msg.from_device_id, msg.to_device_id);
        addMessage(conversationKey, msg);
      } else {
        console.error('Invalid message-received data:', result.error.errors);
        // Fallback for non-UUID IDs if needed
        const raw = msg as any;
        if (raw.from_device_id && raw.to_device_id) {
           const conversationKey = getConversationKey(raw.from_device_id, raw.to_device_id);
           addMessage(conversationKey, raw as Message);
        }
      }
    });

    return () => {
      unlistenSent.then((fn) => fn());
      unlistenReceived.then((fn) => fn());
    };
  }, [addMessage]);
}
