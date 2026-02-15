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
    onClose?: () => void;
}
export default function Sidebar({ className, onClose }: SidebarProps) {
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
                const conversationKey = getConversationKey(localDeviceId, device.device_id);
                const deviceMessages = messages[conversationKey] || [];
                const lastMessageObj =
                    deviceMessages.length > 0 ? deviceMessages[deviceMessages.length - 1] : null;
                const unreadCount = deviceMessages.filter(
                    (m) => m.from_device_id === device.device_id && !m.read
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
                    id: device.device_id,
                    name: device.display_name,
                    avatar: '',
                    status: Date.now() - (device.last_seen * 1000) < 60000 ? 'online' : 'offline',
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
            <div
                className="flex items-center justify-between px-3 sm:px-4 sm:pt-8 pb-2 sm:pb-3 border-b border-border/50 gap-2"
                style={{ paddingTop: 'max(calc(0.75rem + var(--safe-area-top, 0px)), 0.75rem)' }}
            >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="relative shrink-0">
                        <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                            <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
                            <AvatarFallback>ME</AvatarFallback>
                        </Avatar>
                        <span className="absolute bottom-0 right-0 h-2 w-2 sm:h-3 sm:w-3 rounded-full border-2 border-background bg-green-500" />
                    </div>
                    <h1 className="text-lg sm:text-xl font-bold text-foreground">Chats</h1>
                </div>
                <div className="flex gap-0.5 sm:gap-1 shrink-0">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 sm:h-8 sm:w-8"
                        onClick={() => {
                            navigate('/discovery');
                            onClose?.();
                        }}
                    >
                        <Plus className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 sm:h-8 sm:w-8">
                                <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>My Account</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => {
                                navigate('/settings');
                                onClose?.();
                            }}>
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
            <div className="p-2 sm:p-4">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Search chats..."
                        className="pl-9 h-8 sm:h-10 bg-muted border-none text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:ring-1 focus-visible:ring-ring"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>
            {/* Chat List */}
            <ScrollArea className="flex-1">
                <div className="flex flex-col gap-0.5 sm:gap-1 px-1 sm:px-2 pb-2">
                    {filteredChats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                            <p className="text-xs sm:text-sm">No devices found</p>
                            <p className="text-[11px] sm:text-xs mt-1">Make sure other devices are on the same network.</p>
                        </div>
                    ) : (
                        filteredChats.map((chat, index) => (
                            <button
                                key={chat.id}
                                onClick={() => {
                                    navigate(`/chat/${chat.id}`);
                                    onClose?.();
                                }}
                                className={cn(
                                    'flex w-full items-start gap-2 sm:gap-3 rounded-lg p-2 sm:p-3 text-left transition-all duration-200 hover:bg-accent hover:text-accent-foreground active:scale-95 animate-in fade-in slide-in-from-left-4 min-h-[48px] sm:min-h-[52px]',
                                    selectedChatId === chat.id && 'bg-accent text-accent-foreground shadow-sm'
                                )}
                                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                            >
                                <div className="relative shrink-0 transition-transform duration-300 hover:scale-110">
                                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                                        <AvatarImage src={chat.avatar} alt={chat.name} />
                                        <AvatarFallback>{chat.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    {chat.status === 'online' && (
                                        <span className="absolute bottom-0 right-0 h-2 w-2 sm:h-3 sm:w-3 rounded-full border-2 border-background bg-green-500 animate-pulse" />
                                    )}
                                </div>
                                <div className="flex flex-1 flex-col overflow-hidden min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                        <span className="font-semibold text-xs sm:text-sm truncate pr-1">{chat.name}</span>
                                        <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                                            {chat.timestamp}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-0.5 sm:mt-1 gap-1">
                                        <p className="line-clamp-1 text-[11px] sm:text-xs text-muted-foreground pr-1 truncate">
                                            {chat.lastMessage}
                                        </p>
                                        {chat.unreadCount > 0 && (
                                            <Badge
                                                variant="default"
                                                className="h-4 min-w-4 shrink-0 rounded-full px-1 flex items-center justify-center text-[9px] animate-in zoom-in spin-in-180 duration-500"
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
