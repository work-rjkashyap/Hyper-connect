//! AI Module Types
//!
//! Data structures for Google Gemini API integration.
//! Provides chat summarization, smart replies, semantic search,
//! and a general-purpose AI assistant — all powered by Gemini.

use serde::{Deserialize, Serialize};

// ============================================================================
// Gemini API Request Types
// ============================================================================

/// A single part of a Gemini content message.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiPart {
    pub text: String,
}

/// A content entry in the Gemini conversation (user or model turn).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiContent {
    pub role: String,
    pub parts: Vec<GeminiPart>,
}

/// Safety settings to control content filtering.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiSafetySetting {
    pub category: String,
    pub threshold: String,
}

/// Generation configuration for controlling output.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiGenerationConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_k: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_output_tokens: Option<u32>,
}

impl Default for GeminiGenerationConfig {
    fn default() -> Self {
        Self {
            temperature: Some(0.7),
            top_p: Some(0.95),
            top_k: Some(40),
            max_output_tokens: Some(2048),
        }
    }
}

/// The top-level request body sent to Gemini's `generateContent` endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiRequest {
    pub contents: Vec<GeminiContent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generation_config: Option<GeminiGenerationConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub safety_settings: Option<Vec<GeminiSafetySetting>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_instruction: Option<GeminiContent>,
}

// ============================================================================
// Gemini API Response Types
// ============================================================================

/// A single candidate response from Gemini.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiCandidate {
    pub content: Option<GeminiContent>,
    #[serde(default)]
    pub finish_reason: Option<String>,
    #[serde(default)]
    pub safety_ratings: Option<Vec<GeminiSafetyRating>>,
}

/// Safety rating on generated content.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiSafetyRating {
    pub category: String,
    pub probability: String,
}

/// Token usage metadata returned by Gemini.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiUsageMetadata {
    #[serde(default)]
    pub prompt_token_count: Option<u32>,
    #[serde(default)]
    pub candidates_token_count: Option<u32>,
    #[serde(default)]
    pub total_token_count: Option<u32>,
}

/// The top-level response from Gemini's `generateContent` endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiResponse {
    #[serde(default)]
    pub candidates: Vec<GeminiCandidate>,
    #[serde(default)]
    pub usage_metadata: Option<GeminiUsageMetadata>,
    /// Present when the API returns an error instead of candidates.
    #[serde(default)]
    pub error: Option<GeminiErrorResponse>,
}

/// Gemini API error payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiErrorResponse {
    pub code: Option<i32>,
    pub message: Option<String>,
    pub status: Option<String>,
}

// ============================================================================
// Application-Level AI Types
// ============================================================================

/// Available Gemini models.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AiModel {
    #[serde(rename = "gemini-2.5-flash")]
    Gemini25Flash,
    #[serde(rename = "gemini-2.0-flash")]
    Gemini20Flash,
    #[serde(rename = "gemini-2.5-pro")]
    Gemini25Pro,
}

impl AiModel {
    /// Returns the model identifier string used in the API URL.
    pub fn model_id(&self) -> &'static str {
        match self {
            AiModel::Gemini25Flash => "gemini-2.5-flash",
            AiModel::Gemini20Flash => "gemini-2.0-flash",
            AiModel::Gemini25Pro => "gemini-2.5-pro",
        }
    }
}

impl Default for AiModel {
    fn default() -> Self {
        AiModel::Gemini25Flash
    }
}

impl std::fmt::Display for AiModel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.model_id())
    }
}

/// The type of AI action being performed.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AiAction {
    /// Summarize a conversation
    Summarize,
    /// Generate smart reply suggestions
    SmartReply,
    /// Free-form question to the AI assistant
    Ask,
    /// Semantic / intelligent search across messages
    SmartSearch,
    /// Analyze conversation tone & sentiment
    Analyze,
}

impl std::fmt::Display for AiAction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AiAction::Summarize => write!(f, "summarize"),
            AiAction::SmartReply => write!(f, "smart_reply"),
            AiAction::Ask => write!(f, "ask"),
            AiAction::SmartSearch => write!(f, "smart_search"),
            AiAction::Analyze => write!(f, "analyze"),
        }
    }
}

/// Current status of the AI service.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AiServiceStatus {
    /// No API key configured
    NotConfigured,
    /// API key set, service ready
    Ready,
    /// Currently processing a request
    Processing,
    /// Last request failed
    Error,
}

/// AI service status report returned to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiStatus {
    pub status: AiServiceStatus,
    pub model: AiModel,
    pub has_api_key: bool,
    /// Total requests made in this session
    pub request_count: u32,
    /// Total tokens used in this session
    pub total_tokens_used: u32,
    /// Last error message, if any
    pub last_error: Option<String>,
}

/// A message in the AI assistant conversation history.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiChatMessage {
    pub id: String,
    pub role: AiChatRole,
    pub content: String,
    pub timestamp: i64,
    /// Which action produced this message (if from AI)
    pub action: Option<AiAction>,
    /// Token usage for this specific response
    pub tokens_used: Option<u32>,
}

/// Role in the AI conversation.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AiChatRole {
    User,
    Assistant,
    System,
}

/// Request payload for the `ai_summarize_chat` IPC command.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummarizeRequest {
    /// Conversation key or group ID to summarize
    pub conversation_id: String,
    /// Whether this is a group conversation
    pub is_group: bool,
    /// Optional: limit to last N messages (default: all)
    pub message_limit: Option<u32>,
}

/// Response from a summarization request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummarizeResponse {
    pub summary: String,
    pub message_count: u32,
    pub tokens_used: u32,
    pub model: String,
}

/// Request payload for the `ai_smart_reply` IPC command.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartReplyRequest {
    /// Conversation key or group ID
    pub conversation_id: String,
    /// Whether this is a group conversation
    pub is_group: bool,
    /// Number of suggestions to generate (default: 3)
    pub count: Option<u32>,
}

/// Response from a smart reply request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartReplyResponse {
    pub suggestions: Vec<String>,
    pub tokens_used: u32,
    pub model: String,
}

/// Request payload for the `ai_ask` IPC command.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AskRequest {
    /// The user's question or prompt
    pub prompt: String,
    /// Optional context: conversation ID to provide as context
    pub context_conversation_id: Option<String>,
    /// Whether the context conversation is a group
    pub context_is_group: Option<bool>,
}

/// Response from the AI ask command.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AskResponse {
    pub answer: String,
    pub tokens_used: u32,
    pub model: String,
}

/// Request payload for `ai_smart_search`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartSearchRequest {
    /// Natural language search query
    pub query: String,
    /// Maximum results to return
    pub limit: Option<u32>,
}

/// A single smart search result with AI-generated relevance explanation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartSearchResult {
    /// The matched message content
    pub content: String,
    /// Conversation key or group ID
    pub conversation_id: String,
    /// Whether it's from a group conversation
    pub is_group: bool,
    /// Device ID of the sender
    pub from_device_id: String,
    /// Timestamp of the message
    pub timestamp: i64,
    /// AI-generated explanation of why this result is relevant
    pub relevance: String,
}

/// Response from smart search.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartSearchResponse {
    pub results: Vec<SmartSearchResult>,
    pub query: String,
    pub tokens_used: u32,
    pub model: String,
}

/// Request payload for `ai_analyze_chat`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzeRequest {
    /// Conversation key or group ID
    pub conversation_id: String,
    /// Whether this is a group conversation
    pub is_group: bool,
}

/// Sentiment / tone analysis result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzeResponse {
    /// Overall tone description (e.g., "friendly", "professional", "heated")
    pub tone: String,
    /// Key topics discussed
    pub topics: Vec<String>,
    /// Activity level description
    pub activity: String,
    /// Any notable insights
    pub insights: Vec<String>,
    pub tokens_used: u32,
    pub model: String,
}

// ============================================================================
// Events emitted to the frontend
// ============================================================================

/// Emitted when an AI operation starts.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiProcessingEvent {
    pub action: AiAction,
    pub conversation_id: Option<String>,
}

/// Emitted when an AI operation completes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiCompletedEvent {
    pub action: AiAction,
    pub conversation_id: Option<String>,
    pub tokens_used: u32,
    pub success: bool,
    pub error: Option<String>,
}

/// Emitted when the AI service status changes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiStatusChangedEvent {
    pub status: AiServiceStatus,
    pub has_api_key: bool,
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ai_model_id() {
        assert_eq!(AiModel::Gemini25Flash.model_id(), "gemini-2.5-flash");
        assert_eq!(AiModel::Gemini20Flash.model_id(), "gemini-2.0-flash");
        assert_eq!(AiModel::Gemini25Pro.model_id(), "gemini-2.5-pro");
    }

    #[test]
    fn test_ai_model_default() {
        let model = AiModel::default();
        assert_eq!(model, AiModel::Gemini25Flash);
    }

    #[test]
    fn test_ai_model_display() {
        assert_eq!(format!("{}", AiModel::Gemini25Flash), "gemini-2.5-flash");
    }

    #[test]
    fn test_ai_action_display() {
        assert_eq!(format!("{}", AiAction::Summarize), "summarize");
        assert_eq!(format!("{}", AiAction::SmartReply), "smart_reply");
        assert_eq!(format!("{}", AiAction::Ask), "ask");
        assert_eq!(format!("{}", AiAction::SmartSearch), "smart_search");
        assert_eq!(format!("{}", AiAction::Analyze), "analyze");
    }

    #[test]
    fn test_generation_config_default() {
        let config = GeminiGenerationConfig::default();
        assert_eq!(config.temperature, Some(0.7));
        assert_eq!(config.top_p, Some(0.95));
        assert_eq!(config.top_k, Some(40));
        assert_eq!(config.max_output_tokens, Some(2048));
    }

    #[test]
    fn test_gemini_request_serialization() {
        let request = GeminiRequest {
            contents: vec![GeminiContent {
                role: "user".to_string(),
                parts: vec![GeminiPart {
                    text: "Hello".to_string(),
                }],
            }],
            generation_config: Some(GeminiGenerationConfig::default()),
            safety_settings: None,
            system_instruction: None,
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("\"role\":\"user\""));
        assert!(json.contains("\"text\":\"Hello\""));
        assert!(json.contains("\"temperature\":0.7"));
        // safety_settings should be omitted when None
        assert!(!json.contains("safetySettings"));
    }

    #[test]
    fn test_gemini_response_deserialization() {
        let json = r#"{
            "candidates": [{
                "content": {
                    "role": "model",
                    "parts": [{"text": "Hello! How can I help?"}]
                },
                "finishReason": "STOP"
            }],
            "usageMetadata": {
                "promptTokenCount": 5,
                "candidatesTokenCount": 10,
                "totalTokenCount": 15
            }
        }"#;

        let response: GeminiResponse = serde_json::from_str(json).unwrap();
        assert_eq!(response.candidates.len(), 1);
        let candidate = &response.candidates[0];
        assert!(candidate.content.is_some());
        let content = candidate.content.as_ref().unwrap();
        assert_eq!(content.role, "model");
        assert_eq!(content.parts[0].text, "Hello! How can I help?");

        let usage = response.usage_metadata.as_ref().unwrap();
        assert_eq!(usage.total_token_count, Some(15));
    }

    #[test]
    fn test_gemini_error_response_deserialization() {
        let json = r#"{
            "candidates": [],
            "error": {
                "code": 400,
                "message": "Invalid API key",
                "status": "INVALID_ARGUMENT"
            }
        }"#;

        let response: GeminiResponse = serde_json::from_str(json).unwrap();
        assert!(response.candidates.is_empty());
        let error = response.error.as_ref().unwrap();
        assert_eq!(error.code, Some(400));
        assert_eq!(error.message.as_deref(), Some("Invalid API key"));
    }

    #[test]
    fn test_ai_status_serialization() {
        let status = AiStatus {
            status: AiServiceStatus::Ready,
            model: AiModel::default(),
            has_api_key: true,
            request_count: 5,
            total_tokens_used: 1234,
            last_error: None,
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"status\":\"ready\""));
        assert!(json.contains("\"has_api_key\":true"));
        assert!(json.contains("\"request_count\":5"));
    }

    #[test]
    fn test_ai_chat_message_serialization() {
        let msg = AiChatMessage {
            id: "msg-1".to_string(),
            role: AiChatRole::Assistant,
            content: "Here is a summary...".to_string(),
            timestamp: 1700000000,
            action: Some(AiAction::Summarize),
            tokens_used: Some(150),
        };

        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"role\":\"assistant\""));
        assert!(json.contains("\"action\":\"summarize\""));
    }

    #[test]
    fn test_summarize_request_serialization() {
        let req = SummarizeRequest {
            conversation_id: "conv-123".to_string(),
            is_group: false,
            message_limit: Some(50),
        };

        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("\"conversation_id\":\"conv-123\""));
        assert!(json.contains("\"message_limit\":50"));
    }

    #[test]
    fn test_smart_reply_response_deserialization() {
        let json = r#"{
            "suggestions": ["Sounds good!", "Let me check.", "Thanks for letting me know."],
            "tokens_used": 42,
            "model": "gemini-2.5-flash"
        }"#;

        let resp: SmartReplyResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.suggestions.len(), 3);
        assert_eq!(resp.suggestions[0], "Sounds good!");
        assert_eq!(resp.tokens_used, 42);
    }

    #[test]
    fn test_analyze_response_deserialization() {
        let json = r#"{
            "tone": "friendly",
            "topics": ["project updates", "weekend plans"],
            "activity": "moderately active",
            "insights": ["Conversation is mostly casual"],
            "tokens_used": 200,
            "model": "gemini-2.5-flash"
        }"#;

        let resp: AnalyzeResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.tone, "friendly");
        assert_eq!(resp.topics.len(), 2);
        assert_eq!(resp.insights.len(), 1);
    }
}
