//! Screen Share Service
//!
//! Manages screen capture, JPEG encoding, and UDP frame streaming for LAN screen sharing.
//! The broadcaster captures screen frames, encodes them as JPEG, and streams over UDP.
//! The viewer listens on a UDP socket, reassembles frames, and emits them to the frontend.

use crate::discovery::MdnsDiscoveryService;
use crate::network::TcpClient;
use crate::screen_share::types::*;
use serde::Serialize;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::net::UdpSocket;
use tokio::sync::{watch, Mutex, RwLock};

/// Interval between streaming stats emissions (in seconds).
const STATS_INTERVAL_SECS: u64 = 2;

/// How many frames to skip before emitting stats.
const STATS_FRAME_INTERVAL: u64 = 60;

/// Timeout for waiting on viewer frames before considering the stream dead (in seconds).
const VIEWER_TIMEOUT_SECS: u64 = 5;

/// Port range for screen share UDP sockets.
const STREAM_PORT_START: u16 = 9100;
const STREAM_PORT_END: u16 = 9200;

// ============================================================================
// SERVICE
// ============================================================================

/// Manages screen share sessions, capture, and streaming.
#[derive(Clone)]
pub struct ScreenShareService {
    /// Active sessions keyed by session_id.
    sessions: Arc<RwLock<HashMap<String, ScreenShareSession>>>,
    /// Cancellation senders for active broadcast/view tasks, keyed by session_id.
    cancel_senders: Arc<Mutex<HashMap<String, watch::Sender<bool>>>>,
    /// Local device ID (set during init).
    local_device_id: String,
    /// Local display name.
    local_display_name: String,
    /// Reference to the TCP client for sending signaling messages.
    tcp_client: Option<Arc<TcpClient>>,
    /// TCP port used for signaling.
    tcp_port: u16,
}

impl ScreenShareService {
    /// Create a new ScreenShareService.
    pub fn new(local_device_id: String, local_display_name: String) -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            cancel_senders: Arc::new(Mutex::new(HashMap::new())),
            local_device_id,
            local_display_name,
            tcp_client: None,
            tcp_port: 8080,
        }
    }

    /// Set the TCP client for signaling.
    pub fn set_tcp_client(&mut self, client: Arc<TcpClient>) {
        self.tcp_client = Some(client);
    }

    /// Set the TCP port for signaling.
    pub fn set_tcp_port(&mut self, port: u16) {
        self.tcp_port = port;
    }

    // ========================================================================
    // SESSION MANAGEMENT
    // ========================================================================

    /// Get all active sessions.
    pub async fn get_sessions(&self) -> Vec<ScreenShareSession> {
        let sessions = self.sessions.read().await;
        sessions.values().cloned().collect()
    }

    /// Get a specific session by ID.
    pub async fn get_session(&self, session_id: &str) -> Option<ScreenShareSession> {
        let sessions = self.sessions.read().await;
        sessions.get(session_id).cloned()
    }

    /// Check if we are currently broadcasting any session.
    pub async fn is_broadcasting(&self) -> bool {
        let sessions = self.sessions.read().await;
        sessions.values().any(|s| {
            s.broadcaster_id == self.local_device_id
                && s.state == ScreenShareState::Streaming
        })
    }

    /// Check if we are currently viewing any session.
    pub async fn is_viewing(&self) -> bool {
        let sessions = self.sessions.read().await;
        sessions.values().any(|s| {
            s.viewer_id == self.local_device_id
                && s.state == ScreenShareState::Streaming
        })
    }

    /// Find an available UDP port in our range.
    async fn find_available_port() -> Result<u16, String> {
        for port in STREAM_PORT_START..=STREAM_PORT_END {
            match UdpSocket::bind(format!("0.0.0.0:{}", port)).await {
                Ok(_sock) => return Ok(port),
                Err(_) => continue,
            }
        }
        Err("No available UDP port for screen sharing".to_string())
    }

    // ========================================================================
    // BROADCASTER: OFFER → CAPTURE → STREAM
    // ========================================================================

    /// Start a screen share offer to a remote device.
    ///
    /// 1. Finds an available UDP port
    /// 2. Creates a session in Offering state
    /// 3. Sends the offer via encrypted TCP
    /// 4. Waits for the viewer's answer (handled by `handle_answer`)
    pub async fn start_offer(
        &self,
        viewer_device_id: String,
        viewer_display_name: String,
        quality: StreamQuality,
        display_index: u32,
        app_handle: AppHandle,
    ) -> Result<String, String> {
        // Check if already broadcasting
        if self.is_broadcasting().await {
            return Err("Already broadcasting a screen share session".to_string());
        }

        // Find an available port
        let stream_port = Self::find_available_port().await?;

        // Generate session ID
        let session_id = uuid::Uuid::new_v4().to_string();

        // Get screen dimensions (placeholder — actual capture will determine real size)
        let (screen_width, screen_height) = get_primary_screen_size();

        // Create session
        let mut session = ScreenShareSession::new(
            session_id.clone(),
            self.local_device_id.clone(),
            self.local_display_name.clone(),
            viewer_device_id.clone(),
            viewer_display_name.clone(),
            quality,
            stream_port,
            display_index,
        );
        session.state = ScreenShareState::Offering;
        session.screen_width = screen_width;
        session.screen_height = screen_height;

        // Store session
        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(session_id.clone(), session.clone());
        }

        // Send offer via TCP signaling
        let offer = ScreenShareOfferPayload {
            msg_type: "SCREEN_SHARE_OFFER".to_string(),
            session_id: session_id.clone(),
            from_device_id: self.local_device_id.clone(),
            from_display_name: self.local_display_name.clone(),
            to_device_id: viewer_device_id.clone(),
            quality,
            display_index,
            stream_port,
            screen_width,
            screen_height,
        };

        self.send_signaling_message(&viewer_device_id, &offer, &app_handle)
            .await?;

        // Emit state change
        let _ = app_handle.emit(
            "screen-share-state-changed",
            ScreenShareStateChangedEvent {
                session_id: session_id.clone(),
                state: ScreenShareState::Offering,
                role: "broadcaster".to_string(),
                peer_device_id: viewer_device_id,
                peer_display_name: viewer_display_name,
            },
        );

        println!(
            "📺 Screen share offer sent: session={}, port={}",
            session_id, stream_port
        );

        Ok(session_id)
    }

    /// Handle an incoming screen share offer (called on the viewer side).
    pub async fn handle_offer(
        &self,
        offer: ScreenShareOfferPayload,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        // Create session in AwaitingAcceptance state
        let mut session = ScreenShareSession::new(
            offer.session_id.clone(),
            offer.from_device_id.clone(),
            offer.from_display_name.clone(),
            self.local_device_id.clone(),
            self.local_display_name.clone(),
            offer.quality,
            offer.stream_port,
            offer.display_index,
        );
        session.state = ScreenShareState::AwaitingAcceptance;
        session.screen_width = offer.screen_width;
        session.screen_height = offer.screen_height;

        // Store session
        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(offer.session_id.clone(), session);
        }

        // Emit to frontend so the UI can show accept/reject dialog
        let _ = app_handle.emit(
            "screen-share-offer",
            ScreenShareOfferEvent {
                session_id: offer.session_id.clone(),
                from_device_id: offer.from_device_id.clone(),
                from_display_name: offer.from_display_name.clone(),
                quality: offer.quality,
                screen_width: offer.screen_width,
                screen_height: offer.screen_height,
            },
        );

        let _ = app_handle.emit(
            "screen-share-state-changed",
            ScreenShareStateChangedEvent {
                session_id: offer.session_id,
                state: ScreenShareState::AwaitingAcceptance,
                role: "viewer".to_string(),
                peer_device_id: offer.from_device_id,
                peer_display_name: offer.from_display_name,
            },
        );

        Ok(())
    }

    /// Accept or reject a screen share offer (called by the viewer).
    pub async fn answer_offer(
        &self,
        session_id: String,
        accepted: bool,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let session = {
            let sessions = self.sessions.read().await;
            sessions
                .get(&session_id)
                .cloned()
                .ok_or_else(|| format!("Session {} not found", session_id))?
        };

        if session.state != ScreenShareState::AwaitingAcceptance {
            return Err(format!(
                "Session {} is not awaiting acceptance (state: {:?})",
                session_id, session.state
            ));
        }

        // Send answer via TCP signaling
        let answer = ScreenShareAnswerPayload {
            msg_type: "SCREEN_SHARE_ANSWER".to_string(),
            session_id: session_id.clone(),
            from_device_id: self.local_device_id.clone(),
            to_device_id: session.broadcaster_id.clone(),
            accepted,
            reason: if accepted {
                None
            } else {
                Some("User declined".to_string())
            },
        };

        self.send_signaling_message(&session.broadcaster_id, &answer, &app_handle)
            .await?;

        if accepted {
            // Update session state
            {
                let mut sessions = self.sessions.write().await;
                if let Some(s) = sessions.get_mut(&session_id) {
                    s.state = ScreenShareState::Streaming;
                    s.updated_at = chrono::Utc::now().timestamp();
                }
            }

            // Start the viewer receive loop
            let service = self.clone();
            let ah = app_handle.clone();
            let sid = session_id.clone();
            tokio::spawn(async move {
                if let Err(e) = service.run_viewer(sid.clone(), ah.clone()).await {
                    eprintln!("❌ Viewer error for session {}: {}", sid, e);
                    service.cleanup_session(&sid).await;
                    let _ = ah.emit(
                        "screen-share-stopped",
                        ScreenShareStoppedEvent {
                            session_id: sid,
                            from_device_id: String::new(),
                            reason: Some(format!("Viewer error: {}", e)),
                        },
                    );
                }
            });

            let _ = app_handle.emit(
                "screen-share-state-changed",
                ScreenShareStateChangedEvent {
                    session_id: session_id.clone(),
                    state: ScreenShareState::Streaming,
                    role: "viewer".to_string(),
                    peer_device_id: session.broadcaster_id.clone(),
                    peer_display_name: session.broadcaster_name.clone(),
                },
            );

            println!("✅ Accepted screen share: session={}", session_id);
        } else {
            // Remove session
            self.cleanup_session(&session_id).await;

            let _ = app_handle.emit(
                "screen-share-state-changed",
                ScreenShareStateChangedEvent {
                    session_id: session_id.clone(),
                    state: ScreenShareState::Idle,
                    role: "viewer".to_string(),
                    peer_device_id: session.broadcaster_id.clone(),
                    peer_display_name: session.broadcaster_name.clone(),
                },
            );

            println!("❌ Rejected screen share: session={}", session_id);
        }

        Ok(())
    }

    /// Handle an incoming answer from the viewer (called on the broadcaster side).
    pub async fn handle_answer(
        &self,
        answer: ScreenShareAnswerPayload,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let session = {
            let sessions = self.sessions.read().await;
            sessions
                .get(&answer.session_id)
                .cloned()
                .ok_or_else(|| format!("Session {} not found", answer.session_id))?
        };

        // Emit answer event to frontend
        let _ = app_handle.emit(
            "screen-share-answer",
            ScreenShareAnswerEvent {
                session_id: answer.session_id.clone(),
                from_device_id: answer.from_device_id.clone(),
                accepted: answer.accepted,
                reason: answer.reason.clone(),
            },
        );

        if answer.accepted {
            // Update session to Streaming
            {
                let mut sessions = self.sessions.write().await;
                if let Some(s) = sessions.get_mut(&answer.session_id) {
                    s.state = ScreenShareState::Streaming;
                    s.updated_at = chrono::Utc::now().timestamp();
                }
            }

            // Resolve the viewer's IP address
            let viewer_addr = self
                .resolve_peer_address(&session.viewer_id, &app_handle)
                .await?;

            // Start the broadcaster capture & stream loop
            let service = self.clone();
            let ah = app_handle.clone();
            let sid = answer.session_id.clone();
            tokio::spawn(async move {
                if let Err(e) = service
                    .run_broadcaster(sid.clone(), viewer_addr, ah.clone())
                    .await
                {
                    eprintln!("❌ Broadcaster error for session {}: {}", sid, e);
                    service.cleanup_session(&sid).await;
                    let _ = ah.emit(
                        "screen-share-stopped",
                        ScreenShareStoppedEvent {
                            session_id: sid,
                            from_device_id: String::new(),
                            reason: Some(format!("Broadcast error: {}", e)),
                        },
                    );
                }
            });

            let _ = app_handle.emit(
                "screen-share-state-changed",
                ScreenShareStateChangedEvent {
                    session_id: answer.session_id.clone(),
                    state: ScreenShareState::Streaming,
                    role: "broadcaster".to_string(),
                    peer_device_id: session.viewer_id.clone(),
                    peer_display_name: session.viewer_name.clone(),
                },
            );

            println!(
                "✅ Viewer accepted, starting broadcast: session={}",
                answer.session_id
            );
        } else {
            // Viewer rejected — clean up
            self.cleanup_session(&answer.session_id).await;

            let _ = app_handle.emit(
                "screen-share-state-changed",
                ScreenShareStateChangedEvent {
                    session_id: answer.session_id.clone(),
                    state: ScreenShareState::Idle,
                    role: "broadcaster".to_string(),
                    peer_device_id: session.viewer_id.clone(),
                    peer_display_name: session.viewer_name.clone(),
                },
            );

            println!(
                "❌ Viewer rejected screen share: session={}, reason={:?}",
                answer.session_id, answer.reason
            );
        }

        Ok(())
    }

    /// Stop an active screen share session (can be called by either side).
    pub async fn stop_session(
        &self,
        session_id: String,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let session = {
            let sessions = self.sessions.read().await;
            sessions
                .get(&session_id)
                .cloned()
                .ok_or_else(|| format!("Session {} not found", session_id))?
        };

        let peer_device_id = if session.broadcaster_id == self.local_device_id {
            session.viewer_id.clone()
        } else {
            session.broadcaster_id.clone()
        };

        // Send stop signal to the peer
        let stop = ScreenShareStopPayload {
            msg_type: "SCREEN_SHARE_STOP".to_string(),
            session_id: session_id.clone(),
            from_device_id: self.local_device_id.clone(),
            to_device_id: peer_device_id.clone(),
            reason: Some("user_stopped".to_string()),
        };

        // Best-effort signaling — don't fail if the peer is gone
        let _ = self
            .send_signaling_message(&peer_device_id, &stop, &app_handle)
            .await;

        // Cancel the streaming task
        {
            let mut senders = self.cancel_senders.lock().await;
            if let Some(sender) = senders.remove(&session_id) {
                let _ = sender.send(true);
            }
        }

        // Clean up session
        self.cleanup_session(&session_id).await;

        let role = if session.broadcaster_id == self.local_device_id {
            "broadcaster"
        } else {
            "viewer"
        };

        let peer_name = if role == "broadcaster" {
            session.viewer_name.clone()
        } else {
            session.broadcaster_name.clone()
        };

        let _ = app_handle.emit(
            "screen-share-stopped",
            ScreenShareStoppedEvent {
                session_id: session_id.clone(),
                from_device_id: self.local_device_id.clone(),
                reason: Some("user_stopped".to_string()),
            },
        );

        let _ = app_handle.emit(
            "screen-share-state-changed",
            ScreenShareStateChangedEvent {
                session_id: session_id.clone(),
                state: ScreenShareState::Idle,
                role: role.to_string(),
                peer_device_id,
                peer_display_name: peer_name,
            },
        );

        println!("🛑 Screen share stopped: session={}", session_id);

        Ok(())
    }

    /// Handle an incoming stop signal from the remote peer.
    pub async fn handle_stop(
        &self,
        stop: ScreenShareStopPayload,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        // Cancel the streaming task
        {
            let mut senders = self.cancel_senders.lock().await;
            if let Some(sender) = senders.remove(&stop.session_id) {
                let _ = sender.send(true);
            }
        }

        let session = {
            let sessions = self.sessions.read().await;
            sessions.get(&stop.session_id).cloned()
        };

        self.cleanup_session(&stop.session_id).await;

        let _ = app_handle.emit(
            "screen-share-stopped",
            ScreenShareStoppedEvent {
                session_id: stop.session_id.clone(),
                from_device_id: stop.from_device_id.clone(),
                reason: stop.reason.clone(),
            },
        );

        if let Some(session) = session {
            let role = if session.broadcaster_id == self.local_device_id {
                "broadcaster"
            } else {
                "viewer"
            };
            let peer_name = if role == "broadcaster" {
                session.viewer_name.clone()
            } else {
                session.broadcaster_name.clone()
            };

            let _ = app_handle.emit(
                "screen-share-state-changed",
                ScreenShareStateChangedEvent {
                    session_id: stop.session_id.clone(),
                    state: ScreenShareState::Idle,
                    role: role.to_string(),
                    peer_device_id: stop.from_device_id.clone(),
                    peer_display_name: peer_name,
                },
            );
        }

        println!(
            "🛑 Remote stopped screen share: session={}, reason={:?}",
            stop.session_id, stop.reason
        );

        Ok(())
    }

    // ========================================================================
    // BROADCASTER LOOP: Capture screen → JPEG encode → UDP stream
    // ========================================================================

    /// Run the broadcaster loop: capture screen frames, encode as JPEG, and stream via UDP.
    async fn run_broadcaster(
        &self,
        session_id: String,
        viewer_addr: SocketAddr,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let session = self
            .get_session(&session_id)
            .await
            .ok_or("Session not found")?;

        let quality = session.quality;
        let display_index = session.display_index;
        let stream_port = session.stream_port;

        // Bind UDP socket
        let socket = UdpSocket::bind(format!("0.0.0.0:{}", stream_port))
            .await
            .map_err(|e| format!("Failed to bind UDP socket on port {}: {}", stream_port, e))?;

        let viewer_target = SocketAddr::new(viewer_addr.ip(), stream_port);

        println!(
            "📺 Broadcasting to {} on UDP port {}",
            viewer_target, stream_port
        );

        // Create cancellation channel
        let (cancel_tx, mut cancel_rx) = watch::channel(false);
        {
            let mut senders = self.cancel_senders.lock().await;
            senders.insert(session_id.clone(), cancel_tx);
        }

        let frame_interval = tokio::time::Duration::from_millis(quality.frame_interval_ms());
        let session_id_bytes = ScreenShareFrameHeader::uuid_to_bytes(&session_id);

        let mut frame_seq: u32 = 0;
        let mut total_bytes: u64 = 0;
        let mut dropped_frames: u64 = 0;
        let mut last_stats_time = tokio::time::Instant::now();
        let mut frames_since_stats: u64 = 0;

        loop {
            // Check for cancellation
            if *cancel_rx.borrow() {
                println!("📺 Broadcaster cancelled: session={}", session_id);
                break;
            }

            let frame_start = tokio::time::Instant::now();

            // Capture and encode a screen frame
            match capture_screen_frame(display_index, &quality) {
                Ok(frame_data) => {
                    let frame_width = frame_data.width;
                    let frame_height = frame_data.height;
                    let jpeg_data = &frame_data.jpeg_bytes;

                    // Split into UDP chunks
                    let total_chunks =
                        ((jpeg_data.len() + MAX_CHUNK_DATA - 1) / MAX_CHUNK_DATA) as u16;

                    let mut send_failed = false;
                    for chunk_idx in 0..total_chunks {
                        let start = chunk_idx as usize * MAX_CHUNK_DATA;
                        let end = std::cmp::min(start + MAX_CHUNK_DATA, jpeg_data.len());
                        let chunk_data = &jpeg_data[start..end];

                        let header = ScreenShareFrameHeader {
                            session_id_bytes,
                            frame_seq,
                            chunk_index: chunk_idx,
                            total_chunks,
                            chunk_size: chunk_data.len() as u32,
                            frame_width: frame_width as u16,
                            frame_height: frame_height as u16,
                        };

                        let header_bytes = header.encode();
                        let mut packet =
                            Vec::with_capacity(FRAME_HEADER_SIZE + chunk_data.len());
                        packet.extend_from_slice(&header_bytes);
                        packet.extend_from_slice(chunk_data);

                        match socket.send_to(&packet, viewer_target).await {
                            Ok(n) => {
                                total_bytes += n as u64;
                            }
                            Err(e) => {
                                eprintln!("⚠️ UDP send error: {}", e);
                                send_failed = true;
                                break;
                            }
                        }
                    }

                    if send_failed {
                        dropped_frames += 1;
                    }

                    frame_seq = frame_seq.wrapping_add(1);
                    frames_since_stats += 1;
                }
                Err(e) => {
                    eprintln!("⚠️ Screen capture error: {}", e);
                    dropped_frames += 1;
                }
            }

            // Emit stats periodically
            let elapsed_stats = last_stats_time.elapsed();
            if elapsed_stats.as_secs() >= STATS_INTERVAL_SECS
                || frames_since_stats >= STATS_FRAME_INTERVAL
            {
                let fps = frames_since_stats as f32 / elapsed_stats.as_secs_f32();
                let avg_frame_size = if frames_since_stats > 0 {
                    total_bytes / frames_since_stats
                } else {
                    0
                };

                let _ = app_handle.emit(
                    "screen-share-stats",
                    ScreenShareStatsEvent {
                        session_id: session_id.clone(),
                        fps,
                        avg_frame_size,
                        total_bytes,
                        latency_ms: 0, // Would need round-trip measurement
                        dropped_frames,
                    },
                );

                last_stats_time = tokio::time::Instant::now();
                frames_since_stats = 0;
            }

            // Wait for next frame interval (accounting for capture + encode time)
            let elapsed = frame_start.elapsed();
            if elapsed < frame_interval {
                tokio::select! {
                    _ = tokio::time::sleep(frame_interval - elapsed) => {},
                    _ = cancel_rx.changed() => {
                        if *cancel_rx.borrow() {
                            break;
                        }
                    }
                }
            }
        }

        println!(
            "📺 Broadcaster finished: session={}, frames={}, bytes={}",
            session_id, frame_seq, total_bytes
        );

        Ok(())
    }

    // ========================================================================
    // VIEWER LOOP: Receive UDP frames → reassemble → emit to frontend
    // ========================================================================

    /// Run the viewer loop: receive UDP datagrams, reassemble frames, and emit to frontend.
    async fn run_viewer(
        &self,
        session_id: String,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let session = self
            .get_session(&session_id)
            .await
            .ok_or("Session not found")?;

        let stream_port = session.stream_port;

        // Bind UDP socket on the same port
        let socket = UdpSocket::bind(format!("0.0.0.0:{}", stream_port))
            .await
            .map_err(|e| format!("Failed to bind UDP socket on port {}: {}", stream_port, e))?;

        println!(
            "👁️ Viewer listening on UDP port {} for session {}",
            stream_port, session_id
        );

        // Create cancellation channel
        let (cancel_tx, mut cancel_rx) = watch::channel(false);
        {
            let mut senders = self.cancel_senders.lock().await;
            senders.insert(session_id.clone(), cancel_tx);
        }

        let session_id_bytes = ScreenShareFrameHeader::uuid_to_bytes(&session_id);
        let mut recv_buf = vec![0u8; MAX_UDP_PAYLOAD + 64]; // Extra space for safety

        // Frame reassembly buffer: frame_seq → (chunks_received, total_chunks, data_vec)
        let mut frame_buffer: HashMap<u32, FrameAssembly> = HashMap::new();
        let mut last_emitted_seq: u32 = 0;

        let mut total_bytes: u64 = 0;
        let mut dropped_frames: u64 = 0;
        let mut last_stats_time = tokio::time::Instant::now();
        let mut frames_since_stats: u64 = 0;

        let timeout_duration = tokio::time::Duration::from_secs(VIEWER_TIMEOUT_SECS);

        loop {
            let recv_result = tokio::select! {
                result = socket.recv_from(&mut recv_buf) => Some(result),
                _ = cancel_rx.changed() => {
                    if *cancel_rx.borrow() {
                        break;
                    }
                    continue;
                }
                _ = tokio::time::sleep(timeout_duration) => {
                    eprintln!("⚠️ Viewer timeout: no frames for {}s, session={}", VIEWER_TIMEOUT_SECS, session_id);
                    break;
                }
            };

            let (n, _addr) = match recv_result {
                Some(Ok(v)) => v,
                Some(Err(e)) => {
                    eprintln!("⚠️ UDP recv error: {}", e);
                    continue;
                }
                None => continue,
            };

            if n < FRAME_HEADER_SIZE {
                continue;
            }

            let header = match ScreenShareFrameHeader::decode(&recv_buf[..n]) {
                Some(h) => h,
                None => continue,
            };

            // Verify session ID
            if header.session_id_bytes != session_id_bytes {
                continue;
            }

            total_bytes += n as u64;

            let chunk_data = &recv_buf[FRAME_HEADER_SIZE..FRAME_HEADER_SIZE + header.chunk_size as usize];

            // Add chunk to reassembly buffer
            let assembly = frame_buffer
                .entry(header.frame_seq)
                .or_insert_with(|| FrameAssembly::new(header.total_chunks, header.frame_width, header.frame_height));

            assembly.add_chunk(header.chunk_index, chunk_data);

            // Check if frame is complete
            if assembly.is_complete() {
                let jpeg_data = assembly.assemble();
                let frame_width = assembly.frame_width;
                let frame_height = assembly.frame_height;

                // Clean up frame buffer (remove this frame and any older incomplete frames)
                frame_buffer.retain(|seq, _| *seq > header.frame_seq);

                // Only emit if this frame is newer than the last emitted
                if header.frame_seq >= last_emitted_seq || last_emitted_seq == 0 {
                    last_emitted_seq = header.frame_seq + 1;

                    // Emit the frame as base64 to the frontend
                    let frame_base64 = base64::Engine::encode(
                        &base64::engine::general_purpose::STANDARD,
                        &jpeg_data,
                    );

                    let _ = app_handle.emit(
                        "screen-share-frame",
                        serde_json::json!({
                            "session_id": session_id,
                            "frame_seq": header.frame_seq,
                            "width": frame_width,
                            "height": frame_height,
                            "jpeg_base64": frame_base64,
                        }),
                    );

                    frames_since_stats += 1;
                } else {
                    dropped_frames += 1;
                }
            }

            // Emit stats periodically
            let elapsed_stats = last_stats_time.elapsed();
            if elapsed_stats.as_secs() >= STATS_INTERVAL_SECS {
                let fps = frames_since_stats as f32 / elapsed_stats.as_secs_f32();

                let _ = app_handle.emit(
                    "screen-share-stats",
                    ScreenShareStatsEvent {
                        session_id: session_id.clone(),
                        fps,
                        avg_frame_size: if frames_since_stats > 0 {
                            total_bytes / frames_since_stats
                        } else {
                            0
                        },
                        total_bytes,
                        latency_ms: 0,
                        dropped_frames,
                    },
                );

                last_stats_time = tokio::time::Instant::now();
                frames_since_stats = 0;
            }

            // Clean up very old incomplete frames (more than 30 frames behind)
            if header.frame_seq > 30 {
                let cutoff = header.frame_seq - 30;
                let old_count = frame_buffer.len();
                frame_buffer.retain(|seq, _| *seq >= cutoff);
                dropped_frames += (old_count - frame_buffer.len()) as u64;
            }
        }

        println!(
            "👁️ Viewer finished: session={}, bytes={}",
            session_id, total_bytes
        );

        Ok(())
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    /// Clean up a session from all internal state.
    async fn cleanup_session(&self, session_id: &str) {
        {
            let mut sessions = self.sessions.write().await;
            sessions.remove(session_id);
        }
        {
            let mut senders = self.cancel_senders.lock().await;
            if let Some(sender) = senders.remove(session_id) {
                let _ = sender.send(true);
            }
        }
    }

    /// Send a signaling message to a peer via the existing encrypted TCP channel.
    async fn send_signaling_message<T: Serialize>(
        &self,
        peer_device_id: &str,
        payload: &T,
        app_handle: &AppHandle,
    ) -> Result<(), String> {
        let tcp_client = self
            .tcp_client
            .as_ref()
            .ok_or("TCP client not available")?;

        // Look up the peer address from mDNS discovery
        let peer_address = {
            if let Some(discovery) = app_handle.try_state::<Arc<MdnsDiscoveryService>>() {
                let devices = discovery.get_devices().await;
                devices
                    .iter()
                    .find(|d| d.id == peer_device_id)
                    .and_then(|d| d.addresses.first().cloned())
                    .ok_or_else(|| format!("Peer {} not found in discovery", peer_device_id))?
            } else {
                return Err("Discovery service not available".to_string());
            }
        };

        let json = serde_json::to_vec(payload)
            .map_err(|e| format!("Failed to serialize signaling payload: {}", e))?;

        tcp_client
            .send_text_message(peer_device_id, &peer_address, self.tcp_port, json)
            .await
            .map_err(|e| format!("Failed to send signaling message: {}", e))?;

        Ok(())
    }

    /// Resolve a peer's network address from mDNS discovery.
    async fn resolve_peer_address(
        &self,
        peer_device_id: &str,
        app_handle: &AppHandle,
    ) -> Result<SocketAddr, String> {
        if let Some(discovery) = app_handle.try_state::<Arc<MdnsDiscoveryService>>() {
            let devices = discovery.get_devices().await;
            let device = devices
                .iter()
                .find(|d| d.id == peer_device_id)
                .ok_or_else(|| format!("Peer {} not found in discovery", peer_device_id))?;

            let addr_str = device
                .addresses
                .first()
                .ok_or("Peer has no addresses")?;

            let port = device.port;
            let ip: std::net::IpAddr = addr_str
                .parse()
                .map_err(|e| format!("Invalid peer IP address '{}': {}", addr_str, e))?;

            Ok(SocketAddr::new(ip, port))
        } else {
            Err("Discovery service not available".to_string())
        }
    }
}

// ============================================================================
// FRAME REASSEMBLY
// ============================================================================

/// Holds chunks for a single frame being reassembled on the viewer side.
struct FrameAssembly {
    total_chunks: u16,
    received: Vec<Option<Vec<u8>>>,
    chunks_received: u16,
    frame_width: u16,
    frame_height: u16,
}

impl FrameAssembly {
    fn new(total_chunks: u16, frame_width: u16, frame_height: u16) -> Self {
        Self {
            total_chunks,
            received: vec![None; total_chunks as usize],
            chunks_received: 0,
            frame_width,
            frame_height,
        }
    }

    fn add_chunk(&mut self, chunk_index: u16, data: &[u8]) {
        let idx = chunk_index as usize;
        if idx < self.received.len() && self.received[idx].is_none() {
            self.received[idx] = Some(data.to_vec());
            self.chunks_received += 1;
        }
    }

    fn is_complete(&self) -> bool {
        self.chunks_received == self.total_chunks
    }

    fn assemble(&self) -> Vec<u8> {
        let mut data = Vec::new();
        for chunk in &self.received {
            if let Some(bytes) = chunk {
                data.extend_from_slice(bytes);
            }
        }
        data
    }
}

// ============================================================================
// SCREEN CAPTURE (platform-specific)
// ============================================================================

/// Captured screen frame data.
struct CapturedFrame {
    /// JPEG-encoded bytes
    jpeg_bytes: Vec<u8>,
    /// Width of the captured frame
    width: u32,
    /// Height of the captured frame
    height: u32,
}

/// Get the primary screen dimensions.
/// Returns (width, height). Falls back to a sensible default.
fn get_primary_screen_size() -> (u32, u32) {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        // Use system_profiler to get display resolution on macOS
        if let Ok(output) = Command::new("system_profiler")
            .args(["SPDisplaysDataType", "-json"])
            .output()
        {
            if let Ok(text) = String::from_utf8(output.stdout) {
                // Parse resolution from JSON output
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                    if let Some(displays) = json
                        .get("SPDisplaysDataType")
                        .and_then(|d| d.as_array())
                        .and_then(|arr| arr.first())
                        .and_then(|gpu| gpu.get("spdisplays_ndrvs"))
                        .and_then(|d| d.as_array())
                        .and_then(|arr| arr.first())
                    {
                        let resolution = displays
                            .get("_spdisplays_resolution")
                            .and_then(|r| r.as_str())
                            .unwrap_or("");
                        // Format is like "2560 x 1440"
                        let parts: Vec<&str> = resolution.split(" x ").collect();
                        if parts.len() == 2 {
                            if let (Ok(w), Ok(h)) = (
                                parts[0].trim().parse::<u32>(),
                                parts[1].trim().parse::<u32>(),
                            ) {
                                return (w, h);
                            }
                        }
                    }
                }
            }
        }
        (1920, 1080) // Default
    }

    #[cfg(target_os = "windows")]
    {
        // On Windows, use GetSystemMetrics
        (1920, 1080) // Placeholder — would use winapi
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        // Use xdpyinfo or xrandr
        if let Ok(output) = Command::new("xrandr")
            .arg("--current")
            .output()
        {
            if let Ok(text) = String::from_utf8(output.stdout) {
                for line in text.lines() {
                    if line.contains("*") {
                        // Current resolution line, e.g. "   1920x1080     60.00*+"
                        let parts: Vec<&str> = line.trim().split_whitespace().collect();
                        if let Some(res) = parts.first() {
                            let dims: Vec<&str> = res.split('x').collect();
                            if dims.len() == 2 {
                                if let (Ok(w), Ok(h)) = (
                                    dims[0].parse::<u32>(),
                                    dims[1].parse::<u32>(),
                                ) {
                                    return (w, h);
                                }
                            }
                        }
                    }
                }
            }
        }
        (1920, 1080)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        (1920, 1080)
    }
}

/// Capture a single screen frame and encode it as JPEG.
///
/// This uses platform-specific screen capture APIs:
/// - macOS: `screencapture` command (simple and reliable)
/// - Windows/Linux: equivalent tools
///
/// For production use, this would be replaced with a proper screen capture
/// library (e.g., `scap`, `xcap`, or direct CoreGraphics/DXGI calls).
fn capture_screen_frame(
    display_index: u32,
    quality: &StreamQuality,
) -> Result<CapturedFrame, String> {
    use std::io::Read;

    let temp_path = std::env::temp_dir().join(format!(
        "hyper_connect_screenshare_{}.jpg",
        std::process::id()
    ));

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        let _jpeg_quality_pct = quality.jpeg_quality();

        // Use screencapture with JPEG format
        // -x: no sound, -C: no cursor, -t jpg: JPEG format
        let mut args = vec![
            "-x".to_string(),
            "-t".to_string(),
            "jpg".to_string(),
        ];

        // Display selection (macOS screencapture uses -D flag for display index)
        if display_index > 0 {
            args.push("-D".to_string());
            args.push((display_index + 1).to_string()); // macOS uses 1-based indexing
        }

        args.push(temp_path.to_string_lossy().to_string());

        let output = Command::new("screencapture")
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to run screencapture: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "screencapture failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;

        // Try scrot first, fallback to gnome-screenshot
        let result = Command::new("scrot")
            .args([
                "--quality",
                &quality.jpeg_quality().to_string(),
                &temp_path.to_string_lossy(),
            ])
            .output();

        if result.is_err() || !result.as_ref().unwrap().status.success() {
            Command::new("gnome-screenshot")
                .args(["-f", &temp_path.to_string_lossy()])
                .output()
                .map_err(|e| format!("Failed to capture screen: {}", e))?;
        }
    }

    #[cfg(target_os = "windows")]
    {
        // On Windows, we'd use DXGI Desktop Duplication or GDI
        // For now, use a placeholder approach
        return Err("Screen capture not yet implemented for Windows".to_string());
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        return Err("Screen capture not supported on this platform".to_string());
    }

    // Read the captured JPEG file
    let mut file = std::fs::File::open(&temp_path)
        .map_err(|e| format!("Failed to open captured frame: {}", e))?;

    let mut jpeg_bytes = Vec::new();
    file.read_to_end(&mut jpeg_bytes)
        .map_err(|e| format!("Failed to read captured frame: {}", e))?;

    // Clean up temp file (best-effort)
    let _ = std::fs::remove_file(&temp_path);

    if jpeg_bytes.is_empty() {
        return Err("Captured frame is empty".to_string());
    }

    // Get dimensions from the screen info (we already know them)
    let (screen_w, screen_h) = get_primary_screen_size();

    // Apply downscaling if quality preset limits resolution
    let max_w = quality.max_width();
    let max_h = quality.max_height();

    let (final_w, final_h) = if max_w > 0 && max_h > 0 && (screen_w > max_w || screen_h > max_h) {
        let scale = f64::min(max_w as f64 / screen_w as f64, max_h as f64 / screen_h as f64);
        (
            (screen_w as f64 * scale) as u32,
            (screen_h as f64 * scale) as u32,
        )
    } else {
        (screen_w, screen_h)
    };

    Ok(CapturedFrame {
        jpeg_bytes,
        width: final_w,
        height: final_h,
    })
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_service_creation() {
        let service = ScreenShareService::new("device-1".into(), "Test Device".into());
        assert_eq!(service.local_device_id, "device-1");
        assert_eq!(service.local_display_name, "Test Device");
    }

    #[tokio::test]
    async fn test_no_active_sessions() {
        let service = ScreenShareService::new("device-1".into(), "Test Device".into());
        assert!(!service.is_broadcasting().await);
        assert!(!service.is_viewing().await);
        assert!(service.get_sessions().await.is_empty());
    }

    #[test]
    fn test_frame_assembly() {
        let mut assembly = FrameAssembly::new(3, 1920, 1080);
        assert!(!assembly.is_complete());

        assembly.add_chunk(0, b"chunk0");
        assembly.add_chunk(1, b"chunk1");
        assert!(!assembly.is_complete());

        assembly.add_chunk(2, b"chunk2");
        assert!(assembly.is_complete());

        let data = assembly.assemble();
        assert_eq!(data, b"chunk0chunk1chunk2");
    }

    #[test]
    fn test_frame_assembly_duplicate_chunk() {
        let mut assembly = FrameAssembly::new(2, 1920, 1080);
        assembly.add_chunk(0, b"chunk0");
        assembly.add_chunk(0, b"duplicate"); // Should be ignored
        assert_eq!(assembly.chunks_received, 1);

        assembly.add_chunk(1, b"chunk1");
        assert!(assembly.is_complete());

        let data = assembly.assemble();
        assert_eq!(data, b"chunk0chunk1");
    }

    #[test]
    fn test_get_primary_screen_size() {
        let (w, h) = get_primary_screen_size();
        assert!(w > 0);
        assert!(h > 0);
    }

    #[test]
    fn test_find_port_range() {
        assert!(STREAM_PORT_START < STREAM_PORT_END);
        assert!(STREAM_PORT_START >= 9100);
    }
}
