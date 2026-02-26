//! File Transfer repository
//!
//! All SQL operations for persisting file transfer state.

use crate::db::DbPool;
use crate::network::file_transfer::{FileTransfer, TransferStatus};
use anyhow::Result;
use sqlx::Row;

// ── Helpers ───────────────────────────────────────────────────────────────────

fn status_to_str(status: &TransferStatus) -> &'static str {
    match status {
        TransferStatus::Pending => "pending",
        TransferStatus::InProgress => "in_progress",
        TransferStatus::Paused => "paused",
        TransferStatus::Completed => "completed",
        TransferStatus::Failed => "failed",
        TransferStatus::Cancelled => "cancelled",
        TransferStatus::Rejected => "rejected",
        TransferStatus::AwaitingAcceptance => "awaiting_acceptance",
    }
}

fn str_to_status(s: &str) -> TransferStatus {
    match s {
        "in_progress" => TransferStatus::InProgress,
        "paused" => TransferStatus::Paused,
        "completed" => TransferStatus::Completed,
        "failed" => TransferStatus::Failed,
        "cancelled" => TransferStatus::Cancelled,
        "rejected" => TransferStatus::Rejected,
        "awaiting_acceptance" => TransferStatus::AwaitingAcceptance,
        _ => TransferStatus::Pending,
    }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/// Insert a new transfer record.  Uses `INSERT OR IGNORE` — safe to call
/// multiple times with the same transfer ID.
pub async fn insert_transfer(pool: &DbPool, transfer: &FileTransfer) -> Result<()> {
    sqlx::query(
        "INSERT OR IGNORE INTO file_transfers
             (id, filename, file_path, size, transferred, status,
              from_device_id, to_device_id, checksum, speed_bps,
              eta_seconds, created_at, updated_at,
              compression, compression_ratio, parallel_streams)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&transfer.id)
    .bind(&transfer.filename)
    .bind(&transfer.file_path)
    .bind(transfer.size as i64)
    .bind(transfer.transferred as i64)
    .bind(status_to_str(&transfer.status))
    .bind(&transfer.from_device_id)
    .bind(&transfer.to_device_id)
    .bind(&transfer.checksum)
    .bind(transfer.speed_bps)
    .bind(transfer.eta_seconds.map(|e| e as i64))
    .bind(transfer.created_at)
    .bind(transfer.updated_at)
    .bind(&transfer.compression)
    .bind(transfer.compression_ratio)
    .bind(transfer.parallel_streams as i64)
    .execute(pool)
    .await?;
    Ok(())
}

/// Update only the status and `updated_at` timestamp of a transfer.
pub async fn update_transfer_status(
    pool: &DbPool,
    transfer_id: &str,
    status: &TransferStatus,
    updated_at: i64,
) -> Result<()> {
    sqlx::query(
        "UPDATE file_transfers
         SET    status = ?, updated_at = ?
         WHERE  id = ?",
    )
    .bind(status_to_str(status))
    .bind(updated_at)
    .bind(transfer_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Update the local file path (set when receiver accepts the transfer).
pub async fn update_transfer_file_path(
    pool: &DbPool,
    transfer_id: &str,
    file_path: &str,
    updated_at: i64,
) -> Result<()> {
    sqlx::query(
        "UPDATE file_transfers
         SET    file_path = ?, updated_at = ?
         WHERE  id = ?",
    )
    .bind(file_path)
    .bind(updated_at)
    .bind(transfer_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Update transfer on completion: final byte count, checksum, status.
pub async fn complete_transfer(
    pool: &DbPool,
    transfer_id: &str,
    transferred: u64,
    checksum: &str,
    updated_at: i64,
) -> Result<()> {
    sqlx::query(
        "UPDATE file_transfers
         SET    status = 'completed', transferred = ?,
                checksum = ?, updated_at = ?
         WHERE  id = ?",
    )
    .bind(transferred as i64)
    .bind(checksum)
    .bind(updated_at)
    .bind(transfer_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Load all transfer records, ordered by creation time (newest first).
pub async fn get_transfers(pool: &DbPool) -> Result<Vec<FileTransfer>> {
    let rows = sqlx::query(
        "SELECT id, filename, file_path, size, transferred, status,
                from_device_id, to_device_id, checksum, speed_bps,
                eta_seconds, created_at, updated_at,
                compression, compression_ratio, parallel_streams
         FROM   file_transfers
         ORDER  BY created_at DESC",
    )
    .fetch_all(pool)
    .await?;

    let transfers = rows
        .iter()
        .map(|row| {
            let eta_seconds: Option<i64> = row.get("eta_seconds");
            let status_str: String = row.get("status");
            let compression_ratio: Option<f64> = row.get("compression_ratio");
            FileTransfer {
                id: row.get("id"),
                filename: row.get("filename"),
                file_path: row.get("file_path"),
                size: row.get::<i64, _>("size") as u64,
                transferred: row.get::<i64, _>("transferred") as u64,
                status: str_to_status(&status_str),
                from_device_id: row.get("from_device_id"),
                to_device_id: row.get("to_device_id"),
                checksum: row.get("checksum"),
                speed_bps: row.get("speed_bps"),
                eta_seconds: eta_seconds.map(|e| e as u64),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                compression: row.get("compression"),
                compression_ratio,
                parallel_streams: row.get::<i64, _>("parallel_streams") as u8,
            }
        })
        .collect();

    Ok(transfers)
}

/// Persist transfer progress (transferred bytes) to the database.
///
/// Called periodically during an active transfer so that resume can pick up
/// from the last confirmed offset if the app crashes or the connection drops.
pub async fn update_transfer_progress(
    pool: &DbPool,
    transfer_id: &str,
    transferred: u64,
    updated_at: i64,
) -> Result<()> {
    sqlx::query(
        "UPDATE file_transfers
         SET    transferred = ?, updated_at = ?
         WHERE  id = ?",
    )
    .bind(transferred as i64)
    .bind(updated_at)
    .bind(transfer_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Load transfers that can be resumed — those with status `paused` or `failed`
/// that have already received some data (`transferred > 0`).
///
/// Results are ordered by most-recently-updated first.
pub async fn get_resumable_transfers(pool: &DbPool) -> Result<Vec<FileTransfer>> {
    let rows = sqlx::query(
        "SELECT id, filename, file_path, size, transferred, status,
                from_device_id, to_device_id, checksum, speed_bps,
                eta_seconds, created_at, updated_at,
                compression, compression_ratio, parallel_streams
         FROM   file_transfers
         WHERE  status IN ('paused', 'failed', 'in_progress')
                AND transferred > 0
                AND transferred < size
         ORDER  BY updated_at DESC",
    )
    .fetch_all(pool)
    .await?;

    let transfers = rows
        .iter()
        .map(|row| {
            let eta_seconds: Option<i64> = row.get("eta_seconds");
            let status_str: String = row.get("status");
            let compression_ratio: Option<f64> = row.get("compression_ratio");
            FileTransfer {
                id: row.get("id"),
                filename: row.get("filename"),
                file_path: row.get("file_path"),
                size: row.get::<i64, _>("size") as u64,
                transferred: row.get::<i64, _>("transferred") as u64,
                status: str_to_status(&status_str),
                from_device_id: row.get("from_device_id"),
                to_device_id: row.get("to_device_id"),
                checksum: row.get("checksum"),
                speed_bps: row.get("speed_bps"),
                eta_seconds: eta_seconds.map(|e| e as u64),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                compression: row.get("compression"),
                compression_ratio,
                parallel_streams: row.get::<i64, _>("parallel_streams") as u8,
            }
        })
        .collect();

    Ok(transfers)
}

/// Delete all transfer records (used by "Reset App").
pub async fn clear_transfers(pool: &DbPool) -> Result<()> {
    sqlx::query("DELETE FROM file_transfers")
        .execute(pool)
        .await?;
    Ok(())
}
