import { useState, useRef } from 'react';
import Send from 'lucide-react/dist/esm/icons/send';
import Paperclip from 'lucide-react/dist/esm/icons/paperclip';
import Smile from 'lucide-react/dist/esm/icons/smile';
import Mic from 'lucide-react/dist/esm/icons/mic';
import ImageIcon from 'lucide-react/dist/esm/icons/image';
import Film from 'lucide-react/dist/esm/icons/film';
import File from 'lucide-react/dist/esm/icons/file';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatInputProps {
    onSendMessage: (message: string) => void;
    onFileSelect?: (file: File) => void;
}

export default function ChatInput({ onSendMessage, onFileSelect }: ChatInputProps) {
    const [message, setMessage] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSendMessage = () => {
        if (message.trim()) {
            onSendMessage(message);
            setMessage('');
            // Reset height
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        setMessage((prev) => prev + emojiData.emoji);
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
        // Auto-resize
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    };

    const handleAttachmentClick = (type: 'image' | 'video' | 'file') => {
        if (fileInputRef.current) {
            let accept = '*/*';
            if (type === 'image') accept = 'image/*';
            if (type === 'video') accept = 'video/*';
            fileInputRef.current.accept = accept;
            fileInputRef.current.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onFileSelect?.(file);
        }
        // Reset input
        e.target.value = '';
    };

    return (
        <div
            className="flex items-end gap-1 sm:gap-2 border-t border-border bg-background p-2 sm:p-4"
            style={{ paddingBottom: 'max(calc(0.5rem + var(--safe-area-bottom, 0px)), 0.5rem)' }}
        >
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
            />

            {/* Left Actions */}
            <div className="flex items-center gap-0.5 sm:gap-1 pb-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-foreground">
                            <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
                            <span className="sr-only">Attach</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top" className="w-40 sm:w-48">
                        <DropdownMenuItem onClick={() => handleAttachmentClick('image')}>
                            <ImageIcon className="mr-2 h-4 w-4" />
                            <span>Photo</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAttachmentClick('video')}>
                            <Film className="mr-2 h-4 w-4" />
                            <span>Video</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAttachmentClick('file')}>
                            <File className="mr-2 h-4 w-4" />
                            <span>Document</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-foreground">
                            <Smile className="h-4 w-4 sm:h-5 sm:w-5" />
                            <span className="sr-only">Insert emoji</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="start" className="w-auto p-0 border-none shadow-none bg-transparent">
                        <EmojiPicker
                            onEmojiClick={handleEmojiClick}
                            theme={Theme.AUTO}
                            searchDisabled
                            skinTonesDisabled
                            previewConfig={{ showPreview: false }}
                        />
                    </PopoverContent>
                </Popover>
            </div>

            {/* Input Area */}
            <div className="flex-1 min-w-0">
                <Textarea
                    ref={textareaRef}
                    value={message}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="min-h-[36px] sm:min-h-[40px] max-h-[120px] resize-none overflow-y-auto py-2 sm:py-3 px-3 bg-muted/50 border-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:bg-background transition-colors rounded-md"
                    rows={1}
                />
            </div>

            {/* Right Actions */}
            <div className="pb-1">
                {message.trim() ? (
                    <Button onClick={handleSendMessage} size="sm" className="h-8 w-8 sm:h-10 sm:w-10 shrink-0">
                        <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="sr-only">Send</span>
                    </Button>
                ) : (
                    <Button variant="ghost" size="sm" className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 text-muted-foreground hover:text-foreground">
                        <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                )}
            </div>
        </div>
    );
}
