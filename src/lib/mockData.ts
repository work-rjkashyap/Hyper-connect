import type { Device, Message } from "../types";

export const MOCK_LOCAL_DEVICE_ID = "local-device-id";

export const MOCK_DEVICES: Device[] = [
  {
    device_id: "device-1",
    display_name: "Alice's MacBook Pro",
    hostname: "alice-mbp",
    port: 8080,
    addresses: ["192.168.1.101"],
    last_seen: Math.floor(Date.now() / 1000),
    platform: "macOS",
    app_version: "1.0.0",
  },
  {
    device_id: "device-2",
    display_name: "Bob's Windows PC",
    hostname: "bob-pc",
    port: 8080,
    addresses: ["192.168.1.102"],
    last_seen: Math.floor(Date.now() / 1000) - 60 * 5, // 5 mins ago
    platform: "Windows",
    app_version: "1.0.0",
  },
  {
    device_id: "device-3",
    display_name: "Charlie's Linux Laptop",
    hostname: "charlie-linux",
    port: 8080,
    addresses: ["192.168.1.103"],
    last_seen: Math.floor(Date.now() / 1000) - 60 * 60 * 2, // 2 hours ago
    platform: "Linux",
    app_version: "1.0.0",
  },
  {
    device_id: "device-4",
    display_name: "Dave's Android Phone",
    hostname: "dave-android",
    port: 8080,
    addresses: ["192.168.1.104"],
    last_seen: Math.floor(Date.now() / 1000) - 60 * 60 * 24, // 1 day ago
    platform: "Android",
    app_version: "1.0.0",
  },
];

export const MOCK_MESSAGES: Record<string, Message[]> = {
  [`${MOCK_LOCAL_DEVICE_ID}_device-1`]: [
    {
      id: "msg-1",
      from_device_id: "device-1",
      to_device_id: MOCK_LOCAL_DEVICE_ID,
      timestamp: Math.floor(Date.now() / 1000) - 60 * 60,
      message_type: { type: "Text", content: "Hey! Did you get the files?" },
      thread_id: null,
      status: "read",
    },
    {
      id: "msg-2",
      from_device_id: MOCK_LOCAL_DEVICE_ID,
      to_device_id: "device-1",
      timestamp: Math.floor(Date.now() / 1000) - 60 * 30,
      message_type: {
        type: "Text",
        content: "Yes, downloading them now. Thanks!",
      },
      thread_id: null,
      status: "read",
    },
    {
      id: "msg-3",
      from_device_id: "device-1",
      to_device_id: MOCK_LOCAL_DEVICE_ID,
      timestamp: Math.floor(Date.now() / 1000) - 60 * 5,
      message_type: {
        type: "Text",
        content: "Great, let me know if you need anything else.",
      },
      thread_id: null,
      // Received but not yet read – will show in the unread badge
      status: "delivered",
    },
  ],
  [`${MOCK_LOCAL_DEVICE_ID}_device-2`]: [
    {
      id: "msg-4",
      from_device_id: MOCK_LOCAL_DEVICE_ID,
      to_device_id: "device-2",
      timestamp: Math.floor(Date.now() / 1000) - 60 * 60 * 24,
      message_type: { type: "Text", content: "Meeting at 3 PM?" },
      thread_id: null,
      status: "sent",
    },
    {
      id: "msg-5",
      from_device_id: "device-2",
      to_device_id: MOCK_LOCAL_DEVICE_ID,
      timestamp: Math.floor(Date.now() / 1000) - 60 * 60 * 23,
      message_type: { type: "Text", content: "Sure, see you then." },
      thread_id: null,
      status: "read",
    },
  ],
};
