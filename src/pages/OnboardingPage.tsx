import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
	Globe,
	Shield,
	Zap,
	ArrowRight,
	Check,
	Loader2,
	Wifi,
	Lock,
} from "lucide-react";
import type { DeviceIdentity } from "@/types";

const FEATURES = [
	{
		icon: Zap,
		color: "text-amber-500",
		bg: "bg-amber-500/10",
		title: "Zero Configuration",
		desc: "Instant device discovery via mDNS — no setup required.",
	},
	{
		icon: Shield,
		color: "text-emerald-500",
		bg: "bg-emerald-500/10",
		title: "Private & Secure",
		desc: "End-to-end encrypted. Your data never leaves your network.",
	},
	{
		icon: Wifi,
		color: "text-blue-500",
		bg: "bg-blue-500/10",
		title: "LAN-First",
		desc: "Blazing-fast transfers using your local network infrastructure.",
	},
];

export default function OnboardingPage() {
	const { setOnboarded, setDeviceIdentity } = useAppStore();
	const [step, setStep] = useState(1);
	const [name, setName] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleComplete = async () => {
		const trimmedName = name.trim();
		if (!trimmedName) return;
		setIsLoading(true);
		setError(null);
		try {
			await invoke("update_display_name", { name: trimmedName });
			const identity = await invoke<DeviceIdentity>("get_device_info");
			setDeviceIdentity(identity);
			setOnboarded(true);
		} catch (err) {
			console.error("Failed to save device name:", err);
			setError("Failed to save your device name. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-6 overflow-hidden">
			{/* Ambient background blobs */}
			

			<div className="relative w-full max-w-md">
				{/* Logo mark */}
				<div className="flex justify-center mb-8">
					<div className="relative">
						<div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center ">
							<Globe className="w-8 h-8 text-primary-foreground" />
						</div>
						<div className="absolute -inset-1 bg-primary/20 rounded-2xl blur-md -z-10" />
					</div>
				</div>

				<AnimatePresence mode="wait">
					{/* ── Step 1: Welcome ──────────────────────────────────── */}
					{step === 1 && (
						<motion.div
							key="step1"
							initial={{ opacity: 0, y: 24 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -24 }}
							transition={{ duration: 0.35, ease: "easeOut" }}
							className="space-y-7"
						>
							<div className="text-center space-y-2">
								<Badge
									variant="secondary"
									className="mb-3 text-xs font-medium px-3 py-1 rounded-full"
								>
									Local-first messaging
								</Badge>
								<h1 className="text-4xl font-black tracking-tight text-foreground">
									Hyper Connect
								</h1>
								<p className="text-base text-muted-foreground leading-relaxed">
									The fastest way to share files and chat across devices on your
									local network.
								</p>
							</div>

							<Separator className="opacity-40" />

							<div className="space-y-3">
								{FEATURES.map(({ icon: Icon, color, bg, title, desc }) => (
									<div
										key={title}
										className="flex items-start gap-4 p-4 rounded-xl bg-background border border-border hover:bg-muted/20 transition-colors"
									>
										<div
											className={`shrink-0 w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}
										>
											<Icon className={`w-4 h-4 ${color}`} />
										</div>
										<div className="min-w-0">
											<p className="text-sm font-semibold text-foreground">
												{title}
											</p>
											<p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
												{desc}
											</p>
										</div>
									</div>
								))}
							</div>

							<Button
								size="lg"
								className="w-full h-12 font-semibold rounded-xl text-base group "
								onClick={() => setStep(2)}
							>
								Get Started
								<ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
							</Button>

							<p className="text-center text-[11px] text-muted-foreground/70">
								<Lock className="inline h-3 w-3 mr-1 mb-0.5" />
								All data stays on your local network — always.
							</p>
						</motion.div>
					)}

					{/* ── Step 2: Identity ─────────────────────────────────── */}
					{step === 2 && (
						<motion.div
							key="step2"
							initial={{ opacity: 0, x: 40 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: -40 }}
							transition={{ duration: 0.35, ease: "easeOut" }}
							className="space-y-7"
						>
							<div className="space-y-2">
								<div className="flex items-center gap-2 mb-4">
									<div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary">
										<span className="text-xs font-bold">2</span>
									</div>
									<div className="flex-1 h-px bg-border" />
								</div>
								<h2 className="text-3xl font-black tracking-tight">
									Your Identity
								</h2>
								<p className="text-sm text-muted-foreground leading-relaxed">
									Choose a name for your device. This is how other devices on the
									network will identify you.
								</p>
							</div>

							<div className="space-y-2">
								<Label
									htmlFor="name"
									className="text-sm font-semibold text-foreground"
								>
									Device Name
								</Label>
								<Input
									id="name"
									placeholder="e.g. MacBook Pro, iPhone 16"
									value={name}
									onChange={(e) => {
										setName(e.target.value);
										setError(null);
									}}
									className="h-12 text-base rounded-xl bg-muted/40 border-border/60 focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
									autoFocus
									disabled={isLoading}
									onKeyDown={(e) => e.key === "Enter" && !isLoading && handleComplete()}
								/>
								{error && (
									<p className="text-xs text-destructive font-medium mt-1">
										{error}
									</p>
								)}
							</div>

							{/* Preview card */}
							<AnimatePresence>
								{name && (
									<motion.div
										initial={{ opacity: 0, scale: 0.97 }}
										animate={{ opacity: 1, scale: 1 }}
										exit={{ opacity: 0, scale: 0.97 }}
										className="p-4 rounded-xl border border-primary/25 bg-primary/5 flex items-center gap-3"
									>
										<div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-black text-sm shrink-0">
											{name[0].toUpperCase()}
										</div>
										<div className="min-w-0">
											<p className="text-[10px] font-bold uppercase tracking-widest text-primary/60">
												Network Identity
											</p>
											<p className="font-semibold text-sm text-foreground truncate">
												{name}
											</p>
										</div>
										<Check className="h-4 w-4 text-emerald-500 shrink-0 ml-auto" />
									</motion.div>
								)}
							</AnimatePresence>

							<div className="flex gap-3">
								<Button
									variant="ghost"
									className="h-12 px-6 font-semibold rounded-xl"
									onClick={() => setStep(1)}
								>
									Back
								</Button>
								<Button
									size="lg"
									className="flex-1 h-12 font-semibold rounded-xl "
									disabled={!name.trim() || isLoading}
									onClick={handleComplete}
								>
									{isLoading ? (
										<>
											<Loader2 className="h-4 w-4 animate-spin mr-2" />
											Saving…
										</>
									) : (
										<>
											Complete Setup
											<Check className="ml-2 h-4 w-4" />
										</>
									)}
								</Button>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}
