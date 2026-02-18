import React, { useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/store";
import type { Message, Thread, TextMessagePayload } from "@/types";
import { getConversationKey, getMessageContent } from "@/types";
import type { MessageStatus } from "@/types";
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
    markConversationAsRead,
    localDeviceId,
    isOnboarded,
  } = useAppStore();

  // Track shown toasts to prevent duplicates (use ref to persist across renders)
  const shownToastsRef = React.useRef(new Set<string>());

  // Helper to get device name - reads directly from store to avoid stale closures
  const getDeviceName = (deviceId: string): string => {
    const devices = useAppStore.getState().devices;
    const device = devices.find((d) => d.device_id === deviceId);
    return device?.display_name || "Unknown Device";
  };

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
    async (
      toDeviceId: string,
      content: string,
      peerAddress: string,
      peerPort?: number,
    ) => {
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
          peerPort: peerPort ?? null,
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

  // Mark a single message as read
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

  // Mark every received message in a conversation as read (clears the unread badge)
  const markConversationRead = useCallback(
    async (conversationKey: string, readerDeviceId: string) => {
      // Optimistic local update first so the badge clears immediately
      markConversationAsRead(conversationKey, readerDeviceId);
      try {
        await invoke("mark_conversation_as_read", {
          conversationKey,
          readerDeviceId,
        });
      } catch (error) {
        console.warn("mark_conversation_as_read backend call failed:", error);
      }
    },
    [markConversationAsRead],
  );

  // Mark entire thread as read (legacy helper kept for compatibility)
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
        unlistenSent = await listen<Message>("message-sent", (event) => {
          console.log("📤 Message sent event:", event.payload);
          const msg = event.payload; // Backend emits Message directly, not wrapped
          const conversationKey = getConversationKey(
            msg.from_device_id,
            msg.to_device_id,
          );
          addMessage(conversationKey, msg);
        });

        // Listen for received messages.
        // The backend now emits a full Message object (with status:"delivered")
        // from MessagingService.  We also accept the legacy TextMessagePayload
        // shape (no message_type / status fields) and normalise it.
        unlistenReceived = await listen<Message | TextMessagePayload>(
          "message-received",
          (event) => {
            console.log("📥 Message received event:", event.payload);
            const raw = event.payload as unknown as Record<string, unknown>;

            // Normalise: if the payload has a top-level `content` string it is
            // a TextMessagePayload (legacy / plaintext path); otherwise it is a
            // full Message (encrypted path via MessagingService).
            let msg: Message;
            if (typeof raw.content === "string") {
              // Legacy TextMessagePayload shape
              const payload = raw as unknown as TextMessagePayload;
              msg = {
                id: payload.id,
                from_device_id: payload.from_device_id,
                to_device_id: payload.to_device_id,
                message_type: { type: "Text", content: payload.content },
                timestamp: payload.timestamp,
                thread_id: payload.thread_id,
                status: "delivered" as MessageStatus,
              };
            } else {
              // Full Message shape from MessagingService
              msg = raw as unknown as Message;
              // Guarantee status is set
              if (!msg.status) {
                msg = { ...msg, status: "delivered" as MessageStatus };
              }
            }

            const conversationKey = getConversationKey(
              msg.from_device_id,
              msg.to_device_id,
            );

            addMessage(conversationKey, msg);

            // Show toast notification for received messages (not from local device)
            // Use message ID to prevent duplicate toasts
            if (
              msg.from_device_id !== localDeviceId &&
              !shownToastsRef.current.has(msg.id)
            ) {
              shownToastsRef.current.add(msg.id);

              // Clean up old toast IDs after 10 seconds to prevent memory leak
              setTimeout(() => {
                shownToastsRef.current.delete(msg.id);
              }, 10000);

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
      // Clear toast tracking on cleanup
      shownToastsRef.current.clear();
      console.log("🧹 Messaging listeners cleaned up");
    };
    // Only re-run when onboarding status or localDeviceId changes
    // addMessage and getDeviceName are accessed via closure and don't need to be dependencies
  }, [isOnboarded, localDeviceId]);

  return {
    sendMessage,
    loadMessages,
    loadThreads,
    markRead,
    markConversationRead,
    markThreadRead,
  };
}
