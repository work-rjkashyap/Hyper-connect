import * as React from 'react';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Settings from 'lucide-react/dist/esm/icons/settings';
import Search from 'lucide-react/dist/esm/icons/search';
import MoreVertical from 'lucide-react/dist/esm/icons/more-vertical';
import Sun from 'lucide-react/dist/esm/icons/sun';
import Moon from 'lucide-react/dist/esm/icons/moon';
import Plus from 'lucide-react/dist/esm/icons/plus';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
interface SidebarProps {
    className?: string;
}
export default function Sidebar({ className }: SidebarProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const [search, setSearch] = useState('');
    const { devices, messages, localDeviceId, theme, toggleTheme } = useAppStore();
    // Helper to get conversation key
    const getConversationKey = (device1: string, device2: string): string => {
        const participants = [device1, device2].sort();
        return participants.join('_');
    };
    // Helper to format timestamp
    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        if (isToday) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString();
    };
    const chats = React.useMemo(() => {
        return devices
            .map((device) => {
                if (!localDeviceId) return null;
                const conversationKey = getConversationKey(localDeviceId, device.id);
                const deviceMessages = messages[conversationKey] || [];
                const lastMessageObj =
                    deviceMessages.length > 0 ? deviceMessages[deviceMessages.length - 1] : null;
                const unreadCount = deviceMessages.filter(
                    (m) => m.from_device_id === device.id && !m.read
                ).length;
                let lastMessageContent = 'No messages yet';
                if (lastMessageObj) {
                    if (lastMessageObj.message_type.type === 'Text') {
                        lastMessageContent = lastMessageObj.message_type.content || '';
                    } else if (lastMessageObj.message_type.type === 'File') {
                        lastMessageContent = `File: ${lastMessageObj.message_type.filename}`;
                    } else {
                        lastMessageContent = 'Sent a message';
                    }
                }
                return {
                    id: device.id,
                    name: device.name,
                    avatar: '',
                    status: Date.now() - device.last_seen < 60000 ? 'online' : 'offline',
                    lastMessage: lastMessageContent,
                    timestamp: lastMessageObj ? formatTimestamp(lastMessageObj.timestamp) : '',
                    unreadCount,
                };
            })
            .filter((chat): chat is NonNullable<typeof chat> => chat !== null);
    }, [devices, messages, localDeviceId]);
    const filteredChats = chats.filter((chat) =>
        chat.name.toLowerCase().includes(search.toLowerCase())
    );
    const selectedChatId = location.pathname.startsWith('/chat/')
        ? location.pathname.split('/chat/')[1]
        : null;
    return (
        <div
            className={cn(
                'flex h-full w-full shrink-0 flex-col border-r border-border bg-card text-card-foreground',
                className
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-8 pb-3 border-b border-border/50">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Avatar>
                            <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                            <AvatarFallback>ME</AvatarFallback>
                        </Avatar>
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
                    </div>
                    <h1 className="text-xl font-bold text-foreground">Chats</h1>
                </div>
                <div className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => navigate('/discovery')}
                    >
                        <Plus className="h-5 w-5 text-muted-foreground" />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-5 w-5 text-muted-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>My Account</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate('/settings')}>
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Settings</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={toggleTheme}>
                                {theme === 'dark' ? (
                                    <Sun className="mr-2 h-4 w-4" />
                                ) : (
                                    <Moon className="mr-2 h-4 w-4" />
                                )}
                                <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            {/* Search */}
            <div className="p-4">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search chats..."
                        className="pl-9 bg-muted border-none text-foreground placeholder:text-muted-foreground/70 focus-visible:ring-1 focus-visible:ring-ring"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>
            {/* Chat List */}
            <ScrollArea className="flex-1">
                <div className="flex flex-col gap-1 px-2 pb-2">
                    {filteredChats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                            <p>No devices found</p>
                            <p className="text-xs mt-1">Make sure other devices are on the same network.</p>
                        </div>
                    ) : (
                        filteredChats.map((chat, index) => (
                            <button
                                key={chat.id}
                                onClick={() => navigate(`/chat/${chat.id}`)}
                                className={cn(
                                    'flex w-full items-start gap-3 rounded-lg p-3 text-left transition-all duration-200 hover:bg-accent hover:text-accent-foreground active:scale-95 animate-in fade-in slide-in-from-left-4',
                                    selectedChatId === chat.id && 'bg-accent text-accent-foreground shadow-sm'
                                )}
                                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                            >
                                <div className="relative shrink-0 transition-transform duration-300 hover:scale-110">
                                    <Avatar>
                                        <AvatarImage src={chat.avatar} alt={chat.name} />
                                        <AvatarFallback>{chat.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    {chat.status === 'online' && (
                                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-green-500 animate-pulse" />
                                    )}
                                </div>
                                <div className="flex flex-1 flex-col overflow-hidden min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold truncate pr-2">{chat.name}</span>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                                            {chat.timestamp}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <p className="line-clamp-1 text-sm text-muted-foreground pr-2 truncate">
                                            {chat.lastMessage}
                                        </p>
                                        {chat.unreadCount > 0 && (
                                            <Badge
                                                variant="default"
                                                className="h-5 min-w-5 shrink-0 rounded-full px-1.5 flex items-center justify-center text-[10px] animate-in zoom-in spin-in-180 duration-500"
                                            >
                                                {chat.unreadCount}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
