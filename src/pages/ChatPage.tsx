import { useParams } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { useAppStore } from '@/store';
import type { Message } from '@/lib/schemas';
import { getMessageContent } from '@/types';

export default function ChatPage() {
    const { deviceId } = useParams<{ deviceId: string }>();
    const { devices, messages, localDeviceId, addMessage, setMessages } = useAppStore();

    const selectedDevice = devices.find(d => d.device_id === deviceId);

    const getConversationKey = (device1: string, device2: string): string => {
        const participants = [device1, device2].sort();
        return participants.join('_');
    };

    const getCurrentMessages = (): Message[] => {
        if (!selectedDevice || !localDeviceId) return [];
        const conversationKey = getConversationKey(localDeviceId, selectedDevice.device_id);
        const msgs = messages[conversationKey] || [];
        console.log('💬 Current messages for', conversationKey, ':', msgs.length, msgs);
        return msgs;
    };

    // Load messages from backend when chat opens
    useEffect(() => {
        if (!selectedDevice || !localDeviceId) return;

        const loadMessages = async () => {
            try {
                const backendMessages = await invoke<Message[]>('get_messages', {
                    device1: localDeviceId,
                    device2: selectedDevice.device_id,
                });

                if (backendMessages && backendMessages.length > 0) {
                    const conversationKey = getConversationKey(localDeviceId, selectedDevice.device_id);

                    // Merge with existing messages (avoiding duplicates)
                    const existingMessages = messages[conversationKey] || [];
                    const existingIds = new Set(existingMessages.map(m => m.id));
                    const newMessages = backendMessages.filter(m => !existingIds.has(m.id));

                    if (newMessages.length > 0) {
                        setMessages(conversationKey, [...existingMessages, ...newMessages]);
                    }
                }
            } catch (error) {
                console.error('Failed to load messages from backend:', error);
            }
        };

        loadMessages();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDevice?.id, localDeviceId]);

    const handleSendMessage = async (text: string) => {
        if (!selectedDevice || !localDeviceId) {
            console.error('Missing device or local device ID');
            return;
        }

        try {
            // Get the device's IP address (first address from the addresses array)
            const peerAddress = selectedDevice.addresses && selectedDevice.addresses.length > 0
                ? selectedDevice.addresses[0]
                : null;

            if (!peerAddress) {
                throw new Error('Device has no available network address. Make sure both devices are on the same network.');
            }

            console.log('Sending message:', {
                fromDeviceId: localDeviceId,
                toDeviceId: selectedDevice.id,
                text,
                peerAddress,
            });

            // Call Tauri backend to send message
            const message = await invoke<Message>('send_message', {
                fromDeviceId: localDeviceId,
                toDeviceId: selectedDevice.device_id,
                content: text,
                peerAddress,
            });

            console.log('Message sent successfully:', message);
            // Note: Message will be added to store via the 'message-sent' event listener
        } catch (error) {
            console.error('Failed to send message:', error);
            // Show error to user
            alert(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

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
            recipientStatus={Date.now() - (selectedDevice.last_seen * 1000) < 60000 ? 'online' : 'offline'}
            messages={getCurrentMessages().map(msg => ({
                id: msg.id,
                content: getMessageContent(msg.message_type),
                sender: msg.from_device_id === localDeviceId ? 'me' : 'them',
                timestamp: new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: msg.read ? 'read' : 'sent',
                type: 'text',
            }))}
            onSendMessage={handleSendMessage}
        />
    );
}
