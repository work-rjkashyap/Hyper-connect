//! Discovery Module
//!
//! Handles device discovery on the local network using Multicast DNS (mDNS).

pub mod mdns;

pub use mdns::{Device, MdnsDiscoveryService};
