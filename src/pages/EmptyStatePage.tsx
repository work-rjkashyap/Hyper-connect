export default function EmptyStatePage() {
    return (
        <div className="flex flex-col items-center justify-center h-full bg-background/50 text-center p-4 sm:p-8">
            <div className="relative mb-4 sm:mb-6 group">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-card border-2 border-dashed border-muted-foreground/25 rounded-2xl flex items-center justify-center transform group-hover:scale-105 transition-transform duration-300">
                    <svg
                        className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                    </svg>
                </div>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mb-2">
                Your Messages
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground max-w-sm mb-6 sm:mb-8 leading-relaxed">
                Select a chat from the sidebar to start messaging or share files with devices on your network.
            </p>
        </div>
    );
}
