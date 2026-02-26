import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
	AiStatus,
	AiModel,
	AiChatMessage,
	AiAction,
	SummarizeResponse,
	SmartReplyResponse,
	AskResponse,
	SmartSearchResponse,
	AnalyzeResponse,
	AiProcessingEvent,
	AiCompletedEvent,
} from "@/types";

// ============================================================================
// Types
// ============================================================================

export interface UseAiReturn {
	/** Current AI service status */
	status: AiStatus | null;
	/** Whether the AI service is ready (API key configured) */
	isReady: boolean;
	/** Whether an AI operation is currently in progress */
	isProcessing: boolean;
	/** Current processing action type */
	processingAction: AiAction | null;
	/** Last error message */
	error: string | null;
	/** AI conversation history (assistant chat) */
	conversationHistory: AiChatMessage[];

	// Configuration
	/** Set the Gemini API key */
	setApiKey: (key: string) => Promise<void>;
	/** Clear the stored API key */
	clearApiKey: () => Promise<void>;
	/** Change the Gemini model */
	setModel: (model: AiModel) => Promise<void>;
	/** Refresh the AI status from the backend */
	refreshStatus: () => Promise<void>;

	// Features
	/** Summarize a conversation */
	summarizeChat: (
		conversationId: string,
		isGroup: boolean,
		messageLimit?: number,
	) => Promise<SummarizeResponse | null>;
	/** Generate smart reply suggestions */
	getSmartReplies: (
		conversationId: string,
		isGroup: boolean,
		count?: number,
	) => Promise<SmartReplyResponse | null>;
	/** Ask the AI assistant a question */
	ask: (
		prompt: string,
		contextConversationId?: string,
		contextIsGroup?: boolean,
	) => Promise<AskResponse | null>;
	/** Perform AI-powered semantic search */
	smartSearch: (
		query: string,
		limit?: number,
	) => Promise<SmartSearchResponse | null>;
	/** Analyze conversation tone and topics */
	analyzeChat: (
		conversationId: string,
		isGroup: boolean,
	) => Promise<AnalyzeResponse | null>;
	/** Load conversation history from backend */
	loadConversationHistory: () => Promise<void>;
	/** Clear the AI conversation history */
	clearConversationHistory: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for interacting with the AI service (Google Gemini).
 *
 * Provides access to all AI features:
 * - Chat summarization
 * - Smart reply suggestions
 * - Free-form AI assistant
 * - Semantic smart search
 * - Conversation analysis
 *
 * @example
 * ```tsx
 * const { isReady, summarizeChat, ask, isProcessing } = useAi();
 *
 * // Summarize a conversation
 * const summary = await summarizeChat("conv-key", false);
 *
 * // Ask the AI assistant
 * const response = await ask("What were the main topics discussed?");
 * ```
 */
export function useAi(): UseAiReturn {
	const [status, setStatus] = useState<AiStatus | null>(null);
	const [isProcessing, setIsProcessing] = useState(false);
	const [processingAction, setProcessingAction] = useState<AiAction | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);
	const [conversationHistory, setConversationHistory] = useState<
		AiChatMessage[]
	>([]);

	const mountedRef = useRef(true);

	// ── Status management ──────────────────────────────────────────────────

	const refreshStatus = useCallback(async () => {
		try {
			const aiStatus = await invoke<AiStatus>("ai_get_status");
			if (mountedRef.current) {
				setStatus(aiStatus);
			}
		} catch (err) {
			console.error("Failed to get AI status:", err);
		}
	}, []);

	// ── Event listeners ────────────────────────────────────────────────────

	useEffect(() => {
		mountedRef.current = true;
		let unlistenProcessing: (() => void) | undefined;
		let unlistenCompleted: (() => void) | undefined;

		// Listen for AI processing events
		listen<AiProcessingEvent>("ai-processing", (event) => {
			if (mountedRef.current) {
				setIsProcessing(true);
				setProcessingAction(event.payload.action);
				setError(null);
			}
		}).then((fn) => {
			unlistenProcessing = fn;
		});

		// Listen for AI completed events
		listen<AiCompletedEvent>("ai-completed", (event) => {
			if (mountedRef.current) {
				setIsProcessing(false);
				setProcessingAction(null);
				if (!event.payload.success && event.payload.error) {
					setError(event.payload.error);
				}
				// Refresh status after each operation to update token counts
				refreshStatus();
			}
		}).then((fn) => {
			unlistenCompleted = fn;
		});

		// Initial status fetch
		refreshStatus();

		return () => {
			mountedRef.current = false;
			unlistenProcessing?.();
			unlistenCompleted?.();
		};
	}, [refreshStatus]);

	// ── Configuration ──────────────────────────────────────────────────────

	const setApiKey = useCallback(
		async (key: string) => {
			try {
				setError(null);
				await invoke("ai_set_api_key", { apiKey: key });
				await refreshStatus();
			} catch (err) {
				const msg = String(err);
				setError(msg);
				console.error("Failed to set AI API key:", err);
				throw err;
			}
		},
		[refreshStatus],
	);

	const clearApiKey = useCallback(async () => {
		try {
			setError(null);
			await invoke("ai_clear_api_key");
			await refreshStatus();
		} catch (err) {
			console.error("Failed to clear AI API key:", err);
		}
	}, [refreshStatus]);

	const setModel = useCallback(
		async (model: AiModel) => {
			try {
				setError(null);
				await invoke("ai_set_model", { model });
				await refreshStatus();
			} catch (err) {
				const msg = String(err);
				setError(msg);
				console.error("Failed to set AI model:", err);
			}
		},
		[refreshStatus],
	);

	// ── Features ───────────────────────────────────────────────────────────

	const summarizeChat = useCallback(
		async (
			conversationId: string,
			isGroup: boolean,
			messageLimit?: number,
		): Promise<SummarizeResponse | null> => {
			try {
				setError(null);
				const result = await invoke<SummarizeResponse>(
					"ai_summarize_chat",
					{
						conversationId,
						isGroup,
						messageLimit: messageLimit ?? null,
					},
				);
				return result;
			} catch (err) {
				const msg = String(err);
				if (mountedRef.current) setError(msg);
				console.error("AI summarize failed:", err);
				return null;
			}
		},
		[],
	);

	const getSmartReplies = useCallback(
		async (
			conversationId: string,
			isGroup: boolean,
			count?: number,
		): Promise<SmartReplyResponse | null> => {
			try {
				setError(null);
				const result = await invoke<SmartReplyResponse>(
					"ai_smart_reply",
					{
						conversationId,
						isGroup,
						count: count ?? null,
					},
				);
				return result;
			} catch (err) {
				const msg = String(err);
				if (mountedRef.current) setError(msg);
				console.error("AI smart reply failed:", err);
				return null;
			}
		},
		[],
	);

	const ask = useCallback(
		async (
			prompt: string,
			contextConversationId?: string,
			contextIsGroup?: boolean,
		): Promise<AskResponse | null> => {
			try {
				setError(null);
				const result = await invoke<AskResponse>("ai_ask", {
					prompt,
					contextConversationId: contextConversationId ?? null,
					contextIsGroup: contextIsGroup ?? null,
				});

				// Update local conversation history after asking
				if (mountedRef.current) {
					const now = Date.now();
					setConversationHistory((prev) => [
						...prev,
						{
							id: crypto.randomUUID(),
							role: "user" as const,
							content: prompt,
							timestamp: now,
							action: null,
							tokens_used: null,
						},
						{
							id: crypto.randomUUID(),
							role: "assistant" as const,
							content: result.answer,
							timestamp: now + 1,
							action: "ask" as const,
							tokens_used: result.tokens_used,
						},
					]);
				}

				return result;
			} catch (err) {
				const msg = String(err);
				if (mountedRef.current) setError(msg);
				console.error("AI ask failed:", err);
				return null;
			}
		},
		[],
	);

	const smartSearch = useCallback(
		async (
			query: string,
			limit?: number,
		): Promise<SmartSearchResponse | null> => {
			try {
				setError(null);
				const result = await invoke<SmartSearchResponse>(
					"ai_smart_search",
					{
						query,
						limit: limit ?? null,
					},
				);
				return result;
			} catch (err) {
				const msg = String(err);
				if (mountedRef.current) setError(msg);
				console.error("AI smart search failed:", err);
				return null;
			}
		},
		[],
	);

	const analyzeChat = useCallback(
		async (
			conversationId: string,
			isGroup: boolean,
		): Promise<AnalyzeResponse | null> => {
			try {
				setError(null);
				const result = await invoke<AnalyzeResponse>(
					"ai_analyze_chat",
					{
						conversationId,
						isGroup,
					},
				);
				return result;
			} catch (err) {
				const msg = String(err);
				if (mountedRef.current) setError(msg);
				console.error("AI analyze failed:", err);
				return null;
			}
		},
		[],
	);

	const loadConversationHistory = useCallback(async () => {
		try {
			const history = await invoke<AiChatMessage[]>(
				"ai_get_conversation_history",
			);
			if (mountedRef.current) {
				setConversationHistory(history);
			}
		} catch (err) {
			console.error("Failed to load AI conversation history:", err);
		}
	}, []);

	const clearConversationHistory = useCallback(async () => {
		try {
			await invoke("ai_clear_conversation_history");
			if (mountedRef.current) {
				setConversationHistory([]);
			}
		} catch (err) {
			console.error("Failed to clear AI conversation history:", err);
		}
	}, []);

	// ── Derived state ──────────────────────────────────────────────────────

	const isReady = status?.has_api_key === true;

	return {
		status,
		isReady,
		isProcessing,
		processingAction,
		error,
		conversationHistory,

		// Configuration
		setApiKey,
		clearApiKey,
		setModel,
		refreshStatus,

		// Features
		summarizeChat,
		getSmartReplies,
		ask,
		smartSearch,
		analyzeChat,
		loadConversationHistory,
		clearConversationHistory,
	};
}
