//! Mesh Routing Module
//!
//! Multi-hop message routing for LAN devices that cannot directly reach each other.
//! Messages are relayed through intermediate devices: A → B → C → D.
//!
//! Key concepts:
//! - **Routing Table**: Each device maintains a table of reachable peers, built from
//!   periodic topology announcements exchanged over the existing encrypted TCP channel.
//! - **Relay Protocol**: A `MESH_RELAY` encrypted message wraps any inner message with
//!   routing metadata (origin, final destination, hop list, TTL).
//! - **Forwarding**: When a device receives a relay message not destined for itself,
//!   it decrements the TTL, appends itself to the hop list, and forwards to the next hop.
//! - **Loop Prevention**: TTL + hop-list deduplication prevent infinite routing loops.

pub mod router;
pub mod types;

pub use router::MeshRouter;
