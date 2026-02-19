import { useMemo } from "react";

interface DateSeparatorProps {
	/** Unix timestamp in seconds */
	timestamp: number;
}

/**
 * Formats a Unix timestamp (seconds) into a human-friendly date label.
 *
 * - Same calendar day as now → "Today"
 * - Previous calendar day   → "Yesterday"
 * - Within the last 7 days  → weekday name, e.g. "Monday"
 * - Same year               → "Mon, Jan 5"
 * - Different year           → "Mon, Jan 5, 2024"
 */
export function formatDateLabel(timestampSeconds: number): string {
	const messageDate = new Date(timestampSeconds * 1000);
	const now = new Date();

	// Strip time to compare calendar days
	const stripTime = (d: Date) =>
		new Date(d.getFullYear(), d.getMonth(), d.getDate());

	const today = stripTime(now);
	const msgDay = stripTime(messageDate);

	const diffMs = today.getTime() - msgDay.getTime();
	const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Yesterday";

	if (diffDays > 1 && diffDays < 7) {
		return messageDate.toLocaleDateString(undefined, { weekday: "long" });
	}

	if (messageDate.getFullYear() === now.getFullYear()) {
		return messageDate.toLocaleDateString(undefined, {
			weekday: "short",
			month: "short",
			day: "numeric",
		});
	}

	return messageDate.toLocaleDateString(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

/**
 * Returns a date-only key string (YYYY-MM-DD) for grouping messages
 * that fall on the same calendar day.
 */
export function getDateKey(timestampSeconds: number): string {
	const d = new Date(timestampSeconds * 1000);
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * A thin horizontal rule with a centred date label, used to visually
 * separate messages that belong to different calendar days.
 */
export default function DateSeparator({ timestamp }: DateSeparatorProps) {
	const label = useMemo(() => formatDateLabel(timestamp), [timestamp]);

	return (
		<div
			className="flex items-center gap-3 py-2 select-none"
			role="separator"
			aria-label={label}
		>
			<div className="flex-1 h-px bg-border" />
			<span className="text-[10px] sm:text-xs font-medium text-muted-foreground tracking-wide uppercase px-2">
				{label}
			</span>
			<div className="flex-1 h-px bg-border" />
		</div>
	);
}
