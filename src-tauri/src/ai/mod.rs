//! AI Module — Google Gemini Integration
//!
//! Provides AI-powered features using the Google Gemini REST API:
//! - Chat summarization
//! - Smart reply suggestions
//! - Free-form AI assistant
//! - Semantic smart search across messages
//! - Conversation tone/sentiment analysis
//!
//! All API calls go through the Rust backend to keep the API key secure.

pub mod service;
pub mod types;

pub use service::AiService;
#[allow(unused_imports)]
pub use types::*;
