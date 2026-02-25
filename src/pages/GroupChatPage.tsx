import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store";
import { useGroupChat } from "@/hooks/use-group-chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { GroupMessage, GroupMember, Device } from "@/types";
import Users from "lucide-react/dist/esm/icons/users";
import Send from "lucide-react/dist/esm/icons/send";
import Crown from "lucide-react/dist/esm/icons/crown";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import MoreVertical from "lucide-react/dist/esm/icons/more-vertical";
import LogOut from "lucide-react/dist/esm/icons/log-out";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import UserMinus from "lucide-react/dist/esm/icons/user-minus";

import PanelRight from "lucide-react/dist/esm/icons/panel-right";
import Monitor from "lucide-react/dist/esm/icons/monitor";
import Smartphone from "lucide-react/dist/esm/icons/smartphone";
import Laptop from "lucide-react/dist/esm/icons/laptop";

function getPlatformIcon(platform: string) {
	const p = platform.toLowerCase();
	if (p.includes("android") || p.includes("ios") || p.includes("mobile")) {
		return <Smartphone className="h-3.5 w-3.5" />;
	}
	if (p.includes("laptop") || p.includes("mac")) {
		return <Laptop className="h-3.5 w-3.5" />;
	}
	return <Monitor className="h-3.5 w-3.5" />;
}

function formatMessageTime(timestamp: number): string {
	const date = new Date(timestamp * 1000);
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateSeparator(timestamp: number): string {
	const date = new Date(timestamp * 1000);
	const now = new Date();
	const stripTime = (d: Date) =>
		new Date(d.getFullYear(), d.getMonth(), d.getDate());
	const today = stripTime(now);
	const msgDay = stripTime(date);
	const diffDays = Math.floor(
		(today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24),
	);

	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Yesterday";
	if (diffDays < 7) return date.toLocaleDateString([], { weekday: "long" });
	return date.toLocaleDateString([], {
		month: "short",
		day: "numeric",
		year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
	});
}

/** Check whether two timestamps belong to different calendar days. */
function isDifferentDay(ts1: number, ts2: number): boolean {
	const d1 = new Date(ts1 * 1000);
	const d2 = new Date(ts2 * 1000);
	return (
		d1.getFullYear() !== d2.getFullYear() ||
		d1.getMonth() !== d2.getMonth() ||
		d1.getDate() !== d2.getDate()
	);
}

export default function GroupChatPage() {
	const { groupId } = useParams<{ groupId: string }>();
	const navigate = useNavigate();

	const localDeviceId = useAppStore((state) => state.localDeviceId);
	const groups = useAppStore((state) => state.groups);
	const groupMessages = useAppStore((state) => state.groupMessages);
	const groupMembers = useAppStore((state) => state.groupMembers);
	const devices = useAppStore((state) => state.devices);
	const connectedDevices = useAppStore((state) => state.connectedDevices);
	const setActiveGroupId = useAppStore((state) => state.setActiveGroupId);

	const {
		loadGroupMessages,
		loadGroupMembers,
		sendGroupMessage,
		leaveGroup,
		disbandGroup,
		removeMember,
	} = useGroupChat();

	const [messageInput, setMessageInput] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [showMembers, setShowMembers] = useState(false);
	const [confirmAction, setConfirmAction] = useState<
		"leave" | "disband" | null
	>(null);
	const [removingMemberId, setRemovingMemberId] = useState<string | null>(
		null,
	);

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// ── Derived state ────────────────────────────────────────────────────────

	const group = groups.find((g) => g.id === groupId);
	const messages: GroupMessage[] = groupId
		? groupMessages[groupId] || []
		: [];
	const members: GroupMember[] = groupId ? groupMembers[groupId] || [] : [];

	const isHost = group?.host_device_id === localDeviceId;
	const isCreator = group?.creator_device_id === localDeviceId;

	/** Lookup a device by ID from the discovery list. */
	const getDevice = useCallback(
		(deviceId: string): Device | undefined =>
			devices.find((d) => d.device_id === deviceId),
		[devices],
	);

	const getDisplayName = useCallback(
		(deviceId: string): string => {
			if (deviceId === localDeviceId) return "You";
			const device = getDevice(deviceId);
			return device?.display_name || deviceId.slice(0, 8) + "…";
		},
		[localDeviceId, getDevice],
	);

	// ── Load data on mount ───────────────────────────────────────────────────

	useEffect(() => {
		if (!groupId) return;
		setActiveGroupId(groupId);
		loadGroupMessages(groupId);
		loadGroupMembers(groupId);

		return () => {
			setActiveGroupId(null);
		};
	}, [groupId, setActiveGroupId, loadGroupMessages, loadGroupMembers]);

	// ── Auto-scroll to bottom ────────────────────────────────────────────────

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages.length]);

	// ── Focus input ──────────────────────────────────────────────────────────

	useEffect(() => {
		inputRef.current?.focus();
	}, [groupId]);

	// ── Handlers ─────────────────────────────────────────────────────────────

	const handleSend = async () => {
		if (!groupId || !messageInput.trim() || isSending) return;

		const content = messageInput.trim();
		setMessageInput("");
		setIsSending(true);
		try {
			await sendGroupMessage(groupId, content);
		} finally {
			setIsSending(false);
			inputRef.current?.focus();
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const handleLeave = async () => {
		if (!groupId) return;
		await leaveGroup(groupId);
		navigate("/");
	};

	const handleDisband = async () => {
		if (!groupId) return;
		await disbandGroup(groupId);
		navigate("/");
	};

	const handleRemoveMember = async (deviceId: string) => {
		if (!groupId) return;
		setRemovingMemberId(null);
		await removeMember(groupId, deviceId);
		loadGroupMembers(groupId);
	};

	// ── Not found ────────────────────────────────────────────────────────────

	if (!groupId || !group) {
		return (
			<div className="flex-1 flex items-center justify-center p-8">
				<div className="text-center space-y-3">
					<Users className="h-12 w-12 text-muted-foreground mx-auto" />
					<h2 className="text-lg font-medium">Group not found</h2>
					<p className="text-sm text-muted-foreground">
						This group may have been disbanded or you are no longer
						a member.
					</p>
					<Button variant="outline" onClick={() => navigate("/")}>
						<ArrowLeft className="h-4 w-4 mr-2" />
						Go back
					</Button>
				</div>
			</div>
		);
	}

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<TooltipProvider delayDuration={300}>
			<div className="flex flex-1 min-h-0 overflow-hidden">
				{/* Main chat area */}
				<div className="flex flex-col flex-1 min-w-0">
					{/* Header */}
					<div className="flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur-sm">
						<Button
							variant="ghost"
							size="icon"
							className="md:hidden shrink-0"
							onClick={() => navigate("/")}
						>
							<ArrowLeft className="h-4 w-4" />
						</Button>

						<div className="flex items-center gap-2 flex-1 min-w-0">
							<div className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 shrink-0">
								<Users className="h-4 w-4 text-primary" />
							</div>
							<div className="min-w-0">
								<h2 className="text-sm font-semibold truncate">
									{group.name}
								</h2>
								<p className="text-xs text-muted-foreground truncate">
									{members.length} member
									{members.length !== 1 ? "s" : ""}
									{isHost && (
										<span className="ml-1 text-primary">
											• You're the host
										</span>
									)}
								</p>
							</div>
						</div>

						<div className="flex items-center gap-1 shrink-0">
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										onClick={() =>
											setShowMembers(!showMembers)
										}
										className={cn(
											showMembers &&
												"bg-accent text-accent-foreground",
										)}
									>
										<PanelRight className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									{showMembers
										? "Hide members"
										: "Show members"}
								</TooltipContent>
							</Tooltip>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" size="icon">
										<MoreVertical className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem
										onClick={() =>
											setShowMembers(!showMembers)
										}
									>
										<Users className="h-4 w-4 mr-2" />
										{showMembers
											? "Hide Members"
											: "Show Members"}
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										onClick={() =>
											setConfirmAction("leave")
										}
										className="text-orange-500 focus:text-orange-500"
									>
										<LogOut className="h-4 w-4 mr-2" />
										Leave Group
									</DropdownMenuItem>
									{(isHost || isCreator) && (
										<DropdownMenuItem
											onClick={() =>
												setConfirmAction("disband")
											}
											className="text-destructive focus:text-destructive"
										>
											<Trash2 className="h-4 w-4 mr-2" />
											Disband Group
										</DropdownMenuItem>
									)}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>

					{/* Messages */}
					<ScrollArea className="flex-1">
						<div className="px-4 py-4 space-y-1">
							{messages.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-16 text-center">
									<div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
										<Users className="h-8 w-8 text-primary" />
									</div>
									<h3 className="text-sm font-medium mb-1">
										No messages yet
									</h3>
									<p className="text-xs text-muted-foreground max-w-[240px]">
										Send the first message to start the
										group conversation!
									</p>
								</div>
							) : (
								messages.map((msg, idx) => {
									const isLocal =
										msg.from_device_id === localDeviceId;
									const senderName = getDisplayName(
										msg.from_device_id,
									);
									const prevMsg =
										idx > 0 ? messages[idx - 1] : null;
									const showDateSeparator =
										!prevMsg ||
										isDifferentDay(
											prevMsg.timestamp,
											msg.timestamp,
										);
									const showSender =
										!isLocal &&
										(!prevMsg ||
											prevMsg.from_device_id !==
												msg.from_device_id ||
											showDateSeparator);
									const isConsecutive =
										prevMsg &&
										prevMsg.from_device_id ===
											msg.from_device_id &&
										!showDateSeparator &&
										msg.timestamp - prevMsg.timestamp < 120;

									return (
										<div key={msg.id}>
											{/* Date separator */}
											{showDateSeparator && (
												<div className="flex items-center gap-3 py-3">
													<Separator className="flex-1" />
													<span className="text-xs text-muted-foreground font-medium px-2">
														{formatDateSeparator(
															msg.timestamp,
														)}
													</span>
													<Separator className="flex-1" />
												</div>
											)}

											{/* Message bubble */}
											<div
												className={cn(
													"flex gap-2",
													isLocal
														? "justify-end"
														: "justify-start",
													isConsecutive
														? "mt-0.5"
														: "mt-2",
												)}
											>
												{/* Sender avatar placeholder for alignment */}
												{!isLocal && (
													<div className="w-7 shrink-0">
														{showSender && (
															<Tooltip>
																<TooltipTrigger
																	asChild
																>
																	<div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium cursor-default">
																		{senderName
																			.charAt(
																				0,
																			)
																			.toUpperCase()}
																	</div>
																</TooltipTrigger>
																<TooltipContent side="left">
																	{senderName}
																</TooltipContent>
															</Tooltip>
														)}
													</div>
												)}

												<div
													className={cn(
														"max-w-[75%] min-w-0",
													)}
												>
													{/* Sender name */}
													{showSender && (
														<p className="text-xs font-medium text-muted-foreground mb-0.5 ml-1">
															{senderName}
															{group.host_device_id ===
																msg.from_device_id && (
																<Crown className="inline h-3 w-3 ml-1 text-yellow-500" />
															)}
														</p>
													)}

													{/* Bubble */}
													<div
														className={cn(
															"rounded-2xl px-3 py-1.5 text-sm break-words",
															isLocal
																? "bg-primary text-primary-foreground rounded-br-md"
																: "bg-muted rounded-bl-md",
														)}
													>
														{msg.msg_type ===
														"emoji" ? (
															<span className="text-2xl">
																{msg.content}
															</span>
														) : (
															<span>
																{msg.content}
															</span>
														)}
														<span
															className={cn(
																"text-[10px] ml-2 opacity-60 whitespace-nowrap float-right mt-1",
																isLocal
																	? "text-primary-foreground/70"
																	: "text-muted-foreground",
															)}
														>
															{formatMessageTime(
																msg.timestamp,
															)}
														</span>
													</div>
												</div>
											</div>
										</div>
									);
								})
							)}
							<div ref={messagesEndRef} />
						</div>
					</ScrollArea>

					{/* Input */}
					<div className="px-4 py-3 border-t bg-background/95 backdrop-blur-sm">
						<div className="flex items-center gap-2">
							<Input
								ref={inputRef}
								placeholder={`Message ${group.name}...`}
								value={messageInput}
								onChange={(e) =>
									setMessageInput(e.target.value)
								}
								onKeyDown={handleKeyDown}
								disabled={isSending}
								className="flex-1"
							/>
							<Button
								size="icon"
								onClick={handleSend}
								disabled={!messageInput.trim() || isSending}
							>
								<Send className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</div>

				{/* Members panel */}
				{showMembers && (
					<div className="w-64 border-l bg-background flex flex-col shrink-0">
						<div className="px-4 py-3 border-b">
							<h3 className="text-sm font-semibold">
								Members ({members.length})
							</h3>
						</div>
						<ScrollArea className="flex-1">
							<div className="p-2 space-y-1">
								{members.map((member) => {
									const device = getDevice(member.device_id);
									const displayName =
										member.device_id === localDeviceId
											? "You"
											: device?.display_name ||
												member.device_id.slice(0, 8) +
													"…";
									const isOnline = connectedDevices.has(
										member.device_id,
									);
									const isMemberHost = member.role === "host";
									const isSelf =
										member.device_id === localDeviceId;

									return (
										<div
											key={member.device_id}
											className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 group"
										>
											{/* Avatar */}
											<div className="relative shrink-0">
												<div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
													{device
														? getPlatformIcon(
																device.platform,
															)
														: displayName
																.charAt(0)
																.toUpperCase()}
												</div>
												{/* Online dot */}
												<div
													className={cn(
														"absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
														isSelf || isOnline
															? "bg-green-500"
															: "bg-muted-foreground/30",
													)}
												/>
											</div>

											{/* Info */}
											<div className="flex-1 min-w-0">
												<p className="text-sm font-medium truncate flex items-center gap-1">
													{displayName}
													{isMemberHost && (
														<Crown className="h-3 w-3 text-yellow-500 shrink-0" />
													)}
												</p>
												<p className="text-xs text-muted-foreground truncate">
													{isSelf
														? isHost
															? "Host"
															: "Member"
														: isOnline
															? "Online"
															: "Offline"}
												</p>
											</div>

											{/* Remove button (host only, not self) */}
											{isHost && !isSelf && (
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="icon"
															className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
															onClick={() =>
																setRemovingMemberId(
																	member.device_id,
																)
															}
														>
															<UserMinus className="h-3.5 w-3.5 text-destructive" />
														</Button>
													</TooltipTrigger>
													<TooltipContent>
														Remove from group
													</TooltipContent>
												</Tooltip>
											)}
										</div>
									);
								})}
							</div>
						</ScrollArea>

						{/* Group info footer */}
						<div className="px-4 py-3 border-t space-y-1">
							<p className="text-xs text-muted-foreground">
								Created{" "}
								{new Date(
									group.created_at * 1000,
								).toLocaleDateString()}
							</p>
							<p className="text-xs text-muted-foreground">
								Host: {getDisplayName(group.host_device_id)}
							</p>
						</div>
					</div>
				)}
			</div>

			{/* Leave / Disband confirmation */}
			<AlertDialog
				open={confirmAction !== null}
				onOpenChange={() => setConfirmAction(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{confirmAction === "disband"
								? "Disband Group?"
								: "Leave Group?"}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{confirmAction === "disband"
								? `This will permanently delete "${group.name}" for all members. This action cannot be undone.`
								: `You will no longer receive messages from "${group.name}". ${
										isHost
											? "A new host will be elected automatically."
											: ""
									}`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={
								confirmAction === "disband"
									? handleDisband
									: handleLeave
							}
							className={cn(
								confirmAction === "disband" &&
									"bg-destructive text-destructive-foreground hover:bg-destructive/90",
							)}
						>
							{confirmAction === "disband" ? "Disband" : "Leave"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Remove member confirmation */}
			<AlertDialog
				open={removingMemberId !== null}
				onOpenChange={() => setRemovingMemberId(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove Member?</AlertDialogTitle>
						<AlertDialogDescription>
							{removingMemberId &&
								`Remove ${getDisplayName(removingMemberId)} from "${group.name}"? They can be re-added later.`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() =>
								removingMemberId &&
								handleRemoveMember(removingMemberId)
							}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Remove
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</TooltipProvider>
	);
}
