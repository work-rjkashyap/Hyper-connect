import * as React from "react";
import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useNavigate, useLocation } from "react-router-dom";
import Settings from "lucide-react/dist/esm/icons/settings";
import Search from "lucide-react/dist/esm/icons/search";
import MoreVertical from "lucide-react/dist/esm/icons/more-vertical";
import Sun from "lucide-react/dist/esm/icons/sun";
import Moon from "lucide-react/dist/esm/icons/moon";
import Plus from "lucide-react/dist/esm/icons/plus";
import UserCheck from "lucide-react/dist/esm/icons/user-check";
import UserX from "lucide-react/dist/esm/icons/user-x";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import { isSystemMessage, getConversationKey } from "@/types";

interface SidebarProps {
	className?: string;
	onClose?: () => void;
}

export default function Sidebar({ className, onClose }: SidebarProps) {
	const navigate = useNavigate();
	const location = useLocation();
	const [search, setSearch] = useState("");
	const {
		devices,
		messages,
		localDeviceId,
		theme,
		toggleTheme,
		markConversationAsRead,
		startedChats,
		approvedDevices,
		declinedDevices,
	} = useAppStore();

	// Keep badge in sync when the backend emits a conversation-read event
	useEffect(() => {
		let unlisten: (() => void) | undefined;
		let cancelled = false;

		listen<{ conversation_key: string; reader_device_id: string }>(
			"conversation-read",
			(event) => {
				const { conversation_key, reader_device_id } = event.payload;
				markConversationAsRead(conversation_key, reader_device_id);
			},
		).then((fn) => {
			if (cancelled) {
				fn();
			} else {
				unlisten = fn;
			}
		});

		return () => {
			cancelled = true;
			unlisten?.();
		};
	}, [markConversationAsRead]);

	// Helper to format timestamp (timestamp is Unix seconds from Rust backend)
	const formatTimestamp = (timestamp: number) => {
		const date = new Date(timestamp * 1000);
		const now = new Date();

		const stripTime = (d: Date) =>
			new Date(d.getFullYear(), d.getMonth(), d.getDate());
		const today = stripTime(now);
		const msgDay = stripTime(date);
		const diffDays = Math.round(
			(today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24),
		);

		if (diffDays === 0) {
			return date.toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			});
		}
		if (diffDays === 1) return "Yesterday";
		if (diffDays > 1 && diffDays < 7) {
			return date.toLocaleDateString(undefined, { weekday: "long" });
		}
		if (date.getFullYear() === now.getFullYear()) {
			return date.toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
			});
		}
		return date.toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	const selectedChatId = location.pathname.startsWith("/chat/")
		? location.pathname.split("/chat/")[1]
		: null;

	const chats = React.useMemo(() => {
		return devices
			.filter((device) => startedChats.includes(device.device_id))
			.map((device) => {
				if (!localDeviceId) return null;
				const conversationKey = getConversationKey(
					localDeviceId,
					device.device_id,
				);
				const deviceMessages = (messages[conversationKey] || []).filter(
					(m) => !isSystemMessage(m),
				);
				const lastMessageObj =
					deviceMessages.length > 0
						? deviceMessages[deviceMessages.length - 1]
						: null;

				const unreadCount =
					selectedChatId === device.device_id
						? 0
						: deviceMessages.filter(
								(m) =>
									m.from_device_id === device.device_id &&
									m.status !== "read",
							).length;

				let lastMessageContent = "No messages yet";
				if (lastMessageObj) {
					if (lastMessageObj.message_type.type === "Text") {
						lastMessageContent =
							lastMessageObj.message_type.content || "";
					} else if (lastMessageObj.message_type.type === "File") {
						lastMessageContent = `File: ${lastMessageObj.message_type.filename}`;
					} else {
						lastMessageContent = "Sent a message";
					}
				}

				// Determine if this is a pending chat request (they messaged us but
				// we haven't approved or declined them yet)
				const isApproved = approvedDevices.includes(device.device_id);
				const isDeclined = declinedDevices.includes(device.device_id);
				const hasIncomingMessages = deviceMessages.some(
					(m) => m.from_device_id === device.device_id,
				);
				const isPendingRequest =
					!isApproved && !isDeclined && hasIncomingMessages;

				return {
					id: device.device_id,
					name: device.display_name,
					avatar: "",
					status:
						Date.now() - device.last_seen * 1000 < 60000
							? "online"
							: "offline",
					lastMessage: lastMessageContent,
					timestamp: lastMessageObj
						? formatTimestamp(lastMessageObj.timestamp)
						: "",
					unreadCount,
					isPendingRequest,
					isDeclined,
					sortTimestamp: lastMessageObj
						? lastMessageObj.timestamp
						: 0,
				};
			})
			.filter((chat): chat is NonNullable<typeof chat> => chat !== null)
			.sort((a, b) => {
				// Pending requests first, then by timestamp
				if (a.isPendingRequest && !b.isPendingRequest) return -1;
				if (!a.isPendingRequest && b.isPendingRequest) return 1;
				return b.sortTimestamp - a.sortTimestamp;
			});
	}, [
		devices,
		messages,
		localDeviceId,
		startedChats,
		approvedDevices,
		declinedDevices,
		selectedChatId,
	]);

	const filteredChats = chats.filter((chat) =>
		chat.name.toLowerCase().includes(search.toLowerCase()),
	);

	const pendingChats = filteredChats.filter((c) => c.isPendingRequest);
	const activeChats = filteredChats.filter(
		(c) => !c.isPendingRequest && !c.isDeclined,
	);
	const declinedChats = filteredChats.filter((c) => c.isDeclined);

	return (
		<div
			className={cn(
				"flex h-full w-full shrink-0 flex-col border-r border-border bg-card text-card-foreground",
				className,
			)}
		>
			{/* macOS traffic light spacer — only on desktop with overlay title bar */}
			<div
				data-tauri-drag-region
				className="hidden md:block h-8 w-full shrink-0"
			/>

			{/* Header */}
			<div
				className="flex items-center justify-between px-3 sm:px-4 pb-2 sm:pb-3 border-b border-border/50 gap-2"
				style={{
					paddingTop:
						"max(calc(0.75rem + var(--safe-area-top, 0px)), 0.75rem)",
				}}
			>
				<div className="flex items-center gap-2 sm:gap-3 min-w-0">
					<div className="relative shrink-0">
						<Avatar className="h-8 w-8 sm:h-10 sm:w-10">
							<AvatarImage
								src="https://github.com/shadcn.png"
								alt="@shadcn"
							/>
							<AvatarFallback>ME</AvatarFallback>
						</Avatar>
						<span className="absolute bottom-0 right-0 h-2 w-2 sm:h-3 sm:w-3 rounded-full border-2 border-background bg-green-500" />
					</div>
					<h1 className="text-lg sm:text-xl font-bold text-foreground">
						Chats
					</h1>
				</div>
				<div className="flex gap-0.5 sm:gap-1 shrink-0">
					<Button
						variant="ghost"
						size="sm"
						className="h-8 w-8 sm:h-8 sm:w-8"
						onClick={() => {
							navigate("/discovery");
							onClose?.();
						}}
					>
						<Plus className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 w-8 sm:h-8 sm:w-8"
							>
								<MoreVertical className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>My Account</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => {
									navigate("/settings");
									onClose?.();
								}}
							>
								<Settings className="mr-2 h-4 w-4" />
								<span>Settings</span>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={toggleTheme}>
								{theme === "dark" ? (
									<Sun className="mr-2 h-4 w-4" />
								) : (
									<Moon className="mr-2 h-4 w-4" />
								)}
								<span>
									{theme === "dark"
										? "Light Mode"
										: "Dark Mode"}
								</span>
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
							<p className="text-xs sm:text-sm">No chats yet</p>
							<p className="text-[11px] sm:text-xs mt-1">
								Go to{" "}
								<button
									className="text-primary underline underline-offset-2 hover:text-primary/80"
									onClick={() => {
										navigate("/discovery");
										onClose?.();
									}}
								>
									Discovery
								</button>{" "}
								to find devices and start chatting.
							</p>
						</div>
					) : (
						<>
							{/* ── Pending Chat Requests ──────────────────────────────── */}
							{pendingChats.length > 0 && (
								<>
									<div className="flex items-center gap-2 px-2 sm:px-3 pt-2 pb-1">
										<ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
										<span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-500">
											Chat Requests
										</span>
										<Badge
											variant="secondary"
											className="h-4 min-w-4 rounded-full px-1 text-[9px] bg-amber-500/15 text-amber-500 border-none"
										>
											{pendingChats.length}
										</Badge>
									</div>
									{pendingChats.map((chat, index) => (
										<ChatRequestItem
											key={chat.id}
											chat={chat}
											index={index}
											isSelected={
												selectedChatId === chat.id
											}
											onNavigate={() => {
												navigate(`/chat/${chat.id}`);
												onClose?.();
											}}
										/>
									))}
									{activeChats.length > 0 && (
										<div className="mx-3 my-1.5 border-t border-border/40" />
									)}
								</>
							)}

							{/* ── Active Chats ───────────────────────────────────────── */}
							{activeChats.length > 0 &&
								(pendingChats.length > 0 ||
									declinedChats.length > 0) && (
									<div className="flex items-center gap-2 px-2 sm:px-3 pt-1 pb-1">
										<UserCheck className="h-3.5 w-3.5 text-emerald-500" />
										<span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
											Active
										</span>
									</div>
								)}
							{activeChats.map((chat, index) => (
								<ChatListItem
									key={chat.id}
									chat={chat}
									index={index}
									isSelected={selectedChatId === chat.id}
									onNavigate={() => {
										navigate(`/chat/${chat.id}`);
										onClose?.();
									}}
								/>
							))}

							{/* ── Declined Chats (dimmed) ─────────────────────────────── */}
							{declinedChats.length > 0 && (
								<>
									<div className="mx-3 my-1.5 border-t border-border/40" />
									<div className="flex items-center gap-2 px-2 sm:px-3 pt-1 pb-1">
										<UserX className="h-3.5 w-3.5 text-muted-foreground/60" />
										<span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">
											Declined
										</span>
									</div>
									{declinedChats.map((chat, index) => (
										<ChatListItem
											key={chat.id}
											chat={chat}
											index={index}
											isSelected={
												selectedChatId === chat.id
											}
											onNavigate={() => {
												navigate(`/chat/${chat.id}`);
												onClose?.();
											}}
											dimmed
										/>
									))}
								</>
							)}
						</>
					)}
				</div>
			</ScrollArea>
		</div>
	);
}

// ── Reusable chat list item ─────────────────────────────────────────────────

interface ChatItemData {
	id: string;
	name: string;
	avatar: string;
	status: string;
	lastMessage: string;
	timestamp: string;
	unreadCount: number;
	isPendingRequest: boolean;
}

function ChatListItem({
	chat,
	index,
	isSelected,
	onNavigate,
	dimmed = false,
}: {
	chat: ChatItemData;
	index: number;
	isSelected: boolean;
	onNavigate: () => void;
	dimmed?: boolean;
}) {
	return (
		<button
			onClick={onNavigate}
			className={cn(
				"flex w-full items-start gap-2 sm:gap-3 rounded-lg p-2 sm:p-3 text-left transition-all duration-200 hover:bg-accent hover:text-accent-foreground active:scale-95 animate-in fade-in slide-in-from-left-4 min-h-[48px] sm:min-h-[52px]",
				isSelected && "bg-accent text-accent-foreground shadow-sm",
				dimmed && "opacity-50",
			)}
			style={{
				animationDelay: `${index * 50}ms`,
				animationFillMode: "both",
			}}
		>
			<div className="relative shrink-0 transition-transform duration-300 hover:scale-110">
				<Avatar className="h-8 w-8 sm:h-10 sm:w-10">
					<AvatarImage src={chat.avatar} alt={chat.name} />
					<AvatarFallback>
						{chat.name.substring(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				{chat.status === "online" && (
					<span className="absolute bottom-0 right-0 h-2 w-2 sm:h-3 sm:w-3 rounded-full border-2 border-background bg-green-500 animate-pulse" />
				)}
			</div>
			<div className="flex flex-1 flex-col overflow-hidden min-w-0">
				<div className="flex items-center justify-between gap-1">
					<span className="font-semibold text-xs sm:text-sm truncate pr-1">
						{chat.name}
					</span>
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
	);
}

// ── Chat request item with accept/decline visual indicator ──────────────────

function ChatRequestItem({
	chat,
	index,
	isSelected,
	onNavigate,
}: {
	chat: ChatItemData;
	index: number;
	isSelected: boolean;
	onNavigate: () => void;
}) {
	return (
		<button
			onClick={onNavigate}
			className={cn(
				"flex w-full items-start gap-2 sm:gap-3 rounded-lg p-2 sm:p-3 text-left transition-all duration-200 hover:bg-amber-500/10 hover:text-accent-foreground active:scale-95 animate-in fade-in slide-in-from-left-4 min-h-[48px] sm:min-h-[52px] border border-amber-500/20 bg-amber-500/5",
				isSelected && "bg-amber-500/15 border-amber-500/30 shadow-sm",
			)}
			style={{
				animationDelay: `${index * 50}ms`,
				animationFillMode: "both",
			}}
		>
			<div className="relative shrink-0 transition-transform duration-300 hover:scale-110">
				<Avatar className="h-8 w-8 sm:h-10 sm:w-10">
					<AvatarImage src={chat.avatar} alt={chat.name} />
					<AvatarFallback className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
						{chat.name.substring(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				{chat.status === "online" && (
					<span className="absolute bottom-0 right-0 h-2 w-2 sm:h-3 sm:w-3 rounded-full border-2 border-background bg-green-500 animate-pulse" />
				)}
			</div>
			<div className="flex flex-1 flex-col overflow-hidden min-w-0">
				<div className="flex items-center justify-between gap-1">
					<span className="font-semibold text-xs sm:text-sm truncate pr-1">
						{chat.name}
					</span>
					<Badge
						variant="secondary"
						className="h-4 shrink-0 rounded-full px-1.5 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border-none"
					>
						Request
					</Badge>
				</div>
				<div className="flex items-center justify-between mt-0.5 sm:mt-1 gap-1">
					<p className="line-clamp-1 text-[11px] sm:text-xs text-muted-foreground pr-1 truncate">
						{chat.lastMessage}
					</p>
					{chat.unreadCount > 0 && (
						<Badge
							variant="default"
							className="h-4 min-w-4 shrink-0 rounded-full px-1 flex items-center justify-center text-[9px] animate-in zoom-in spin-in-180 duration-500 bg-amber-500 hover:bg-amber-500"
						>
							{chat.unreadCount}
						</Badge>
					)}
				</div>
			</div>
		</button>
	);
}
