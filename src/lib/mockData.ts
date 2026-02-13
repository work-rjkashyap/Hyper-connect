import { Device, Message } from '../types';

export const MOCK_LOCAL_DEVICE_ID = "local-device-id";

export const MOCK_DEVICES: Device[] = [
    {
        id: "device-1",
        name: "Alice's MacBook Pro",
        hostname: "alice-mbp",
        port: 8080,
        addresses: ["192.168.1.101"],
        last_seen: Date.now()
    },
    {
        id: "device-2",
        name: "Bob's Windows PC",
        hostname: "bob-pc",
        port: 8080,
        addresses: ["192.168.1.102"],
        last_seen: Date.now() - 1000 * 60 * 5 // 5 mins ago
    },
    {
        id: "device-3",
        name: "Charlie's Linux Laptop",
        hostname: "charlie-linux",
        port: 8080,
        addresses: ["192.168.1.103"],
        last_seen: Date.now() - 1000 * 60 * 60 * 2 // 2 hours ago
    },
    {
        id: "device-4",
        name: "Dave's Android Phone",
        hostname: "dave-android",
        port: 8080,
        addresses: ["192.168.1.104"],
        last_seen: Date.now() - 1000 * 60 * 60 * 24 // 1 day ago
    }
];

export const MOCK_MESSAGES: Record<string, Message[]> = {
    [`${MOCK_LOCAL_DEVICE_ID}_device-1`]: [
        {
            id: "msg-1",
            from_device_id: "device-1",
            to_device_id: MOCK_LOCAL_DEVICE_ID,
            timestamp: Date.now() - 1000 * 60 * 60,
            message_type: { type: "Text", content: "Hey! Did you get the files?" },
            read: true
        },
        {
            id: "msg-2",
            from_device_id: MOCK_LOCAL_DEVICE_ID,
            to_device_id: "device-1",
            timestamp: Date.now() - 1000 * 60 * 30,
            message_type: { type: "Text", content: "Yes, downloading them now. Thanks!" },
            read: true
        },
        {
            id: "msg-3",
            from_device_id: "device-1",
            to_device_id: MOCK_LOCAL_DEVICE_ID,
            timestamp: Date.now() - 1000 * 60 * 5,
            message_type: { type: "Text", content: "Great, let me know if you need anything else." },
            read: false
        }
    ],
    [`${MOCK_LOCAL_DEVICE_ID}_device-2`]: [
        {
            id: "msg-4",
            from_device_id: MOCK_LOCAL_DEVICE_ID,
            to_device_id: "device-2",
            timestamp: Date.now() - 1000 * 60 * 60 * 24,
            message_type: { type: "Text", content: "Meeting at 3 PM?" },
            read: true
        },
        {
            id: "msg-5",
            from_device_id: "device-2",
            to_device_id: MOCK_LOCAL_DEVICE_ID,
            timestamp: Date.now() - 1000 * 60 * 60 * 23,
            message_type: { type: "Text", content: "Sure, see you then." },
            read: true
        }
    ]
};
