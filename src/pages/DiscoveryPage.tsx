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
	Radar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store";
import type { Device } from "@/types";

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

export default function DiscoveryPage() {
	const navigate = useNavigate();
	const { devices, deviceName, setDeviceName, startChat } = useAppStore();
	const [isEditing, setIsEditing] = useState(false);
	const [editName, setEditName] = useState(deviceName || "");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditing]);

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
		// Add to startedChats + auto-approve (we initiated contact)
		startChat(device.device_id);
		navigate(`/chat/${device.device_id}`);
	};

	return (
		<div className="flex flex-col h-full bg-background overflow-hidden">
			{/* Header */}
			<header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6 bg-background sticky top-0 z-10">
				<div className="flex items-center gap-3">
					<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
						<Radar className="h-4 w-4 text-foreground/70" />
					</div>
					<div>
						<div className="flex items-center gap-2">
							<h1 className="text-sm font-semibold tracking-tight">
								Local Discovery
							</h1>
							<Badge
								variant="secondary"
								className="h-[18px] px-1.5 text-[9px] font-medium gap-1 rounded-md"
							>
								<span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
								Live
							</Badge>
							{devices.length > 0 && (
								<span className="text-[11px] text-muted-foreground tabular-nums">
									· {devices.length}{" "}
									{devices.length === 1
										? "device"
										: "devices"}
								</span>
							)}
						</div>
						<p className="text-xs text-muted-foreground">
							Devices on your local network
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					{isEditing ? (
						<div className="flex items-center gap-1.5">
							<Input
								ref={inputRef}
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								onKeyDown={handleKeyDown}
								className="h-8 w-36 text-xs font-medium"
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
							<span className="text-xs text-muted-foreground">
								{deviceName || "My Device"}
							</span>
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7"
								onClick={() => {
									setEditName(deviceName || "");
									setIsEditing(true);
								}}
							>
								<Pencil className="h-3 w-3" />
							</Button>
						</div>
					)}
				</div>
			</header>

			{/* Device Grid */}
			<div className="flex-1 overflow-auto px-6 pb-6">
				{devices.length === 0 ? (
					<div className="h-full flex flex-col items-center justify-center space-y-4 pt-12">
						<div className="relative">
							<motion.div
								animate={{
									scale: [1, 1.2, 1],
									opacity: [0.3, 0.1, 0.3],
								}}
								transition={{
									duration: 3,
									repeat: Infinity,
									ease: "easeInOut",
								}}
								className="absolute -inset-10 bg-primary/10 blur-3xl rounded-full"
							/>
							<div className="w-20 h-20 rounded-2xl bg-muted/30 flex items-center justify-center border border-dashed border-border">
								<Radio
									className="w-8 h-8 text-muted-foreground/40"
									strokeWidth={1.5}
								/>
							</div>
						</div>
						<div className="text-center max-w-xs space-y-1.5">
							<h3 className="text-sm font-semibold">
								Looking for devices…
							</h3>
							<p className="text-xs text-muted-foreground leading-relaxed">
								Connect to the same Wi-Fi and open Hyper Connect
								on other devices.
							</p>
						</div>
					</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-4">
						<AnimatePresence mode="popLayout">
							{devices.map((device, index) => {
								const Icon = getOSIcon(device.platform);
								return (
									<motion.div
										key={device.device_id}
										layout
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, scale: 0.95 }}
										transition={{ delay: index * 0.05 }}
									>
										<Card
											role="button"
											tabIndex={0}
											onClick={() =>
												handleDeviceClick(device)
											}
											className="group cursor-pointer border-border/50 hover:border-primary/40 hover:bg-accent/50 transition-colors rounded-xl"
										>
											<CardContent className="p-4">
												<div className="flex items-start justify-between mb-3">
													<div className="p-2 rounded-lg bg-muted">
														<Icon
															className="w-5 h-5 text-foreground/60 group-hover:text-primary transition-colors"
															strokeWidth={1.5}
														/>
													</div>
													<Badge
														variant="outline"
														className="text-[9px] font-medium h-[18px] px-1.5 rounded border-border/50 text-muted-foreground"
													>
														{device.platform ||
															"Unknown"}
													</Badge>
												</div>

												<div className="space-y-1">
													<h3 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
														{device.display_name ||
															"Unknown Device"}
													</h3>
													<p className="text-[11px] text-muted-foreground font-mono truncate">
														{device.hostname}
													</p>
												</div>

												<div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
													<div className="flex items-center gap-1 text-[10px] text-muted-foreground">
														<Wifi className="w-3 h-3" />
														<span>LAN</span>
													</div>
													<ArrowRightIcon className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
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

function ArrowRightIcon(props: any) {
	return (
		<svg
			{...props}
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M5 12h14" />
			<path d="m12 5 7 7-7 7" />
		</svg>
	);
}
