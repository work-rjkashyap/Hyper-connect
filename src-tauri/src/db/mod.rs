//! Database Module
//!
//! SQLite persistence layer using sqlx.
//! Stores messages, threads, file transfers, and group chats so history survives app restarts.
//! Includes FTS5 full-text search indexes for messages, group messages, and file transfers.

pub mod groups;
pub mod messages;
pub mod search;
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

    // ── Migrations (additive, idempotent) ─────────────────────────────────────

    // Add compression columns to file_transfers (Feature #20)
    // ALTER TABLE … ADD COLUMN is a no-op if the column already exists in SQLite
    // when wrapped with IF NOT EXISTS-style guards.  SQLite doesn't support
    // IF NOT EXISTS on ADD COLUMN, so we check the pragma first.
    {
        let columns: Vec<(String,)> = sqlx::query_as(
            "SELECT name FROM pragma_table_info('file_transfers')",
        )
        .fetch_all(pool)
        .await?;

        let col_names: Vec<&str> = columns.iter().map(|c| c.0.as_str()).collect();

        if !col_names.contains(&"compression") {
            sqlx::query(
                "ALTER TABLE file_transfers ADD COLUMN compression TEXT",
            )
            .execute(pool)
            .await?;
            println!("✓ Migration: added 'compression' column to file_transfers");
        }

        if !col_names.contains(&"compression_ratio") {
            sqlx::query(
                "ALTER TABLE file_transfers ADD COLUMN compression_ratio REAL",
            )
            .execute(pool)
            .await?;
            println!("✓ Migration: added 'compression_ratio' column to file_transfers");
        }

        if !col_names.contains(&"parallel_streams") {
            sqlx::query(
                "ALTER TABLE file_transfers ADD COLUMN parallel_streams INTEGER NOT NULL DEFAULT 1",
            )
            .execute(pool)
            .await?;
            println!("✓ Migration: added 'parallel_streams' column to file_transfers");
        }
    }

    // ── FTS5 Full-Text Search Indexes (Feature #18) ───────────────────────────
    //
    // We use "content-sync" FTS5 tables backed by triggers so the FTS index
    // is always in sync with the source tables without any application-level
    // bookkeeping.  The `content=` and `content_rowid=` options tell FTS5
    // where the authoritative data lives; the triggers fire on INSERT, UPDATE,
    // and DELETE to keep the index current.
    //
    // NOTE: FTS5 content-sync tables require the source table to have an
    // INTEGER PRIMARY KEY (rowid).  Our tables use TEXT primary keys, so we
    // use "external content" mode and manually manage the index via triggers
    // that reference the implicit `rowid` column that SQLite provides.

    // ── Messages FTS ──────────────────────────────────────────────────────────
    sqlx::query(
        "CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
            content,
            from_device_id,
            to_device_id,
            conversation_key,
            msg_type,
            content=messages,
            content_rowid=rowid,
            tokenize='unicode61 remove_diacritics 2'
        )",
    )
    .execute(pool)
    .await?;

    // Trigger: after INSERT on messages → insert into FTS
    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS messages_fts_insert
         AFTER INSERT ON messages BEGIN
             INSERT INTO messages_fts(rowid, content, from_device_id, to_device_id, conversation_key, msg_type)
             VALUES (new.rowid, new.content, new.from_device_id, new.to_device_id, new.conversation_key, new.msg_type);
         END",
    )
    .execute(pool)
    .await?;

    // Trigger: after DELETE on messages → remove from FTS
    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS messages_fts_delete
         AFTER DELETE ON messages BEGIN
             INSERT INTO messages_fts(messages_fts, rowid, content, from_device_id, to_device_id, conversation_key, msg_type)
             VALUES ('delete', old.rowid, old.content, old.from_device_id, old.to_device_id, old.conversation_key, old.msg_type);
         END",
    )
    .execute(pool)
    .await?;

    // Trigger: after UPDATE on messages → update FTS (delete old + insert new)
    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS messages_fts_update
         AFTER UPDATE ON messages BEGIN
             INSERT INTO messages_fts(messages_fts, rowid, content, from_device_id, to_device_id, conversation_key, msg_type)
             VALUES ('delete', old.rowid, old.content, old.from_device_id, old.to_device_id, old.conversation_key, old.msg_type);
             INSERT INTO messages_fts(rowid, content, from_device_id, to_device_id, conversation_key, msg_type)
             VALUES (new.rowid, new.content, new.from_device_id, new.to_device_id, new.conversation_key, new.msg_type);
         END",
    )
    .execute(pool)
    .await?;

    // ── Group Messages FTS ────────────────────────────────────────────────────
    sqlx::query(
        "CREATE VIRTUAL TABLE IF NOT EXISTS group_messages_fts USING fts5(
            content,
            from_device_id,
            group_id,
            msg_type,
            content=group_messages,
            content_rowid=rowid,
            tokenize='unicode61 remove_diacritics 2'
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS group_messages_fts_insert
         AFTER INSERT ON group_messages BEGIN
             INSERT INTO group_messages_fts(rowid, content, from_device_id, group_id, msg_type)
             VALUES (new.rowid, new.content, new.from_device_id, new.group_id, new.msg_type);
         END",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS group_messages_fts_delete
         AFTER DELETE ON group_messages BEGIN
             INSERT INTO group_messages_fts(group_messages_fts, rowid, content, from_device_id, group_id, msg_type)
             VALUES ('delete', old.rowid, old.content, old.from_device_id, old.group_id, old.msg_type);
         END",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS group_messages_fts_update
         AFTER UPDATE ON group_messages BEGIN
             INSERT INTO group_messages_fts(group_messages_fts, rowid, content, from_device_id, group_id, msg_type)
             VALUES ('delete', old.rowid, old.content, old.from_device_id, old.group_id, old.msg_type);
             INSERT INTO group_messages_fts(rowid, content, from_device_id, group_id, msg_type)
             VALUES (new.rowid, new.content, new.from_device_id, new.group_id, new.msg_type);
         END",
    )
    .execute(pool)
    .await?;

    // ── File Transfers FTS ────────────────────────────────────────────────────
    sqlx::query(
        "CREATE VIRTUAL TABLE IF NOT EXISTS file_transfers_fts USING fts5(
            filename,
            from_device_id,
            to_device_id,
            status,
            content=file_transfers,
            content_rowid=rowid,
            tokenize='unicode61 remove_diacritics 2'
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS file_transfers_fts_insert
         AFTER INSERT ON file_transfers BEGIN
             INSERT INTO file_transfers_fts(rowid, filename, from_device_id, to_device_id, status)
             VALUES (new.rowid, new.filename, new.from_device_id, new.to_device_id, new.status);
         END",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS file_transfers_fts_delete
         AFTER DELETE ON file_transfers BEGIN
             INSERT INTO file_transfers_fts(file_transfers_fts, rowid, filename, from_device_id, to_device_id, status)
             VALUES ('delete', old.rowid, old.filename, old.from_device_id, old.to_device_id, old.status);
         END",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TRIGGER IF NOT EXISTS file_transfers_fts_update
         AFTER UPDATE ON file_transfers BEGIN
             INSERT INTO file_transfers_fts(file_transfers_fts, rowid, filename, from_device_id, to_device_id, status)
             VALUES ('delete', old.rowid, old.filename, old.from_device_id, old.to_device_id, old.status);
             INSERT INTO file_transfers_fts(rowid, filename, from_device_id, to_device_id, status)
             VALUES (new.rowid, new.filename, new.from_device_id, new.to_device_id, new.status);
         END",
    )
    .execute(pool)
    .await?;

    // ── Backfill FTS indexes for existing data ────────────────────────────────
    // Only runs if the FTS tables are empty (first migration).  Subsequent
    // launches skip this because triggers keep the indexes in sync.
    {
        let msg_fts_count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM messages_fts")
                .fetch_one(pool)
                .await
                .unwrap_or((0,));

        if msg_fts_count.0 == 0 {
            let source_count: (i64,) =
                sqlx::query_as("SELECT COUNT(*) FROM messages")
                    .fetch_one(pool)
                    .await
                    .unwrap_or((0,));

            if source_count.0 > 0 {
                sqlx::query(
                    "INSERT INTO messages_fts(rowid, content, from_device_id, to_device_id, conversation_key, msg_type)
                     SELECT rowid, content, from_device_id, to_device_id, conversation_key, msg_type FROM messages",
                )
                .execute(pool)
                .await?;
                println!("✓ FTS backfill: indexed {} existing message(s)", source_count.0);
            }
        }

        let grp_fts_count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM group_messages_fts")
                .fetch_one(pool)
                .await
                .unwrap_or((0,));

        if grp_fts_count.0 == 0 {
            let source_count: (i64,) =
                sqlx::query_as("SELECT COUNT(*) FROM group_messages")
                    .fetch_one(pool)
                    .await
                    .unwrap_or((0,));

            if source_count.0 > 0 {
                sqlx::query(
                    "INSERT INTO group_messages_fts(rowid, content, from_device_id, group_id, msg_type)
                     SELECT rowid, content, from_device_id, group_id, msg_type FROM group_messages",
                )
                .execute(pool)
                .await?;
                println!("✓ FTS backfill: indexed {} existing group message(s)", source_count.0);
            }
        }

        let ft_fts_count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM file_transfers_fts")
                .fetch_one(pool)
                .await
                .unwrap_or((0,));

        if ft_fts_count.0 == 0 {
            let source_count: (i64,) =
                sqlx::query_as("SELECT COUNT(*) FROM file_transfers")
                    .fetch_one(pool)
                    .await
                    .unwrap_or((0,));

            if source_count.0 > 0 {
                sqlx::query(
                    "INSERT INTO file_transfers_fts(rowid, filename, from_device_id, to_device_id, status)
                     SELECT rowid, filename, from_device_id, to_device_id, status FROM file_transfers",
                )
                .execute(pool)
                .await?;
                println!("✓ FTS backfill: indexed {} existing file transfer(s)", source_count.0);
            }
        }
    }

    println!("✓ FTS5 search indexes ready");

    Ok(())
}
