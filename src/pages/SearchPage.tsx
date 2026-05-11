import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSearch } from "@/hooks/use-search";
import type { SearchFilter } from "@/hooks/use-search";
import type { SearchResult } from "@/types";
import { formatFileSize } from "@/types";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

import SearchIcon from "lucide-react/dist/esm/icons/search";
import X from "lucide-react/dist/esm/icons/x";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import UsersIcon from "lucide-react/dist/esm/icons/users";
import FileIcon from "lucide-react/dist/esm/icons/file";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Clock from "lucide-react/dist/esm/icons/clock";
import Layers from "lucide-react/dist/esm/icons/layers";

// ============================================================================
// Filter Tab Config
// ============================================================================

interface FilterTab {
	key: SearchFilter;
	label: string;
	icon: React.ReactNode;
}

const FILTER_TABS: FilterTab[] = [
	{
		key: "all",
		label: "All",
		icon: <Layers className="h-3.5 w-3.5" />,
	},
	{
		key: "messages",
		label: "Messages",
		icon: <MessageSquare className="h-3.5 w-3.5" />,
	},
	{
		key: "group_messages",
		label: "Groups",
		icon: <UsersIcon className="h-3.5 w-3.5" />,
	},
	{
		key: "files",
		label: "Files",
		icon: <FileIcon className="h-3.5 w-3.5" />,
	},
];

// ============================================================================
// Helpers
// ============================================================================

function formatTimestamp(ts: number): string {
	const date = new Date(ts * 1000);
	const now = new Date();

	const stripTime = (d: Date) =>
		new Date(d.getFullYear(), d.getMonth(), d.getDate());
	const today = stripTime(now);
	const msgDay = stripTime(date);
	const diffDays = Math.round(
		(today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24),
	);

	if (diffDays === 0) {
		return date.toLocaleTimeString(undefined, {
			hour: "numeric",
			minute: "2-digit",
		});
	}
	if (diffDays === 1) {
		return "Yesterday";
	}
	if (diffDays < 7) {
		return date.toLocaleDateString(undefined, { weekday: "short" });
	}
	return date.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: diffDays > 365 ? "numeric" : undefined,
	});
}

/**
 * Renders an FTS5 snippet with `<b>` tags as actual bold spans.
 * The snippet comes from SQLite with search terms wrapped in `<b>…</b>`.
 */
function HighlightedSnippet({ snippet }: { snippet: string }) {
	// Split on <b>...</b> tags and render bold spans
	const parts = snippet.split(/(<b>.*?<\/b>)/g);

	return (
		<span>
			{parts.map((part, i) => {
				if (part.startsWith("<b>") && part.endsWith("</b>")) {
					const text = part.slice(3, -4);
					return (
						<span
							key={i}
							className="font-semibold text-primary bg-primary/10 rounded-sm px-0.5"
						>
							{text}
						</span>
					);
				}
				return <span key={i}>{part}</span>;
			})}
		</span>
	);
}

// ============================================================================
// Result Card Components
// ============================================================================

function MessageResultCard({
	result,
	onClick,
}: {
	result: SearchResult & { kind: "message" };
	onClick: () => void;
}) {
	const devices = useAppStore((s) => s.devices);
	const localDeviceId = useAppStore((s) => s.localDeviceId);

	const isSender = result.from_device_id === localDeviceId;
	const otherDeviceId = isSender
		? result.to_device_id
		: result.from_device_id;
	const device = devices.find((d) => d.device_id === otherDeviceId);
	const displayName = device?.display_name || otherDeviceId.slice(0, 8);
	const senderLabel = isSender ? "You" : displayName;

	return (
		<Card
			className="p-3 cursor-pointer hover:bg-accent/50 transition-colors group"
			onClick={onClick}
		>
			<div className="flex items-start gap-3">
				<div className="mt-0.5 shrink-0 h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
					<MessageSquare className="h-4 w-4 text-blue-500" />
				</div>

				<div className="flex-1 min-w-0 space-y-1">
					<div className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-1.5 min-w-0">
							<span className="text-xs font-semibold truncate">
								{senderLabel}
							</span>
							<Badge
								variant="secondary"
								className="h-4 text-[9px] px-1 shrink-0"
							>
								DM
							</Badge>
						</div>
						<div className="flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground">
							<Clock className="h-3 w-3" />
							{formatTimestamp(result.timestamp)}
						</div>
					</div>

					<p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
						<HighlightedSnippet snippet={result.snippet} />
					</p>
				</div>

				<ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
			</div>
		</Card>
	);
}

function GroupMessageResultCard({
	result,
	onClick,
}: {
	result: SearchResult & { kind: "group_message" };
	onClick: () => void;
}) {
	const devices = useAppStore((s) => s.devices);
	const groups = useAppStore((s) => s.groups);
	const localDeviceId = useAppStore((s) => s.localDeviceId);

	const group = groups.find((g) => g.id === result.group_id);
	const groupName = group?.name || "Unknown Group";

	const isSender = result.from_device_id === localDeviceId;
	const device = devices.find((d) => d.device_id === result.from_device_id);
	const senderName = isSender
		? "You"
		: device?.display_name || result.from_device_id.slice(0, 8);

	return (
		<Card
			className="p-3 cursor-pointer hover:bg-accent/50 transition-colors group"
			onClick={onClick}
		>
			<div className="flex items-start gap-3">
				<div className="mt-0.5 shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
					<UsersIcon className="h-4 w-4 text-primary" />
				</div>

				<div className="flex-1 min-w-0 space-y-1">
					<div className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-1.5 min-w-0">
							<span className="text-xs font-semibold truncate">
								{senderName}
							</span>
							<span className="text-[10px] text-muted-foreground">
								in
							</span>
							<Badge
								variant="secondary"
								className="h-4 text-[9px] px-1 shrink-0 max-w-24 truncate"
							>
								{groupName}
							</Badge>
						</div>
						<div className="flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground">
							<Clock className="h-3 w-3" />
							{formatTimestamp(result.timestamp)}
						</div>
					</div>

					<p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
						<HighlightedSnippet snippet={result.snippet} />
					</p>
				</div>

				<ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
			</div>
		</Card>
	);
}

function FileResultCard({
	result,
	onClick,
}: {
	result: SearchResult & { kind: "file" };
	onClick: () => void;
}) {
	const devices = useAppStore((s) => s.devices);
	const localDeviceId = useAppStore((s) => s.localDeviceId);

	const isSender = result.from_device_id === localDeviceId;
	const otherDeviceId = isSender
		? result.to_device_id
		: result.from_device_id;
	const device = devices.find((d) => d.device_id === otherDeviceId);
	const peerName = device?.display_name || otherDeviceId.slice(0, 8);

	const statusColors: Record<string, string> = {
		completed: "text-emerald-500 bg-emerald-500/10",
		failed: "text-destructive bg-destructive/10",
		cancelled: "text-muted-foreground bg-muted",
		in_progress: "text-blue-500 bg-blue-500/10",
		pending: "text-amber-500 bg-amber-500/10",
	};

	const statusColor =
		statusColors[result.status] || "text-muted-foreground bg-muted";

	return (
		<Card
			className="p-3 cursor-pointer hover:bg-accent/50 transition-colors group"
			onClick={onClick}
		>
			<div className="flex items-start gap-3">
				<div className="mt-0.5 shrink-0 h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
					<FileIcon className="h-4 w-4 text-amber-500" />
				</div>

				<div className="flex-1 min-w-0 space-y-1">
					<div className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-1.5 min-w-0">
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="text-xs font-semibold truncate max-w-40 cursor-default">
										{result.filename}
									</span>
								</TooltipTrigger>
								<TooltipContent
									side="top"
									className="text-xs max-w-64"
								>
									<p className="break-all">
										{result.filename}
									</p>
								</TooltipContent>
							</Tooltip>
							<Badge
								variant="outline"
								className={cn(
									"h-4 text-[9px] px-1 shrink-0 border-0",
									statusColor,
								)}
							>
								{result.status}
							</Badge>
						</div>
						<div className="flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground">
							<Clock className="h-3 w-3" />
							{formatTimestamp(result.created_at)}
						</div>
					</div>

					<div className="flex items-center gap-2 text-[10px] text-muted-foreground">
						<span>{formatFileSize(result.size)}</span>
						<span>·</span>
						<span>
							{isSender ? "Sent to" : "Received from"} {peerName}
						</span>
					</div>
				</div>

				<ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
			</div>
		</Card>
	);
}

// ============================================================================
// Empty / Loading States
// ============================================================================

function EmptySearchState() {
	return (
		<div className="flex flex-col items-center justify-center py-20 text-center">
			<div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
				<SearchIcon className="h-8 w-8 text-muted-foreground/50" />
			</div>
			<h3 className="text-sm font-medium text-muted-foreground mb-1">
				Search your conversations
			</h3>
			<p className="text-xs text-muted-foreground/70 max-w-56">
				Find messages, group chats, and files instantly. All searches
				happen locally — no internet needed.
			</p>
		</div>
	);
}

function NoResultsState({ query }: { query: string }) {
	return (
		<div className="flex flex-col items-center justify-center py-16 text-center">
			<div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center mb-3">
				<SearchIcon className="h-7 w-7 text-muted-foreground/40" />
			</div>
			<h3 className="text-sm font-medium text-muted-foreground mb-1">
				No results found
			</h3>
			<p className="text-xs text-muted-foreground/70 max-w-56">
				No matches for &ldquo;
				<span className="font-medium text-foreground/70">{query}</span>
				&rdquo;. Try a different search term.
			</p>
		</div>
	);
}

function SearchLoadingState() {
	return (
		<div className="flex flex-col items-center justify-center py-16">
			<Loader2 className="h-6 w-6 text-primary animate-spin mb-3" />
			<p className="text-xs text-muted-foreground">Searching…</p>
		</div>
	);
}

// ============================================================================
// Main SearchPage Component
// ============================================================================

export default function SearchPage() {
	const navigate = useNavigate();
	const localDeviceId = useAppStore((s) => s.localDeviceId);
	const inputRef = useRef<HTMLInputElement>(null);

	const {
		query,
		setQuery,
		filter,
		setFilter,
		isSearching,
		results,
		totalCount,
		response,
		clearSearch,
	} = useSearch({ debounceMs: 200, limit: 30 });

	// Auto-focus input on mount
	useEffect(() => {
		const timer = setTimeout(() => {
			inputRef.current?.focus();
		}, 100);
		return () => clearTimeout(timer);
	}, []);

	const handleResultClick = useCallback(
		(result: SearchResult) => {
			switch (result.kind) {
				case "message": {
					// Navigate to the chat with the other device
					const otherDeviceId =
						result.from_device_id === localDeviceId
							? result.to_device_id
							: result.from_device_id;
					navigate(`/chat/${otherDeviceId}`);
					break;
				}
				case "group_message":
					navigate(`/group/${result.group_id}`);
					break;
				case "file": {
					// Navigate to the chat with the file transfer peer
					const otherDeviceId =
						result.from_device_id === localDeviceId
							? result.to_device_id
							: result.from_device_id;
					navigate(`/chat/${otherDeviceId}`);
					break;
				}
			}
		},
		[navigate, localDeviceId],
	);

	const hasQuery = query.trim().length > 0;
	const hasResults = totalCount > 0;

	return (
		<TooltipProvider delayDuration={300}>
			<div className="flex h-full min-h-0 flex-col overflow-hidden">
				{/* ── Header ─────────────────────────────────────────────── */}
				<div className="shrink-0 border-b border-border/50 bg-card/50 backdrop-blur-sm">
					<div className="px-4 pt-3 pb-2">
						<div className="flex items-center gap-2 mb-3">
							<SearchIcon className="h-5 w-5 text-primary shrink-0" />
							<h1 className="text-lg font-bold">Search</h1>
						</div>

						{/* Search Input */}
						<div className="relative">
							<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
							<Input
								ref={inputRef}
								type="text"
								placeholder="Search messages, groups, files…"
								className="pl-9 pr-9 h-10 bg-muted border-none text-sm placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-primary"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
							/>
							{hasQuery && (
								<Button
									variant="ghost"
									size="icon"
									className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full"
									onClick={clearSearch}
								>
									<X className="h-3.5 w-3.5" />
								</Button>
							)}
						</div>
					</div>

					{/* Filter Tabs */}
					<div className="flex items-center gap-1 px-4 pb-2">
						{FILTER_TABS.map((tab) => {
							const isActive = filter === tab.key;
							const count =
								tab.key === "all"
									? totalCount
									: tab.key === "messages"
										? (response?.message_count ?? 0)
										: tab.key === "group_messages"
											? (response?.group_message_count ??
												0)
											: (response?.file_count ?? 0);

							return (
								<Button
									key={tab.key}
									variant={isActive ? "default" : "ghost"}
									size="sm"
									className={cn(
										"h-7 text-xs gap-1.5 px-2.5 rounded-full",
										!isActive &&
											"text-muted-foreground hover:text-foreground",
									)}
									onClick={() => setFilter(tab.key)}
								>
									{tab.icon}
									{tab.label}
									{hasQuery && count > 0 && (
										<Badge
											variant={
												isActive
													? "outline"
													: "secondary"
											}
											className={cn(
												"h-4 min-w-4 rounded-full px-1 text-[9px] ml-0.5",
												isActive &&
													"border-primary-foreground/30 text-primary-foreground",
											)}
										>
											{count}
										</Badge>
									)}
								</Button>
							);
						})}
					</div>

					<Separator />
				</div>

				{/* ── Results ─────────────────────────────────────────────── */}
				<ScrollArea className="min-h-0 flex-1">
					<div className="p-4 space-y-2">
						{!hasQuery && <EmptySearchState />}

						{hasQuery && isSearching && <SearchLoadingState />}

						{hasQuery && !isSearching && !hasResults && (
							<NoResultsState query={query} />
						)}

						{hasQuery && !isSearching && hasResults && (
							<>
								{/* Results header */}
								<div className="flex items-center justify-between mb-1">
									<p className="text-[11px] text-muted-foreground font-medium">
										{totalCount} result
										{totalCount !== 1 ? "s" : ""} for
										&ldquo;
										<span className="text-foreground/80">
											{response?.query}
										</span>
										&rdquo;
									</p>
								</div>

								{/* Result cards */}
								{results.map((result) => {
									switch (result.kind) {
										case "message":
											return (
												<MessageResultCard
													key={`msg-${result.id}`}
													result={result}
													onClick={() =>
														handleResultClick(
															result,
														)
													}
												/>
											);
										case "group_message":
											return (
												<GroupMessageResultCard
													key={`grp-${result.id}`}
													result={result}
													onClick={() =>
														handleResultClick(
															result,
														)
													}
												/>
											);
										case "file":
											return (
												<FileResultCard
													key={`file-${result.id}`}
													result={result}
													onClick={() =>
														handleResultClick(
															result,
														)
													}
												/>
											);
										default:
											return null;
									}
								})}
							</>
						)}
					</div>
				</ScrollArea>
			</div>
		</TooltipProvider>
	);
}
