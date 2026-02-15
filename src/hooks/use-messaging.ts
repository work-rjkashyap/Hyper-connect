import { useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/store";
import type {
  Message,
  MessageReceivedEvent,
  MessageSentEvent,
  Thread,
  TextMessagePayload,
} from "@/types";
import { getConversationKey, getMessageContent } from "@/types";
import { toast } from "@/hooks/use-toast";

/**
 * Hook to listen for real-time messaging events from Tauri backend
 */
export function useMessaging() {
  const {
    addMessage,
    setMessages,
    setThreads,
    markMessageAsRead,
    devices,
    localDeviceId,
    isOnboarded,
  } = useAppStore();

  const getDeviceName = useCallback(
    (deviceId: string): string => {
      const device = devices.find((d) => d.device_id === deviceId);
      return device?.display_name || "Unknown Device";
    },
    [devices],
  );

  // Load messages for a conversation
  const loadMessages = useCallback(
    async (device1: string, device2: string) => {
      try {
        const messages = await invoke<Message[]>("get_messages", {
          device1,
          device2,
        });
        const conversationKey = getConversationKey(device1, device2);
        setMessages(conversationKey, messages);
        console.log(
          `📥 Loaded ${messages.length} messages for ${conversationKey}`,
        );
        return messages;
      } catch (error) {
        console.error("Failed to load messages:", error);
        return [];
      }
    },
    [setMessages],
  );

  // Load all threads
  const loadThreads = useCallback(async () => {
    try {
      const threads = await invoke<Thread[]>("get_threads");
      setThreads(threads);
      console.log(`📋 Loaded ${threads.length} threads`);
      return threads;
    } catch (error) {
      console.error("Failed to load threads:", error);
      return [];
    }
  }, [setThreads]);

  // Send a message
  const sendMessage = useCallback(
    async (toDeviceId: string, content: string, peerAddress: string) => {
      if (!localDeviceId) {
        console.error("Cannot send message: no local device ID");
        return null;
      }

      try {
        const message = await invoke<Message>("send_message", {
          fromDeviceId: localDeviceId,
          toDeviceId,
          content,
          peerAddress,
        });

        console.log("📤 Message sent:", message);

        // Add to store
        const conversationKey = getConversationKey(localDeviceId, toDeviceId);
        addMessage(conversationKey, message);

        return message;
      } catch (error) {
        console.error("Failed to send message:", error);
        toast({
          title: "Failed to send message",
          description: String(error),
          variant: "destructive",
        });
        return null;
      }
    },
    [localDeviceId, addMessage],
  );

  // Mark message as read
  const markRead = useCallback(
    async (messageId: string, conversationKey: string) => {
      try {
        await invoke("mark_as_read", {
          messageId,
          conversationKey,
        });
        markMessageAsRead(conversationKey, messageId);
      } catch (error) {
        console.error("Failed to mark message as read:", error);
      }
    },
    [markMessageAsRead],
  );

  // Mark entire thread as read
  const markThreadRead = useCallback(async (threadId: string) => {
    try {
      await invoke("mark_thread_as_read", { threadId });
      console.log(`✅ Thread ${threadId} marked as read`);
    } catch (error) {
      console.error("Failed to mark thread as read:", error);
    }
  }, []);

  // Listen for messaging events
  useEffect(() => {
    if (!isOnboarded || !localDeviceId) {
      console.log("⏸️ Skipping messaging setup - not onboarded or no identity");
      return;
    }

    let unlistenSent: (() => void) | undefined;
    let unlistenReceived: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        // Listen for sent messages
        unlistenSent = await listen<Message>(
          "message-sent",
          (event) => {
            console.log("📤 Message sent event:", event.payload);
            const msg = event.payload; // Backend emits Message directly, not wrapped
            const conversationKey = getConversationKey(
              msg.from_device_id,
              msg.to_device_id,
            );
            addMessage(conversationKey, msg);
          },
        );

        // Listen for received messages (backend emits TextMessagePayload directly)
        unlistenReceived = await listen<TextMessagePayload>(
          "message-received",
          (event) => {
            console.log("📥 Message received event:", event.payload);
            const payload = event.payload;

            // Transform TextMessagePayload to Message
            const msg: Message = {
              id: payload.id,
              from_device_id: payload.from_device_id,
              to_device_id: payload.to_device_id,
              message_type: { type: "Text", content: payload.content },
              timestamp: payload.timestamp,
              thread_id: payload.thread_id,
              read: false,
            };

            const conversationKey = getConversationKey(
              msg.from_device_id,
              msg.to_device_id,
            );

            addMessage(conversationKey, msg);

            // Show toast notification for received messages (not from local device)
            if (msg.from_device_id !== localDeviceId) {
              const senderName = getDeviceName(msg.from_device_id);
              const content = getMessageContent(msg.message_type);

              toast({
                title: senderName,
                description:
                  content.length > 100
                    ? content.substring(0, 100) + "..."
                    : content,
                duration: 5000,
              });
            }
          },
        );

        console.log("✅ Messaging listeners setup complete");
      } catch (error) {
        console.error("Failed to setup messaging listeners:", error);
      }
    };

    setupListeners();

    return () => {
      if (unlistenSent) unlistenSent();
      if (unlistenReceived) unlistenReceived();
      console.log("🧹 Messaging listeners cleaned up");
    };
  }, [isOnboarded, localDeviceId, addMessage, getDeviceName]);

  return {
    sendMessage,
    loadMessages,
    loadThreads,
    markRead,
    markThreadRead,
  };
}
