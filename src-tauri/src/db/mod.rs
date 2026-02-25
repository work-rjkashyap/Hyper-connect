//! Database Module
//!
//! SQLite persistence layer using sqlx.
//! Stores messages, threads, file transfers, and group chats so history survives app restarts.

pub mod groups;
pub mod messages;
pub mod transfers;

use anyhow::Result;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::path::Path;

/// Shared connection pool type — an Arc is not needed because SqlitePool is
/// already internally reference-counted and cheap to clone.
pub type DbPool = SqlitePool;

/// Initialise the SQLite database at `<app_data_dir>/hyper-connect.db`.
///
/// Creates the file and all tables if they do not already exist.
/// Returns a ready-to-use connection pool.
pub async fn init_db(app_data_dir: &Path) -> Result<DbPool> {
    let db_path = app_data_dir.join("hyper-connect.db");

    let options = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true)
        // Enable WAL mode for better concurrent read performance
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        // Reduce fsync calls — acceptable for a local-only app
        .synchronous(sqlx::sqlite::SqliteSynchronous::Normal);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    run_migrations(&pool).await?;

    println!("✓ SQLite database ready at {:?}", db_path);
    Ok(pool)
}

/// Create all tables if they don't exist (idempotent).
async fn run_migrations(pool: &DbPool) -> Result<()> {
    // ── Messages ─────────────────────────────────────────────────────────────
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS messages (
            id               TEXT    PRIMARY KEY NOT NULL,
            conversation_key TEXT    NOT NULL,
            from_device_id   TEXT    NOT NULL,
            to_device_id     TEXT    NOT NULL,
            msg_type         TEXT    NOT NULL,
            content          TEXT    NOT NULL,
            reply_to         TEXT,
            status           TEXT    NOT NULL DEFAULT 'sent',
            timestamp        INTEGER NOT NULL,
            thread_id        TEXT,
            created_at       INTEGER NOT NULL
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_messages_conv_ts
             ON messages (conversation_key, timestamp)",
    )
    .execute(pool)
    .await?;

    // ── Threads ───────────────────────────────────────────────────────────────
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS threads (
            conversation_key        TEXT    PRIMARY KEY NOT NULL,
            id                      TEXT    NOT NULL,
            participant_1           TEXT    NOT NULL,
            participant_2           TEXT    NOT NULL,
            last_message_timestamp  INTEGER NOT NULL DEFAULT 0,
            unread_count            INTEGER NOT NULL DEFAULT 0
        )",
    )
    .execute(pool)
    .await?;

    // ── File transfers ────────────────────────────────────────────────────────
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS file_transfers (
            id             TEXT    PRIMARY KEY NOT NULL,
            filename       TEXT    NOT NULL,
            file_path      TEXT,
            size           INTEGER NOT NULL DEFAULT 0,
            transferred    INTEGER NOT NULL DEFAULT 0,
            status         TEXT    NOT NULL DEFAULT 'pending',
            from_device_id TEXT    NOT NULL,
            to_device_id   TEXT    NOT NULL,
            checksum       TEXT,
            speed_bps      REAL    NOT NULL DEFAULT 0.0,
            eta_seconds    INTEGER,
            created_at     INTEGER NOT NULL,
            updated_at     INTEGER NOT NULL
        )",
    )
    .execute(pool)
    .await?;

    // ── Groups ────────────────────────────────────────────────────────────────
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS groups (
            id                TEXT    PRIMARY KEY NOT NULL,
            name              TEXT    NOT NULL,
            creator_device_id TEXT    NOT NULL,
            host_device_id    TEXT    NOT NULL,
            created_at        INTEGER NOT NULL,
            updated_at        INTEGER NOT NULL
        )",
    )
    .execute(pool)
    .await?;

    // ── Group members ─────────────────────────────────────────────────────────
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS group_members (
            group_id   TEXT    NOT NULL,
            device_id  TEXT    NOT NULL,
            role       TEXT    NOT NULL DEFAULT 'member',
            joined_at  INTEGER NOT NULL,
            PRIMARY KEY (group_id, device_id),
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_group_members_device
             ON group_members (device_id)",
    )
    .execute(pool)
    .await?;

    // ── Group messages ────────────────────────────────────────────────────────
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS group_messages (
            id              TEXT    PRIMARY KEY NOT NULL,
            group_id        TEXT    NOT NULL,
            from_device_id  TEXT    NOT NULL,
            msg_type        TEXT    NOT NULL DEFAULT 'text',
            content         TEXT    NOT NULL,
            reply_to        TEXT,
            timestamp       INTEGER NOT NULL,
            created_at      INTEGER NOT NULL,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_group_messages_group_ts
             ON group_messages (group_id, timestamp)",
    )
    .execute(pool)
    .await?;

    Ok(())
}
