//! Full-Text Search repository (Feature #18)
//!
//! Uses SQLite FTS5 virtual tables to provide instant search across
//! messages, group messages, and file transfers — all offline, no internet.
//!
//! The FTS5 indexes are kept in sync with the source tables via triggers
//! (see `db/mod.rs` migrations).  This module only reads from them.

use crate::db::DbPool;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::Row;

// ============================================================================
// Search Result Types
// ============================================================================

/// A single search result from the messages table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageSearchResult {
    /// Original message ID
    pub id: String,
    /// Conversation key (sorted device IDs joined by underscore)
    pub conversation_key: String,
    pub from_device_id: String,
    pub to_device_id: String,
    pub msg_type: String,
    pub content: String,
    pub timestamp: i64,
    /// FTS5 snippet with search term highlighted (wrapped in <b>…</b>)
    pub snippet: String,
    /// FTS5 rank score (lower = more relevant)
    pub rank: f64,
}

/// A single search result from the group_messages table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupMessageSearchResult {
    /// Original group message ID
    pub id: String,
    pub group_id: String,
    pub from_device_id: String,
    pub msg_type: String,
    pub content: String,
    pub timestamp: i64,
    /// FTS5 snippet with search term highlighted
    pub snippet: String,
    pub rank: f64,
}

/// A single search result from the file_transfers table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSearchResult {
    /// Original file transfer ID
    pub id: String,
    pub filename: String,
    pub from_device_id: String,
    pub to_device_id: String,
    pub status: String,
    pub size: u64,
    pub created_at: i64,
    /// FTS5 snippet with search term highlighted
    pub snippet: String,
    pub rank: f64,
}

/// Unified search result that the frontend can discriminate on via the `kind` field.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum SearchResult {
    #[serde(rename = "message")]
    Message(MessageSearchResult),
    #[serde(rename = "group_message")]
    GroupMessage(GroupMessageSearchResult),
    #[serde(rename = "file")]
    File(FileSearchResult),
}

/// Aggregated search response returned by the `search_all` IPC command.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResponse {
    pub query: String,
    pub results: Vec<SearchResult>,
    pub message_count: usize,
    pub group_message_count: usize,
    pub file_count: usize,
    pub total_count: usize,
}

// ============================================================================
// Search Queries
// ============================================================================

/// Sanitise user input for FTS5.
///
/// FTS5 uses a query syntax where certain characters (quotes, colons, etc.)
/// have special meaning.  We wrap each word in double quotes so the user
/// can type anything without causing a syntax error, and append `*` for
/// prefix matching so partial words still find results.
fn sanitise_fts_query(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    // Split on whitespace, quote each token, append prefix wildcard
    trimmed
        .split_whitespace()
        .map(|word| {
            // Strip any existing quotes from the word
            let clean = word.replace('"', "");
            if clean.is_empty() {
                return String::new();
            }
            format!("\"{}\"*", clean)
        })
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

/// Search direct messages using FTS5.
///
/// Returns up to `limit` results ranked by relevance.
/// Optionally filter by `conversation_key` to search within a specific chat.
pub async fn search_messages(
    pool: &DbPool,
    query: &str,
    conversation_key: Option<&str>,
    limit: u32,
) -> Result<Vec<MessageSearchResult>> {
    let fts_query = sanitise_fts_query(query);
    if fts_query.is_empty() {
        return Ok(vec![]);
    }

    let rows = if let Some(conv_key) = conversation_key {
        // Scoped search within a single conversation
        sqlx::query(
            "SELECT m.id, m.conversation_key, m.from_device_id, m.to_device_id,
                    m.msg_type, m.content, m.timestamp,
                    snippet(messages_fts, 0, '<b>', '</b>', '…', 48) AS snippet,
                    rank
             FROM   messages_fts
             JOIN   messages m ON m.rowid = messages_fts.rowid
             WHERE  messages_fts MATCH ?1
               AND  m.conversation_key = ?2
             ORDER  BY rank
             LIMIT  ?3",
        )
        .bind(&fts_query)
        .bind(conv_key)
        .bind(limit)
        .fetch_all(pool)
        .await?
    } else {
        // Global search across all conversations
        sqlx::query(
            "SELECT m.id, m.conversation_key, m.from_device_id, m.to_device_id,
                    m.msg_type, m.content, m.timestamp,
                    snippet(messages_fts, 0, '<b>', '</b>', '…', 48) AS snippet,
                    rank
             FROM   messages_fts
             JOIN   messages m ON m.rowid = messages_fts.rowid
             WHERE  messages_fts MATCH ?1
             ORDER  BY rank
             LIMIT  ?2",
        )
        .bind(&fts_query)
        .bind(limit)
        .fetch_all(pool)
        .await?
    };

    let results = rows
        .iter()
        .map(|row| MessageSearchResult {
            id: row.get("id"),
            conversation_key: row.get("conversation_key"),
            from_device_id: row.get("from_device_id"),
            to_device_id: row.get("to_device_id"),
            msg_type: row.get("msg_type"),
            content: row.get("content"),
            timestamp: row.get("timestamp"),
            snippet: row.get("snippet"),
            rank: row.get("rank"),
        })
        .collect();

    Ok(results)
}

/// Search group messages using FTS5.
///
/// Returns up to `limit` results ranked by relevance.
/// Optionally filter by `group_id` to search within a specific group.
pub async fn search_group_messages(
    pool: &DbPool,
    query: &str,
    group_id: Option<&str>,
    limit: u32,
) -> Result<Vec<GroupMessageSearchResult>> {
    let fts_query = sanitise_fts_query(query);
    if fts_query.is_empty() {
        return Ok(vec![]);
    }

    let rows = if let Some(gid) = group_id {
        sqlx::query(
            "SELECT gm.id, gm.group_id, gm.from_device_id, gm.msg_type,
                    gm.content, gm.timestamp,
                    snippet(group_messages_fts, 0, '<b>', '</b>', '…', 48) AS snippet,
                    rank
             FROM   group_messages_fts
             JOIN   group_messages gm ON gm.rowid = group_messages_fts.rowid
             WHERE  group_messages_fts MATCH ?1
               AND  gm.group_id = ?2
             ORDER  BY rank
             LIMIT  ?3",
        )
        .bind(&fts_query)
        .bind(gid)
        .bind(limit)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query(
            "SELECT gm.id, gm.group_id, gm.from_device_id, gm.msg_type,
                    gm.content, gm.timestamp,
                    snippet(group_messages_fts, 0, '<b>', '</b>', '…', 48) AS snippet,
                    rank
             FROM   group_messages_fts
             JOIN   group_messages gm ON gm.rowid = group_messages_fts.rowid
             WHERE  group_messages_fts MATCH ?1
             ORDER  BY rank
             LIMIT  ?2",
        )
        .bind(&fts_query)
        .bind(limit)
        .fetch_all(pool)
        .await?
    };

    let results = rows
        .iter()
        .map(|row| GroupMessageSearchResult {
            id: row.get("id"),
            group_id: row.get("group_id"),
            from_device_id: row.get("from_device_id"),
            msg_type: row.get("msg_type"),
            content: row.get("content"),
            timestamp: row.get("timestamp"),
            snippet: row.get("snippet"),
            rank: row.get("rank"),
        })
        .collect();

    Ok(results)
}

/// Search file transfers by filename using FTS5.
///
/// Returns up to `limit` results ranked by relevance.
pub async fn search_files(
    pool: &DbPool,
    query: &str,
    limit: u32,
) -> Result<Vec<FileSearchResult>> {
    let fts_query = sanitise_fts_query(query);
    if fts_query.is_empty() {
        return Ok(vec![]);
    }

    let rows = sqlx::query(
        "SELECT ft.id, ft.filename, ft.from_device_id, ft.to_device_id,
                ft.status, ft.size, ft.created_at,
                snippet(file_transfers_fts, 0, '<b>', '</b>', '…', 48) AS snippet,
                rank
         FROM   file_transfers_fts
         JOIN   file_transfers ft ON ft.rowid = file_transfers_fts.rowid
         WHERE  file_transfers_fts MATCH ?1
         ORDER  BY rank
         LIMIT  ?2",
    )
    .bind(&fts_query)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    let results = rows
        .iter()
        .map(|row| FileSearchResult {
            id: row.get("id"),
            filename: row.get("filename"),
            from_device_id: row.get("from_device_id"),
            to_device_id: row.get("to_device_id"),
            status: row.get("status"),
            size: row.get::<i64, _>("size") as u64,
            created_at: row.get("created_at"),
            snippet: row.get("snippet"),
            rank: row.get("rank"),
        })
        .collect();

    Ok(results)
}

/// Search across all content types (messages, group messages, files).
///
/// Runs the three sub-queries concurrently and merges results into a
/// single `SearchResponse` sorted by relevance (FTS5 rank).
///
/// `limit` controls per-category cap (total results can be up to 3× limit).
pub async fn search_all(
    pool: &DbPool,
    query: &str,
    limit: u32,
) -> Result<SearchResponse> {
    let (messages, group_messages, files) = tokio::try_join!(
        search_messages(pool, query, None, limit),
        search_group_messages(pool, query, None, limit),
        search_files(pool, query, limit),
    )?;

    let message_count = messages.len();
    let group_message_count = group_messages.len();
    let file_count = files.len();

    // Merge into a single Vec<SearchResult> and sort by rank (ascending = best first)
    let mut results: Vec<SearchResult> = Vec::with_capacity(
        message_count + group_message_count + file_count,
    );

    for m in messages {
        let rank = m.rank;
        results.push(SearchResult::Message(MessageSearchResult { ..m }));
        // Ensure rank is propagated (it already is, but this makes it explicit)
        if let Some(SearchResult::Message(ref mut last)) = results.last_mut() {
            last.rank = rank;
        }
    }

    for gm in group_messages {
        results.push(SearchResult::GroupMessage(gm));
    }

    for f in files {
        results.push(SearchResult::File(f));
    }

    // Sort by rank (FTS5 rank is negative; more negative = more relevant)
    results.sort_by(|a, b| {
        let rank_a = match a {
            SearchResult::Message(m) => m.rank,
            SearchResult::GroupMessage(gm) => gm.rank,
            SearchResult::File(f) => f.rank,
        };
        let rank_b = match b {
            SearchResult::Message(m) => m.rank,
            SearchResult::GroupMessage(gm) => gm.rank,
            SearchResult::File(f) => f.rank,
        };
        rank_a.partial_cmp(&rank_b).unwrap_or(std::cmp::Ordering::Equal)
    });

    let total_count = results.len();

    Ok(SearchResponse {
        query: query.to_string(),
        results,
        message_count,
        group_message_count,
        file_count,
        total_count,
    })
}

/// Rebuild all FTS indexes from scratch.
///
/// Useful after a bulk import or if the index somehow gets out of sync.
/// This is an expensive operation but is idempotent and safe.
pub async fn rebuild_fts_indexes(pool: &DbPool) -> Result<()> {
    // Delete all FTS content and re-populate from source tables
    sqlx::query("DELETE FROM messages_fts").execute(pool).await?;
    sqlx::query(
        "INSERT INTO messages_fts(rowid, content, from_device_id, to_device_id, conversation_key, msg_type)
         SELECT rowid, content, from_device_id, to_device_id, conversation_key, msg_type FROM messages",
    )
    .execute(pool)
    .await?;

    sqlx::query("DELETE FROM group_messages_fts")
        .execute(pool)
        .await?;
    sqlx::query(
        "INSERT INTO group_messages_fts(rowid, content, from_device_id, group_id, msg_type)
         SELECT rowid, content, from_device_id, group_id, msg_type FROM group_messages",
    )
    .execute(pool)
    .await?;

    sqlx::query("DELETE FROM file_transfers_fts")
        .execute(pool)
        .await?;
    sqlx::query(
        "INSERT INTO file_transfers_fts(rowid, filename, from_device_id, to_device_id, status)
         SELECT rowid, filename, from_device_id, to_device_id, status FROM file_transfers",
    )
    .execute(pool)
    .await?;

    println!("✓ FTS indexes rebuilt");
    Ok(())
}

/// Clear all FTS indexes (used by "Reset App").
pub async fn clear_fts_indexes(pool: &DbPool) -> Result<()> {
    sqlx::query("DELETE FROM messages_fts").execute(pool).await?;
    sqlx::query("DELETE FROM group_messages_fts")
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM file_transfers_fts")
        .execute(pool)
        .await?;
    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitise_fts_query_basic() {
        assert_eq!(sanitise_fts_query("hello"), "\"hello\"*");
    }

    #[test]
    fn test_sanitise_fts_query_multiple_words() {
        assert_eq!(
            sanitise_fts_query("hello world"),
            "\"hello\"* \"world\"*"
        );
    }

    #[test]
    fn test_sanitise_fts_query_strips_quotes() {
        assert_eq!(
            sanitise_fts_query("he\"llo wo\"rld"),
            "\"hello\"* \"world\"*"
        );
    }

    #[test]
    fn test_sanitise_fts_query_empty() {
        assert_eq!(sanitise_fts_query(""), "");
        assert_eq!(sanitise_fts_query("   "), "");
    }

    #[test]
    fn test_sanitise_fts_query_special_chars() {
        // Colons, parentheses, etc. should be safe inside double quotes
        assert_eq!(sanitise_fts_query("foo:bar"), "\"foo:bar\"*");
        assert_eq!(sanitise_fts_query("(test)"), "\"(test)\"*");
    }

    #[test]
    fn test_sanitise_fts_query_whitespace_trimming() {
        assert_eq!(
            sanitise_fts_query("  hello   world  "),
            "\"hello\"* \"world\"*"
        );
    }
}
