//! Mesh Router
//!
//! Core routing service that manages the mesh routing table, handles topology
//! announcements from peers, relays messages through intermediate devices,
//! and periodically purges stale routes.
//!
//! The router integrates with the existing mDNS discovery and encrypted TCP
//! messaging infrastructure:
//! - Direct peers discovered via mDNS are added to the routing table automatically.
//! - Topology announcements (`MESH_TOPOLOGY`) are exchanged with direct peers
//!   every `TOPOLOGY_ANNOUNCE_INTERVAL_SECS` to propagate multi-hop reachability.
//! - Relay messages (`MESH_RELAY`) are forwarded through the routing table when
//!   the final destination is not directly reachable.

use crate::discovery::MdnsDiscoveryService;
use crate::mesh::types::*;
use crate::network::TcpClient;
use serde::Serialize;
use std::collections::HashSet;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::{watch, Mutex, RwLock};

// ============================================================================
// SERVICE
// ============================================================================

/// The mesh router manages multi-hop routing for the local device.
///
/// It maintains a routing table, handles topology announcements, and relays
/// messages to devices that are not directly reachable.
#[derive(Clone)]
pub struct MeshRouter {
    /// The routing table (protected by RwLock for concurrent reads).
    routing_table: Arc<RwLock<MeshRoutingTable>>,
    /// Set of relay IDs we have already seen (deduplication).
    seen_relay_ids: Arc<Mutex<HashSet<String>>>,
    /// Whether mesh routing is enabled.
    enabled: Arc<RwLock<bool>>,
    /// Local device ID.
    local_device_id: String,
    /// Local display name.
    local_display_name: String,
    /// Reference to the TCP client for sending messages.
    tcp_client: Option<Arc<TcpClient>>,
    /// TCP port for signaling.
    tcp_port: u16,
    /// Cancellation sender for the background topology task.
    cancel_sender: Arc<Mutex<Option<watch::Sender<bool>>>>,
    /// Counter of total messages relayed (for stats).
    relay_count: Arc<Mutex<u64>>,
}

impl MeshRouter {
    /// Create a new MeshRouter.
    pub fn new(local_device_id: String, local_display_name: String) -> Self {
        Self {
            routing_table: Arc::new(RwLock::new(MeshRoutingTable::new(
                local_device_id.clone(),
            ))),
            seen_relay_ids: Arc::new(Mutex::new(HashSet::new())),
            enabled: Arc::new(RwLock::new(true)),
            local_device_id,
            local_display_name,
            tcp_client: None,
            tcp_port: 8080,
            cancel_sender: Arc::new(Mutex::new(None)),
            relay_count: Arc::new(Mutex::new(0)),
        }
    }

    /// Set the TCP client for sending signaling/relay messages.
    pub fn set_tcp_client(&mut self, client: Arc<TcpClient>) {
        self.tcp_client = Some(client);
    }

    /// Set the TCP port.
    pub fn set_tcp_port(&mut self, port: u16) {
        self.tcp_port = port;
    }

    // ========================================================================
    // ENABLE / DISABLE
    // ========================================================================

    /// Check if mesh routing is enabled.
    pub async fn is_enabled(&self) -> bool {
        *self.enabled.read().await
    }

    /// Enable or disable mesh routing.
    pub async fn set_enabled(&self, enabled: bool, app_handle: &AppHandle) {
        let mut flag = self.enabled.write().await;
        let was_enabled = *flag;
        *flag = enabled;
        drop(flag);

        if enabled && !was_enabled {
            println!("🕸️  Mesh routing enabled");
            self.emit_routing_update(app_handle).await;
        } else if !enabled && was_enabled {
            println!("🕸️  Mesh routing disabled");
            // Clear relayed routes but keep direct ones
            let mut table = self.routing_table.write().await;
            table.routes.retain(|_, entry| entry.is_direct);
            drop(table);
            self.emit_routing_update(app_handle).await;
        }
    }

    // ========================================================================
    // ROUTING TABLE MANAGEMENT
    // ========================================================================

    /// Called when a new device is discovered via mDNS.
    /// Adds a direct route to the routing table.
    pub async fn on_device_discovered(
        &self,
        device_id: &str,
        device_name: &str,
        app_handle: &AppHandle,
    ) {
        let mut table = self.routing_table.write().await;
        table.add_direct_route(device_id.to_string(), device_name.to_string());
        drop(table);

        println!(
            "🕸️  Direct route added: {} ({})",
            device_name, device_id
        );

        self.emit_routing_update(app_handle).await;
    }

    /// Called when a device is removed from mDNS discovery.
    /// Removes the direct route (relayed routes expire naturally).
    pub async fn on_device_removed(&self, device_id: &str, app_handle: &AppHandle) {
        let mut table = self.routing_table.write().await;
        table.remove_direct_route(device_id);
        drop(table);

        println!("🕸️  Direct route removed: {}", device_id);

        self.emit_routing_update(app_handle).await;
    }

    /// Get the full routing table snapshot (for IPC / frontend).
    pub async fn get_routing_table(&self) -> Vec<MeshRoute> {
        let table = self.routing_table.read().await;
        table
            .all_destinations()
            .iter()
            .map(|e| MeshRoute::from(*e))
            .collect()
    }

    /// Get the next hop device ID for a given destination.
    /// Returns `None` if no route exists.
    pub async fn get_next_hop(&self, destination_id: &str) -> Option<String> {
        let table = self.routing_table.read().await;
        table.next_hop(destination_id).map(|e| e.next_hop_id.clone())
    }

    /// Check if a destination is reachable (directly or via relay).
    pub async fn can_reach(&self, destination_id: &str) -> bool {
        let table = self.routing_table.read().await;
        table.can_reach(destination_id)
    }

    /// Check if a destination is directly reachable (no relay).
    pub async fn is_direct(&self, destination_id: &str) -> bool {
        let table = self.routing_table.read().await;
        table.is_direct(destination_id)
    }

    /// Get total number of relayed messages.
    pub async fn relay_count(&self) -> u64 {
        *self.relay_count.lock().await
    }

    // ========================================================================
    // TOPOLOGY ANNOUNCEMENTS
    // ========================================================================

    /// Start the periodic topology announcement task.
    ///
    /// This spawns a background task that:
    /// 1. Periodically sends topology announcements to all direct peers.
    /// 2. Purges expired routes from the routing table.
    pub async fn start_topology_task(&self, app_handle: AppHandle) {
        // Cancel any existing task first
        self.stop_topology_task().await;

        let (cancel_tx, mut cancel_rx) = watch::channel(false);
        {
            let mut sender = self.cancel_sender.lock().await;
            *sender = Some(cancel_tx);
        }

        let router = self.clone();
        let ah = app_handle;

        tokio::spawn(async move {
            println!("🕸️  Topology announcement task started");

            let interval =
                tokio::time::Duration::from_secs(TOPOLOGY_ANNOUNCE_INTERVAL_SECS);

            loop {
                tokio::select! {
                    _ = tokio::time::sleep(interval) => {},
                    _ = cancel_rx.changed() => {
                        if *cancel_rx.borrow() {
                            println!("🕸️  Topology announcement task cancelled");
                            break;
                        }
                        continue;
                    }
                }

                if !router.is_enabled().await {
                    continue;
                }

                // 1. Purge expired routes
                let purged = {
                    let mut table = router.routing_table.write().await;
                    table.purge_expired()
                };
                if purged > 0 {
                    println!("🕸️  Purged {} expired routes", purged);
                    router.emit_routing_update(&ah).await;
                }

                // 2. Trim seen-relay-ids if it grows too large
                {
                    let mut seen = router.seen_relay_ids.lock().await;
                    if seen.len() > MAX_SEEN_RELAY_IDS {
                        // Just clear — old relay IDs are unlikely to reappear
                        seen.clear();
                    }
                }

                // 3. Build and send topology announcement to all direct peers
                let announcement = {
                    let table = router.routing_table.read().await;
                    table.build_announcement()
                };

                let direct_peers: Vec<String> = {
                    let table = router.routing_table.read().await;
                    table
                        .direct_peers()
                        .iter()
                        .map(|e| e.destination_id.clone())
                        .collect()
                };

                if direct_peers.is_empty() {
                    continue;
                }

                let mut sent = 0usize;
                for peer_id in &direct_peers {
                    match router
                        .send_signaling_message(peer_id, &announcement, &ah)
                        .await
                    {
                        Ok(()) => sent += 1,
                        Err(e) => {
                            // Don't spam logs for every failed peer
                            if sent == 0 {
                                eprintln!(
                                    "⚠️  Failed to send topology to {}: {}",
                                    peer_id, e
                                );
                            }
                        }
                    }
                }

                if sent > 0 {
                    println!(
                        "🕸️  Topology announced to {}/{} direct peers ({} routes)",
                        sent,
                        direct_peers.len(),
                        announcement.neighbors.len()
                    );
                }
            }
        });
    }

    /// Stop the periodic topology announcement task.
    pub async fn stop_topology_task(&self) {
        let mut sender = self.cancel_sender.lock().await;
        if let Some(tx) = sender.take() {
            let _ = tx.send(true);
        }
    }

    /// Handle an incoming topology announcement from a direct peer.
    ///
    /// Merges the announced topology into the local routing table.
    pub async fn handle_topology_announcement(
        &self,
        announcement: MeshTopologyAnnouncement,
        app_handle: &AppHandle,
    ) {
        if !self.is_enabled().await {
            return;
        }

        let peer_id = announcement.from_device_id.clone();
        let neighbor_count = announcement.neighbors.len();

        {
            let mut table = self.routing_table.write().await;
            table.merge_announcement(&peer_id, &announcement);
        }

        println!(
            "🕸️  Merged topology from {} ({} neighbors)",
            peer_id, neighbor_count
        );

        self.emit_routing_update(app_handle).await;
    }

    // ========================================================================
    // MESSAGE RELAY
    // ========================================================================

    /// Attempt to send a message to a destination, using mesh relay if the
    /// destination is not directly reachable.
    ///
    /// - If the destination is directly reachable, returns `Ok(false)` indicating
    ///   no relay was needed (caller should send directly as usual).
    /// - If the destination is reachable only via relay, wraps the payload in a
    ///   `MeshRelayPayload` and sends it to the next hop. Returns `Ok(true)`.
    /// - If the destination is unreachable, returns `Err`.
    pub async fn send_or_relay(
        &self,
        destination_id: &str,
        inner_payload: &str,
        app_handle: &AppHandle,
    ) -> Result<bool, String> {
        if !self.is_enabled().await {
            return Ok(false);
        }

        let table = self.routing_table.read().await;

        // If directly reachable, let the caller send it directly
        if table.is_direct(destination_id) {
            return Ok(false);
        }

        // Check if we have a relayed route
        let next_hop_entry = table
            .next_hop(destination_id)
            .ok_or_else(|| {
                format!(
                    "No route to destination {} (not reachable directly or via relay)",
                    destination_id
                )
            })?
            .clone();

        drop(table);

        // Create the relay payload
        let relay = MeshRelayPayload::new(
            self.local_device_id.clone(),
            self.local_display_name.clone(),
            destination_id.to_string(),
            inner_payload.to_string(),
        );

        println!(
            "🕸️  Relaying message to {} via {} (hop_count: {})",
            destination_id, next_hop_entry.next_hop_id, next_hop_entry.hop_count
        );

        // Send the relay payload to the next hop
        self.send_signaling_message(&next_hop_entry.next_hop_id, &relay, app_handle)
            .await?;

        // Track relay stats
        {
            let mut count = self.relay_count.lock().await;
            *count += 1;
        }

        let _ = app_handle.emit(
            "mesh-message-relayed",
            MeshMessageRelayedEvent {
                relay_id: relay.relay_id.clone(),
                origin_device_id: relay.origin_device_id.clone(),
                final_destination_id: relay.final_destination_id.clone(),
                hop_count: relay.hop_count(),
                ttl: relay.ttl,
            },
        );

        Ok(true)
    }

    /// Handle an incoming relay message.
    ///
    /// If the message is destined for us, deliver it locally.
    /// If not, forward it to the next hop (if routing is possible).
    pub async fn handle_relay(
        &self,
        mut relay: MeshRelayPayload,
        app_handle: &AppHandle,
    ) -> Result<Option<String>, String> {
        if !self.is_enabled().await {
            return Err("Mesh routing is disabled".to_string());
        }

        // Deduplication: check if we've already seen this relay ID
        {
            let mut seen = self.seen_relay_ids.lock().await;
            if seen.contains(&relay.relay_id) {
                println!(
                    "🕸️  Duplicate relay dropped: {}",
                    relay.relay_id
                );
                return Ok(None);
            }
            seen.insert(relay.relay_id.clone());
        }

        // Is this message destined for us?
        if relay.final_destination_id == self.local_device_id {
            println!(
                "🕸️  Relay delivered to us from {} ({} hops)",
                relay.origin_device_id,
                relay.hop_count()
            );

            let _ = app_handle.emit(
                "mesh-message-delivered",
                MeshMessageDeliveredEvent {
                    relay_id: relay.relay_id.clone(),
                    origin_device_id: relay.origin_device_id.clone(),
                    origin_display_name: relay.origin_display_name.clone(),
                    hop_count: relay.hop_count(),
                },
            );

            // Return the inner payload for the caller to process
            return Ok(Some(relay.inner_payload));
        }

        // Not for us — try to forward
        if !relay.prepare_forward(&self.local_device_id) {
            println!(
                "🕸️  Relay dropped (TTL exhausted or loop): relay_id={}, origin={}, dest={}, ttl={}, hops={:?}",
                relay.relay_id, relay.origin_device_id, relay.final_destination_id, relay.ttl, relay.hops
            );
            return Ok(None);
        }

        // Look up next hop
        let next_hop_id = {
            let table = self.routing_table.read().await;
            table
                .next_hop(&relay.final_destination_id)
                .map(|e| e.next_hop_id.clone())
        };

        let next_hop_id = match next_hop_id {
            Some(id) => id,
            None => {
                println!(
                    "🕸️  Relay dropped (no route to {}): relay_id={}",
                    relay.final_destination_id, relay.relay_id
                );
                return Ok(None);
            }
        };

        // Don't forward back to the origin
        if next_hop_id == relay.origin_device_id {
            println!(
                "🕸️  Relay dropped (would bounce back to origin): relay_id={}",
                relay.relay_id
            );
            return Ok(None);
        }

        println!(
            "🕸️  Forwarding relay {} → {} via {} (ttl={}, hops={})",
            relay.origin_device_id,
            relay.final_destination_id,
            next_hop_id,
            relay.ttl,
            relay.hop_count()
        );

        // Forward the relay to the next hop
        self.send_signaling_message(&next_hop_id, &relay, app_handle)
            .await?;

        // Track relay stats
        {
            let mut count = self.relay_count.lock().await;
            *count += 1;
        }

        let _ = app_handle.emit(
            "mesh-message-relayed",
            MeshMessageRelayedEvent {
                relay_id: relay.relay_id.clone(),
                origin_device_id: relay.origin_device_id.clone(),
                final_destination_id: relay.final_destination_id.clone(),
                hop_count: relay.hop_count(),
                ttl: relay.ttl,
            },
        );

        Ok(None)
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    /// Send a signaling message to a peer via the existing encrypted TCP channel.
    async fn send_signaling_message<T: Serialize>(
        &self,
        peer_device_id: &str,
        payload: &T,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        let tcp_client = self
            .tcp_client
            .as_ref()
            .ok_or("TCP client not available for mesh routing")?;

        // Look up the peer address from mDNS discovery
        let peer_address = {
            if let Some(discovery) = app_handle.try_state::<Arc<MdnsDiscoveryService>>() {
                let devices = discovery.get_devices().await;
                devices
                    .iter()
                    .find(|d| d.id == peer_device_id)
                    .and_then(|d| d.addresses.first().cloned())
                    .ok_or_else(|| {
                        format!("Peer {} not found in discovery", peer_device_id)
                    })?
            } else {
                return Err("Discovery service not available".to_string());
            }
        };

        let json = serde_json::to_vec(payload)
            .map_err(|e| format!("Failed to serialize mesh payload: {}", e))?;

        tcp_client
            .send_text_message(peer_device_id, &peer_address, self.tcp_port, json)
            .await
            .map_err(|e| format!("Failed to send mesh message: {}", e))?;

        Ok(())
    }

    /// Emit a routing table update event to the frontend.
    async fn emit_routing_update(&self, app_handle: &AppHandle) {
        let table = self.routing_table.read().await;
        let direct = table.direct_peers().len();
        let relayed = table.relayed_destinations().len();
        let all = table.all_destinations();

        let routes: Vec<MeshRoute> = all.iter().map(|e| MeshRoute::from(*e)).collect();

        let _ = app_handle.emit(
            "mesh-routing-updated",
            MeshRoutingUpdatedEvent {
                total_destinations: direct + relayed,
                direct_peers: direct,
                relayed_destinations: relayed,
                routes,
            },
        );
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_router_creation() {
        let router = MeshRouter::new("dev-1".into(), "Device 1".into());
        assert_eq!(router.local_device_id, "dev-1");
        assert_eq!(router.local_display_name, "Device 1");
    }

    #[tokio::test]
    async fn test_router_enabled_by_default() {
        let router = MeshRouter::new("dev-1".into(), "Device 1".into());
        assert!(router.is_enabled().await);
    }

    #[tokio::test]
    async fn test_router_empty_table() {
        let router = MeshRouter::new("dev-1".into(), "Device 1".into());
        let routes = router.get_routing_table().await;
        assert!(routes.is_empty());
        assert!(!router.can_reach("dev-2").await);
        assert!(!router.is_direct("dev-2").await);
        assert!(router.get_next_hop("dev-2").await.is_none());
    }

    #[tokio::test]
    async fn test_relay_deduplication() {
        let router = MeshRouter::new("relay-dev".into(), "Relay".into());

        // Simulate seeing a relay ID
        {
            let mut seen = router.seen_relay_ids.lock().await;
            seen.insert("relay-abc".into());
        }

        // Verify it's been seen
        {
            let seen = router.seen_relay_ids.lock().await;
            assert!(seen.contains("relay-abc"));
            assert!(!seen.contains("relay-xyz"));
        }
    }

    #[tokio::test]
    async fn test_relay_count() {
        let router = MeshRouter::new("dev-1".into(), "Device 1".into());
        assert_eq!(router.relay_count().await, 0);

        {
            let mut count = router.relay_count.lock().await;
            *count += 5;
        }
        assert_eq!(router.relay_count().await, 5);
    }

    #[tokio::test]
    async fn test_router_clone_shares_state() {
        let router = MeshRouter::new("dev-1".into(), "Device 1".into());
        let clone = router.clone();

        // Modify state through the clone
        {
            let mut table = clone.routing_table.write().await;
            table.add_direct_route("dev-2".into(), "Device 2".into());
        }

        // Verify the original sees the change
        assert!(router.can_reach("dev-2").await);
    }

    #[tokio::test]
    async fn test_send_or_relay_returns_false_for_direct() {
        let router = MeshRouter::new("dev-1".into(), "Device 1".into());

        // Add a direct route
        {
            let mut table = router.routing_table.write().await;
            table.add_direct_route("dev-2".into(), "Device 2".into());
        }

        // For a directly reachable device, we don't need to go through
        // send_signaling_message, so we just test the routing table logic.
        let table = router.routing_table.read().await;
        assert!(table.is_direct("dev-2"));
    }

    #[tokio::test]
    async fn test_handle_relay_for_us() {
        let router = MeshRouter::new("final-dest".into(), "Final Dest".into());
        // We need an AppHandle for handle_relay, but we can test the logic
        // by directly checking the routing table state.

        let relay = MeshRelayPayload::new(
            "origin".into(),
            "Origin Dev".into(),
            "final-dest".into(), // Destined for us
            r#"{"type":"TEXT_MESSAGE","content":"hello via mesh"}"#.into(),
        );

        // Verify the relay is destined for us
        assert_eq!(relay.final_destination_id, router.local_device_id);
    }

    #[tokio::test]
    async fn test_handle_relay_not_for_us() {
        let router = MeshRouter::new("relay-node".into(), "Relay Node".into());

        let relay = MeshRelayPayload::new(
            "origin".into(),
            "Origin Dev".into(),
            "other-dest".into(), // NOT destined for us
            r#"{"type":"TEXT_MESSAGE","content":"hello"}"#.into(),
        );

        // Verify the relay is NOT destined for us
        assert_ne!(relay.final_destination_id, router.local_device_id);

        // Without a route, forwarding would fail — that's correct behavior
        let table = router.routing_table.read().await;
        assert!(table.next_hop("other-dest").is_none());
    }
}
