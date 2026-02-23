import { useAppStore } from "@/store";
import newMessageSoundUrl from "@/assets/sound/new-message.mp3";
import notificationSoundUrl from "@/assets/sound/notification-sound.mp3";

/**
 * Notification sound utility.
 *
 * Plays one of two MP3 files depending on whether the sender's chat is
 * currently open on screen:
 *
 *   chatIsOpen = true  → new-message.mp3        (subtle in-chat ping)
 *   chatIsOpen = false → notification-sound.mp3  (background notification)
 *
 * Gate rules:
 *   - In-chat ping   : only requires `soundEnabled`
 *   - Background tone: requires both `notificationsEnabled` AND `soundEnabled`
 *
 * A module-level reference to the currently playing audio is kept so that:
 *   - A new sound stops any previous one before starting (no overlaps)
 *   - The reference is cleared when playback ends or is aborted
 *
 * @param chatIsOpen  Whether the sender's chat window is currently visible
 * @param volume      Master volume 0–1 (defaults: 0.4 in-chat, 0.6 background)
 */

// Module-level ref — tracks the currently playing Audio instance
let currentAudio: HTMLAudioElement | null = null;

export function playNotificationSound(
	chatIsOpen = false,
	volume?: number,
): void {
	const { notificationsEnabled, soundEnabled } = useAppStore.getState();

	// ── Gate: respect user settings ──────────────────────────────────────
	// In-chat ping is UX feedback, not a notification — only needs soundEnabled.
	// Background notification needs both flags.
	if (!soundEnabled) return;
	if (!chatIsOpen && !notificationsEnabled) return;

	// ── Default volume differs per context ───────────────────────────────
	const effectiveVolume = volume ?? (chatIsOpen ? 0.4 : 0.6);
	const url = chatIsOpen ? newMessageSoundUrl : notificationSoundUrl;

	try {
		// ── Stop any currently playing sound before starting a new one ───
		if (currentAudio) {
			currentAudio.pause();
			currentAudio.currentTime = 0;
			currentAudio = null;
		}

		const audio = new Audio(url);
		audio.volume = effectiveVolume;
		currentAudio = audio;

		// Clear the ref once playback finishes naturally
		audio.addEventListener("ended", () => {
			currentAudio = null;
		});

		audio.play().catch((err) => {
			// Browser autoplay policy rejection — clear ref and warn
			currentAudio = null;
			console.warn("Could not play notification sound:", err);
		});
	} catch (err) {
		currentAudio = null;
		console.warn("Could not play notification sound:", err);
	}
}
