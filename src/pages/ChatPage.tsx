import { useParams } from 'react-router-dom';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { useAppStore } from '@/store';
import type { Message } from '@/lib/schemas';

export default function ChatPage() {
    const { deviceId } = useParams<{ deviceId: string }>();
    const { devices, messages, localDeviceId, addMessage } = useAppStore();

    const selectedDevice = devices.find(d => d.id === deviceId);

    const getConversationKey = (device1: string, device2: string): string => {
        const participants = [device1, device2].sort();
        return participants.join('_');
    };

    const getCurrentMessages = (): Message[] => {
        if (!selectedDevice || !localDeviceId) return [];
        const conversationKey = getConversationKey(localDeviceId, selectedDevice.id);
        return messages[conversationKey] || [];
    };

    const handleSendMessage = async (text: string) => {
        if (!selectedDevice || !localDeviceId) return;

        const conversationKey = getConversationKey(localDeviceId, selectedDevice.id);
        const newMessage: Message = {
            id: `msg-${Date.now()}`,
            from_device_id: localDeviceId,
            to_device_id: selectedDevice.id,
            timestamp: Date.now(),
            message_type: { type: 'Text', content: text },
            read: true,
        };

        addMessage(conversationKey, newMessage);

        // TODO: Replace with actual Tauri invoke
        // await invoke('send_message', { ... });
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
            recipientName={selectedDevice.name}
            recipientStatus={Date.now() - selectedDevice.last_seen < 60000 ? 'online' : 'offline'}
            messages={getCurrentMessages().map(msg => ({
                id: msg.id,
                content: msg.message_type.type === 'Text' ? msg.message_type.content : '',
                sender: msg.from_device_id === localDeviceId ? 'me' : 'them',
                timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: msg.read ? 'read' : 'sent',
                type: 'text',
            }))}
            onSendMessage={handleSendMessage}
        />
    );
}
