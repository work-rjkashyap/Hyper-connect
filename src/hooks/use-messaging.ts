import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useAppStore } from '@/store';
import { messageSchema } from '@/lib/schemas';
import type { Message } from '@/lib/schemas';
import { toast } from '@/hooks/use-toast';

/**
 * Hook to listen for real-time messaging events from Tauri backend
 */
export function useMessaging() {
  const { addMessage, devices, localDeviceId } = useAppStore();

  const getConversationKey = (device1: string, device2: string): string => {
    const participants = [device1, device2].sort();
    return participants.join('_');
  };

  const getDeviceName = (deviceId: string): string => {
    const device = devices.find(d => d.id === deviceId);
    return device?.name || 'Unknown Device';
  };

  useEffect(() => {
    // Listen for sent messages
    const unlistenSent = listen<Message>('message-sent', (event) => {
      console.log('📤 Message-sent event received:', event.payload);
      const msg = event.payload;
      const result = messageSchema.safeParse(msg);

      if (result.success) {
        const conversationKey = getConversationKey(msg.from_device_id, msg.to_device_id);
        console.log('Adding sent message to store:', conversationKey, msg);
        addMessage(conversationKey, msg);
      } else {
        console.error('Invalid message-sent data:', result.error.errors);
      }
    });

    // Listen for received messages
    const unlistenReceived = listen<Message>('message-received', (event) => {
      console.log('📥 Message-received event received:', event.payload);
      const msg = event.payload;
      const result = messageSchema.safeParse(msg);

      if (result.success) {
        const conversationKey = getConversationKey(msg.from_device_id, msg.to_device_id);
        console.log('Adding received message to store:', conversationKey, msg);
        addMessage(conversationKey, msg);

        // Show toast notification for received messages (not from local device)
        if (msg.from_device_id !== localDeviceId) {
          const senderName = getDeviceName(msg.from_device_id);
          const content = msg.message_type.type === 'Text'
            ? msg.message_type.content
            : msg.message_type.type === 'File'
            ? `📎 ${msg.message_type.filename}`
            : 'New message';

          toast({
            title: senderName,
            description: content.length > 100 ? content.substring(0, 100) + '...' : content,
            duration: 5000,
          });
        }
      } else {
        console.error('Invalid message-received data:', result.error.errors);
        // Fallback for non-UUID IDs if needed
        const raw = msg as any;
        if (raw.from_device_id && raw.to_device_id) {
           const conversationKey = getConversationKey(raw.from_device_id, raw.to_device_id);
           addMessage(conversationKey, raw as Message);

           // Show toast for fallback messages too
           if (raw.from_device_id !== localDeviceId) {
             const senderName = getDeviceName(raw.from_device_id);
             toast({
               title: senderName,
               description: 'New message',
               duration: 5000,
             });
           }
        }
      }
    });

    return () => {
      unlistenSent.then((fn) => fn());
      unlistenReceived.then((fn) => fn());
    };
  }, [addMessage, devices, localDeviceId]);
}
