import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
	Radio,
	Pencil,
	Monitor,
	Smartphone,
	Laptop,
	Wifi,
	Check,
	X,
	ArrowRight,
	Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/store";
import type { Device } from "@/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

// Helper to get OS icon
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

const getPlatformLabel = (platform?: string) => {
	if (!platform) return "Unknown";
	const map: Record<string, string> = {
		windows: "Windows",
		mac: "macOS",
		macos: "macOS",
		linux: "Linux",
		android: "Android",
		ios: "iOS",
	};
	return map[platform.toLowerCase()] ?? platform;
};

export default function DiscoveryPage() {
	const navigate = useNavigate();
	const {
		devices,
		deviceName,
		setDeviceName,
		startChat,
		connectedDevices,
		deviceConnectionStatus,
	} = useAppStore();
	const [isEditing, setIsEditing] = useState(false);
	const [editName, setEditName] = useState(deviceName || "");
	const inputRef = useRef<HTMLInputElement>(null);
	const [isSearching, setIsSearching] = useState(true);
	const isMobile = useIsMobile();

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditing]);

	// Simulate search state for UX
	useEffect(() => {
		const timer = setTimeout(() => setIsSearching(false), 2000);
		return () => clearTimeout(timer);
	}, []);

	const handleSave = () => {
		if (editName.trim()) {
			setDeviceName(editName.trim());
			setIsEditing(false);
		}
	};

	const handleCancel = () => {
		setEditName(deviceName || "");
		setIsEditing(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") handleSave();
		if (e.key === "Escape") handleCancel();
	};

	const handleDeviceClick = (device: Device) => {
		startChat(device.device_id);
		navigate(`/chat/${device.device_id}`);
	};

	return (
		<div className="flex flex-col h-full bg-background overflow-hidden">
			{/* ── Header ──────────────────────────────────────────────────── */}
			<header className="hidden md:flex h-14 shrink-0 items-center justify-between border-b border-border/60 px-5 bg-background/95 backdrop-blur-sm sticky top-0 z-10">
				<div className="flex items-center gap-3 min-w-0">
					{/* Pulsing radar icon */}
					<div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
						<Radio className="h-4 w-4 text-primary" />
						<span className="absolute inset-0 rounded-lg bg-primary/10 animate-ping opacity-30" />
					</div>
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<h1 className="text-sm font-semibold tracking-tight">
								Local Discovery
							</h1>
							<Badge
								variant="secondary"
								className="h-[18px] px-1.5 text-[9px] font-semibold gap-1 rounded-md"
							>
								<span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
								Live
							</Badge>
							{devices.length > 0 && (
								<span className="text-[11px] text-muted-foreground tabular-nums">
									· {devices.length}{" "}
									{devices.length === 1 ? "device" : "devices"}
								</span>
							)}
						</div>
						<p className="text-xs text-muted-foreground">
							Devices on your local network
						</p>
					</div>
				</div>

				{/* Device name editor */}
				<div className="flex items-center gap-2 shrink-0">
					{isEditing ? (
						<div className="flex items-center gap-1.5">
							<Input
								ref={inputRef}
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								onKeyDown={handleKeyDown}
								className="h-8 w-36 text-xs font-medium rounded-lg"
							/>
							<Button
								size="icon"
								variant="ghost"
								className="h-7 w-7 text-emerald-500 hover:bg-emerald-500/10"
								onClick={handleSave}
							>
								<Check className="h-3.5 w-3.5" />
							</Button>
							<Button
								size="icon"
								variant="ghost"
								className="h-7 w-7 text-destructive hover:bg-destructive/10"
								onClick={handleCancel}
							>
								<X className="h-3.5 w-3.5" />
							</Button>
						</div>
					) : (
						<div className="flex items-center gap-2">
							<div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/60 border border-border/40">
								<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
								<span className="text-xs text-muted-foreground font-medium">
									{deviceName || "My Device"}
								</span>
							</div>
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7 text-muted-foreground hover:text-foreground"
								onClick={() => {
									setEditName(deviceName || "");
									setIsEditing(true);
								}}
								title="Edit device name"
							>
								<Pencil className="h-3 w-3" />
							</Button>
						</div>
					)}
				</div>
			</header>

			<Separator className="opacity-40" />

			{/* ── Device Grid / Empty state ────────────────────────────────── */}
			<div className={cn("flex-1 overflow-auto", isMobile ? "px-4 py-4" : "px-5 py-5")}>
				{isMobile && (
					<div className="mb-4 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur-sm">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
									Visible Device
								</p>
								<h2 className="mt-1 text-base font-semibold truncate">
									{deviceName || "My Device"}
								</h2>
								<p className="mt-1 text-xs text-muted-foreground">
									{devices.length} {devices.length === 1 ? "device" : "devices"} nearby
								</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								className="h-9 rounded-xl"
								onClick={() => {
									setEditName(deviceName || "");
									setIsEditing((value) => !value);
								}}
							>
								<Pencil className="mr-2 h-3.5 w-3.5" />
								Edit
							</Button>
						</div>
						{isEditing && (
							<div className="mt-3 flex items-center gap-2">
								<Input
									ref={inputRef}
									value={editName}
									onChange={(e) => setEditName(e.target.value)}
									onKeyDown={handleKeyDown}
									className="h-10 rounded-xl"
								/>
								<Button size="icon" className="h-10 w-10 rounded-xl" onClick={handleSave}>
									<Check className="h-4 w-4" />
								</Button>
								<Button size="icon" variant="outline" className="h-10 w-10 rounded-xl" onClick={handleCancel}>
									<X className="h-4 w-4" />
								</Button>
							</div>
						)}
					</div>
				)}
				{devices.length === 0 ? (
					<div className="h-full flex flex-col items-center justify-center space-y-5 py-12">
						<div className="relative">
							<motion.div
								animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.06, 0.2] }}
								transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
								className="absolute -inset-12 bg-primary/10 blur-3xl rounded-full"
							/>
							<motion.div
								animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
								transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
								className="absolute -inset-6 bg-primary/15 blur-xl rounded-full"
							/>
							<div className="relative w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center border border-dashed border-border">
								{isSearching ? (
									<Loader2 className="w-8 h-8 text-primary animate-spin" />
								) : (
									<Radio className="w-8 h-8 text-muted-foreground/40" strokeWidth={1.5} />
								)}
							</div>
						</div>
						<div className="text-center max-w-xs space-y-2">
							<h3 className="text-base font-semibold">
								{isSearching ? "Scanning your network…" : "Looking for devices…"}
							</h3>
							<p className="text-sm text-muted-foreground leading-relaxed">
								Make sure other devices are on the same Wi-Fi network and have
								Hyper Connect open.
							</p>
						</div>
						{/* Skeleton placeholders while searching */}
						{isSearching && (
							<div className="grid grid-cols-2 gap-3 w-full max-w-sm mt-2 opacity-40">
								{[0, 1, 2, 3].map((i) => (
									<div key={i} className="p-4 rounded-xl border border-border/50 space-y-3">
										<Skeleton className="h-9 w-9 rounded-lg" />
										<Skeleton className="h-3.5 w-24 rounded" />
										<Skeleton className="h-2.5 w-16 rounded" />
									</div>
								))}
							</div>
						)}
					</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
						<AnimatePresence mode="popLayout">
							{devices.map((device, index) => {
								const Icon = getOSIcon(device.platform);
								const isOnline =
									connectedDevices.has(device.device_id) ||
									deviceConnectionStatus[device.device_id] ===
										"connected" ||
									Date.now() - device.last_seen * 1000 < 60000;
								return (
									<motion.div
										key={device.device_id}
										layout
										initial={{ opacity: 0, y: 20, scale: 0.96 }}
										animate={{ opacity: 1, y: 0, scale: 1 }}
										exit={{ opacity: 0, scale: 0.95 }}
										transition={{ delay: index * 0.05, duration: 0.3 }}
									>
										<Card
											role="button"
											tabIndex={0}
											onClick={() => handleDeviceClick(device)}
											onKeyDown={(e) =>
												e.key === "Enter" && handleDeviceClick(device)
											}
											className="group cursor-pointer border-border hover:border-primary/50 transition-all duration-200 rounded-xl overflow-hidden"
										>
											<CardContent className="p-4 space-y-3">
												{/* Top row: icon + platform badge */}
												<div className="flex items-start justify-between">
													<div className="p-2.5 rounded-xl bg-muted/30 group-hover:bg-primary/10 transition-colors duration-200">
														<Icon
															className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors duration-200"
															strokeWidth={1.5}
														/>
													</div>
													<div className="flex items-center gap-1.5">
														{isOnline && (
															<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
														)}
														<Badge
															variant="outline"
															className="text-[9px] font-medium h-[18px] px-1.5 rounded border-border/50 text-muted-foreground"
														>
															{getPlatformLabel(device.platform)}
														</Badge>
													</div>
												</div>

												{/* Device info */}
												<div className="space-y-1">
													<h3 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors duration-200">
														{device.display_name || "Unknown Device"}
													</h3>
													<p className="text-[11px] text-muted-foreground font-mono truncate">
														{device.hostname}
													</p>
												</div>

												{/* Footer: LAN badge + arrow */}
												<div className="pt-2 border-t border-border/40 flex items-center justify-between">
													<div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
														<Wifi className="w-3 h-3" />
														<span>LAN</span>
													</div>
													<ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
												</div>
											</CardContent>
										</Card>
									</motion.div>
								);
							})}
						</AnimatePresence>
					</div>
				)}
			</div>
		</div>
	);
}
