import { useEffect, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "@/hooks/use-toast";
import type {
	MeshRoute,
	MeshRoutingUpdatedEvent,
	MeshMessageRelayedEvent,
	MeshMessageDeliveredEvent,
} from "@/types";

// ============================================================================
// TYPES
// ============================================================================

export interface MeshRoutingHook {
	/** All known mesh routes (direct + relayed) */
	routes: MeshRoute[];
	/** Number of directly connected peers */
	directPeers: number;
	/** Number of destinations reachable only via relay */
	relayedDestinations: number;
	/** Total reachable destinations */
	totalDestinations: number;
	/** Whether mesh routing is enabled */
	isEnabled: boolean;
	/** Total number of messages relayed through this device */
	relayCount: number;
	/** Whether any multi-hop routes exist */
	hasMeshRoutes: boolean;

	// Actions
	/** Enable or disable mesh routing */
	setEnabled: (enabled: boolean) => Promise<void>;
	/** Get the next hop for a specific destination */
	getRouteTo: (deviceId: string) => Promise<string | null>;
	/** Refresh routes from backend */
	refreshRoutes: () => Promise<void>;
	/** Refresh relay count from backend */
	refreshRelayCount: () => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useMeshRouting(): MeshRoutingHook {
	const [routes, setRoutes] = useState<MeshRoute[]>([]);
	const [directPeers, setDirectPeers] = useState(0);
	const [relayedDestinations, setRelayedDestinations] = useState(0);
	const [totalDestinations, setTotalDestinations] = useState(0);
	const [isEnabled, setIsEnabled] = useState(true);
	const [relayCount, setRelayCount] = useState(0);

	const hasMeshRoutes = relayedDestinations > 0;

	// ========================================================================
	// ACTIONS
	// ========================================================================

	const refreshRoutes = useCallback(async () => {
		try {
			const result = await invoke<MeshRoute[]>("get_mesh_routes");
			setRoutes(result);

			const direct = result.filter((r) => r.is_direct).length;
			const relayed = result.filter((r) => !r.is_direct).length;
			setDirectPeers(direct);
			setRelayedDestinations(relayed);
			setTotalDestinations(direct + relayed);
		} catch (err) {
			console.error("Failed to get mesh routes:", err);
		}
	}, []);

	const refreshRelayCount = useCallback(async () => {
		try {
			const count = await invoke<number>("get_mesh_relay_count");
			setRelayCount(count);
		} catch (err) {
			console.error("Failed to get mesh relay count:", err);
		}
	}, []);

	const setEnabled = useCallback(
		async (enabled: boolean) => {
			try {
				await invoke("set_mesh_enabled", { enabled });
				setIsEnabled(enabled);

				toast({
					title: enabled
						? "Mesh routing enabled"
						: "Mesh routing disabled",
					description: enabled
						? "Messages can be relayed through intermediate devices"
						: "Only directly connected peers are reachable",
				});

				refreshRoutes();
			} catch (err) {
				toast({
					title: "Failed to update mesh routing",
					description: String(err),
					variant: "destructive",
				});
			}
		},
		[refreshRoutes],
	);

	const getRouteTo = useCallback(
		async (deviceId: string): Promise<string | null> => {
			try {
				const nextHop = await invoke<string | null>(
					"get_mesh_route_to",
					{ deviceId },
				);
				return nextHop;
			} catch (err) {
				console.error("Failed to get route to device:", err);
				return null;
			}
		},
		[],
	);

	// ========================================================================
	// EVENT LISTENERS
	// ========================================================================

	useEffect(() => {
		const unlisteners: Array<() => void> = [];
		let cancelled = false;

		// Routing table updated
		listen<MeshRoutingUpdatedEvent>(
			"mesh-routing-updated",
			(event) => {
				if (cancelled) return;
				const {
					total_destinations,
					direct_peers,
					relayed_destinations,
					routes: updatedRoutes,
				} = event.payload;

				setRoutes(updatedRoutes);
				setDirectPeers(direct_peers);
				setRelayedDestinations(relayed_destinations);
				setTotalDestinations(total_destinations);
			},
		).then((fn) => {
			if (!cancelled) unlisteners.push(fn);
		});

		// Message relayed through this device
		listen<MeshMessageRelayedEvent>(
			"mesh-message-relayed",
			(event) => {
				if (cancelled) return;
				console.log("🕸️ Message relayed:", event.payload);
				setRelayCount((prev) => prev + 1);
			},
		).then((fn) => {
			if (!cancelled) unlisteners.push(fn);
		});

		// Relayed message delivered to us
		listen<MeshMessageDeliveredEvent>(
			"mesh-message-delivered",
			(event) => {
				if (cancelled) return;
				const { origin_display_name, hop_count } = event.payload;
				console.log(
					"🕸️ Mesh message delivered:",
					event.payload,
				);

				toast({
					title: "Message via mesh",
					description: `Received from ${origin_display_name} (${hop_count} hops)`,
				});
			},
		).then((fn) => {
			if (!cancelled) unlisteners.push(fn);
		});

		// Initial load
		refreshRoutes();
		refreshRelayCount();

		// Load enabled state
		invoke<boolean>("get_mesh_enabled")
			.then((enabled) => {
				if (!cancelled) setIsEnabled(enabled);
			})
			.catch((err) =>
				console.error("Failed to get mesh enabled state:", err),
			);

		return () => {
			cancelled = true;
			unlisteners.forEach((fn) => fn());
		};
	}, [refreshRoutes, refreshRelayCount]);

	return {
		routes,
		directPeers,
		relayedDestinations,
		totalDestinations,
		isEnabled,
		relayCount,
		hasMeshRoutes,

		setEnabled,
		getRouteTo,
		refreshRoutes,
		refreshRelayCount,
	};
}
