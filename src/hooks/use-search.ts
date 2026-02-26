import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
	SearchResponse,
	MessageSearchResult,
	GroupMessageSearchResult,
	FileSearchResult,
	SearchResult,
} from "@/types";

// ============================================================================
// Types
// ============================================================================

export type SearchFilter = "all" | "messages" | "group_messages" | "files";

export interface UseSearchOptions {
	/** Debounce delay in milliseconds (default: 250) */
	debounceMs?: number;
	/** Maximum results per category (default: 20, max: 100) */
	limit?: number;
	/** Optional conversation key to scope message search */
	conversationKey?: string | null;
	/** Optional group ID to scope group message search */
	groupId?: string | null;
}

export interface UseSearchReturn {
	/** Current search query string */
	query: string;
	/** Update the search query (triggers debounced search) */
	setQuery: (query: string) => void;
	/** Current active filter */
	filter: SearchFilter;
	/** Update the filter and re-run search */
	setFilter: (filter: SearchFilter) => void;
	/** Whether a search is currently in progress */
	isSearching: boolean;
	/** Full search response from the backend */
	response: SearchResponse | null;
	/** Filtered results based on current filter */
	results: SearchResult[];
	/** Message results only */
	messageResults: MessageSearchResult[];
	/** Group message results only */
	groupMessageResults: GroupMessageSearchResult[];
	/** File results only */
	fileResults: FileSearchResult[];
	/** Total count of results */
	totalCount: number;
	/** Error message if search failed */
	error: string | null;
	/** Clear all search state */
	clearSearch: () => void;
	/** Manually trigger a search with the current query */
	search: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for full-text search across messages, group messages, and file transfers.
 *
 * Provides debounced search, filter support, and loading state management.
 * Uses SQLite FTS5 on the backend — instant, offline, no internet required.
 *
 * @example
 * ```tsx
 * const { query, setQuery, results, isSearching, filter, setFilter } = useSearch();
 *
 * <Input value={query} onChange={(e) => setQuery(e.target.value)} />
 * {results.map((r) => <SearchResultItem key={r.id} result={r} />)}
 * ```
 */
export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
	const {
		debounceMs = 250,
		limit = 20,
		conversationKey = null,
		groupId = null,
	} = options;

	const [query, setQueryInternal] = useState("");
	const [filter, setFilter] = useState<SearchFilter>("all");
	const [isSearching, setIsSearching] = useState(false);
	const [response, setResponse] = useState<SearchResponse | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Debounce timer ref
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Track the latest query to avoid stale results
	const latestQueryRef = useRef("");

	const performSearch = useCallback(
		async (searchQuery: string, searchFilter: SearchFilter) => {
			const trimmed = searchQuery.trim();
			if (!trimmed) {
				setResponse(null);
				setError(null);
				setIsSearching(false);
				return;
			}

			latestQueryRef.current = trimmed;
			setIsSearching(true);
			setError(null);

			try {
				let searchResponse: SearchResponse;

				if (searchFilter === "all") {
					searchResponse = await invoke<SearchResponse>(
						"search_all",
						{ query: trimmed, limit },
					);
				} else if (searchFilter === "messages") {
					const results = await invoke<MessageSearchResult[]>(
						"search_messages_cmd",
						{
							query: trimmed,
							conversationKey,
							limit,
						},
					);
					searchResponse = {
						query: trimmed,
						results: results.map((r) => ({
							kind: "message" as const,
							...r,
						})),
						message_count: results.length,
						group_message_count: 0,
						file_count: 0,
						total_count: results.length,
					};
				} else if (searchFilter === "group_messages") {
					const results = await invoke<GroupMessageSearchResult[]>(
						"search_group_messages_cmd",
						{
							query: trimmed,
							groupId,
							limit,
						},
					);
					searchResponse = {
						query: trimmed,
						results: results.map((r) => ({
							kind: "group_message" as const,
							...r,
						})),
						message_count: 0,
						group_message_count: results.length,
						file_count: 0,
						total_count: results.length,
					};
				} else {
					// files
					const results = await invoke<FileSearchResult[]>(
						"search_files_cmd",
						{ query: trimmed, limit },
					);
					searchResponse = {
						query: trimmed,
						results: results.map((r) => ({
							kind: "file" as const,
							...r,
						})),
						message_count: 0,
						group_message_count: 0,
						file_count: results.length,
						total_count: results.length,
					};
				}

				// Only apply results if this is still the latest query
				if (latestQueryRef.current === trimmed) {
					setResponse(searchResponse);
				}
			} catch (err) {
				console.error("Search failed:", err);
				if (latestQueryRef.current === trimmed) {
					setError(String(err));
					setResponse(null);
				}
			} finally {
				if (latestQueryRef.current === trimmed) {
					setIsSearching(false);
				}
			}
		},
		[limit, conversationKey, groupId],
	);

	const setQuery = useCallback(
		(newQuery: string) => {
			setQueryInternal(newQuery);

			// Clear existing debounce timer
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}

			// If query is empty, immediately clear results
			if (!newQuery.trim()) {
				latestQueryRef.current = "";
				setResponse(null);
				setError(null);
				setIsSearching(false);
				return;
			}

			// Debounce the search
			debounceRef.current = setTimeout(() => {
				performSearch(newQuery, filter);
			}, debounceMs);
		},
		[debounceMs, filter, performSearch],
	);

	// Re-run search when filter changes (if there's an active query)
	useEffect(() => {
		if (query.trim()) {
			performSearch(query, filter);
		}
	}, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

	// Cleanup debounce timer on unmount
	useEffect(() => {
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, []);

	const clearSearch = useCallback(() => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}
		latestQueryRef.current = "";
		setQueryInternal("");
		setResponse(null);
		setError(null);
		setIsSearching(false);
	}, []);

	const search = useCallback(async () => {
		await performSearch(query, filter);
	}, [query, filter, performSearch]);

	// Derive filtered result arrays
	const results = response?.results ?? [];

	const messageResults: MessageSearchResult[] = results
		.filter((r): r is SearchResult & { kind: "message" } => r.kind === "message")
		.map(({ kind: _kind, ...rest }) => rest);

	const groupMessageResults: GroupMessageSearchResult[] = results
		.filter(
			(r): r is SearchResult & { kind: "group_message" } =>
				r.kind === "group_message",
		)
		.map(({ kind: _kind, ...rest }) => rest);

	const fileResults: FileSearchResult[] = results
		.filter((r): r is SearchResult & { kind: "file" } => r.kind === "file")
		.map(({ kind: _kind, ...rest }) => rest);

	return {
		query,
		setQuery,
		filter,
		setFilter,
		isSearching,
		response,
		results,
		messageResults,
		groupMessageResults,
		fileResults,
		totalCount: response?.total_count ?? 0,
		error,
		clearSearch,
		search,
	};
}
