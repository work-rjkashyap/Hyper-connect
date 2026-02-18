import { useParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useCallback, useState } from "react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { useAppStore } from "@/store";
import type { Message, ConnectionStatusEvent } from "@/types";
import { getMessageContent } from "@/types";

type ConnectionState = "idle" | "connecting" | "connected" | "unreachable";

export default function ChatPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const {
    devices,
    messages,
    localDeviceId,
    addMessage,
    setMessages,
    markConversationAsRead,
    setConnectionStatus,
    setDeviceConnecting,
  } = useAppStore();

  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const selectedDevice = devices.find((d) => d.device_id === deviceId);

  const getConversationKey = (device1: string, device2: string): string =>
    [device1, device2].sort().join("_");

  const getCurrentMessages = (): Message[] => {
    if (!selectedDevice || !localDeviceId) return [];
    const key = getConversationKey(localDeviceId, selectedDevice.device_id);
    return messages[key] || [];
  };

  // ── Pre-connect: ping the peer the moment the chat opens ─────────────────
  const preConnect = useCallback(async () => {
    if (!selectedDevice || !localDeviceId) return;

    const peerAddress =
      selectedDevice.addresses && selectedDevice.addresses.length > 0
        ? selectedDevice.addresses[0]
        : null;

    if (!peerAddress) {
      setConnectionState("unreachable");
      return;
    }

    setConnectionState("connecting");
    setDeviceConnecting(selectedDevice.device_id);

    try {
      const latency = await invoke<number>("ping_device", {
        deviceId: selectedDevice.device_id,
        peerAddress,
        peerPort: selectedDevice.port,
      });
      setConnectionState("connected");
      setLatencyMs(latency);
      setConnectionStatus({
        device_id: selectedDevice.device_id,
        connected: true,
        latency_ms: latency,
      });
    } catch (err) {
      console.warn("ping_device failed:", err);
      setConnectionState("unreachable");
      setConnectionStatus({
        device_id: selectedDevice.device_id,
        connected: false,
        error: String(err),
      });
    }
  }, [selectedDevice, localDeviceId, setConnectionStatus, setDeviceConnecting]);

  // ── Listen for backend connection-status events ───────────────────────────
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<ConnectionStatusEvent>("connection-status", (event) => {
      if (event.payload.device_id !== selectedDevice?.device_id) return;

      setConnectionStatus(event.payload);

      if (event.payload.connected) {
        setConnectionState("connected");
        if (event.payload.latency_ms != null) {
          setLatencyMs(event.payload.latency_ms);
        }
      } else {
        setConnectionState("unreachable");
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => unlisten?.();
  }, [selectedDevice?.device_id, setConnectionStatus]);

  // ── Run pre-connect whenever the target device changes ───────────────────
  useEffect(() => {
    setConnectionState("idle");
    setLatencyMs(null);
    preConnect();
  }, [selectedDevice?.device_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load messages from backend when chat opens ───────────────────────────
  useEffect(() => {
    if (!selectedDevice || !localDeviceId) return;

    const loadMessages = async () => {
      try {
        const backendMessages = await invoke<Message[]>("get_messages", {
          device1: localDeviceId,
          device2: selectedDevice.device_id,
        });

        if (backendMessages && backendMessages.length > 0) {
          const key = getConversationKey(
            localDeviceId,
            selectedDevice.device_id,
          );
          const existingMessages = messages[key] || [];
          const existingIds = new Set(existingMessages.map((m) => m.id));
          const newMessages = backendMessages.filter(
            (m) => !existingIds.has(m.id),
          );
          if (newMessages.length > 0) {
            setMessages(key, [...existingMessages, ...newMessages]);
          }
        }
      } catch (error) {
        console.error("Failed to load messages from backend:", error);
      }
    };

    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDevice?.device_id, localDeviceId]);

  // ── Mark conversation as read whenever this chat becomes active ───────────
  const markAsRead = useCallback(async () => {
    if (!selectedDevice || !localDeviceId) return;
    const key = getConversationKey(localDeviceId, selectedDevice.device_id);
    markConversationAsRead(key, localDeviceId);
    try {
      await invoke("mark_conversation_as_read", {
        conversationKey: key,
        readerDeviceId: localDeviceId,
      });
    } catch (error) {
      console.warn("mark_conversation_as_read backend call failed:", error);
    }
  }, [selectedDevice, localDeviceId, markConversationAsRead]);

  useEffect(() => {
    markAsRead();
  }, [markAsRead]);

  // ── Send a message ────────────────────────────────────────────────────────
  const handleSendMessage = async (text: string) => {
    if (!selectedDevice || !localDeviceId) {
      console.error("Missing device or local device ID");
      return;
    }

    const peerAddress =
      selectedDevice.addresses && selectedDevice.addresses.length > 0
        ? selectedDevice.addresses[0]
        : null;

    if (!peerAddress) {
      alert(
        "Device has no available network address. Make sure both devices are on the same network.",
      );
      return;
    }

    // If connection is not yet confirmed, wait for it (up to 4 s)
    if (connectionState !== "connected") {
      try {
        await invoke("ping_device", {
          deviceId: selectedDevice.device_id,
          peerAddress,
          peerPort: selectedDevice.port,
        });
        setConnectionState("connected");
      } catch {
        // Let send_message attempt anyway; it will reconnect internally
      }
    }

    try {
      const message = await invoke<Message>("send_message", {
        fromDeviceId: localDeviceId,
        toDeviceId: selectedDevice.device_id,
        content: text,
        peerAddress,
        peerPort: selectedDevice.port,
      });

      // Optimistically add to store; 'message-sent' event will deduplicate
      const key = getConversationKey(localDeviceId, selectedDevice.device_id);
      addMessage(key, message);
    } catch (error) {
      console.error("Failed to send message:", error);
      alert(
        `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (!selectedDevice) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Device not found</p>
      </div>
    );
  }

  return (
    <ChatWindow
      recipientName={selectedDevice.display_name}
      recipientStatus={
        Date.now() - selectedDevice.last_seen * 1000 < 60_000
          ? "online"
          : "offline"
      }
      connectionState={connectionState}
      latencyMs={latencyMs}
      messages={getCurrentMessages().map((msg) => ({
        id: msg.id,
        content: getMessageContent(msg.message_type),
        sender: msg.from_device_id === localDeviceId ? "me" : "them",
        timestamp: new Date(msg.timestamp * 1000).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        status: msg.status as "sent" | "delivered" | "read",
        type: "text",
      }))}
      onSendMessage={handleSendMessage}
    />
  );
}
