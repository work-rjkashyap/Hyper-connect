//! Mesh Routing Types
//!
//! Data structures for multi-hop message routing, topology announcements,
//! routing tables, and relay payloads.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// CONSTANTS
// ============================================================================

/// Maximum number of hops a relayed message can traverse before being dropped.
/// Prevents infinite routing loops on misconfigured or cyclic topologies.
pub const MAX_TTL: u8 = 8;

/// Default TTL assigned to new relay messages.
pub const DEFAULT_TTL: u8 = 5;

/// Maximum number of entries in a single topology announcement.
/// Limits the size of the announcement payload to prevent abuse.
pub const MAX_TOPOLOGY_ENTRIES: usize = 64;

/// How often (in seconds) topology announcements are broadcast to direct peers.
pub const TOPOLOGY_ANNOUNCE_INTERVAL_SECS: u64 = 30;

/// How long (in seconds) before a routing entry is considered stale and removed.
pub const ROUTE_EXPIRY_SECS: i64 = 120;

/// Maximum number of relay IDs to remember for deduplication.
pub const MAX_SEEN_RELAY_IDS: usize = 4096;

// ============================================================================
// ROUTING ENTRY
// ============================================================================

/// A single entry in the routing table describing how to reach a destination device.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingEntry {
    /// Device ID of the final destination.
    pub destination_id: String,
    /// Display name of the destination device (informational).
    pub destination_name: String,
    /// Device ID of the next-hop peer to forward messages through.
    /// If this equals `destination_id`, the destination is directly reachable.
    pub next_hop_id: String,
    /// Number of hops to reach the destination (1 = direct peer).
    pub hop_count: u8,
    /// Timestamp when this route was last confirmed (epoch seconds).
    pub last_seen: i64,
    /// Whether this is a direct connection (discovered via mDNS) or a relayed route.
    pub is_direct: bool,
    /// Optional estimated latency in milliseconds through this route.
    pub latency_ms: Option<u32>,
}

impl RoutingEntry {
    /// Create a new direct route entry (hop_count = 1).
    pub fn direct(destination_id: String, destination_name: String) -> Self {
        Self {
            destination_id: destination_id.clone(),
            destination_name,
            next_hop_id: destination_id,
            hop_count: 1,
            last_seen: chrono::Utc::now().timestamp(),
            is_direct: true,
            latency_ms: None,
        }
    }

    /// Create a new relayed route entry.
    pub fn relayed(
        destination_id: String,
        destination_name: String,
        next_hop_id: String,
        hop_count: u8,
    ) -> Self {
        Self {
            destination_id,
            destination_name,
            next_hop_id,
            hop_count,
            last_seen: chrono::Utc::now().timestamp(),
            is_direct: false,
            latency_ms: None,
        }
    }

    /// Check if this route has expired based on `ROUTE_EXPIRY_SECS`.
    pub fn is_expired(&self) -> bool {
        let now = chrono::Utc::now().timestamp();
        now - self.last_seen > ROUTE_EXPIRY_SECS
    }

    /// Refresh the `last_seen` timestamp to now.
    pub fn refresh(&mut self) {
        self.last_seen = chrono::Utc::now().timestamp();
    }
}

// ============================================================================
// ROUTING TABLE
// ============================================================================

/// The local device's routing table mapping destination device IDs to routes.
///
/// When multiple routes exist to the same destination, the one with the fewest
/// hops is preferred. Direct routes always take priority over relayed routes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshRoutingTable {
    /// The local device's own ID (owner of this table).
    pub local_device_id: String,
    /// Routes keyed by destination device ID.
    pub routes: HashMap<String, RoutingEntry>,
}

impl MeshRoutingTable {
    /// Create a new empty routing table.
    pub fn new(local_device_id: String) -> Self {
        Self {
            local_device_id,
            routes: HashMap::new(),
        }
    }

    /// Add or update a direct route for a device discovered via mDNS.
    pub fn add_direct_route(&mut self, device_id: String, device_name: String) {
        // Direct routes always win — overwrite any existing relayed route.
        let entry = RoutingEntry::direct(device_id.clone(), device_name);
        self.routes.insert(device_id, entry);
    }

    /// Remove a direct route when a device goes offline (mDNS removal).
    /// Relayed routes learned from topology announcements are NOT removed here;
    /// they expire naturally via `ROUTE_EXPIRY_SECS`.
    pub fn remove_direct_route(&mut self, device_id: &str) {
        if let Some(entry) = self.routes.get(device_id) {
            if entry.is_direct {
                self.routes.remove(device_id);
            }
        }
    }

    /// Merge routes learned from a topology announcement sent by a direct peer.
    ///
    /// For each destination in the announcement:
    /// - Skip if destination is our own device.
    /// - Skip if we already have a direct route to the destination.
    /// - Otherwise, add a relayed route through `announcing_peer_id` if it is
    ///   shorter than any existing relayed route (or if no route exists).
    pub fn merge_announcement(
        &mut self,
        announcing_peer_id: &str,
        announcement: &MeshTopologyAnnouncement,
    ) {
        for neighbor in &announcement.neighbors {
            // Never add a route to ourselves.
            if neighbor.device_id == self.local_device_id {
                continue;
            }

            // Never replace a direct route with a relayed one.
            if let Some(existing) = self.routes.get(&neighbor.device_id) {
                if existing.is_direct {
                    continue;
                }
            }

            let new_hop_count = neighbor.hop_count.saturating_add(1);

            // Enforce TTL — don't store routes that exceed MAX_TTL.
            if new_hop_count > MAX_TTL {
                continue;
            }

            let should_update = match self.routes.get(&neighbor.device_id) {
                None => true,
                Some(existing) => {
                    // Prefer shorter routes; on tie, prefer the fresher one.
                    new_hop_count < existing.hop_count
                        || (new_hop_count == existing.hop_count
                            && neighbor.last_seen > existing.last_seen)
                }
            };

            if should_update {
                let entry = RoutingEntry::relayed(
                    neighbor.device_id.clone(),
                    neighbor.device_name.clone(),
                    announcing_peer_id.to_string(),
                    new_hop_count,
                );
                self.routes.insert(neighbor.device_id.clone(), entry);
            }
        }
    }

    /// Look up the next hop for a given destination device ID.
    /// Returns `None` if no route exists or the only route has expired.
    pub fn next_hop(&self, destination_id: &str) -> Option<&RoutingEntry> {
        self.routes.get(destination_id).filter(|e| !e.is_expired())
    }

    /// Check whether we can reach a destination (directly or via relay).
    pub fn can_reach(&self, destination_id: &str) -> bool {
        self.next_hop(destination_id).is_some()
    }

    /// Check whether a destination is directly reachable (no relay needed).
    pub fn is_direct(&self, destination_id: &str) -> bool {
        self.routes
            .get(destination_id)
            .map(|e| e.is_direct && !e.is_expired())
            .unwrap_or(false)
    }

    /// Remove all expired routes.
    pub fn purge_expired(&mut self) -> usize {
        let before = self.routes.len();
        self.routes.retain(|_, entry| !entry.is_expired());
        before - self.routes.len()
    }

    /// Get all known destinations (both direct and relayed).
    pub fn all_destinations(&self) -> Vec<&RoutingEntry> {
        self.routes.values().filter(|e| !e.is_expired()).collect()
    }

    /// Get only directly connected peers.
    pub fn direct_peers(&self) -> Vec<&RoutingEntry> {
        self.routes
            .values()
            .filter(|e| e.is_direct && !e.is_expired())
            .collect()
    }

    /// Get only relayed (multi-hop) destinations.
    pub fn relayed_destinations(&self) -> Vec<&RoutingEntry> {
        self.routes
            .values()
            .filter(|e| !e.is_direct && !e.is_expired())
            .collect()
    }

    /// Build a topology announcement from this table's direct peers.
    /// This is what gets sent to neighbors so they can learn about our local topology.
    pub fn build_announcement(&self) -> MeshTopologyAnnouncement {
        let neighbors: Vec<TopologyNeighbor> = self
            .routes
            .values()
            .filter(|e| !e.is_expired())
            .take(MAX_TOPOLOGY_ENTRIES)
            .map(|e| TopologyNeighbor {
                device_id: e.destination_id.clone(),
                device_name: e.destination_name.clone(),
                hop_count: e.hop_count,
                is_direct: e.is_direct,
                last_seen: e.last_seen,
            })
            .collect();

        MeshTopologyAnnouncement {
            msg_type: "MESH_TOPOLOGY".to_string(),
            from_device_id: self.local_device_id.clone(),
            neighbors,
            timestamp: chrono::Utc::now().timestamp(),
        }
    }

    /// Total number of routes in the table (including possibly expired ones).
    pub fn len(&self) -> usize {
        self.routes.len()
    }

    /// Whether the routing table is empty.
    pub fn is_empty(&self) -> bool {
        self.routes.is_empty()
    }
}

// ============================================================================
// TOPOLOGY ANNOUNCEMENT (exchanged between direct peers)
// ============================================================================

/// A neighbor entry inside a topology announcement.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopologyNeighbor {
    /// Device ID of the neighbor.
    pub device_id: String,
    /// Display name of the neighbor.
    pub device_name: String,
    /// Hop count from the announcer to this neighbor (1 = direct).
    pub hop_count: u8,
    /// Whether this neighbor is directly connected to the announcer.
    pub is_direct: bool,
    /// Last time the announcer saw this neighbor (epoch seconds).
    pub last_seen: i64,
}

/// Periodic topology announcement sent by each device to all direct peers.
///
/// Transmitted as an encrypted message with `type: "MESH_TOPOLOGY"`.
/// Each device broadcasts its known neighbors so peers can build multi-hop
/// routing tables.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshTopologyAnnouncement {
    /// Inner message type discriminator for the encrypted channel router.
    #[serde(rename = "type", default = "default_topology_type")]
    pub msg_type: String,
    /// Device ID of the announcer.
    pub from_device_id: String,
    /// List of neighbors the announcer can reach.
    pub neighbors: Vec<TopologyNeighbor>,
    /// Timestamp of the announcement (epoch seconds).
    pub timestamp: i64,
}

fn default_topology_type() -> String {
    "MESH_TOPOLOGY".to_string()
}

// ============================================================================
// MESH RELAY PAYLOAD (wraps any inner message for multi-hop delivery)
// ============================================================================

/// A relay envelope that wraps an inner encrypted message for multi-hop delivery.
///
/// Transmitted as an encrypted message with `type: "MESH_RELAY"`.
///
/// When a device receives this and `final_destination_id` is NOT its own ID,
/// it decrements the TTL, appends its own ID to `hops`, and forwards the
/// `inner_payload` to the next hop from the routing table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshRelayPayload {
    /// Inner message type discriminator.
    #[serde(rename = "type", default = "default_relay_type")]
    pub msg_type: String,
    /// Unique relay ID for deduplication (UUID v4).
    pub relay_id: String,
    /// Device ID of the original sender.
    pub origin_device_id: String,
    /// Display name of the original sender.
    pub origin_display_name: String,
    /// Device ID of the final intended recipient.
    pub final_destination_id: String,
    /// Remaining time-to-live (decremented at each hop).
    pub ttl: u8,
    /// Ordered list of device IDs that have relayed this message (loop detection).
    pub hops: Vec<String>,
    /// The inner message payload (JSON string of the original encrypted message content).
    /// This is the actual message that should be delivered to the final destination.
    pub inner_payload: String,
    /// Timestamp when the relay was originally created (epoch seconds).
    pub created_at: i64,
}

fn default_relay_type() -> String {
    "MESH_RELAY".to_string()
}

impl MeshRelayPayload {
    /// Create a new relay payload wrapping an inner message.
    pub fn new(
        origin_device_id: String,
        origin_display_name: String,
        final_destination_id: String,
        inner_payload: String,
    ) -> Self {
        Self {
            msg_type: "MESH_RELAY".to_string(),
            relay_id: uuid::Uuid::new_v4().to_string(),
            origin_device_id,
            origin_display_name,
            final_destination_id,
            ttl: DEFAULT_TTL,
            hops: Vec::new(),
            inner_payload,
            created_at: chrono::Utc::now().timestamp(),
        }
    }

    /// Check if this relay has expired (TTL reached 0).
    pub fn is_expired(&self) -> bool {
        self.ttl == 0
    }

    /// Check if a specific device has already relayed this message (loop detection).
    pub fn has_visited(&self, device_id: &str) -> bool {
        self.hops.iter().any(|h| h == device_id)
    }

    /// Prepare this relay for forwarding: decrement TTL and add the current device to hops.
    /// Returns `false` if the message should be dropped (TTL exhausted or loop detected).
    pub fn prepare_forward(&mut self, current_device_id: &str) -> bool {
        // Loop detection
        if self.has_visited(current_device_id) {
            return false;
        }

        // TTL check
        if self.ttl == 0 {
            return false;
        }

        self.ttl = self.ttl.saturating_sub(1);
        self.hops.push(current_device_id.to_string());
        true
    }

    /// Total number of hops this message has traversed so far.
    pub fn hop_count(&self) -> usize {
        self.hops.len()
    }
}

// ============================================================================
// MESH ROUTE (simplified view for frontend)
// ============================================================================

/// Simplified route information for the frontend UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshRoute {
    /// Destination device ID.
    pub device_id: String,
    /// Destination display name.
    pub device_name: String,
    /// Number of hops to reach the destination.
    pub hop_count: u8,
    /// Whether this is a direct connection.
    pub is_direct: bool,
    /// The next-hop device ID (may be the destination itself for direct routes).
    pub next_hop_id: String,
    /// Estimated latency in ms, if known.
    pub latency_ms: Option<u32>,
    /// Whether the route is currently active (not expired).
    pub is_active: bool,
}

impl From<&RoutingEntry> for MeshRoute {
    fn from(entry: &RoutingEntry) -> Self {
        Self {
            device_id: entry.destination_id.clone(),
            device_name: entry.destination_name.clone(),
            hop_count: entry.hop_count,
            is_direct: entry.is_direct,
            next_hop_id: entry.next_hop_id.clone(),
            latency_ms: entry.latency_ms,
            is_active: !entry.is_expired(),
        }
    }
}

// ============================================================================
// FRONTEND EVENT TYPES
// ============================================================================

/// Emitted when the routing table changes.
/// Event name: `mesh-routing-updated`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshRoutingUpdatedEvent {
    /// Total number of reachable destinations.
    pub total_destinations: usize,
    /// Number of directly connected peers.
    pub direct_peers: usize,
    /// Number of destinations reachable only via relay.
    pub relayed_destinations: usize,
    /// Full list of routes for UI display.
    pub routes: Vec<MeshRoute>,
}

/// Emitted when a message is relayed through this device.
/// Event name: `mesh-message-relayed`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshMessageRelayedEvent {
    /// The relay ID of the forwarded message.
    pub relay_id: String,
    /// Origin device ID.
    pub origin_device_id: String,
    /// Final destination device ID.
    pub final_destination_id: String,
    /// Current hop count.
    pub hop_count: usize,
    /// Remaining TTL.
    pub ttl: u8,
}

/// Emitted when a relayed message is delivered to its final destination (us).
/// Event name: `mesh-message-delivered`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshMessageDeliveredEvent {
    /// The relay ID.
    pub relay_id: String,
    /// Origin device ID.
    pub origin_device_id: String,
    /// Origin display name.
    pub origin_display_name: String,
    /// Total hops the message traversed.
    pub hop_count: usize,
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_routing_entry_direct() {
        let entry = RoutingEntry::direct("dev-1".into(), "Device 1".into());
        assert_eq!(entry.destination_id, "dev-1");
        assert_eq!(entry.next_hop_id, "dev-1");
        assert_eq!(entry.hop_count, 1);
        assert!(entry.is_direct);
        assert!(!entry.is_expired());
    }

    #[test]
    fn test_routing_entry_relayed() {
        let entry = RoutingEntry::relayed(
            "dev-3".into(),
            "Device 3".into(),
            "dev-2".into(),
            2,
        );
        assert_eq!(entry.destination_id, "dev-3");
        assert_eq!(entry.next_hop_id, "dev-2");
        assert_eq!(entry.hop_count, 2);
        assert!(!entry.is_direct);
    }

    #[test]
    fn test_routing_entry_expiry() {
        let mut entry = RoutingEntry::direct("dev-1".into(), "Device 1".into());
        assert!(!entry.is_expired());

        // Simulate an old timestamp
        entry.last_seen = chrono::Utc::now().timestamp() - ROUTE_EXPIRY_SECS - 10;
        assert!(entry.is_expired());

        // Refresh should fix it
        entry.refresh();
        assert!(!entry.is_expired());
    }

    #[test]
    fn test_routing_table_new() {
        let table = MeshRoutingTable::new("local-dev".into());
        assert!(table.is_empty());
        assert_eq!(table.len(), 0);
        assert_eq!(table.local_device_id, "local-dev");
    }

    #[test]
    fn test_routing_table_add_direct() {
        let mut table = MeshRoutingTable::new("local-dev".into());
        table.add_direct_route("dev-1".into(), "Device 1".into());
        table.add_direct_route("dev-2".into(), "Device 2".into());

        assert_eq!(table.len(), 2);
        assert!(table.can_reach("dev-1"));
        assert!(table.is_direct("dev-1"));
        assert!(table.can_reach("dev-2"));
        assert!(!table.can_reach("dev-3"));
    }

    #[test]
    fn test_routing_table_remove_direct() {
        let mut table = MeshRoutingTable::new("local-dev".into());
        table.add_direct_route("dev-1".into(), "Device 1".into());
        assert!(table.can_reach("dev-1"));

        table.remove_direct_route("dev-1");
        assert!(!table.can_reach("dev-1"));
    }

    #[test]
    fn test_routing_table_remove_does_not_affect_relayed() {
        let mut table = MeshRoutingTable::new("local-dev".into());

        // Add a relayed route manually
        let entry = RoutingEntry::relayed("dev-3".into(), "Device 3".into(), "dev-2".into(), 2);
        table.routes.insert("dev-3".into(), entry);

        // remove_direct_route should NOT remove a relayed route
        table.remove_direct_route("dev-3");
        assert!(table.can_reach("dev-3"));
    }

    #[test]
    fn test_routing_table_direct_overwrites_relayed() {
        let mut table = MeshRoutingTable::new("local-dev".into());

        // First add a relayed route
        let entry = RoutingEntry::relayed("dev-2".into(), "Device 2".into(), "dev-1".into(), 3);
        table.routes.insert("dev-2".into(), entry);
        assert!(!table.is_direct("dev-2"));
        assert_eq!(table.next_hop("dev-2").unwrap().hop_count, 3);

        // Now add a direct route — should overwrite
        table.add_direct_route("dev-2".into(), "Device 2".into());
        assert!(table.is_direct("dev-2"));
        assert_eq!(table.next_hop("dev-2").unwrap().hop_count, 1);
    }

    #[test]
    fn test_routing_table_purge_expired() {
        let mut table = MeshRoutingTable::new("local-dev".into());
        table.add_direct_route("dev-1".into(), "Device 1".into());

        // Make it expired
        table.routes.get_mut("dev-1").unwrap().last_seen =
            chrono::Utc::now().timestamp() - ROUTE_EXPIRY_SECS - 10;

        assert_eq!(table.purge_expired(), 1);
        assert!(table.is_empty());
    }

    #[test]
    fn test_merge_announcement_basic() {
        let mut table = MeshRoutingTable::new("local-dev".into());
        table.add_direct_route("peer-a".into(), "Peer A".into());

        // Peer A announces it can see Peer B and Peer C
        let announcement = MeshTopologyAnnouncement {
            msg_type: "MESH_TOPOLOGY".into(),
            from_device_id: "peer-a".into(),
            neighbors: vec![
                TopologyNeighbor {
                    device_id: "peer-b".into(),
                    device_name: "Peer B".into(),
                    hop_count: 1,
                    is_direct: true,
                    last_seen: chrono::Utc::now().timestamp(),
                },
                TopologyNeighbor {
                    device_id: "peer-c".into(),
                    device_name: "Peer C".into(),
                    hop_count: 2,
                    is_direct: false,
                    last_seen: chrono::Utc::now().timestamp(),
                },
            ],
            timestamp: chrono::Utc::now().timestamp(),
        };

        table.merge_announcement("peer-a", &announcement);

        // We should now have routes to peer-b (2 hops via peer-a) and peer-c (3 hops via peer-a)
        assert!(table.can_reach("peer-b"));
        assert_eq!(table.next_hop("peer-b").unwrap().hop_count, 2);
        assert_eq!(table.next_hop("peer-b").unwrap().next_hop_id, "peer-a");
        assert!(!table.is_direct("peer-b"));

        assert!(table.can_reach("peer-c"));
        assert_eq!(table.next_hop("peer-c").unwrap().hop_count, 3);
    }

    #[test]
    fn test_merge_announcement_skips_self() {
        let mut table = MeshRoutingTable::new("local-dev".into());

        let announcement = MeshTopologyAnnouncement {
            msg_type: "MESH_TOPOLOGY".into(),
            from_device_id: "peer-a".into(),
            neighbors: vec![TopologyNeighbor {
                device_id: "local-dev".into(),
                device_name: "Local".into(),
                hop_count: 1,
                is_direct: true,
                last_seen: chrono::Utc::now().timestamp(),
            }],
            timestamp: chrono::Utc::now().timestamp(),
        };

        table.merge_announcement("peer-a", &announcement);

        // Should NOT add a route to ourselves
        assert!(!table.can_reach("local-dev"));
    }

    #[test]
    fn test_merge_announcement_does_not_overwrite_direct() {
        let mut table = MeshRoutingTable::new("local-dev".into());
        table.add_direct_route("peer-b".into(), "Peer B".into());

        // Peer A says it can reach Peer B in 1 hop
        let announcement = MeshTopologyAnnouncement {
            msg_type: "MESH_TOPOLOGY".into(),
            from_device_id: "peer-a".into(),
            neighbors: vec![TopologyNeighbor {
                device_id: "peer-b".into(),
                device_name: "Peer B".into(),
                hop_count: 1,
                is_direct: true,
                last_seen: chrono::Utc::now().timestamp(),
            }],
            timestamp: chrono::Utc::now().timestamp(),
        };

        table.merge_announcement("peer-a", &announcement);

        // Our direct route should still be there, not replaced
        assert!(table.is_direct("peer-b"));
        assert_eq!(table.next_hop("peer-b").unwrap().hop_count, 1);
        assert_eq!(table.next_hop("peer-b").unwrap().next_hop_id, "peer-b");
    }

    #[test]
    fn test_merge_announcement_prefers_shorter() {
        let mut table = MeshRoutingTable::new("local-dev".into());

        // First: Peer A says it can reach Peer C in 3 hops
        let ann1 = MeshTopologyAnnouncement {
            msg_type: "MESH_TOPOLOGY".into(),
            from_device_id: "peer-a".into(),
            neighbors: vec![TopologyNeighbor {
                device_id: "peer-c".into(),
                device_name: "Peer C".into(),
                hop_count: 3,
                is_direct: false,
                last_seen: chrono::Utc::now().timestamp(),
            }],
            timestamp: chrono::Utc::now().timestamp(),
        };
        table.merge_announcement("peer-a", &ann1);
        assert_eq!(table.next_hop("peer-c").unwrap().hop_count, 4); // 3 + 1
        assert_eq!(table.next_hop("peer-c").unwrap().next_hop_id, "peer-a");

        // Second: Peer B says it can reach Peer C directly (1 hop)
        let ann2 = MeshTopologyAnnouncement {
            msg_type: "MESH_TOPOLOGY".into(),
            from_device_id: "peer-b".into(),
            neighbors: vec![TopologyNeighbor {
                device_id: "peer-c".into(),
                device_name: "Peer C".into(),
                hop_count: 1,
                is_direct: true,
                last_seen: chrono::Utc::now().timestamp(),
            }],
            timestamp: chrono::Utc::now().timestamp(),
        };
        table.merge_announcement("peer-b", &ann2);

        // Should now use the shorter route via peer-b (2 hops)
        assert_eq!(table.next_hop("peer-c").unwrap().hop_count, 2);
        assert_eq!(table.next_hop("peer-c").unwrap().next_hop_id, "peer-b");
    }

    #[test]
    fn test_merge_announcement_respects_max_ttl() {
        let mut table = MeshRoutingTable::new("local-dev".into());

        // Peer A says it can reach Peer Z in MAX_TTL hops (adding 1 would exceed)
        let announcement = MeshTopologyAnnouncement {
            msg_type: "MESH_TOPOLOGY".into(),
            from_device_id: "peer-a".into(),
            neighbors: vec![TopologyNeighbor {
                device_id: "peer-z".into(),
                device_name: "Peer Z".into(),
                hop_count: MAX_TTL,
                is_direct: false,
                last_seen: chrono::Utc::now().timestamp(),
            }],
            timestamp: chrono::Utc::now().timestamp(),
        };

        table.merge_announcement("peer-a", &announcement);

        // Should NOT have added it because MAX_TTL + 1 > MAX_TTL
        assert!(!table.can_reach("peer-z"));
    }

    #[test]
    fn test_build_announcement() {
        let mut table = MeshRoutingTable::new("local-dev".into());
        table.add_direct_route("dev-1".into(), "Device 1".into());
        table.add_direct_route("dev-2".into(), "Device 2".into());

        let announcement = table.build_announcement();
        assert_eq!(announcement.from_device_id, "local-dev");
        assert_eq!(announcement.neighbors.len(), 2);
        assert_eq!(announcement.msg_type, "MESH_TOPOLOGY");
    }

    #[test]
    fn test_mesh_relay_payload_new() {
        let relay = MeshRelayPayload::new(
            "origin-dev".into(),
            "Origin Device".into(),
            "dest-dev".into(),
            r#"{"type":"TEXT_MESSAGE","content":"hello"}"#.into(),
        );
        assert_eq!(relay.msg_type, "MESH_RELAY");
        assert_eq!(relay.origin_device_id, "origin-dev");
        assert_eq!(relay.final_destination_id, "dest-dev");
        assert_eq!(relay.ttl, DEFAULT_TTL);
        assert!(relay.hops.is_empty());
        assert!(!relay.is_expired());
    }

    #[test]
    fn test_mesh_relay_prepare_forward() {
        let mut relay = MeshRelayPayload::new(
            "origin".into(),
            "Origin".into(),
            "dest".into(),
            "payload".into(),
        );

        assert!(relay.prepare_forward("hop-1"));
        assert_eq!(relay.ttl, DEFAULT_TTL - 1);
        assert_eq!(relay.hops, vec!["hop-1"]);
        assert_eq!(relay.hop_count(), 1);

        assert!(relay.prepare_forward("hop-2"));
        assert_eq!(relay.ttl, DEFAULT_TTL - 2);
        assert_eq!(relay.hops, vec!["hop-1", "hop-2"]);
        assert_eq!(relay.hop_count(), 2);
    }

    #[test]
    fn test_mesh_relay_loop_detection() {
        let mut relay = MeshRelayPayload::new(
            "origin".into(),
            "Origin".into(),
            "dest".into(),
            "payload".into(),
        );

        assert!(relay.prepare_forward("hop-1"));
        assert!(relay.prepare_forward("hop-2"));

        // Trying to forward through hop-1 again should fail (loop)
        assert!(!relay.prepare_forward("hop-1"));
    }

    #[test]
    fn test_mesh_relay_ttl_exhaustion() {
        let mut relay = MeshRelayPayload::new(
            "origin".into(),
            "Origin".into(),
            "dest".into(),
            "payload".into(),
        );
        relay.ttl = 1;

        assert!(relay.prepare_forward("hop-1"));
        assert_eq!(relay.ttl, 0);

        // Now TTL is 0 — cannot forward further
        assert!(!relay.prepare_forward("hop-2"));
    }

    #[test]
    fn test_mesh_relay_has_visited() {
        let mut relay = MeshRelayPayload::new(
            "origin".into(),
            "Origin".into(),
            "dest".into(),
            "payload".into(),
        );
        relay.hops.push("hop-1".into());
        relay.hops.push("hop-2".into());

        assert!(relay.has_visited("hop-1"));
        assert!(relay.has_visited("hop-2"));
        assert!(!relay.has_visited("hop-3"));
    }

    #[test]
    fn test_mesh_route_from_routing_entry() {
        let entry = RoutingEntry::relayed("dev-3".into(), "Device 3".into(), "dev-2".into(), 2);
        let route: MeshRoute = (&entry).into();

        assert_eq!(route.device_id, "dev-3");
        assert_eq!(route.device_name, "Device 3");
        assert_eq!(route.hop_count, 2);
        assert!(!route.is_direct);
        assert_eq!(route.next_hop_id, "dev-2");
        assert!(route.is_active);
    }

    #[test]
    fn test_direct_peers_vs_relayed() {
        let mut table = MeshRoutingTable::new("local-dev".into());
        table.add_direct_route("dev-1".into(), "Device 1".into());

        let entry = RoutingEntry::relayed("dev-3".into(), "Device 3".into(), "dev-1".into(), 2);
        table.routes.insert("dev-3".into(), entry);

        assert_eq!(table.direct_peers().len(), 1);
        assert_eq!(table.relayed_destinations().len(), 1);
        assert_eq!(table.all_destinations().len(), 2);
    }

    #[test]
    fn test_topology_announcement_serialization() {
        let announcement = MeshTopologyAnnouncement {
            msg_type: "MESH_TOPOLOGY".into(),
            from_device_id: "dev-1".into(),
            neighbors: vec![TopologyNeighbor {
                device_id: "dev-2".into(),
                device_name: "Device 2".into(),
                hop_count: 1,
                is_direct: true,
                last_seen: 1700000000,
            }],
            timestamp: 1700000000,
        };

        let json = serde_json::to_string(&announcement).unwrap();
        assert!(json.contains("MESH_TOPOLOGY"));
        assert!(json.contains("dev-1"));
        assert!(json.contains("dev-2"));

        let parsed: MeshTopologyAnnouncement = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.from_device_id, "dev-1");
        assert_eq!(parsed.neighbors.len(), 1);
        assert_eq!(parsed.neighbors[0].device_id, "dev-2");
    }

    #[test]
    fn test_relay_payload_serialization() {
        let relay = MeshRelayPayload::new(
            "origin".into(),
            "Origin Dev".into(),
            "dest".into(),
            r#"{"type":"TEXT_MESSAGE","content":"hi"}"#.into(),
        );

        let json = serde_json::to_string(&relay).unwrap();
        assert!(json.contains("MESH_RELAY"));
        assert!(json.contains("origin"));
        assert!(json.contains("dest"));
        assert!(json.contains("TEXT_MESSAGE"));

        let parsed: MeshRelayPayload = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.origin_device_id, "origin");
        assert_eq!(parsed.final_destination_id, "dest");
        assert_eq!(parsed.ttl, DEFAULT_TTL);
    }

    #[test]
    fn test_constants_sane() {
        assert!(MAX_TTL >= 2, "MAX_TTL should be at least 2 for multi-hop");
        assert!(DEFAULT_TTL <= MAX_TTL, "DEFAULT_TTL must not exceed MAX_TTL");
        assert!(ROUTE_EXPIRY_SECS > TOPOLOGY_ANNOUNCE_INTERVAL_SECS as i64,
            "Routes should expire slower than announcements are sent");
        assert!(MAX_TOPOLOGY_ENTRIES > 0);
        assert!(MAX_SEEN_RELAY_IDS > 0);
    }
}
