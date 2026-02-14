import Check from 'lucide-react/dist/esm/icons/check';
import CheckCheck from 'lucide-react/dist/esm/icons/check-check';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export interface MessageBubbleProps {
    id: string;
    content: string;
    sender: 'me' | 'them';
    timestamp: string;
    status?: 'sent' | 'delivered' | 'read';
    type?: 'text' | 'image';
    imageUrl?: string;
    recipientName?: string;
    recipientAvatar?: string;
    animationDelay?: number;
}

export default function MessageBubble({
    content,
    sender,
    timestamp,
    status = 'sent',
    type = 'text',
    imageUrl,
    recipientName = 'User',
    recipientAvatar,
    animationDelay = 0,
}: MessageBubbleProps) {
    return (
        <div
            className={cn(
                'flex w-full max-w-[85%] sm:max-w-[75%] items-end gap-1.5 sm:gap-2 animate-in slide-in-from-bottom-2 fade-in duration-300',
                sender === 'me' ? 'ml-auto flex-row-reverse' : ''
            )}
            style={{ animationDelay: `${animationDelay}ms`, animationFillMode: 'both' }}
        >
            {/* Avatar for 'them' */}
            {sender === 'them' && (
                <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 shadow-sm transition-transform hover:scale-105">
                    <AvatarImage src={recipientAvatar} alt={recipientName} />
                    <AvatarFallback>{recipientName.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
            )}

            <div
                className={cn(
                    'relative rounded-2xl px-3 sm:px-4 py-1.5 sm:py-2 shadow-sm transition-all hover:shadow-md',
                    sender === 'me'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-secondary text-secondary-foreground rounded-bl-none'
                )}
            >
                {type === 'text' ? (
                    <p className="text-xs sm:text-sm leading-relaxed">{content}</p>
                ) : (
                    <div className="overflow-hidden rounded-lg">
                        <img
                            src={imageUrl}
                            alt="Shared image"
                            className="max-w-full h-auto object-cover transition-transform hover:scale-105 duration-300 cursor-zoom-in"
                        />
                    </div>
                )}

                <div
                    className={cn(
                        'mt-1 flex items-center gap-0.5 text-[9px] sm:text-[10px] opacity-70',
                        sender === 'me' ? 'text-primary-foreground justify-end' : 'text-muted-foreground justify-start'
                    )}
                >
                    <span>{timestamp}</span>
                    {sender === 'me' && (
                        <span>
                            {status === 'read' ? <CheckCheck className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> : <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
