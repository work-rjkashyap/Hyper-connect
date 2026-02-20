import { motion, AnimatePresence } from "framer-motion";
import { Monitor, Smartphone, Laptop, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Device } from "@/types";

interface DeviceListProps {
	devices: Device[];
	onDeviceClick?: (device: Device) => void;
}

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.1,
		},
	},
};

const itemVariants = {
	hidden: { y: 20, opacity: 0 },
	visible: {
		y: 0,
		opacity: 1,
		transition: {
			type: "spring" as const,
			stiffness: 300,
			damping: 24,
		},
	},
	exit: { scale: 0.95, opacity: 0 },
};

export default function DeviceList({
	devices,
	onDeviceClick,
}: DeviceListProps) {
	const getOSIcon = (platform?: string) => {
		if (!platform) return Monitor;

		switch (platform.toLowerCase()) {
			case "windows":
				return Monitor;
			case "mac":
			case "macos":
				return Laptop;
			case "linux":
				return Monitor;
			case "android":
			case "ios":
				return Smartphone;
			default:
				return Monitor;
		}
	};

	const getStatusColor = (lastSeen: number) => {
		const now = Date.now();
		const diff = now - lastSeen * 1000;

		if (diff < 60000)
			return "bg-emerald-500 shadow-[0_0_8px_var(--emerald-500)]";
		if (diff < 300000)
			return "bg-amber-500 shadow-[0_0_8px_var(--amber-500)]";
		return "bg-muted-foreground";
	};

	const formatLastSeen = (lastSeen: number) => {
		const now = Date.now();
		const diff = now - lastSeen * 1000;

		if (diff < 60000) return "Online";
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
		if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
		return `${Math.floor(diff / 86400000)}d ago`;
	};

	return (
		<div className="flex flex-col h-full">
			{/* Minimal Header */}
			<div className="px-6 pt-6 pb-4 space-y-1">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2.5">
						<h2 className="text-lg font-semibold tracking-tight text-foreground">
							Devices
						</h2>
						<Badge
							variant="secondary"
							className="h-5 px-1.5 text-[10px] font-medium gap-1.5 rounded-md"
						>
							<span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
							Live
						</Badge>
					</div>
					{devices.length > 0 && (
						<span className="text-xs text-muted-foreground tabular-nums">
							{devices.length}{" "}
							{devices.length === 1 ? "device" : "devices"}
						</span>
					)}
				</div>
				<p className="text-sm text-muted-foreground">
					Nearby devices on your local network
				</p>
			</div>

			{/* Content */}
			{devices.length === 0 ? (
				<div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
					<div className="relative mb-6">
						<motion.div
							animate={{
								scale: [1, 1.2, 1],
								opacity: [0.1, 0.2, 0.1],
							}}
							transition={{ duration: 4, repeat: Infinity }}
							className="absolute inset-0 bg-primary blur-2xl rounded-full"
						/>
						<div className="relative w-20 h-20 rounded-2xl bg-muted/40 border border-dashed border-border flex items-center justify-center">
							<Radio
								className="h-8 w-8 text-muted-foreground/50"
								strokeWidth={1.5}
							/>
						</div>
					</div>
					<h3 className="font-semibold text-base text-foreground mb-1">
						Searching for devices…
					</h3>
					<p className="text-sm text-muted-foreground text-center max-w-xs leading-relaxed">
						Make sure other devices have{" "}
						<span className="text-primary font-medium">
							Hyper Connect
						</span>{" "}
						open on the same network.
					</p>
					<motion.div
						animate={{ x: [-8, 8, -8] }}
						transition={{
							duration: 2,
							repeat: Infinity,
							ease: "linear",
						}}
						className="mt-6 flex gap-1"
					>
						{[0, 1, 2].map((i) => (
							<div
								key={i}
								className="h-1 w-1 rounded-full bg-muted-foreground/30"
							/>
						))}
					</motion.div>
				</div>
			) : (
				<ScrollArea className="flex-1">
					<motion.div
						variants={containerVariants}
						initial="hidden"
						animate="visible"
						className="grid gap-3 px-6 pb-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
					>
						<AnimatePresence mode="popLayout">
							{devices.map((device) => {
								const Icon = getOSIcon(device.platform);
								return (
									<motion.button
										key={device.device_id}
										variants={itemVariants}
										layout
										whileHover={{
											y: -2,
											transition: { duration: 0.15 },
										}}
										whileTap={{ scale: 0.98 }}
										className="group relative flex items-start gap-3.5 p-4 rounded-xl border border-border bg-card text-left transition-colors hover:border-primary/40 hover:bg-accent/50"
										onClick={() => onDeviceClick?.(device)}
									>
										<div className="relative shrink-0">
											<Avatar className="h-11 w-11 rounded-lg border border-border/50">
												<AvatarFallback className="rounded-lg bg-primary/8 text-primary font-semibold text-sm">
													{device.display_name
														.substring(0, 2)
														.toUpperCase()}
												</AvatarFallback>
											</Avatar>
											<span
												className={cn(
													"absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
													getStatusColor(
														device.last_seen,
													),
												)}
											/>
										</div>

										<div className="flex-1 min-w-0 space-y-1.5">
											<div className="flex items-center justify-between gap-2">
												<h3 className="text-sm font-medium leading-none text-foreground truncate group-hover:text-primary transition-colors">
													{device.display_name}
												</h3>
												<Icon className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
											</div>

											<p className="text-[11px] font-mono text-muted-foreground/70 truncate">
												{device.addresses[0] ||
													"Unknown IP"}
											</p>

											<div className="flex items-center gap-1.5 pt-0.5">
												<Badge
													variant="secondary"
													className="text-[9px] h-[18px] px-1.5 font-medium rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none shadow-none"
												>
													{formatLastSeen(
														device.last_seen,
													)}
												</Badge>
												{device.platform && (
													<Badge
														variant="outline"
														className="text-[9px] h-[18px] px-1.5 font-medium rounded border-border/50 text-muted-foreground"
													>
														{device.platform}
													</Badge>
												)}
											</div>
										</div>
									</motion.button>
								);
							})}
						</AnimatePresence>
					</motion.div>
				</ScrollArea>
			)}
		</div>
	);
}
