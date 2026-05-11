import * as React from "react";
import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useNavigate, useLocation } from "react-router-dom";
import {
	Settings,
	Search,
	MoreVertical,
	Monitor,
	Sun,
	Moon,
	Sparkles,
	Plus,
	UserCheck,
	UserX,
	ShieldAlert,
	Users,
	Crown,
	MessageSquare,
	Radar,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuBadge,
	useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/store";
import { isSystemMessage, getConversationKey } from "@/types";
import CreateGroupDialog from "@/components/group/CreateGroupDialog";

// ── Timestamp formatter ──────────────────────────────────────────────────

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
	if (diffDays === 0)
		return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	if (diffDays === 1) return "Yesterday";
	if (diffDays < 7)
		return date.toLocaleDateString(undefined, { weekday: "short" });
	return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

// ── Exported Sidebar component ───────────────────────────────────────────

export function AppSidebar() {
	const navigate = useNavigate();
	const location = useLocation();
	const { setOpenMobile } = useSidebar();
	const [search, setSearch] = useState("");
	const connectedDevices = useAppStore((s) => s.connectedDevices);
	const deviceConnectionStatus = useAppStore(
		(s) => s.deviceConnectionStatus,
	);

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
		groups,
		groupMessages,
		groupMembers,
		deviceName,
	} = useAppStore();

	// Keep badge in sync when backend emits conversation-read event
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
			if (cancelled) fn();
			else unlisten = fn;
		});
		return () => {
			cancelled = true;
			unlisten?.();
		};
	}, [markConversationAsRead]);

	const selectedChatId = location.pathname.startsWith("/chat/")
		? location.pathname.split("/chat/")[1]
		: null;

	const selectedGroupId = location.pathname.startsWith("/group/")
		? location.pathname.split("/group/")[1]
		: null;

	// ── Group chat items ─────────────────────────────────────────────────
	const groupItems = React.useMemo(() => {
		return groups
			.filter((g) => {
				if (!search) return true;
				return g.name.toLowerCase().includes(search.toLowerCase());
			})
			.map((group) => {
				const msgs = groupMessages[group.id] || [];
				const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
				const members = groupMembers[group.id] || [];
				let lastMessageContent = "";
				if (lastMsg) {
					const senderDevice = devices.find(
						(d) => d.device_id === lastMsg.from_device_id,
					);
					const senderName =
						lastMsg.from_device_id === localDeviceId
							? "You"
							: senderDevice?.display_name ||
								lastMsg.from_device_id.slice(0, 8);
					lastMessageContent = `${senderName}: ${lastMsg.content}`;
					if (lastMessageContent.length > 50)
						lastMessageContent = lastMessageContent.substring(0, 50) + "…";
				}
				return {
					id: group.id,
					name: group.name,
					memberCount: members.length,
					lastMessage: lastMessageContent || "No messages yet",
					timestamp: lastMsg
						? formatTimestamp(lastMsg.timestamp)
						: formatTimestamp(group.created_at),
					sortTimestamp: lastMsg ? lastMsg.timestamp : group.created_at,
					isHost: group.host_device_id === localDeviceId,
				};
			})
			.sort((a, b) => b.sortTimestamp - a.sortTimestamp);
	}, [groups, groupMessages, groupMembers, devices, localDeviceId, search]);

	// ── Direct chat items ────────────────────────────────────────────────
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
					if (lastMessageObj.message_type.type === "Text")
						lastMessageContent = lastMessageObj.message_type.content || "";
					else if (lastMessageObj.message_type.type === "File")
						lastMessageContent = `📎 ${lastMessageObj.message_type.filename}`;
					else lastMessageContent = "Sent a message";
				}

				const isApproved = approvedDevices.includes(device.device_id);
				const isDeclined = declinedDevices.includes(device.device_id);
				const hasIncomingMessages = deviceMessages.some(
					(m) => m.from_device_id === device.device_id,
				);
				const isPendingRequest = !isApproved && !isDeclined && hasIncomingMessages;

				return {
					id: device.device_id,
					name: device.display_name,
					status:
						connectedDevices.has(device.device_id) ||
						deviceConnectionStatus[device.device_id] === "connected" ||
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
					sortTimestamp: lastMessageObj ? lastMessageObj.timestamp : 0,
				};
			})
			.filter((chat): chat is NonNullable<typeof chat> => chat !== null)
			.sort((a, b) => {
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
		connectedDevices,
		deviceConnectionStatus,
	]);

	const filteredChats = chats.filter((chat) =>
		chat.name.toLowerCase().includes(search.toLowerCase()),
	);

	const pendingChats = filteredChats.filter((c) => c.isPendingRequest);
	const activeChats = filteredChats.filter(
		(c) => !c.isPendingRequest && !c.isDeclined,
	);
	const declinedChats = filteredChats.filter((c) => c.isDeclined);

	const navigate_ = (path: string) => {
		navigate(path);
		setOpenMobile(false);
	};

	const userInitials = deviceName
		? deviceName.substring(0, 2).toUpperCase()
		: "ME";

	return (
		<Sidebar>
			{/* ── macOS traffic light spacer ─────────────────────────────── */}
			<div
				data-tauri-drag-region
				className="hidden md:block h-8 w-full shrink-0"
			/>

			{/* ── Header ─────────────────────────────────────────────────── */}
			<SidebarHeader className="px-3 pb-0">
				<div className="flex items-center justify-between py-2">
					<div className="flex items-center gap-2.5 min-w-0">
						<div className="relative shrink-0">
							<Avatar className="h-9 w-9 ring-2 ring-primary/20">
								<AvatarImage src="" alt={deviceName || "Me"} />
								<AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
									{userInitials}
								</AvatarFallback>
							</Avatar>
							<span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-emerald-500" />
						</div>
						<div className="min-w-0">
							<p className="text-sm font-semibold text-sidebar-foreground truncate leading-none">
								{deviceName || "My Device"}
							</p>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								On your network
							</p>
						</div>
					</div>

					{/* Header action buttons */}
					<div className="flex items-center gap-0.5 shrink-0">
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
							onClick={() => navigate_("/search")}
							title="Search"
						>
							<Search className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
							onClick={() => navigate_("/discovery")}
							title="Find devices"
						>
							<Plus className="h-4 w-4" />
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
								>
									<MoreVertical className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-48">
								<DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
									Navigation
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => navigate_("/discovery")}>
									<Radar className="mr-2 h-4 w-4" />
									<span>Discover Devices</span>
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => navigate_("/search")}>
									<Search className="mr-2 h-4 w-4" />
									<span>Search Messages</span>
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => navigate_("/screen-share")}>
									<Monitor className="mr-2 h-4 w-4" />
									<span>Screen Share</span>
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => navigate_("/ai")}>
									<Sparkles className="mr-2 h-4 w-4" />
									<span>AI Assistant</span>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => navigate_("/settings")}>
									<Settings className="mr-2 h-4 w-4" />
									<span>Settings</span>
								</DropdownMenuItem>
								<DropdownMenuItem onClick={toggleTheme}>
									{theme === "dark" ? (
										<Sun className="mr-2 h-4 w-4" />
									) : (
										<Moon className="mr-2 h-4 w-4" />
									)}
									<span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				{/* Search bar */}
				<div className="relative pb-3">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
					<Input
						type="text"
						placeholder="Search chats…"
						className="pl-9 h-9 text-sm bg-muted/60 border-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:bg-muted/80 rounded-lg"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>
			</SidebarHeader>

			<Separator className="opacity-60" />

			{/* ── Content ─────────────────────────────────────────────────── */}
			<SidebarContent>
				{/* Empty state */}
				{filteredChats.length === 0 && groupItems.length === 0 && (
					<div className="flex flex-col items-center justify-center p-8 text-center gap-3 h-40">
						<div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
							<MessageSquare className="h-5 w-5 text-muted-foreground/60" />
						</div>
						<div>
							<p className="text-sm font-medium text-foreground">No chats yet</p>
							<button
								className="text-xs text-primary hover:text-primary/80 underline-offset-2 hover:underline mt-0.5"
								onClick={() => navigate_("/discovery")}
							>
								Find devices on your network →
							</button>
						</div>
					</div>
				)}

				{/* ── Groups ──────────────────────────────────────────────── */}
				{groupItems.length > 0 && (
					<SidebarGroup>
						<SidebarGroupLabel className="flex items-center justify-between pr-1">
							<div className="flex items-center gap-1.5">
								<Users className="h-3 w-3" />
								<span>Groups</span>
								<Badge
									variant="secondary"
									className="h-4 min-w-4 rounded-full px-1 text-[9px] font-medium ml-0.5"
								>
									{groupItems.length}
								</Badge>
							</div>
							<CreateGroupDialog
								trigger={
									<Button
										variant="ghost"
										size="icon"
										className="h-5 w-5 p-0 opacity-60 hover:opacity-100"
									>
										<Plus className="h-3 w-3" />
									</Button>
								}
							/>
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{groupItems.map((item) => (
									<SidebarMenuItem key={item.id}>
										<SidebarMenuButton
											isActive={selectedGroupId === item.id}
											onClick={() => navigate_(`/group/${item.id}`)}
											className="h-auto py-2 px-2 gap-2.5"
										>
											<div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10 shrink-0">
												<Users className="h-4 w-4 text-primary" />
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-center justify-between gap-1">
													<span className="text-sm font-medium truncate flex items-center gap-1">
														{item.name}
														{item.isHost && (
															<Crown className="h-2.5 w-2.5 text-amber-500 shrink-0" />
														)}
													</span>
													<span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
														{item.timestamp}
													</span>
												</div>
												<p className="text-[11px] text-muted-foreground truncate mt-0.5">
													{item.lastMessage}
												</p>
											</div>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				)}

				{/* Separator between groups and chats */}
				{groupItems.length > 0 && filteredChats.length > 0 && (
					<div className="mx-3 my-0.5">
						<Separator className="opacity-40" />
					</div>
				)}

				{/* ── Pending Requests ────────────────────────────────────── */}
				{pendingChats.length > 0 && (
					<SidebarGroup>
						<SidebarGroupLabel className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
							<ShieldAlert className="h-3 w-3" />
							<span>Requests</span>
							<Badge className="h-4 min-w-4 rounded-full px-1 text-[9px] font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 border-none hover:bg-amber-500/15 ml-0.5">
								{pendingChats.length}
							</Badge>
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{pendingChats.map((chat) => (
									<SidebarMenuItem key={chat.id}>
										<SidebarMenuButton
											isActive={selectedChatId === chat.id}
											onClick={() => navigate_(`/chat/${chat.id}`)}
											className="h-auto py-2 px-2 gap-2.5 border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 data-[active=true]:bg-amber-500/15 rounded-xl mb-0.5"
										>
											<div className="relative shrink-0">
												<Avatar className="h-9 w-9">
													<AvatarFallback className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold">
														{chat.name.substring(0, 2).toUpperCase()}
													</AvatarFallback>
												</Avatar>
												{chat.status === "online" && (
													<span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-emerald-500 animate-pulse" />
												)}
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-center justify-between gap-1">
													<span className="text-sm font-medium truncate">
														{chat.name}
													</span>
													<Badge
														variant="secondary"
														className="h-4 shrink-0 rounded-full px-1.5 text-[8px] font-semibold uppercase tracking-wide bg-amber-500/15 text-amber-600 dark:text-amber-400 border-none"
													>
														Request
													</Badge>
												</div>
												<p className="text-[11px] text-muted-foreground truncate mt-0.5">
													{chat.lastMessage}
												</p>
											</div>
										</SidebarMenuButton>
										{chat.unreadCount > 0 && (
											<SidebarMenuBadge className="bg-amber-500 text-white">
												{chat.unreadCount}
											</SidebarMenuBadge>
										)}
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				)}

				{/* ── Active Chats ─────────────────────────────────────────── */}
				{activeChats.length > 0 && (
					<SidebarGroup>
						{(pendingChats.length > 0 || declinedChats.length > 0) && (
							<SidebarGroupLabel className="flex items-center gap-1.5">
								<UserCheck className="h-3 w-3 text-emerald-500" />
								<span>Chats</span>
							</SidebarGroupLabel>
						)}
						<SidebarGroupContent>
							<SidebarMenu>
								{activeChats.map((chat) => (
									<SidebarMenuItem key={chat.id}>
										<SidebarMenuButton
											isActive={selectedChatId === chat.id}
											onClick={() => navigate_(`/chat/${chat.id}`)}
											className="h-auto py-2 px-2 gap-2.5"
										>
											<div className="relative shrink-0">
												<Avatar className="h-9 w-9">
													<AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
														{chat.name.substring(0, 2).toUpperCase()}
													</AvatarFallback>
												</Avatar>
												{chat.status === "online" && (
													<span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-emerald-500" />
												)}
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-center justify-between gap-1">
													<span className="text-sm font-medium truncate">
														{chat.name}
													</span>
													<span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
														{chat.timestamp}
													</span>
												</div>
												<p className="text-[11px] text-muted-foreground truncate mt-0.5">
													{chat.lastMessage}
												</p>
											</div>
										</SidebarMenuButton>
										{chat.unreadCount > 0 && (
											<SidebarMenuBadge className="bg-primary text-primary-foreground min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold">
												{chat.unreadCount}
											</SidebarMenuBadge>
										)}
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				)}

				{/* ── Declined Chats ───────────────────────────────────────── */}
				{declinedChats.length > 0 && (
					<SidebarGroup>
						<SidebarGroupLabel className="flex items-center gap-1.5 text-muted-foreground/60">
							<UserX className="h-3 w-3" />
							<span>Declined</span>
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{declinedChats.map((chat) => (
									<SidebarMenuItem key={chat.id}>
										<SidebarMenuButton
											isActive={selectedChatId === chat.id}
											onClick={() => navigate_(`/chat/${chat.id}`)}
											className="h-auto py-2 px-2 gap-2.5 opacity-50"
										>
											<Avatar className="h-9 w-9 shrink-0">
												<AvatarFallback className="text-xs font-semibold">
													{chat.name.substring(0, 2).toUpperCase()}
												</AvatarFallback>
											</Avatar>
											<div className="flex-1 min-w-0">
												<span className="text-sm font-medium truncate block">
													{chat.name}
												</span>
												<p className="text-[11px] text-muted-foreground truncate mt-0.5">
													{chat.lastMessage}
												</p>
											</div>
										</SidebarMenuButton>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				)}
			</SidebarContent>

			{/* ── Footer ─────────────────────────────────────────────────── */}
			<SidebarFooter>
				<Separator className="opacity-40 mb-2" />
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							onClick={() => navigate_("/settings")}
							className="h-9 gap-2.5 text-muted-foreground hover:text-foreground"
							isActive={location.pathname === "/settings"}
						>
							<Settings className="h-4 w-4" />
							<span className="text-sm">Settings</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}

// Keep backward compat export
export default AppSidebar;
