import Check from "lucide-react/dist/esm/icons/check";
import CheckCheck from "lucide-react/dist/esm/icons/check-check";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface MessageBubbleProps {
  id: string;
  content: string;
  sender: "me" | "them";
  timestamp: string;
  status?: "sent" | "delivered" | "read";
  type?: "text" | "image";
  imageUrl?: string;
  recipientName?: string;
  recipientAvatar?: string;
  animationDelay?: number;
}

function MessageStatusIcon({
  status,
}: {
  status: "sent" | "delivered" | "read";
}) {
  if (status === "read") {
    return (
      <CheckCheck
        className="h-3 w-3 shrink-0"
        style={{ color: "#60a5fa" /* blue-400 */ }}
        aria-label="Read"
      />
    );
  }

  if (status === "delivered") {
    return (
      <CheckCheck
        className="h-3 w-3 shrink-0 opacity-60"
        aria-label="Delivered"
      />
    );
  }

  // sent
  return <Check className="h-3 w-3 shrink-0 opacity-60" aria-label="Sent" />;
}

export default function MessageBubble({
  content,
  sender,
  timestamp,
  status = "sent",
  type = "text",
  imageUrl,
  recipientName = "User",
  recipientAvatar,
  animationDelay = 0,
}: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "flex w-full max-w-[85%] sm:max-w-[75%] items-end gap-1.5 sm:gap-2",
        "animate-in slide-in-from-bottom-2 fade-in duration-300",
        sender === "me" ? "ml-auto flex-row-reverse" : "",
      )}
      style={{
        animationDelay: `${animationDelay}ms`,
        animationFillMode: "both",
      }}
    >
      {/* Avatar — only for the other person */}
      {sender === "them" && (
        <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 shadow-sm transition-transform hover:scale-105">
          <AvatarImage src={recipientAvatar} alt={recipientName} />
          <AvatarFallback className="text-[10px]">
            {recipientName.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}

      <div
        className={cn(
          "relative rounded-2xl px-3 sm:px-4 py-1.5 sm:py-2 shadow-sm",
          "transition-all hover:shadow-md",
          sender === "me"
            ? "bg-primary text-primary-foreground rounded-br-none"
            : "bg-secondary text-secondary-foreground rounded-bl-none",
        )}
      >
        {type === "text" ? (
          <p className="text-xs sm:text-sm leading-relaxed break-words whitespace-pre-wrap">
            {content}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg">
            <img
              src={imageUrl}
              alt="Shared image"
              className="max-w-full h-auto object-cover transition-transform hover:scale-105 duration-300 cursor-zoom-in"
            />
          </div>
        )}

        {/* Timestamp + status ticks */}
        <div
          className={cn(
            "mt-1 flex items-center gap-1 text-[9px] sm:text-[10px]",
            sender === "me"
              ? "text-primary-foreground/70 justify-end"
              : "text-muted-foreground justify-start",
          )}
        >
          <span className="leading-none">{timestamp}</span>

          {sender === "me" && <MessageStatusIcon status={status} />}
        </div>
      </div>
    </div>
  );
}
