import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAi } from "@/hooks/use-ai";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import Bot from "lucide-react/dist/esm/icons/bot";
import Send from "lucide-react/dist/esm/icons/send";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Search from "lucide-react/dist/esm/icons/search";
import FileText from "lucide-react/dist/esm/icons/file-text";
import BarChart3 from "lucide-react/dist/esm/icons/bar-chart-3";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import Settings2 from "lucide-react/dist/esm/icons/settings-2";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import KeyRound from "lucide-react/dist/esm/icons/key-round";

import Copy from "lucide-react/dist/esm/icons/copy";
import Check from "lucide-react/dist/esm/icons/check";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Zap from "lucide-react/dist/esm/icons/zap";
import type {
	AiChatMessage,
	AiModel,
	SummarizeResponse,
	SmartSearchResponse,
	AnalyzeResponse,
} from "@/types";

// ============================================================================
// Sub-components
// ============================================================================

function ApiKeySetup({ onSave }: { onSave: (key: string) => Promise<void> }) {
	const [key, setKey] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	const handleSave = async () => {
		if (!key.trim()) return;
		setIsSaving(true);
		try {
			await onSave(key.trim());
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="flex flex-col items-center justify-center h-full p-8 gap-6">
			<div className="flex items-center justify-center h-20 w-20 rounded-2xl bg-primary/10">
				<Bot className="h-10 w-10 text-primary" />
			</div>
			<div className="text-center space-y-2 max-w-md">
				<h2 className="text-2xl font-bold">AI Assistant</h2>
				<p className="text-muted-foreground text-sm">
					Powered by Google Gemini. Summarize conversations, get smart
					replies, search intelligently, and more — all from your
					desktop.
				</p>
			</div>
			<div className="w-full max-w-sm space-y-3">
				<div className="flex items-center gap-2">
					<KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
					<Input
						type="password"
						placeholder="Enter your Gemini API key..."
						value={key}
						onChange={(e) => setKey(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleSave();
						}}
						className="text-sm"
					/>
				</div>
				<Button
					onClick={handleSave}
					disabled={!key.trim() || isSaving}
					className="w-full"
				>
					{isSaving ? (
						<Loader2 className="h-4 w-4 mr-2 animate-spin" />
					) : (
						<Sparkles className="h-4 w-4 mr-2" />
					)}
					Enable AI Assistant
				</Button>
				<p className="text-[11px] text-muted-foreground/60 text-center">
					Get your API key from{" "}
					<span className="text-primary/80 font-medium">
						aistudio.google.com
					</span>
					. Your key stays on-device and is never shared.
				</p>
			</div>
		</div>
	);
}

function ChatBubble({
	message,
	onCopy,
}: {
	message: AiChatMessage;
	onCopy: (text: string) => void;
}) {
	const [copied, setCopied] = useState(false);
	const isUser = message.role === "user";

	const handleCopy = () => {
		onCopy(message.content);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div
			className={cn(
				"flex gap-3 group",
				isUser ? "justify-end" : "justify-start",
			)}
		>
			{!isUser && (
				<div className="shrink-0 mt-1">
					<div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10">
						<Sparkles className="h-4 w-4 text-primary" />
					</div>
				</div>
			)}
			<div
				className={cn(
					"relative max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
					isUser
						? "bg-primary text-primary-foreground rounded-br-sm"
						: "bg-muted rounded-bl-sm",
				)}
			>
				<div className="whitespace-pre-wrap break-words leading-relaxed">
					{message.content}
				</div>
				{message.tokens_used && !isUser && (
					<div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground/50">
						<Zap className="h-2.5 w-2.5" />
						{message.tokens_used} tokens
					</div>
				)}
				{!isUser && (
					<button
						onClick={handleCopy}
						className="absolute -right-8 top-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
					>
						{copied ? (
							<Check className="h-3.5 w-3.5 text-green-500" />
						) : (
							<Copy className="h-3.5 w-3.5 text-muted-foreground" />
						)}
					</button>
				)}
			</div>
			{isUser && (
				<div className="shrink-0 mt-1">
					<div className="flex items-center justify-center h-8 w-8 rounded-full bg-accent">
						<MessageSquare className="h-4 w-4 text-accent-foreground" />
					</div>
				</div>
			)}
		</div>
	);
}

function QuickAction({
	icon: Icon,
	label,
	description,
	onClick,
	disabled,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	description: string;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			className={cn(
				"flex items-start gap-3 p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-accent/50 transition-all text-left w-full group",
				disabled && "opacity-50 cursor-not-allowed",
			)}
		>
			<div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
				<Icon className="h-5 w-5 text-primary" />
			</div>
			<div className="min-w-0">
				<p className="text-sm font-medium">{label}</p>
				<p className="text-xs text-muted-foreground mt-0.5">
					{description}
				</p>
			</div>
		</button>
	);
}

function SummaryCard({ data }: { data: SummarizeResponse }) {
	return (
		<div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
			<div className="flex items-center gap-2">
				<FileText className="h-4 w-4 text-primary" />
				<span className="text-sm font-semibold">
					Conversation Summary
				</span>
				<Badge variant="secondary" className="text-[10px] h-5 px-1.5">
					{data.message_count} messages
				</Badge>
			</div>
			<div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
				{data.summary}
			</div>
			<div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
				<Zap className="h-2.5 w-2.5" />
				{data.tokens_used} tokens · {data.model}
			</div>
		</div>
	);
}

function SearchResultsCard({ data }: { data: SmartSearchResponse }) {
	const navigate = useNavigate();

	return (
		<div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
			<div className="flex items-center gap-2">
				<Search className="h-4 w-4 text-primary" />
				<span className="text-sm font-semibold">
					Smart Search Results
				</span>
				<Badge variant="secondary" className="text-[10px] h-5 px-1.5">
					{data.results.length} found
				</Badge>
			</div>
			{data.results.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					No relevant results found for &quot;{data.query}&quot;.
				</p>
			) : (
				<div className="space-y-2">
					{data.results.map((result, i) => (
						<button
							key={`${result.conversation_id}-${result.timestamp}-${i}`}
							onClick={() => {
								if (result.is_group) {
									navigate(
										`/group/${result.conversation_id}`,
									);
								} else {
									// Extract device ID from conversation key
									const parts =
										result.conversation_id.split("_");
									const deviceId =
										parts.find(
											(p) => p !== result.from_device_id,
										) || parts[0];
									navigate(`/chat/${deviceId}`);
								}
							}}
							className="w-full text-left p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors space-y-1"
						>
							<div className="flex items-center gap-2">
								<Badge
									variant="outline"
									className="text-[9px] h-4 px-1"
								>
									{result.is_group ? "Group" : "DM"}
								</Badge>
								<span className="text-[10px] text-muted-foreground font-mono">
									{result.from_device_id.slice(0, 8)}…
								</span>
							</div>
							<p className="text-sm line-clamp-2">
								{result.content}
							</p>
							<p className="text-[11px] text-primary/70 italic">
								{result.relevance}
							</p>
						</button>
					))}
				</div>
			)}
			<div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
				<Zap className="h-2.5 w-2.5" />
				{data.tokens_used} tokens · {data.model}
			</div>
		</div>
	);
}

function AnalysisCard({ data }: { data: AnalyzeResponse }) {
	return (
		<div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
			<div className="flex items-center gap-2">
				<BarChart3 className="h-4 w-4 text-primary" />
				<span className="text-sm font-semibold">
					Conversation Analysis
				</span>
			</div>
			<div className="grid grid-cols-2 gap-3">
				<div className="space-y-1">
					<p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
						Tone
					</p>
					<p className="text-sm font-medium capitalize">
						{data.tone}
					</p>
				</div>
				<div className="space-y-1">
					<p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
						Activity
					</p>
					<p className="text-sm font-medium">{data.activity}</p>
				</div>
			</div>
			{data.topics.length > 0 && (
				<div className="space-y-1.5">
					<p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
						Topics
					</p>
					<div className="flex flex-wrap gap-1.5">
						{data.topics.map((topic, i) => (
							<Badge
								key={i}
								variant="secondary"
								className="text-xs"
							>
								{topic}
							</Badge>
						))}
					</div>
				</div>
			)}
			{data.insights.length > 0 && (
				<div className="space-y-1.5">
					<p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
						Insights
					</p>
					<ul className="space-y-1">
						{data.insights.map((insight, i) => (
							<li
								key={i}
								className="text-sm text-foreground/80 flex items-start gap-2"
							>
								<span className="text-primary mt-1">•</span>
								{insight}
							</li>
						))}
					</ul>
				</div>
			)}
			<div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
				<Zap className="h-2.5 w-2.5" />
				{data.tokens_used} tokens · {data.model}
			</div>
		</div>
	);
}

function SettingsPanel({
	status,
	onSetModel,
	onClearKey,
	onClearHistory,
	isOpen,
	onClose,
}: {
	status: NonNullable<ReturnType<typeof useAi>["status"]>;
	onSetModel: (model: AiModel) => Promise<void>;
	onClearKey: () => Promise<void>;
	onClearHistory: () => Promise<void>;
	isOpen: boolean;
	onClose: () => void;
}) {
	if (!isOpen) return null;

	const models: { id: AiModel; label: string; description: string }[] = [
		{
			id: "gemini-2.5-flash",
			label: "Gemini 2.5 Flash",
			description: "Fast & efficient — best for most tasks",
		},
		{
			id: "gemini-2.0-flash",
			label: "Gemini 2.0 Flash",
			description: "Previous generation — stable & reliable",
		},
		{
			id: "gemini-2.5-pro",
			label: "Gemini 2.5 Pro",
			description: "Most capable — complex reasoning",
		},
	];

	return (
		<div className="absolute right-4 top-14 z-50 w-80 rounded-xl border border-border bg-popover shadow-lg p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-semibold">AI Settings</h3>
				<button
					onClick={onClose}
					className="text-muted-foreground hover:text-foreground"
				>
					×
				</button>
			</div>

			{/* Model Selection */}
			<div className="space-y-2">
				<label className="text-xs font-medium text-muted-foreground">
					Model
				</label>
				<div className="space-y-1.5">
					{models.map((m) => (
						<button
							key={m.id}
							onClick={() => onSetModel(m.id)}
							className={cn(
								"w-full text-left p-2.5 rounded-lg border transition-all",
								status.model === m.id
									? "border-primary bg-primary/5"
									: "border-border/50 hover:border-border",
							)}
						>
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium">
									{m.label}
								</span>
								{status.model === m.id && (
									<Check className="h-3.5 w-3.5 text-primary" />
								)}
							</div>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								{m.description}
							</p>
						</button>
					))}
				</div>
			</div>

			{/* Session Stats */}
			<div className="space-y-2">
				<label className="text-xs font-medium text-muted-foreground">
					Session Stats
				</label>
				<div className="grid grid-cols-2 gap-2">
					<div className="p-2 rounded-lg bg-muted/50 text-center">
						<p className="text-lg font-bold">
							{status.request_count}
						</p>
						<p className="text-[10px] text-muted-foreground">
							Requests
						</p>
					</div>
					<div className="p-2 rounded-lg bg-muted/50 text-center">
						<p className="text-lg font-bold">
							{status.total_tokens_used.toLocaleString()}
						</p>
						<p className="text-[10px] text-muted-foreground">
							Tokens Used
						</p>
					</div>
				</div>
			</div>

			{/* Actions */}
			<div className="space-y-1.5 pt-2 border-t border-border/50">
				<Button
					variant="outline"
					size="sm"
					className="w-full justify-start text-xs h-8"
					onClick={onClearHistory}
				>
					<Trash2 className="h-3.5 w-3.5 mr-2" />
					Clear Chat History
				</Button>
				<Button
					variant="outline"
					size="sm"
					className="w-full justify-start text-xs h-8 text-destructive hover:text-destructive"
					onClick={async () => {
						await onClearKey();
						onClose();
					}}
				>
					<KeyRound className="h-3.5 w-3.5 mr-2" />
					Remove API Key
				</Button>
			</div>
		</div>
	);
}

// ============================================================================
// Main Page Component
// ============================================================================

type SpecialCard =
	| { type: "summary"; data: SummarizeResponse }
	| { type: "search"; data: SmartSearchResponse }
	| { type: "analysis"; data: AnalyzeResponse };

export default function AiChatPage() {
	const navigate = useNavigate();
	const {
		status,
		isReady,
		isProcessing,
		processingAction,
		error,
		conversationHistory,
		setApiKey,
		clearApiKey,
		setModel,
		ask,
		summarizeChat,
		smartSearch,
		analyzeChat,
		loadConversationHistory,
		clearConversationHistory,
	} = useAi();

	const messages = useAppStore((s) => s.messages);
	const groups = useAppStore((s) => s.groups);
	const localDeviceId = useAppStore((s) => s.localDeviceId);

	const [input, setInput] = useState("");
	const [showSettings, setShowSettings] = useState(false);
	const [specialCards, setSpecialCards] = useState<SpecialCard[]>([]);
	const [showQuickActions, setShowQuickActions] = useState(true);

	// For summarize/analyze - conversation picker
	const [showConvPicker, setShowConvPicker] = useState<
		"summarize" | "analyze" | null
	>(null);

	const scrollRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Auto-scroll to bottom when messages change
	useEffect(() => {
		if (scrollRef.current) {
			const el = scrollRef.current;
			// Scroll inner viewport to bottom
			setTimeout(() => {
				el.scrollTop = el.scrollHeight;
			}, 50);
		}
	}, [conversationHistory, specialCards, isProcessing]);

	// Load history on mount
	useEffect(() => {
		loadConversationHistory();
	}, [loadConversationHistory]);

	// Hide quick actions when there's history
	useEffect(() => {
		if (conversationHistory.length > 0 || specialCards.length > 0) {
			setShowQuickActions(false);
		}
	}, [conversationHistory.length, specialCards.length]);

	const handleSend = useCallback(async () => {
		const trimmed = input.trim();
		if (!trimmed || isProcessing) return;

		setInput("");
		setShowQuickActions(false);
		await ask(trimmed);
		inputRef.current?.focus();
	}, [input, isProcessing, ask]);

	const handleCopy = useCallback((text: string) => {
		navigator.clipboard.writeText(text);
	}, []);

	const handleSummarize = useCallback(
		async (conversationId: string, isGroup: boolean) => {
			setShowConvPicker(null);
			setShowQuickActions(false);
			const result = await summarizeChat(conversationId, isGroup);
			if (result) {
				setSpecialCards((prev) => [
					...prev,
					{ type: "summary", data: result },
				]);
			}
		},
		[summarizeChat],
	);

	const handleSmartSearch = useCallback(async () => {
		const query = input.trim();
		if (!query) return;
		setInput("");
		setShowQuickActions(false);
		const result = await smartSearch(query);
		if (result) {
			setSpecialCards((prev) => [
				...prev,
				{ type: "search", data: result },
			]);
		}
	}, [input, smartSearch]);

	const handleAnalyze = useCallback(
		async (conversationId: string, isGroup: boolean) => {
			setShowConvPicker(null);
			setShowQuickActions(false);
			const result = await analyzeChat(conversationId, isGroup);
			if (result) {
				setSpecialCards((prev) => [
					...prev,
					{ type: "analysis", data: result },
				]);
			}
		},
		[analyzeChat],
	);

	// Get available conversations for picker
	const conversationOptions = Object.keys(messages)
		.filter((key) => {
			const convMessages = messages[key];
			return convMessages && convMessages.length > 0;
		})
		.map((key) => {
			const convMessages = messages[key];
			const lastMsg = convMessages[convMessages.length - 1];
			const otherDevice =
				lastMsg.from_device_id === localDeviceId
					? lastMsg.to_device_id
					: lastMsg.from_device_id;
			return {
				id: key,
				label: otherDevice.slice(0, 12) + "…",
				isGroup: false,
				messageCount: convMessages.length,
			};
		});

	const groupOptions = groups.map((g) => ({
		id: g.id,
		label: g.name,
		isGroup: true,
		messageCount: 0,
	}));

	const allConversations = [...conversationOptions, ...groupOptions];

	// ── Render ──────────────────────────────────────────────────────────────

	if (!isReady) {
		return <ApiKeySetup onSave={setApiKey} />;
	}

	return (
		<div className="relative flex h-full min-h-0 flex-col overflow-hidden">
			{/* Header */}
			<div className="shrink-0 flex items-center justify-between border-b border-border/50 bg-background/95 px-4 py-3 backdrop-blur-sm">
				<div className="flex items-center gap-3">
					<Button
						variant="ghost"
						size="sm"
						className="h-8 w-8 p-0 md:hidden"
						onClick={() => navigate(-1)}
					>
						<ArrowLeft className="h-4 w-4" />
					</Button>
					<div className="flex items-center gap-2.5">
						<div className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/10">
							<Sparkles className="h-5 w-5 text-primary" />
						</div>
						<div>
							<h2 className="text-sm font-semibold flex items-center gap-1.5">
								AI Assistant
								<Badge
									variant="secondary"
									className="text-[9px] h-4 px-1 font-normal"
								>
									{status?.model || "gemini-2.5-flash"}
								</Badge>
							</h2>
							<p className="text-[11px] text-muted-foreground">
								Powered by Google Gemini
							</p>
						</div>
					</div>
				</div>
				<div className="flex items-center gap-1">
					{status && status.total_tokens_used > 0 && (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 text-[10px] text-muted-foreground mr-1">
										<Zap className="h-3 w-3" />
										{status.total_tokens_used.toLocaleString()}
									</div>
								</TooltipTrigger>
								<TooltipContent>
									<p>
										Total tokens used this session (
										{status.request_count} requests)
									</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}
					<Button
						variant="ghost"
						size="sm"
						className="h-8 w-8 p-0"
						onClick={() => setShowSettings(!showSettings)}
					>
						<Settings2 className="h-4 w-4 text-muted-foreground" />
					</Button>
				</div>
			</div>

			{/* Settings Panel (overlay) */}
			{status && (
				<SettingsPanel
					status={status}
					onSetModel={setModel}
					onClearKey={clearApiKey}
					onClearHistory={async () => {
						await clearConversationHistory();
						setSpecialCards([]);
						setShowQuickActions(true);
					}}
					isOpen={showSettings}
					onClose={() => setShowSettings(false)}
				/>
			)}

			{/* Conversation Picker Modal */}
			{showConvPicker && (
				<div className="absolute inset-0 z-40 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
					<div className="w-full max-w-sm rounded-xl border border-border bg-popover shadow-lg p-4 space-y-3 animate-in fade-in zoom-in-95 duration-200">
						<div className="flex items-center justify-between">
							<h3 className="text-sm font-semibold">
								Select a conversation to{" "}
								{showConvPicker === "summarize"
									? "summarize"
									: "analyze"}
							</h3>
							<button
								onClick={() => setShowConvPicker(null)}
								className="text-muted-foreground hover:text-foreground text-lg"
							>
								×
							</button>
						</div>
						{allConversations.length === 0 ? (
							<p className="text-sm text-muted-foreground text-center py-4">
								No conversations yet. Start chatting first!
							</p>
						) : (
							<ScrollArea className="max-h-64">
								<div className="space-y-1">
									{allConversations.map((conv) => (
										<button
											key={conv.id}
											onClick={() => {
												if (
													showConvPicker ===
													"summarize"
												) {
													handleSummarize(
														conv.id,
														conv.isGroup,
													);
												} else {
													handleAnalyze(
														conv.id,
														conv.isGroup,
													);
												}
											}}
											className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors text-left"
										>
											<div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted">
												{conv.isGroup ? (
													<MessageSquare className="h-4 w-4 text-muted-foreground" />
												) : (
													<MessageSquare className="h-4 w-4 text-muted-foreground" />
												)}
											</div>
											<div className="min-w-0 flex-1">
												<p className="text-sm font-medium truncate">
													{conv.label}
												</p>
												<p className="text-[10px] text-muted-foreground">
													{conv.isGroup
														? "Group"
														: "Direct Message"}
													{conv.messageCount > 0 &&
														` · ${conv.messageCount} messages`}
												</p>
											</div>
										</button>
									))}
								</div>
							</ScrollArea>
						)}
					</div>
				</div>
			)}

			{/* Chat Content */}
			<div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
				<div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
					{/* Quick Actions (shown when empty) */}
					{showQuickActions && (
						<div className="space-y-6 py-8">
							<div className="text-center space-y-2">
								<div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mx-auto">
									<Sparkles className="h-8 w-8 text-primary" />
								</div>
								<h3 className="text-lg font-semibold">
									How can I help?
								</h3>
								<p className="text-sm text-muted-foreground max-w-sm mx-auto">
									Ask me anything, or try one of these quick
									actions.
								</p>
							</div>
							<div className="grid gap-3 sm:grid-cols-2">
								<QuickAction
									icon={FileText}
									label="Summarize Chat"
									description="Get a quick summary of any conversation"
									onClick={() =>
										setShowConvPicker("summarize")
									}
								/>
								<QuickAction
									icon={Search}
									label="Smart Search"
									description="AI-powered search across all messages"
									onClick={() => inputRef.current?.focus()}
								/>
								<QuickAction
									icon={BarChart3}
									label="Analyze Chat"
									description="Understand tone, topics & activity"
									onClick={() => setShowConvPicker("analyze")}
								/>
								<QuickAction
									icon={Bot}
									label="Ask Anything"
									description="General questions, help & more"
									onClick={() => inputRef.current?.focus()}
								/>
							</div>
						</div>
					)}

					{/* Conversation History */}
					{conversationHistory.map((msg) => (
						<ChatBubble
							key={msg.id}
							message={msg}
							onCopy={handleCopy}
						/>
					))}

					{/* Special Cards (summaries, search results, analyses) */}
					{specialCards.map((card, i) => {
						if (card.type === "summary") {
							return (
								<SummaryCard
									key={`card-${i}`}
									data={card.data}
								/>
							);
						}
						if (card.type === "search") {
							return (
								<SearchResultsCard
									key={`card-${i}`}
									data={card.data}
								/>
							);
						}
						if (card.type === "analysis") {
							return (
								<AnalysisCard
									key={`card-${i}`}
									data={card.data}
								/>
							);
						}
						return null;
					})}

					{/* Processing indicator */}
					{isProcessing && (
						<div className="flex items-center gap-3">
							<div className="shrink-0">
								<div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10">
									<Sparkles className="h-4 w-4 text-primary animate-pulse" />
								</div>
							</div>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Loader2 className="h-4 w-4 animate-spin" />
								{processingAction === "summarize"
									? "Summarizing conversation..."
									: processingAction === "smart_reply"
										? "Generating suggestions..."
										: processingAction === "smart_search"
											? "Searching intelligently..."
											: processingAction === "analyze"
												? "Analyzing conversation..."
												: "Thinking..."}
							</div>
						</div>
					)}

					{/* Error display */}
					{error && (
						<div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
							<span className="shrink-0">⚠</span>
							<span className="line-clamp-3">{error}</span>
						</div>
					)}
				</div>
			</div>

			{/* Input Area */}
			<div className="shrink-0 border-t border-border/50 p-3 sm:p-4">
				<div className="max-w-2xl mx-auto">
					<div className="flex items-center gap-2">
						{/* Quick action buttons */}
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										className="h-9 w-9 p-0 shrink-0"
										onClick={() =>
											setShowConvPicker("summarize")
										}
										disabled={isProcessing}
									>
										<FileText className="h-4 w-4 text-muted-foreground" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									Summarize a conversation
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										className="h-9 w-9 p-0 shrink-0"
										onClick={handleSmartSearch}
										disabled={isProcessing || !input.trim()}
									>
										<Search className="h-4 w-4 text-muted-foreground" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									Smart search (type query first)
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										className="h-9 w-9 p-0 shrink-0"
										onClick={() =>
											setShowConvPicker("analyze")
										}
										disabled={isProcessing}
									>
										<BarChart3 className="h-4 w-4 text-muted-foreground" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									Analyze a conversation
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						{/* Input */}
						<Input
							ref={inputRef}
							type="text"
							placeholder={
								isProcessing
									? "Processing..."
									: "Ask me anything..."
							}
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();
									handleSend();
								}
							}}
							disabled={isProcessing}
							className="flex-1 h-10 text-sm"
						/>

						{/* Send button */}
						<Button
							size="sm"
							className="h-10 w-10 p-0 shrink-0"
							onClick={handleSend}
							disabled={isProcessing || !input.trim()}
						>
							{isProcessing ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Send className="h-4 w-4" />
							)}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
