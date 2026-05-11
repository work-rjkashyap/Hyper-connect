import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageSquareDashed, Radar, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EmptyStatePage() {
	const navigate = useNavigate();

	return (
		<div className="flex flex-col items-center justify-center h-full bg-background text-center px-6 py-10 sm:p-8 select-none">
			{/* Animated icon */}
			<div className="relative mb-6">
				<motion.div
					animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.04, 0.15] }}
					transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
					className="absolute -inset-10 bg-primary rounded-full blur-3xl"
				/>
				<motion.div
					animate={{ rotate: [0, 5, -5, 0] }}
					transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
					className="relative w-20 h-20 bg-card border border-dashed border-border rounded-2xl flex items-center justify-center shadow-sm"
				>
					<MessageSquareDashed className="w-9 h-9 text-muted-foreground/50" strokeWidth={1.5} />
				</motion.div>
			</div>

			{/* Copy */}
			<motion.div
				initial={{ opacity: 0, y: 12 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.1, duration: 0.4 }}
				className="space-y-2 mb-8 max-w-xs sm:max-w-sm"
			>
				<h3 className="text-xl font-bold tracking-tight text-foreground">
					Your conversations
				</h3>
				<p className="text-sm text-muted-foreground leading-relaxed">
					Open chats from the mobile drawer, or discover new devices on your network to start a conversation.
				</p>
			</motion.div>

			{/* CTA */}
			<motion.div
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.2, duration: 0.4 }}
			>
				<Button
					variant="outline"
					className="gap-2 font-medium rounded-xl border-border/60 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all duration-200"
					onClick={() => navigate("/discovery")}
				>
					<Radar className="h-4 w-4" />
					Discover Devices
					<ArrowRight className="h-3.5 w-3.5 ml-0.5" />
				</Button>
			</motion.div>
		</div>
	);
}
