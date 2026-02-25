import { useMemo } from "react";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import {
	Wifi,
	WifiOff,
	Monitor,
	Activity,
	Signal,
	SignalLow,
	SignalMedium,
	SignalHigh,
} from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

type NetworkQuality = "excellent" | "good" | "fair" | "poor" | "offline";

interface NetworkHealth {
	quality: NetworkQuality;
	label: string;
	deviceCount: number;
	connectedCount: number;
	avgLatencyMs: number | null;
	minLatencyMs: number | null;
	maxLatencyMs: number | null;
}

function computeNetworkHealth(
	devices: { device_id: string }[],
	connectedDevices: Set<string>,
	deviceLatencyMs: Record<string, number>,
): NetworkHealth {
	const deviceCount = devices.length;
	const connectedCount = connectedDevices.size;

	const latencies = Object.values(deviceLatencyMs).filter(
		(ms) => ms > 0 && Number.isFinite(ms),
	);

	const avgLatencyMs =
		latencies.length > 0
			? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
			: null;

	const minLatencyMs =
		latencies.length > 0 ? Math.round(Math.min(...latencies)) : null;

	const maxLatencyMs =
		latencies.length > 0 ? Math.round(Math.max(...latencies)) : null;

	let quality: NetworkQuality;
	let label: string;

	if (deviceCount === 0) {
		quality = "offline";
		label = "No Devices";
	} else if (avgLatencyMs === null) {
		// Devices discovered but no latency data yet
		quality = "fair";
		label = "Discovering";
	} else if (avgLatencyMs <= 5) {
		quality = "excellent";
		label = "Excellent";
	} else if (avgLatencyMs <= 20) {
		quality = "good";
		label = "Strong";
	} else if (avgLatencyMs <= 50) {
		quality = "fair";
		label = "Fair";
	} else {
		quality = "poor";
		label = "Weak";
	}

	return {
		quality,
		label,
		deviceCount,
		connectedCount,
		avgLatencyMs,
		minLatencyMs,
		maxLatencyMs,
	};
}

const qualityConfig: Record<
	NetworkQuality,
	{
		dotColor: string;
		textColor: string;
		bgColor: string;
		borderColor: string;
		pulseColor: string;
	}
> = {
	excellent: {
		dotColor: "bg-emerald-500",
		textColor: "text-emerald-600 dark:text-emerald-400",
		bgColor: "bg-emerald-500/5 dark:bg-emerald-500/10",
		borderColor: "border-emerald-500/20 dark:border-emerald-400/20",
		pulseColor: "bg-emerald-400",
	},
	good: {
		dotColor: "bg-green-500",
		textColor: "text-green-600 dark:text-green-400",
		bgColor: "bg-green-500/5 dark:bg-green-500/10",
		borderColor: "border-green-500/20 dark:border-green-400/20",
		pulseColor: "bg-green-400",
	},
	fair: {
		dotColor: "bg-amber-500",
		textColor: "text-amber-600 dark:text-amber-400",
		bgColor: "bg-amber-500/5 dark:bg-amber-500/10",
		borderColor: "border-amber-500/20 dark:border-amber-400/20",
		pulseColor: "bg-amber-400",
	},
	poor: {
		dotColor: "bg-red-500",
		textColor: "text-red-600 dark:text-red-400",
		bgColor: "bg-red-500/5 dark:bg-red-500/10",
		borderColor: "border-red-500/20 dark:border-red-400/20",
		pulseColor: "bg-red-400",
	},
	offline: {
		dotColor: "bg-muted-foreground/40",
		textColor: "text-muted-foreground",
		bgColor: "bg-muted/30",
		borderColor: "border-border",
		pulseColor: "bg-muted-foreground/30",
	},
};

function SignalIcon({
	quality,
	className,
}: {
	quality: NetworkQuality;
	className?: string;
}) {
	switch (quality) {
		case "excellent":
			return <SignalHigh className={className} />;
		case "good":
			return <SignalHigh className={className} />;
		case "fair":
			return <SignalMedium className={className} />;
		case "poor":
			return <SignalLow className={className} />;
		case "offline":
			return <Signal className={className} />;
	}
}

function formatLatency(ms: number | null): string {
	if (ms === null) return "—";
	if (ms < 1) return "<1ms";
	return `${ms}ms`;
}

export default function NetworkHealthBar() {
	const devices = useAppStore((s) => s.devices);
	const connectedDevices = useAppStore((s) => s.connectedDevices);
	const deviceLatencyMs = useAppStore((s) => s.deviceLatencyMs);

	const health = useMemo(
		() => computeNetworkHealth(devices, connectedDevices, deviceLatencyMs),
		[devices, connectedDevices, deviceLatencyMs],
	);

	const config = qualityConfig[health.quality];

	return (
		<TooltipProvider delayDuration={300}>
			<div
				className={cn(
					"flex items-center justify-between px-3 sm:px-4 py-1.5 sm:py-2",
					"border-b text-xs sm:text-sm select-none shrink-0",
					config.bgColor,
					config.borderColor,
				)}
			>
				{/* Left section: LAN quality */}
				<div className="flex items-center gap-2 sm:gap-3">
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="flex items-center gap-1.5 cursor-default">
								{health.quality === "offline" ? (
									<WifiOff className={cn("h-3.5 w-3.5", config.textColor)} />
								) : (
									<Wifi className={cn("h-3.5 w-3.5", config.textColor)} />
								)}
								<div className="flex items-center gap-1.5">
									{/* Animated status dot */}
									<span className="relative flex h-2 w-2">
										{health.quality !== "offline" && (
											<span
												className={cn(
													"absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
													config.pulseColor,
												)}
											/>
										)}
										<span
											className={cn(
												"relative inline-flex h-2 w-2 rounded-full",
												config.dotColor,
											)}
										/>
									</span>
									<span
										className={cn(
											"font-semibold tracking-wide",
											config.textColor,
										)}
									>
										LAN: {health.label}
									</span>
								</div>
							</div>
						</TooltipTrigger>
						<TooltipContent side="bottom" className="text-xs">
							<div className="space-y-1">
								<p className="font-semibold">Network Quality: {health.label}</p>
								{health.avgLatencyMs !== null && (
									<>
										<p>
											Avg latency:{" "}
											<span className="font-mono">
												{formatLatency(health.avgLatencyMs)}
											</span>
										</p>
										<p>
											Range:{" "}
											<span className="font-mono">
												{formatLatency(health.minLatencyMs)} –{" "}
												{formatLatency(health.maxLatencyMs)}
											</span>
										</p>
									</>
								)}
								{health.avgLatencyMs === null && health.deviceCount > 0 && (
									<p className="text-muted-foreground">
										Waiting for latency data…
									</p>
								)}
							</div>
						</TooltipContent>
					</Tooltip>

					{/* Separator */}
					<div className="h-3.5 w-px bg-border" />

					{/* Device count */}
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="flex items-center gap-1 cursor-default text-muted-foreground">
								<Monitor className="h-3 w-3" />
								<span className="tabular-nums font-medium">
									{health.deviceCount}{" "}
									<span className="hidden sm:inline">
										{health.deviceCount === 1 ? "Device" : "Devices"}
									</span>
								</span>
								{health.connectedCount > 0 && (
									<span className="text-green-600 dark:text-green-400 tabular-nums">
										({health.connectedCount} active)
									</span>
								)}
							</div>
						</TooltipTrigger>
						<TooltipContent side="bottom" className="text-xs">
							<p>
								{health.deviceCount} device
								{health.deviceCount !== 1 ? "s" : ""} discovered on LAN
							</p>
							{health.connectedCount > 0 && (
								<p>
									{health.connectedCount} with active connection
									{health.connectedCount !== 1 ? "s" : ""}
								</p>
							)}
						</TooltipContent>
					</Tooltip>
				</div>

				{/* Right section: Latency & Signal */}
				<div className="flex items-center gap-2 sm:gap-3">
					{health.avgLatencyMs !== null && (
						<>
							<Tooltip>
								<TooltipTrigger asChild>
									<div className="flex items-center gap-1 cursor-default text-muted-foreground">
										<Activity className="h-3 w-3" />
										<span className="tabular-nums font-mono font-medium">
											{formatLatency(health.avgLatencyMs)}
										</span>
									</div>
								</TooltipTrigger>
								<TooltipContent side="bottom" className="text-xs">
									<p>
										Average round-trip latency across{" "}
										{Object.keys(deviceLatencyMs).length} peer
										{Object.keys(deviceLatencyMs).length !== 1 ? "s" : ""}
									</p>
								</TooltipContent>
							</Tooltip>

							{/* Separator */}
							<div className="h-3.5 w-px bg-border" />
						</>
					)}

					<Tooltip>
						<TooltipTrigger asChild>
							<div className="cursor-default">
								<SignalIcon
									quality={health.quality}
									className={cn("h-3.5 w-3.5", config.textColor)}
								/>
							</div>
						</TooltipTrigger>
						<TooltipContent side="bottom" className="text-xs">
							<p>Signal quality: {health.label}</p>
						</TooltipContent>
					</Tooltip>
				</div>
			</div>
		</TooltipProvider>
	);
}
