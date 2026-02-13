import { useRef, useEffect } from 'react';
import MoreVertical from 'lucide-react/dist/esm/icons/more-vertical';
import Phone from 'lucide-react/dist/esm/icons/phone';
import Video from 'lucide-react/dist/esm/icons/video';
import Info from 'lucide-react/dist/esm/icons/info';
import Search from 'lucide-react/dist/esm/icons/search';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';

export interface UIMessage {
    id: string;
    content: string;
    sender: 'me' | 'them';
    timestamp: string;
    status: 'sent' | 'delivered' | 'read';
    type: 'text' | 'image';
    imageUrl?: string;
}

interface ChatWindowProps {
    messages: UIMessage[];
    onSendMessage: (text: string) => void;
    onFileSelect?: (file: File) => void;
    recipientName?: string;
    recipientAvatar?: string;
    recipientStatus?: 'online' | 'offline';
    className?: string;
}

export function ChatWindow({
    messages,
    onSendMessage,
    onFileSelect,
    recipientName = 'Select a Chat',
    recipientAvatar,
    recipientStatus = 'offline',
    className,
}: ChatWindowProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new message
    useEffect(() => {
        if (scrollRef.current) {
            const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages]);

    return (
        <div className={cn('flex flex-col h-full w-full bg-background text-foreground', className)}>
            {/* Header */}
            <header className="flex h-20 shrink-0 items-center justify-between border-b border-border px-6 pt-6 bg-card/50 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Avatar>
                            <AvatarImage src={recipientAvatar} alt={recipientName} />
                            <AvatarFallback>{recipientName.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        {recipientStatus === 'online' && (
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
                        )}
                    </div>
                    <div>
                        <h3 className="font-semibold leading-none tracking-tight">{recipientName}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {recipientStatus === 'online' ? 'Online' : 'Last seen recently'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                        <Video className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                        <Phone className="h-5 w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                        <Search className="h-5 w-5" />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                                <MoreVertical className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                                <Info className="mr-2 h-4 w-4" />
                                <span>View Info</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive">
                                Block Contact
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* Message Feed */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="flex flex-col gap-4 pb-4">
                    {messages.map((msg, index) => (
                        <MessageBubble
                            key={msg.id}
                            id={msg.id}
                            content={msg.content}
                            sender={msg.sender}
                            timestamp={msg.timestamp}
                            status={msg.status}
                            type={msg.type}
                            imageUrl={msg.imageUrl}
                            recipientName={recipientName}
                            recipientAvatar={recipientAvatar}
                            animationDelay={index * 50}
                        />
                    ))}
                </div>
            </ScrollArea>

            {/* Input Area */}
            <ChatInput onSendMessage={onSendMessage} onFileSelect={onFileSelect} />
        </div>
    );
}
