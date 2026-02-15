//! Identity Module
//!
//! Manages device identity including persistent device ID and display name.

pub mod manager;

pub use manager::{DeviceIdentity, IdentityManager};
