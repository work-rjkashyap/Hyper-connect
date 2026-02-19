import { useAppStore } from "@/store";

/**
 * Notification sound utility using the Web Audio API.
 *
 * Synthesises a pleasant two-tone chime (no external audio file needed).
 * Respects the `notificationsEnabled` and `soundEnabled` settings from the
 * Zustand store – calling `playNotificationSound()` when either is off is a
 * no-op, so callers don't need to check settings themselves.
 */

let audioCtx: AudioContext | null = null;

/** Lazily initialise a shared AudioContext (reused across calls). */
function getAudioContext(): AudioContext {
	if (!audioCtx || audioCtx.state === "closed") {
		audioCtx = new AudioContext();
	}
	return audioCtx;
}

/**
 * Play a short two-tone notification chime.
 *
 * The sound is a pair of sine-wave tones (C6 → E6) with a gentle fade-in /
 * fade-out envelope so it feels soft and non-intrusive.
 *
 * @param volume  Master volume 0–1 (default 0.3)
 */
export function playNotificationSound(volume = 0.3): void {
	// ── Gate: respect user settings ──────────────────────────────────────
	const { notificationsEnabled, soundEnabled } = useAppStore.getState();
	if (!notificationsEnabled || !soundEnabled) return;

	try {
		const ctx = getAudioContext();

		// Resume context if it was suspended (browser autoplay policy)
		if (ctx.state === "suspended") {
			ctx.resume();
		}

		const now = ctx.currentTime;

		// ── Master gain ──────────────────────────────────────────────────
		const masterGain = ctx.createGain();
		masterGain.gain.setValueAtTime(volume, now);
		masterGain.connect(ctx.destination);

		// ── Tone 1: C6 (1046.5 Hz) ──────────────────────────────────────
		playTone(ctx, masterGain, 1046.5, now, 0.12);

		// ── Tone 2: E6 (1318.5 Hz) — starts slightly after ─────────────
		playTone(ctx, masterGain, 1318.5, now + 0.1, 0.14);

		// Disconnect master gain after the sound is done to free resources
		setTimeout(() => {
			masterGain.disconnect();
		}, 400);
	} catch (err) {
		// Silently swallow errors (e.g. AudioContext not supported)
		console.warn("Could not play notification sound:", err);
	}
}

/**
 * Play a single sine-wave tone with a smooth attack / release envelope.
 */
function playTone(
	ctx: AudioContext,
	destination: AudioNode,
	frequency: number,
	startTime: number,
	duration: number,
): void {
	const osc = ctx.createOscillator();
	osc.type = "sine";
	osc.frequency.setValueAtTime(frequency, startTime);

	const env = ctx.createGain();
	// Start silent
	env.gain.setValueAtTime(0, startTime);
	// Quick fade-in
	env.gain.linearRampToValueAtTime(1, startTime + 0.015);
	// Sustain then fade-out
	env.gain.setValueAtTime(1, startTime + duration - 0.04);
	env.gain.linearRampToValueAtTime(0, startTime + duration);

	osc.connect(env);
	env.connect(destination);

	osc.start(startTime);
	osc.stop(startTime + duration);
}
