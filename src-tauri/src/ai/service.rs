//! AI Service — Google Gemini Integration
//!
//! Provides AI-powered features using the Google Gemini REST API:
//! - Chat summarization
//! - Smart reply suggestions
//! - Free-form AI assistant
//! - Semantic smart search across messages
//! - Conversation tone/sentiment analysis
//!
//! All API calls go through the Rust backend to keep the API key secure.
//! The API key is stored via `tauri-plugin-store` and never exposed to the frontend.

use crate::ai::types::*;
use crate::db::{self, DbPool};
use crate::messaging::service::{Message, MessageType};
use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::Deserialize;
use serde_json;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

/// Base URL for the Gemini API.
const GEMINI_API_BASE: &str = "https://generativelanguage.googleapis.com/v1beta/models";

/// Maximum number of messages to include in context for summarization.
const DEFAULT_SUMMARY_MESSAGE_LIMIT: u32 = 100;

/// Maximum number of messages to include in context for smart reply.
const SMART_REPLY_CONTEXT_LIMIT: u32 = 20;

/// Maximum number of messages to include for analysis.
const ANALYSIS_MESSAGE_LIMIT: u32 = 80;

/// Maximum messages for smart search context.
const SMART_SEARCH_MESSAGE_LIMIT: u32 = 200;

// ============================================================================
// AI Service
// ============================================================================

/// The AI service that manages Gemini API interactions.
#[derive(Clone)]
pub struct AiService {
    /// HTTP client for making API requests.
    http: Client,
    /// Gemini API key (stored securely, set at runtime).
    api_key: Arc<Mutex<Option<String>>>,
    /// Which Gemini model to use.
    model: Arc<Mutex<AiModel>>,
    /// Database pool for reading messages.
    db_pool: Arc<DbPool>,
    /// Session statistics.
    stats: Arc<Mutex<AiStats>>,
    /// AI assistant conversation history (in-memory, per session).
    conversation_history: Arc<Mutex<Vec<AiChatMessage>>>,
}

/// Internal stats tracker.
#[derive(Debug, Clone, Default)]
struct AiStats {
    request_count: u32,
    total_tokens_used: u32,
    last_error: Option<String>,
    status: AiServiceStatus,
}

impl Default for AiServiceStatus {
    fn default() -> Self {
        AiServiceStatus::NotConfigured
    }
}

impl AiService {
    /// Create a new AI service.
    pub fn new(db_pool: Arc<DbPool>) -> Self {
        Self {
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(60))
                .build()
                .expect("Failed to create HTTP client"),
            api_key: Arc::new(Mutex::new(None)),
            model: Arc::new(Mutex::new(AiModel::default())),
            db_pool,
            stats: Arc::new(Mutex::new(AiStats::default())),
            conversation_history: Arc::new(Mutex::new(Vec::new())),
        }
    }

    // ========================================================================
    // Configuration
    // ========================================================================

    /// Set the API key. Call this from the IPC command that loads the key from
    /// `tauri-plugin-store` or when the user enters it in settings.
    pub async fn set_api_key(&self, key: String) {
        let has_key = !key.trim().is_empty();
        if has_key {
            *self.api_key.lock().await = Some(key);
            self.stats.lock().await.status = AiServiceStatus::Ready;
        } else {
            *self.api_key.lock().await = None;
            self.stats.lock().await.status = AiServiceStatus::NotConfigured;
        }
        println!(
            "✓ AI service API key {}",
            if has_key { "configured" } else { "cleared" }
        );
    }

    /// Clear the stored API key.
    pub async fn clear_api_key(&self) {
        *self.api_key.lock().await = None;
        self.stats.lock().await.status = AiServiceStatus::NotConfigured;
        println!("✓ AI service API key cleared");
    }

    /// Set the model to use.
    pub async fn set_model(&self, model: AiModel) {
        println!("✓ AI model changed to {}", model);
        *self.model.lock().await = model;
    }

    /// Get the current model.
    pub async fn get_model(&self) -> AiModel {
        self.model.lock().await.clone()
    }

    /// Check if the service is ready (has API key).
    pub async fn is_ready(&self) -> bool {
        self.api_key.lock().await.is_some()
    }

    /// Get the current service status.
    pub async fn get_status(&self) -> AiStatus {
        let stats = self.stats.lock().await;
        let model = self.model.lock().await.clone();
        let has_key = self.api_key.lock().await.is_some();

        AiStatus {
            status: if has_key {
                stats.status.clone()
            } else {
                AiServiceStatus::NotConfigured
            },
            model,
            has_api_key: has_key,
            request_count: stats.request_count,
            total_tokens_used: stats.total_tokens_used,
            last_error: stats.last_error.clone(),
        }
    }

    /// Get the AI assistant conversation history.
    pub async fn get_conversation_history(&self) -> Vec<AiChatMessage> {
        self.conversation_history.lock().await.clone()
    }

    /// Clear the AI assistant conversation history.
    pub async fn clear_conversation_history(&self) {
        self.conversation_history.lock().await.clear();
        println!("✓ AI conversation history cleared");
    }

    // ========================================================================
    // Core API Call
    // ========================================================================

    /// Make a request to the Gemini `generateContent` endpoint.
    async fn call_gemini(&self, request: GeminiRequest) -> Result<GeminiResponse> {
        let api_key = self
            .api_key
            .lock()
            .await
            .clone()
            .ok_or_else(|| anyhow!("AI API key not configured"))?;

        let model = self.model.lock().await.clone();
        let url = format!(
            "{}{}:generateContent?key={}",
            GEMINI_API_BASE,
            format!("/{}", model.model_id()),
            api_key
        );

        // Mark as processing
        self.stats.lock().await.status = AiServiceStatus::Processing;

        let response = self
            .http
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| {
                let msg = format!("Gemini API request failed: {}", e);
                println!("✗ {}", msg);
                anyhow!(msg)
            })?;

        let status = response.status();
        let body = response.text().await.map_err(|e| {
            anyhow!("Failed to read Gemini API response body: {}", e)
        })?;

        if !status.is_success() {
            let msg = format!("Gemini API returned {}: {}", status, body);
            println!("✗ {}", msg);
            let mut stats = self.stats.lock().await;
            stats.status = AiServiceStatus::Error;
            stats.last_error = Some(msg.clone());
            return Err(anyhow!(msg));
        }

        let gemini_response: GeminiResponse = serde_json::from_str(&body).map_err(|e| {
            let msg = format!("Failed to parse Gemini API response: {} — body: {}", e, &body[..body.len().min(500)]);
            println!("✗ {}", msg);
            anyhow!(msg)
        })?;

        // Check for API-level errors
        if let Some(ref err) = gemini_response.error {
            let msg = format!(
                "Gemini API error: {} ({})",
                err.message.as_deref().unwrap_or("Unknown"),
                err.status.as_deref().unwrap_or("UNKNOWN")
            );
            println!("✗ {}", msg);
            let mut stats = self.stats.lock().await;
            stats.status = AiServiceStatus::Error;
            stats.last_error = Some(msg.clone());
            return Err(anyhow!(msg));
        }

        // Update stats
        {
            let mut stats = self.stats.lock().await;
            stats.request_count += 1;
            if let Some(ref usage) = gemini_response.usage_metadata {
                stats.total_tokens_used += usage.total_token_count.unwrap_or(0);
            }
            stats.status = AiServiceStatus::Ready;
            stats.last_error = None;
        }

        Ok(gemini_response)
    }

    /// Extract text content from a Gemini response.
    fn extract_text(response: &GeminiResponse) -> Result<String> {
        response
            .candidates
            .first()
            .and_then(|c| c.content.as_ref())
            .and_then(|content| content.parts.first())
            .map(|part| part.text.clone())
            .ok_or_else(|| anyhow!("No text content in Gemini response"))
    }

    /// Get token count from response.
    fn get_token_count(response: &GeminiResponse) -> u32 {
        response
            .usage_metadata
            .as_ref()
            .and_then(|u| u.total_token_count)
            .unwrap_or(0)
    }

    // ========================================================================
    // Message Formatting Helpers
    // ========================================================================

    /// Format direct messages into a conversation transcript for the AI.
    fn format_messages(messages: &[Message], local_device_id: &str) -> String {
        messages
            .iter()
            .map(|msg| {
                let sender = if msg.from_device_id == local_device_id {
                    "Me"
                } else {
                    &msg.from_device_id[..8.min(msg.from_device_id.len())]
                };
                let content = match &msg.message_type {
                    MessageType::Text { content } => content.clone(),
                    MessageType::Emoji { emoji } => emoji.clone(),
                    MessageType::Reply { content, .. } => format!("(reply) {}", content),
                };
                format!("[{}]: {}", sender, content)
            })
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Format group messages into a conversation transcript.
    fn format_group_messages(messages: &[(String, String, i64)]) -> String {
        messages
            .iter()
            .map(|(from, content, _ts)| {
                let sender = &from[..8.min(from.len())];
                format!("[{}]: {}", sender, content)
            })
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Fetch direct messages for a conversation.
    async fn fetch_direct_messages(
        &self,
        conversation_key: &str,
        limit: Option<u32>,
    ) -> Result<Vec<Message>> {
        let messages = db::messages::get_messages(&self.db_pool, conversation_key).await?;
        let limit = limit.unwrap_or(DEFAULT_SUMMARY_MESSAGE_LIMIT) as usize;
        if messages.len() > limit {
            Ok(messages[messages.len() - limit..].to_vec())
        } else {
            Ok(messages)
        }
    }

    /// Fetch group messages for a conversation.
    /// Returns tuples of (from_device_id, content, timestamp).
    async fn fetch_group_messages(
        &self,
        group_id: &str,
        limit: Option<u32>,
    ) -> Result<Vec<(String, String, i64)>> {
        let messages = db::groups::get_group_messages(&self.db_pool, group_id).await?;
        let limit = limit.unwrap_or(DEFAULT_SUMMARY_MESSAGE_LIMIT) as usize;

        let formatted: Vec<(String, String, i64)> = messages
            .iter()
            .map(|gm| {
                let content = match gm.msg_type.as_str() {
                    "emoji" => gm.content.clone(),
                    "reply" => format!("(reply) {}", gm.content),
                    _ => gm.content.clone(), // "text" and any other type
                };
                (gm.from_device_id.clone(), content, gm.timestamp)
            })
            .collect();

        if formatted.len() > limit {
            Ok(formatted[formatted.len() - limit..].to_vec())
        } else {
            Ok(formatted)
        }
    }

    // ========================================================================
    // Feature: Chat Summarization
    // ========================================================================

    /// Summarize a conversation (direct or group).
    pub async fn summarize_chat(
        &self,
        req: &SummarizeRequest,
        local_device_id: &str,
        app_handle: Option<&AppHandle>,
    ) -> Result<SummarizeResponse> {
        // Emit processing event
        if let Some(handle) = app_handle {
            let _ = handle.emit(
                "ai-processing",
                AiProcessingEvent {
                    action: AiAction::Summarize,
                    conversation_id: Some(req.conversation_id.clone()),
                },
            );
        }

        let (transcript, message_count) = if req.is_group {
            let msgs = self
                .fetch_group_messages(&req.conversation_id, req.message_limit)
                .await?;
            let count = msgs.len() as u32;
            (Self::format_group_messages(&msgs), count)
        } else {
            let msgs = self
                .fetch_direct_messages(&req.conversation_id, req.message_limit)
                .await?;
            let count = msgs.len() as u32;
            (Self::format_messages(&msgs, local_device_id), count)
        };

        if message_count == 0 {
            return Ok(SummarizeResponse {
                summary: "No messages to summarize.".to_string(),
                message_count: 0,
                tokens_used: 0,
                model: self.model.lock().await.model_id().to_string(),
            });
        }

        let system_prompt = "You are a helpful assistant that summarizes chat conversations. \
            Provide a clear, concise summary of the key points discussed. \
            Use bullet points for multiple topics. \
            Keep the summary brief but comprehensive. \
            Do not include device IDs or technical identifiers in the summary. \
            If sender names are short hashes, refer to them as participants.";

        let user_prompt = format!(
            "Please summarize this conversation ({} messages):\n\n{}",
            message_count, transcript
        );

        let request = GeminiRequest {
            contents: vec![GeminiContent {
                role: "user".to_string(),
                parts: vec![GeminiPart { text: user_prompt }],
            }],
            generation_config: Some(GeminiGenerationConfig {
                temperature: Some(0.3),
                max_output_tokens: Some(1024),
                ..Default::default()
            }),
            safety_settings: None,
            system_instruction: Some(GeminiContent {
                role: "user".to_string(),
                parts: vec![GeminiPart {
                    text: system_prompt.to_string(),
                }],
            }),
        };

        let response = self.call_gemini(request).await?;
        let summary = Self::extract_text(&response)?;
        let tokens_used = Self::get_token_count(&response);
        let model = self.model.lock().await.model_id().to_string();

        // Emit completed event
        if let Some(handle) = app_handle {
            let _ = handle.emit(
                "ai-completed",
                AiCompletedEvent {
                    action: AiAction::Summarize,
                    conversation_id: Some(req.conversation_id.clone()),
                    tokens_used,
                    success: true,
                    error: None,
                },
            );
        }

        Ok(SummarizeResponse {
            summary,
            message_count,
            tokens_used,
            model,
        })
    }

    // ========================================================================
    // Feature: Smart Reply Suggestions
    // ========================================================================

    /// Generate smart reply suggestions based on recent conversation context.
    pub async fn smart_reply(
        &self,
        req: &SmartReplyRequest,
        local_device_id: &str,
        app_handle: Option<&AppHandle>,
    ) -> Result<SmartReplyResponse> {
        if let Some(handle) = app_handle {
            let _ = handle.emit(
                "ai-processing",
                AiProcessingEvent {
                    action: AiAction::SmartReply,
                    conversation_id: Some(req.conversation_id.clone()),
                },
            );
        }

        let count = req.count.unwrap_or(3).min(5);

        let transcript = if req.is_group {
            let msgs = self
                .fetch_group_messages(
                    &req.conversation_id,
                    Some(SMART_REPLY_CONTEXT_LIMIT),
                )
                .await?;
            Self::format_group_messages(&msgs)
        } else {
            let msgs = self
                .fetch_direct_messages(
                    &req.conversation_id,
                    Some(SMART_REPLY_CONTEXT_LIMIT),
                )
                .await?;
            Self::format_messages(&msgs, local_device_id)
        };

        if transcript.trim().is_empty() {
            return Ok(SmartReplyResponse {
                suggestions: vec!["Hi! 👋".to_string()],
                tokens_used: 0,
                model: self.model.lock().await.model_id().to_string(),
            });
        }

        let system_prompt = format!(
            "You are a smart reply assistant for a LAN messaging app. \
            Generate exactly {} short, natural reply suggestions based on the conversation context. \
            Each reply should be different in tone/approach (e.g., agreeing, asking a question, casual). \
            Keep each reply under 50 words. \
            Output ONLY the suggestions, one per line, numbered 1. 2. 3. etc. \
            Do not include any other text or explanation.",
            count
        );

        let user_prompt = format!(
            "Based on this recent conversation, suggest {} replies I could send:\n\n{}",
            count, transcript
        );

        let request = GeminiRequest {
            contents: vec![GeminiContent {
                role: "user".to_string(),
                parts: vec![GeminiPart { text: user_prompt }],
            }],
            generation_config: Some(GeminiGenerationConfig {
                temperature: Some(0.8),
                max_output_tokens: Some(512),
                ..Default::default()
            }),
            safety_settings: None,
            system_instruction: Some(GeminiContent {
                role: "user".to_string(),
                parts: vec![GeminiPart {
                    text: system_prompt,
                }],
            }),
        };

        let response = self.call_gemini(request).await?;
        let text = Self::extract_text(&response)?;
        let tokens_used = Self::get_token_count(&response);
        let model = self.model.lock().await.model_id().to_string();

        // Parse numbered suggestions from the response
        let suggestions: Vec<String> = text
            .lines()
            .filter_map(|line| {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    return None;
                }
                // Strip leading number and punctuation (e.g., "1. ", "1) ", "- ")
                let cleaned = trimmed
                    .trim_start_matches(|c: char| c.is_ascii_digit())
                    .trim_start_matches(['.', ')', '-', ':', ' '])
                    .trim();
                if cleaned.is_empty() {
                    None
                } else {
                    Some(cleaned.to_string())
                }
            })
            .take(count as usize)
            .collect();

        if let Some(handle) = app_handle {
            let _ = handle.emit(
                "ai-completed",
                AiCompletedEvent {
                    action: AiAction::SmartReply,
                    conversation_id: Some(req.conversation_id.clone()),
                    tokens_used,
                    success: true,
                    error: None,
                },
            );
        }

        Ok(SmartReplyResponse {
            suggestions,
            tokens_used,
            model,
        })
    }

    // ========================================================================
    // Feature: Free-Form AI Assistant
    // ========================================================================

    /// Ask the AI assistant a free-form question, optionally with conversation context.
    pub async fn ask(
        &self,
        req: &AskRequest,
        local_device_id: &str,
        app_handle: Option<&AppHandle>,
    ) -> Result<AskResponse> {
        if let Some(handle) = app_handle {
            let _ = handle.emit(
                "ai-processing",
                AiProcessingEvent {
                    action: AiAction::Ask,
                    conversation_id: req.context_conversation_id.clone(),
                },
            );
        }

        let system_prompt = "You are a helpful AI assistant integrated into Hyper Connect, \
            a LAN-based peer-to-peer messaging and file sharing application. \
            You help users with questions about their conversations, files, and general queries. \
            Be concise, friendly, and helpful. Use markdown formatting where appropriate. \
            If conversation context is provided, use it to give more relevant answers.";

        // Build the conversation contents with history
        let mut contents: Vec<GeminiContent> = Vec::new();

        // Add conversation history for context continuity
        {
            let history = self.conversation_history.lock().await;
            for msg in history.iter() {
                let role = match msg.role {
                    AiChatRole::User => "user",
                    AiChatRole::Assistant => "model",
                    AiChatRole::System => continue, // Skip system messages
                };
                contents.push(GeminiContent {
                    role: role.to_string(),
                    parts: vec![GeminiPart {
                        text: msg.content.clone(),
                    }],
                });
            }
        }

        // Add optional conversation context
        let mut user_prompt = req.prompt.clone();
        if let Some(ref conv_id) = req.context_conversation_id {
            let is_group = req.context_is_group.unwrap_or(false);
            let context = if is_group {
                let msgs = self
                    .fetch_group_messages(conv_id, Some(SMART_REPLY_CONTEXT_LIMIT))
                    .await;
                match msgs {
                    Ok(msgs) => Self::format_group_messages(&msgs),
                    Err(_) => String::new(),
                }
            } else {
                let msgs = self
                    .fetch_direct_messages(conv_id, Some(SMART_REPLY_CONTEXT_LIMIT))
                    .await;
                match msgs {
                    Ok(msgs) => Self::format_messages(&msgs, local_device_id),
                    Err(_) => String::new(),
                }
            };

            if !context.is_empty() {
                user_prompt = format!(
                    "Here is the recent conversation context:\n\n{}\n\nUser question: {}",
                    context, req.prompt
                );
            }
        }

        contents.push(GeminiContent {
            role: "user".to_string(),
            parts: vec![GeminiPart {
                text: user_prompt.clone(),
            }],
        });

        let request = GeminiRequest {
            contents,
            generation_config: Some(GeminiGenerationConfig {
                temperature: Some(0.7),
                max_output_tokens: Some(2048),
                ..Default::default()
            }),
            safety_settings: None,
            system_instruction: Some(GeminiContent {
                role: "user".to_string(),
                parts: vec![GeminiPart {
                    text: system_prompt.to_string(),
                }],
            }),
        };

        let response = self.call_gemini(request).await?;
        let answer = Self::extract_text(&response)?;
        let tokens_used = Self::get_token_count(&response);
        let model = self.model.lock().await.model_id().to_string();

        // Store in conversation history
        {
            let now = chrono::Utc::now().timestamp_millis();
            let mut history = self.conversation_history.lock().await;

            // Add user message
            history.push(AiChatMessage {
                id: uuid::Uuid::new_v4().to_string(),
                role: AiChatRole::User,
                content: req.prompt.clone(),
                timestamp: now,
                action: None,
                tokens_used: None,
            });

            // Add assistant response
            history.push(AiChatMessage {
                id: uuid::Uuid::new_v4().to_string(),
                role: AiChatRole::Assistant,
                content: answer.clone(),
                timestamp: now + 1,
                action: Some(AiAction::Ask),
                tokens_used: Some(tokens_used),
            });

            // Keep history manageable (last 50 messages)
            if history.len() > 50 {
                let drain_count = history.len() - 50;
                history.drain(..drain_count);
            }
        }

        if let Some(handle) = app_handle {
            let _ = handle.emit(
                "ai-completed",
                AiCompletedEvent {
                    action: AiAction::Ask,
                    conversation_id: req.context_conversation_id.clone(),
                    tokens_used,
                    success: true,
                    error: None,
                },
            );
        }

        Ok(AskResponse {
            answer,
            tokens_used,
            model,
        })
    }

    // ========================================================================
    // Feature: Smart Search
    // ========================================================================

    /// Perform an AI-powered semantic search across messages.
    ///
    /// This first uses FTS5 to find candidate messages, then uses Gemini to
    /// rank and explain relevance.
    pub async fn smart_search(
        &self,
        req: &SmartSearchRequest,
        _local_device_id: &str,
        app_handle: Option<&AppHandle>,
    ) -> Result<SmartSearchResponse> {
        if let Some(handle) = app_handle {
            let _ = handle.emit(
                "ai-processing",
                AiProcessingEvent {
                    action: AiAction::SmartSearch,
                    conversation_id: None,
                },
            );
        }

        let limit = req.limit.unwrap_or(10).min(20);

        // First, use FTS5 to get candidate messages
        let fts_results =
            db::search::search_messages(&self.db_pool, &req.query, None, SMART_SEARCH_MESSAGE_LIMIT)
                .await?;

        let fts_group_results = db::search::search_group_messages(
            &self.db_pool,
            &req.query,
            None,
            SMART_SEARCH_MESSAGE_LIMIT,
        )
        .await?;

        if fts_results.is_empty() && fts_group_results.is_empty() {
            // No FTS results — try a broader AI-based approach
            return Ok(SmartSearchResponse {
                results: vec![],
                query: req.query.clone(),
                tokens_used: 0,
                model: self.model.lock().await.model_id().to_string(),
            });
        }

        // Build a context of candidate messages for Gemini to rank
        let mut candidates = String::new();
        let mut candidate_metadata: Vec<(String, bool, String, i64)> = Vec::new(); // (conv_id, is_group, from_device, timestamp)

        for (i, msg) in fts_results.iter().enumerate().take(30) {
            candidates.push_str(&format!(
                "{}. [DM][{}] {}: {}\n",
                i + 1,
                msg.conversation_key,
                &msg.from_device_id[..8.min(msg.from_device_id.len())],
                msg.content
            ));
            candidate_metadata.push((
                msg.conversation_key.clone(),
                false,
                msg.from_device_id.clone(),
                msg.timestamp,
            ));
        }

        let dm_count = fts_results.len().min(30);
        for (i, msg) in fts_group_results.iter().enumerate().take(20) {
            candidates.push_str(&format!(
                "{}. [GROUP][{}] {}: {}\n",
                dm_count + i + 1,
                msg.group_id,
                &msg.from_device_id[..8.min(msg.from_device_id.len())],
                msg.content
            ));
            candidate_metadata.push((
                msg.group_id.clone(),
                true,
                msg.from_device_id.clone(),
                msg.timestamp,
            ));
        }

        let system_prompt = format!(
            "You are a search assistant. Given a user's search query and a list of candidate messages, \
            select the top {} most relevant messages and explain why each is relevant. \
            Output ONLY a JSON array of objects with fields: \
            \"index\" (1-based number from the list), \"relevance\" (brief explanation). \
            No other text. Example: [{{\"index\": 1, \"relevance\": \"Directly discusses the topic\"}}]",
            limit
        );

        let user_prompt = format!(
            "Search query: \"{}\"\n\nCandidate messages:\n{}",
            req.query, candidates
        );

        let request = GeminiRequest {
            contents: vec![GeminiContent {
                role: "user".to_string(),
                parts: vec![GeminiPart { text: user_prompt }],
            }],
            generation_config: Some(GeminiGenerationConfig {
                temperature: Some(0.1),
                max_output_tokens: Some(1024),
                ..Default::default()
            }),
            safety_settings: None,
            system_instruction: Some(GeminiContent {
                role: "user".to_string(),
                parts: vec![GeminiPart {
                    text: system_prompt,
                }],
            }),
        };

        let response = self.call_gemini(request).await?;
        let text = Self::extract_text(&response)?;
        let tokens_used = Self::get_token_count(&response);
        let model = self.model.lock().await.model_id().to_string();

        // Parse the JSON array from Gemini's response
        let ranked: Vec<SmartSearchResult> = Self::parse_smart_search_results(
            &text,
            &candidate_metadata,
            &fts_results,
            &fts_group_results,
            dm_count,
        );

        if let Some(handle) = app_handle {
            let _ = handle.emit(
                "ai-completed",
                AiCompletedEvent {
                    action: AiAction::SmartSearch,
                    conversation_id: None,
                    tokens_used,
                    success: true,
                    error: None,
                },
            );
        }

        Ok(SmartSearchResponse {
            results: ranked,
            query: req.query.clone(),
            tokens_used,
            model,
        })
    }

    /// Parse Gemini's JSON ranking output into SmartSearchResult structs.
    fn parse_smart_search_results(
        text: &str,
        metadata: &[(String, bool, String, i64)],
        fts_results: &[db::search::MessageSearchResult],
        fts_group_results: &[db::search::GroupMessageSearchResult],
        dm_count: usize,
    ) -> Vec<SmartSearchResult> {
        // Try to extract JSON array from the response (Gemini may wrap it in markdown)
        let json_str = text
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();

        #[derive(Deserialize)]
        struct RankedItem {
            index: usize,
            relevance: String,
        }

        let ranked_items: Vec<RankedItem> = match serde_json::from_str(json_str) {
            Ok(items) => items,
            Err(e) => {
                println!(
                    "⚠ Failed to parse AI search ranking: {}. Falling back to FTS order.",
                    e
                );
                // Fallback: return FTS results in order
                return metadata
                    .iter()
                    .enumerate()
                    .take(10)
                    .map(|(i, (conv_id, is_group, from_device, ts))| {
                        let content = if !*is_group && i < fts_results.len() {
                            fts_results[i].content.clone()
                        } else if *is_group {
                            let gi = i.saturating_sub(dm_count);
                            if gi < fts_group_results.len() {
                                fts_group_results[gi].content.clone()
                            } else {
                                String::new()
                            }
                        } else {
                            String::new()
                        };
                        SmartSearchResult {
                            content,
                            conversation_id: conv_id.clone(),
                            is_group: *is_group,
                            from_device_id: from_device.clone(),
                            timestamp: *ts,
                            relevance: "Matched search terms".to_string(),
                        }
                    })
                    .collect();
            }
        };

        ranked_items
            .into_iter()
            .filter_map(|item| {
                let idx = item.index.checked_sub(1)?; // Convert 1-based to 0-based
                let (conv_id, is_group, from_device, ts) = metadata.get(idx)?;

                let content = if !is_group && idx < fts_results.len() {
                    fts_results[idx].content.clone()
                } else if *is_group {
                    let gi = idx.saturating_sub(dm_count);
                    if gi < fts_group_results.len() {
                        fts_group_results[gi].content.clone()
                    } else {
                        return None;
                    }
                } else {
                    return None;
                };

                Some(SmartSearchResult {
                    content,
                    conversation_id: conv_id.clone(),
                    is_group: *is_group,
                    from_device_id: from_device.clone(),
                    timestamp: *ts,
                    relevance: item.relevance,
                })
            })
            .collect()
    }

    // ========================================================================
    // Feature: Conversation Analysis
    // ========================================================================

    /// Analyze the tone, topics, and activity of a conversation.
    pub async fn analyze_chat(
        &self,
        req: &AnalyzeRequest,
        local_device_id: &str,
        app_handle: Option<&AppHandle>,
    ) -> Result<AnalyzeResponse> {
        if let Some(handle) = app_handle {
            let _ = handle.emit(
                "ai-processing",
                AiProcessingEvent {
                    action: AiAction::Analyze,
                    conversation_id: Some(req.conversation_id.clone()),
                },
            );
        }

        let transcript = if req.is_group {
            let msgs = self
                .fetch_group_messages(&req.conversation_id, Some(ANALYSIS_MESSAGE_LIMIT))
                .await?;
            Self::format_group_messages(&msgs)
        } else {
            let msgs = self
                .fetch_direct_messages(&req.conversation_id, Some(ANALYSIS_MESSAGE_LIMIT))
                .await?;
            Self::format_messages(&msgs, local_device_id)
        };

        if transcript.trim().is_empty() {
            return Ok(AnalyzeResponse {
                tone: "neutral".to_string(),
                topics: vec![],
                activity: "No messages to analyze".to_string(),
                insights: vec![],
                tokens_used: 0,
                model: self.model.lock().await.model_id().to_string(),
            });
        }

        let system_prompt = "You are a conversation analyst. Analyze the given chat transcript and provide:\n\
            1. Overall tone (e.g., friendly, professional, heated, casual, supportive)\n\
            2. Key topics discussed (list of 2-5 topics)\n\
            3. Activity level description (e.g., very active, moderate, quiet)\n\
            4. Notable insights (1-3 observations)\n\n\
            Output ONLY valid JSON with this exact structure:\n\
            {\"tone\": \"...\", \"topics\": [\"...\"], \"activity\": \"...\", \"insights\": [\"...\"]}\n\
            No other text.";

        let user_prompt = format!("Analyze this conversation:\n\n{}", transcript);

        let request = GeminiRequest {
            contents: vec![GeminiContent {
                role: "user".to_string(),
                parts: vec![GeminiPart { text: user_prompt }],
            }],
            generation_config: Some(GeminiGenerationConfig {
                temperature: Some(0.3),
                max_output_tokens: Some(512),
                ..Default::default()
            }),
            safety_settings: None,
            system_instruction: Some(GeminiContent {
                role: "user".to_string(),
                parts: vec![GeminiPart {
                    text: system_prompt.to_string(),
                }],
            }),
        };

        let response = self.call_gemini(request).await?;
        let text = Self::extract_text(&response)?;
        let tokens_used = Self::get_token_count(&response);
        let model = self.model.lock().await.model_id().to_string();

        // Parse the JSON response
        let json_str = text
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();

        #[derive(Deserialize)]
        struct AnalysisJson {
            tone: String,
            topics: Vec<String>,
            activity: String,
            insights: Vec<String>,
        }

        let analysis: AnalysisJson = serde_json::from_str(json_str).map_err(|e| {
            anyhow!(
                "Failed to parse AI analysis response: {}. Raw: {}",
                e,
                &json_str[..json_str.len().min(300)]
            )
        })?;

        if let Some(handle) = app_handle {
            let _ = handle.emit(
                "ai-completed",
                AiCompletedEvent {
                    action: AiAction::Analyze,
                    conversation_id: Some(req.conversation_id.clone()),
                    tokens_used,
                    success: true,
                    error: None,
                },
            );
        }

        Ok(AnalyzeResponse {
            tone: analysis.tone,
            topics: analysis.topics,
            activity: analysis.activity,
            insights: analysis.insights,
            tokens_used,
            model,
        })
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_messages() {
        let messages = vec![
            Message {
                id: "1".to_string(),
                from_device_id: "device-aaa-111".to_string(),
                to_device_id: "device-bbb-222".to_string(),
                message_type: MessageType::Text {
                    content: "Hello!".to_string(),
                },
                timestamp: 1000,
                thread_id: None,
                status: crate::messaging::service::MessageStatus::Sent,
            },
            Message {
                id: "2".to_string(),
                from_device_id: "device-bbb-222".to_string(),
                to_device_id: "device-aaa-111".to_string(),
                message_type: MessageType::Text {
                    content: "Hi there!".to_string(),
                },
                timestamp: 2000,
                thread_id: None,
                status: crate::messaging::service::MessageStatus::Delivered,
            },
        ];

        let transcript = AiService::format_messages(&messages, "device-aaa-111");
        assert!(transcript.contains("[Me]: Hello!"));
        assert!(transcript.contains("[device-b]: Hi there!"));
    }

    #[test]
    fn test_format_messages_emoji() {
        let messages = vec![Message {
            id: "1".to_string(),
            from_device_id: "device-aaa".to_string(),
            to_device_id: "device-bbb".to_string(),
            message_type: MessageType::Emoji {
                emoji: "👍".to_string(),
            },
            timestamp: 1000,
            thread_id: None,
            status: crate::messaging::service::MessageStatus::Sent,
        }];

        let transcript = AiService::format_messages(&messages, "device-aaa");
        assert!(transcript.contains("[Me]: 👍"));
    }

    #[test]
    fn test_format_messages_reply() {
        let messages = vec![Message {
            id: "1".to_string(),
            from_device_id: "device-aaa".to_string(),
            to_device_id: "device-bbb".to_string(),
            message_type: MessageType::Reply {
                content: "Agreed!".to_string(),
                reply_to: "msg-0".to_string(),
            },
            timestamp: 1000,
            thread_id: None,
            status: crate::messaging::service::MessageStatus::Sent,
        }];

        let transcript = AiService::format_messages(&messages, "device-aaa");
        assert!(transcript.contains("[Me]: (reply) Agreed!"));
    }

    #[test]
    fn test_format_group_messages() {
        let messages = vec![
            ("device-aaa-111".to_string(), "Hello group!".to_string(), 1000i64),
            ("device-bbb-222".to_string(), "Hey everyone!".to_string(), 2000i64),
        ];

        let transcript = AiService::format_group_messages(&messages);
        assert!(transcript.contains("[device-a]: Hello group!"));
        assert!(transcript.contains("[device-b]: Hey everyone!"));
    }

    #[test]
    fn test_extract_text_success() {
        let response = GeminiResponse {
            candidates: vec![GeminiCandidate {
                content: Some(GeminiContent {
                    role: "model".to_string(),
                    parts: vec![GeminiPart {
                        text: "This is the answer.".to_string(),
                    }],
                }),
                finish_reason: Some("STOP".to_string()),
                safety_ratings: None,
            }],
            usage_metadata: None,
            error: None,
        };

        let text = AiService::extract_text(&response).unwrap();
        assert_eq!(text, "This is the answer.");
    }

    #[test]
    fn test_extract_text_empty_candidates() {
        let response = GeminiResponse {
            candidates: vec![],
            usage_metadata: None,
            error: None,
        };

        assert!(AiService::extract_text(&response).is_err());
    }

    #[test]
    fn test_extract_text_no_content() {
        let response = GeminiResponse {
            candidates: vec![GeminiCandidate {
                content: None,
                finish_reason: Some("SAFETY".to_string()),
                safety_ratings: None,
            }],
            usage_metadata: None,
            error: None,
        };

        assert!(AiService::extract_text(&response).is_err());
    }

    #[test]
    fn test_get_token_count() {
        let response = GeminiResponse {
            candidates: vec![],
            usage_metadata: Some(GeminiUsageMetadata {
                prompt_token_count: Some(10),
                candidates_token_count: Some(20),
                total_token_count: Some(30),
            }),
            error: None,
        };

        assert_eq!(AiService::get_token_count(&response), 30);
    }

    #[test]
    fn test_get_token_count_missing() {
        let response = GeminiResponse {
            candidates: vec![],
            usage_metadata: None,
            error: None,
        };

        assert_eq!(AiService::get_token_count(&response), 0);
    }

    #[test]
    fn test_parse_smart_search_results_valid() {
        let json = r#"[{"index": 1, "relevance": "Directly relevant"}, {"index": 2, "relevance": "Also relevant"}]"#;

        let metadata = vec![
            ("conv-1".to_string(), false, "device-a".to_string(), 1000i64),
            ("conv-1".to_string(), false, "device-b".to_string(), 2000i64),
        ];

        let fts_results = vec![
            db::search::MessageSearchResult {
                id: "m1".to_string(),
                conversation_key: "conv-1".to_string(),
                from_device_id: "device-a".to_string(),
                to_device_id: "device-b".to_string(),
                msg_type: "text".to_string(),
                content: "Hello world".to_string(),
                timestamp: 1000,
                snippet: "Hello <b>world</b>".to_string(),
                rank: -1.0,
            },
            db::search::MessageSearchResult {
                id: "m2".to_string(),
                conversation_key: "conv-1".to_string(),
                from_device_id: "device-b".to_string(),
                to_device_id: "device-a".to_string(),
                msg_type: "text".to_string(),
                content: "Hi there".to_string(),
                timestamp: 2000,
                snippet: "Hi <b>there</b>".to_string(),
                rank: -0.5,
            },
        ];

        let results =
            AiService::parse_smart_search_results(json, &metadata, &fts_results, &[], 2);

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].content, "Hello world");
        assert_eq!(results[0].relevance, "Directly relevant");
        assert_eq!(results[1].content, "Hi there");
    }

    #[test]
    fn test_parse_smart_search_results_invalid_json() {
        let json = "not valid json";

        let metadata = vec![(
            "conv-1".to_string(),
            false,
            "device-a".to_string(),
            1000i64,
        )];

        let fts_results = vec![db::search::MessageSearchResult {
            id: "m1".to_string(),
            conversation_key: "conv-1".to_string(),
            from_device_id: "device-a".to_string(),
            to_device_id: "device-b".to_string(),
            msg_type: "text".to_string(),
            content: "Fallback result".to_string(),
            timestamp: 1000,
            snippet: "Fallback".to_string(),
            rank: -1.0,
        }];

        let results =
            AiService::parse_smart_search_results(json, &metadata, &fts_results, &[], 1);

        // Should fallback to FTS order
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].content, "Fallback result");
        assert_eq!(results[0].relevance, "Matched search terms");
    }

    #[test]
    fn test_parse_smart_search_results_with_markdown_wrapper() {
        let json = "```json\n[{\"index\": 1, \"relevance\": \"test\"}]\n```";

        let metadata = vec![(
            "conv-1".to_string(),
            false,
            "device-a".to_string(),
            1000i64,
        )];

        let fts_results = vec![db::search::MessageSearchResult {
            id: "m1".to_string(),
            conversation_key: "conv-1".to_string(),
            from_device_id: "device-a".to_string(),
            to_device_id: "device-b".to_string(),
            msg_type: "text".to_string(),
            content: "Test message".to_string(),
            timestamp: 1000,
            snippet: "test".to_string(),
            rank: -1.0,
        }];

        let results =
            AiService::parse_smart_search_results(json, &metadata, &fts_results, &[], 1);

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].content, "Test message");
    }
}
