import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAppStore } from "@/store";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { ACCENT_COLORS } from "@/lib/accent-colors";
import {
	User,
	Palette,
	Bell,
	Wifi,
	Shield,
	Settings as SettingsIcon,
	Info,
	Save,
	Check,
	Globe,
	Trash2,
	RefreshCw,
	Lock,
	ExternalLink,
	AlertTriangle,
	FolderOpen,
	Download,
	GitBranch,
	Sparkles,
	KeyRound,
	Zap,
	Loader2,
	Eye,
	EyeOff,
} from "lucide-react";
import { useMeshRouting } from "@/hooks/use-mesh-routing";
import { useAi } from "@/hooks/use-ai";
import type { AiModel } from "@/types";

export default function SettingsPage() {
	const {
		isEnabled: meshEnabled,
		setEnabled: setMeshEnabled,
		relayedDestinations,
		relayCount,
	} = useMeshRouting();

	// AI
	const {
		status: aiStatus,
		isReady: isAiReady,
		setApiKey: setAiApiKey,
		clearApiKey: clearAiApiKey,
		setModel: setAiModel,
	} = useAi();

	const [aiKeyInput, setAiKeyInput] = useState("");
	const [isSavingAiKey, setIsSavingAiKey] = useState(false);
	const [showAiKey, setShowAiKey] = useState(false);

	const handleSaveAiKey = async () => {
		if (!aiKeyInput.trim()) return;
		setIsSavingAiKey(true);
		try {
			await setAiApiKey(aiKeyInput.trim());
			setAiKeyInput("");
			setShowAiKey(false);
		} finally {
			setIsSavingAiKey(false);
		}
	};

	const handleRemoveAiKey = async () => {
		await clearAiApiKey();
		setAiKeyInput("");
	};

	const aiModels: { id: AiModel; label: string; desc: string }[] = [
		{
			id: "gemini-2.5-flash",
			label: "Gemini 2.5 Flash",
			desc: "Fast & efficient",
		},
		{
			id: "gemini-2.0-flash",
			label: "Gemini 2.0 Flash",
			desc: "Stable & reliable",
		},
		{
			id: "gemini-2.5-pro",
			label: "Gemini 2.5 Pro",
			desc: "Most capable",
		},
	];

	const {
		deviceName,
		theme,
		toggleTheme,
		setDeviceName,
		accentColor,
		setAccentColor,
		notificationsEnabled,
		soundEnabled,
		setNotificationsEnabled,
		setSoundEnabled,
		downloadDir,
		setDownloadDir,
		appSettings,
		updateAppSettings,
		localDeviceId,
		deviceIdentity,
	} = useAppStore();
	const [localDeviceName, setLocalDeviceName] = useState(
		deviceName || "My Device",
	);
	const [isSaving, setIsSaving] = useState(false);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const [isResetting, setIsResetting] = useState(false);
	const [isClearingCache, setIsClearingCache] = useState(false);
	const [displayDownloadDir, setDisplayDownloadDir] = useState(
		downloadDir || "",
	);
	const [isLoadingDir, setIsLoadingDir] = useState(false);

	const [settings, setSettings] = [
		appSettings,
		(updates: Partial<typeof appSettings>) => updateAppSettings(updates),
	];

	// Load the effective download directory from the backend on mount
	useEffect(() => {
		const loadDownloadDir = async () => {
			try {
				const dir = await invoke<string>("get_default_downloads_dir");
				setDisplayDownloadDir(downloadDir || dir);
			} catch (err) {
				console.error("Failed to load download dir:", err);
			}
		};
		loadDownloadDir();
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		setHasUnsavedChanges(localDeviceName !== deviceName);
	}, [localDeviceName, deviceName]);

	const handleSave = () => {
		setIsSaving(true);
		if (localDeviceName.trim()) {
			setDeviceName(localDeviceName);
		}
		setTimeout(() => {
			setIsSaving(false);
			setHasUnsavedChanges(false);
		}, 800);
	};

	const handleResetApp = async () => {
		setIsResetting(true);
		try {
			await invoke("clear_all_data");
			localStorage.removeItem("hyper-connect-storage");
			useAppStore.getState().reset();
			window.location.reload();
		} catch (err) {
			console.error("Failed to reset app:", err);
			setIsResetting(false);
		}
	};

	const handleChangeDownloadDir = async () => {
		setIsLoadingDir(true);
		try {
			const selected = await open({
				directory: true,
				multiple: false,
				title: "Choose download folder",
			});
			if (selected && typeof selected === "string") {
				await invoke("set_download_dir", { path: selected });
				setDownloadDir(selected);
				setDisplayDownloadDir(selected);
			}
		} catch (err) {
			console.error("Failed to set download dir:", err);
		} finally {
			setIsLoadingDir(false);
		}
	};

	const handleOpenDownloadDir = async () => {
		if (!displayDownloadDir) return;
		try {
			await invoke("open_file_location", { path: displayDownloadDir });
		} catch (err) {
			console.error("Failed to open download dir:", err);
		}
	};

	const handleClearCache = async () => {
		setIsClearingCache(true);
		try {
			await invoke("clear_all_data");
			useAppStore.setState({
				messages: {},
				threads: [],
				activeThread: null,
				transfers: [],
				activeTransfers: new Set<string>(),
				devices: [],
				connectedDevices: new Set<string>(),
				deviceConnectionStatus: {},
				deviceLatencyMs: {},
			});
		} catch (err) {
			console.error("Failed to clear cache:", err);
		} finally {
			setIsClearingCache(false);
		}
	};

	return (
		<div className="flex flex-col h-full bg-background overflow-hidden">
			{/* Header */}
			<header className="flex h-14 shrink-0 items-center border-b border-border px-6 bg-background sticky top-0 z-10">
				<div className="flex items-center gap-3">
					<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0">
						<SettingsIcon className="h-4 w-4 text-foreground/70" />
					</div>
					<div>
						<h1 className="text-sm font-semibold tracking-tight">
							App Settings
						</h1>
						<p className="text-xs text-muted-foreground">
							Configure your Hyper Connect experience
						</p>
					</div>
				</div>
			</header>

			{/* Content Area */}
			<ScrollArea className="flex-1">
				<div className="max-w-2xl mx-auto p-6 space-y-8">
					{/* ── General ── */}
					<section id="general">
						<div className="flex items-center gap-3 mb-4">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
								<User className="h-4 w-4 text-violet-600 dark:text-violet-400" />
							</div>
							<div>
								<h2 className="text-sm font-semibold tracking-tight">
									General
								</h2>
								<p className="text-xs text-muted-foreground">
									Personalize how your device appears to
									others
								</p>
							</div>
						</div>
						<Card className="shadow-sm">
							<CardContent className="p-6 space-y-4">
								<div className="space-y-2">
									<Label
										htmlFor="device-name"
										className="text-sm font-medium"
									>
										Display Name
									</Label>
									<div className="flex items-center gap-2">
										<Input
											id="device-name"
											value={localDeviceName}
											onChange={(e) =>
												setLocalDeviceName(
													e.target.value,
												)
											}
											placeholder="Enter device name"
											className="max-w-xs"
										/>
										<Badge
											variant="outline"
											className="h-9 px-3 font-medium text-xs shrink-0"
										>
											Active
										</Badge>
									</div>
									<p className="text-xs text-muted-foreground">
										This name will be broadcasted via mDNS
										to other LAN peers.
									</p>
								</div>
							</CardContent>
						</Card>
					</section>

					{/* ── Appearance ── */}
					<section id="appearance">
						<div className="flex items-center gap-3 mb-4">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
								<Palette className="h-4 w-4 text-blue-600 dark:text-blue-400" />
							</div>
							<div>
								<h2 className="text-sm font-semibold tracking-tight">
									Appearance
								</h2>
								<p className="text-xs text-muted-foreground">
									Customize the visual experience
								</p>
							</div>
						</div>
						<Card className="shadow-sm">
							<CardContent className="p-0">
								{/* Theme toggle row */}
								<div className="flex items-center justify-between p-4 border-b border-border">
									<div className="space-y-0.5">
										<Label className="text-sm font-medium">
											Interface Theme
										</Label>
										<p className="text-xs text-muted-foreground">
											Switch between light and dark modes
										</p>
									</div>
									<div className="flex items-center gap-0.5 bg-muted rounded-md p-1 border border-border shrink-0">
										<Button
											variant={
												theme === "light"
													? "secondary"
													: "ghost"
											}
											size="sm"
											onClick={() =>
												theme !== "light" &&
												toggleTheme()
											}
											className="h-7 px-3 text-xs font-medium rounded-sm"
										>
											Light
										</Button>
										<Button
											variant={
												theme === "dark"
													? "secondary"
													: "ghost"
											}
											size="sm"
											onClick={() =>
												theme !== "dark" &&
												toggleTheme()
											}
											className="h-7 px-3 text-xs font-medium rounded-sm"
										>
											Dark
										</Button>
									</div>
								</div>

								{/* Accent color row */}
								<div className="p-4 space-y-3">
									<Label className="text-sm font-medium">
										Accent Color
									</Label>
									<div className="flex flex-wrap gap-4">
										{ACCENT_COLORS.map((color) => {
											const isSelected =
												accentColor === color.name;
											return (
												<div
													key={color.name}
													className="flex flex-col items-center gap-1.5 text-center"
												>
													<button
														onClick={() =>
															setAccentColor(
																color.name,
															)
														}
														className={cn(
															"w-9 h-9 rounded-lg transition-all flex items-center justify-center shadow-sm",
															isSelected
																? "ring-2 ring-primary ring-offset-2 ring-offset-background"
																: "hover:ring-2 hover:ring-muted-foreground/30 ring-offset-1 ring-offset-background",
														)}
														style={{
															backgroundColor:
																color.swatch,
														}}
													>
														{isSelected && (
															<Check className="h-4 w-4 text-white drop-shadow-sm" />
														)}
													</button>
													<span className="text-[10px] font-medium text-muted-foreground">
														{color.name}
													</span>
												</div>
											);
										})}
									</div>
								</div>
							</CardContent>
						</Card>
					</section>

					{/* ── Notifications ── */}
					<section id="notifications">
						<div className="flex items-center gap-3 mb-4">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
								<Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
							</div>
							<div>
								<h2 className="text-sm font-semibold tracking-tight">
									Notifications
								</h2>
								<p className="text-xs text-muted-foreground">
									Manage your alerts and sounds
								</p>
							</div>
						</div>
						<Card className="shadow-sm divide-y divide-border">
							<div className="flex items-center justify-between p-4">
								<div className="flex items-center gap-3">
									<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
										<Bell className="h-4 w-4 text-muted-foreground" />
									</div>
									<div className="space-y-0.5">
										<Label className="text-sm font-medium">
											Enable Notifications
										</Label>
										<p className="text-xs text-muted-foreground">
											Push notifications for messages and
											files
										</p>
									</div>
								</div>
								<Switch
									checked={notificationsEnabled}
									onCheckedChange={setNotificationsEnabled}
									className="shrink-0"
								/>
							</div>
							<div className="flex items-center justify-between p-4">
								<div className="flex items-center gap-3">
									<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
										<Globe className="h-4 w-4 text-muted-foreground" />
									</div>
									<div className="space-y-0.5">
										<Label className="text-sm font-medium">
											Sound Feedback
										</Label>
										<p className="text-xs text-muted-foreground">
											Play unique sounds for different
											events
										</p>
									</div>
								</div>
								<Switch
									checked={soundEnabled}
									onCheckedChange={setSoundEnabled}
									className="shrink-0"
								/>
							</div>
						</Card>
					</section>

					{/* ── Network & Discovery ── */}
					<section id="network">
						<div className="flex items-center gap-3 mb-4">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
								<Wifi className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
							</div>
							<div>
								<h2 className="text-sm font-semibold tracking-tight">
									Network & Discovery
								</h2>
								<p className="text-xs text-muted-foreground">
									Control local network visibility
								</p>
							</div>
						</div>
						<Card className="shadow-sm">
							<CardContent className="p-6 space-y-6">
								<div className="flex items-center justify-between">
									<div className="space-y-0.5">
										<Label className="text-sm font-medium">
											Global Visibility
										</Label>
										<p className="text-xs text-muted-foreground">
											Allow any device on this network to
											find you
										</p>
									</div>
									<Switch
										checked={settings.visibleToAll}
										onCheckedChange={(val) =>
											setSettings({
												...settings,
												visibleToAll: val,
											})
										}
										className="shrink-0"
									/>
								</div>

								{/* Port config panel */}
								<div className="space-y-3 p-4 rounded-lg bg-muted/50 border border-border">
									<div className="flex items-center justify-between">
										<Label
											htmlFor="port"
											className="text-sm font-medium"
										>
											mDNS Discovery Port
										</Label>
										<div className="flex items-center gap-2">
											<Badge
												variant="secondary"
												className="font-mono text-xs"
											>
												UDP/TCP
											</Badge>
											<Input
												id="port"
												type="number"
												value={settings.port}
												onChange={(e) =>
													setSettings({
														...settings,
														port: e.target.value,
													})
												}
												className="w-20 h-8 text-right font-mono text-xs font-medium"
											/>
										</div>
									</div>
									<p className="text-xs text-muted-foreground flex items-start gap-1.5">
										<Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
										Advanced: Standard is 5353. Only change
										if you experience network conflicts.
									</p>
								</div>
								{/* Mesh routing toggle */}
								<div className="space-y-3 p-4 rounded-lg bg-muted/50 border border-border">
									<div className="flex items-center justify-between">
										<div className="space-y-0.5">
											<Label className="text-sm font-medium flex items-center gap-1.5">
												<GitBranch className="h-3.5 w-3.5 text-violet-500" />
												Mesh Routing
											</Label>
											<p className="text-xs text-muted-foreground">
												Relay messages through
												intermediate devices on the
												network (multi-hop)
											</p>
										</div>
										<Switch
											checked={meshEnabled}
											onCheckedChange={(val) =>
												setMeshEnabled(val)
											}
											className="shrink-0"
										/>
									</div>
									{meshEnabled && (
										<div className="flex items-center gap-3 text-xs text-muted-foreground">
											{relayedDestinations > 0 && (
												<span className="flex items-center gap-1">
													<GitBranch className="h-3 w-3 text-violet-500" />
													{relayedDestinations} mesh
													route
													{relayedDestinations !== 1
														? "s"
														: ""}
												</span>
											)}
											{relayCount > 0 && (
												<span>
													{relayCount} message
													{relayCount !== 1
														? "s"
														: ""}{" "}
													relayed
												</span>
											)}
											{relayedDestinations === 0 &&
												relayCount === 0 && (
													<span>
														Listening for topology
														announcements…
													</span>
												)}
										</div>
									)}
									<p className="text-xs text-muted-foreground flex items-start gap-1.5">
										<Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
										When enabled, this device can forward
										messages between peers that cannot
										directly reach each other.
									</p>
								</div>
							</CardContent>
						</Card>
					</section>

					{/* ── AI Assistant ── */}
					<section id="ai">
						<div className="flex items-center gap-3 mb-4">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
								<Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
							</div>
							<div>
								<h2 className="text-sm font-semibold tracking-tight">
									AI Assistant
								</h2>
								<p className="text-xs text-muted-foreground">
									Powered by Google Gemini
								</p>
							</div>
						</div>
						<Card className="shadow-sm overflow-hidden">
							<CardContent className="p-4 space-y-4">
								{/* Status */}
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<span className="text-sm font-medium">
											Status
										</span>
										{isAiReady ? (
											<Badge className="bg-emerald-500 hover:bg-emerald-600 text-[10px] uppercase font-semibold tracking-wide px-1.5">
												Active
											</Badge>
										) : (
											<Badge
												variant="secondary"
												className="text-[10px] uppercase font-semibold tracking-wide px-1.5"
											>
												Not Configured
											</Badge>
										)}
									</div>
									{aiStatus && isAiReady && (
										<div className="flex items-center gap-3 text-xs text-muted-foreground">
											<span className="flex items-center gap-1">
												<Zap className="h-3 w-3" />
												{aiStatus.total_tokens_used.toLocaleString()}{" "}
												tokens
											</span>
											<span>
												{aiStatus.request_count} request
												{aiStatus.request_count !== 1
													? "s"
													: ""}
											</span>
										</div>
									)}
								</div>

								{/* API Key */}
								<div className="space-y-2 p-4 rounded-lg bg-muted/50 border border-border">
									<Label className="text-sm font-medium flex items-center gap-1.5">
										<KeyRound className="h-3.5 w-3.5 text-violet-500" />
										Gemini API Key
									</Label>
									{isAiReady ? (
										<div className="flex items-center gap-2">
											<div className="flex-1 px-3 py-2 text-sm rounded-md bg-background border border-border text-muted-foreground font-mono">
												••••••••••••••••
											</div>
											<Button
												variant="outline"
												size="sm"
												className="text-destructive hover:text-destructive h-9"
												onClick={handleRemoveAiKey}
											>
												<Trash2 className="h-3.5 w-3.5 mr-1" />
												Remove
											</Button>
										</div>
									) : (
										<div className="flex items-center gap-2">
											<div className="relative flex-1">
												<Input
													type={
														showAiKey
															? "text"
															: "password"
													}
													placeholder="Enter your Gemini API key..."
													value={aiKeyInput}
													onChange={(e) =>
														setAiKeyInput(
															e.target.value,
														)
													}
													onKeyDown={(e) => {
														if (e.key === "Enter")
															handleSaveAiKey();
													}}
													className="pr-9 text-sm"
												/>
												<button
													type="button"
													onClick={() =>
														setShowAiKey(!showAiKey)
													}
													className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
												>
													{showAiKey ? (
														<EyeOff className="h-4 w-4" />
													) : (
														<Eye className="h-4 w-4" />
													)}
												</button>
											</div>
											<Button
												size="sm"
												className="h-9"
												disabled={
													!aiKeyInput.trim() ||
													isSavingAiKey
												}
												onClick={handleSaveAiKey}
											>
												{isSavingAiKey ? (
													<Loader2 className="h-3.5 w-3.5 animate-spin" />
												) : (
													<Save className="h-3.5 w-3.5" />
												)}
											</Button>
										</div>
									)}
									<p className="text-xs text-muted-foreground flex items-start gap-1.5">
										<Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
										Get your key from{" "}
										<span className="text-primary/80 font-medium">
											aistudio.google.com
										</span>
										. Stored on-device only, never shared.
									</p>
								</div>

								{/* Model Selection */}
								{isAiReady && (
									<div className="space-y-2 p-4 rounded-lg bg-muted/50 border border-border">
										<Label className="text-sm font-medium flex items-center gap-1.5">
											<Sparkles className="h-3.5 w-3.5 text-violet-500" />
											Model
										</Label>
										<div className="grid grid-cols-3 gap-2">
											{aiModels.map((m) => (
												<button
													key={m.id}
													onClick={() =>
														setAiModel(m.id)
													}
													className={cn(
														"p-2.5 rounded-lg border text-left transition-all",
														aiStatus?.model === m.id
															? "border-primary bg-primary/5 ring-1 ring-primary/20"
															: "border-border/50 hover:border-border hover:bg-accent/30",
													)}
												>
													<p className="text-xs font-medium">
														{m.label}
													</p>
													<p className="text-[10px] text-muted-foreground mt-0.5">
														{m.desc}
													</p>
													{aiStatus?.model ===
														m.id && (
														<Check className="h-3 w-3 text-primary mt-1" />
													)}
												</button>
											))}
										</div>
									</div>
								)}

								{/* Last Error */}
								{aiStatus?.last_error && (
									<div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs">
										<AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
										<span className="line-clamp-2">
											{aiStatus.last_error}
										</span>
									</div>
								)}
							</CardContent>
						</Card>
					</section>

					{/* ── Privacy & Security ── */}
					<section id="security">
						<div className="flex items-center gap-3 mb-4">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/10">
								<Shield className="h-4 w-4 text-rose-600 dark:text-rose-400" />
							</div>
							<div>
								<h2 className="text-sm font-semibold tracking-tight">
									Privacy & Security
								</h2>
								<p className="text-xs text-muted-foreground">
									Protect your data and connections
								</p>
							</div>
						</div>
						<Card className="shadow-sm overflow-hidden">
							<CardContent className="p-0">
								{/* Encryption banner */}
								<div className="flex items-start gap-3 p-4 bg-emerald-500/5 border-b border-border">
									<div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow-sm mt-0.5">
										<Check className="h-3 w-3 text-white" />
									</div>
									<div className="space-y-1">
										<div className="flex items-center gap-2">
											<h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">
												Post-Quantum Encryption
											</h3>
											<Badge className="bg-emerald-500 hover:bg-emerald-600 text-[10px] uppercase font-semibold tracking-wide px-1.5">
												Active
											</Badge>
										</div>
										<p className="text-xs text-muted-foreground leading-relaxed">
											All transfers and messages are
											secured with AES-256-GCM. Hyper
											Connect uses perfect forward secrecy
											to ensure your data stays private.
										</p>
									</div>
								</div>

								{/* Security toggle rows */}
								<div className="divide-y divide-border">
									<div className="flex items-center justify-between p-4">
										<div className="space-y-0.5">
											<Label className="text-sm font-medium">
												Strict Verification
											</Label>
											<p className="text-xs text-muted-foreground">
												Require manual approval for all
												incoming transfers
											</p>
										</div>
										<Switch
											checked={settings.requireApproval}
											onCheckedChange={(val) =>
												setSettings({
													...settings,
													requireApproval: val,
												})
											}
											className="shrink-0"
										/>
									</div>
									<div className="flex items-center justify-between p-4">
										<div className="space-y-0.5">
											<Label className="text-sm font-medium">
												Stealth Mode
											</Label>
											<p className="text-xs text-muted-foreground">
												Only allow connections from
												known/paired devices
											</p>
										</div>
										<Switch
											checked={settings.blockUnknown}
											onCheckedChange={(val) =>
												setSettings({
													...settings,
													blockUnknown: val,
												})
											}
											className="shrink-0"
										/>
									</div>
								</div>
							</CardContent>
						</Card>
					</section>

					{/* ── Downloads ── */}
					<section id="downloads">
						<div className="flex items-center gap-3 mb-4">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
								<Download className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
							</div>
							<div>
								<h2 className="text-sm font-semibold tracking-tight">
									Downloads
								</h2>
								<p className="text-xs text-muted-foreground">
									Choose where received files are saved
								</p>
							</div>
						</div>
						<Card className="shadow-sm">
							<CardContent className="p-6 space-y-4">
								<div className="space-y-2">
									<Label className="text-sm font-medium">
										Download Folder
									</Label>
									<div className="flex items-center gap-2">
										<div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border">
											<FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
											<span className="text-sm text-foreground truncate font-mono">
												{displayDownloadDir ||
													"Loading…"}
											</span>
										</div>
										<Button
											variant="outline"
											size="sm"
											className="h-9 px-3 text-xs font-medium shrink-0"
											onClick={handleChangeDownloadDir}
											disabled={isLoadingDir}
										>
											{isLoadingDir ? "…" : "Change"}
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
											onClick={handleOpenDownloadDir}
											title="Open folder"
										>
											<ExternalLink className="h-4 w-4" />
										</Button>
									</div>
									<p className="text-xs text-muted-foreground">
										Files received from other devices will
										be saved to this folder. Click "Change"
										to pick a different location.
									</p>
								</div>
							</CardContent>
						</Card>
					</section>

					{/* ── Advanced ── */}
					<section id="advanced">
						<div className="flex items-center gap-3 mb-4">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-500/10">
								<SettingsIcon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
							</div>
							<div>
								<h2 className="text-sm font-semibold tracking-tight">
									Advanced
								</h2>
								<p className="text-xs text-muted-foreground">
									Fine-tune performance and system hooks
								</p>
							</div>
						</div>
						<Card className="shadow-sm">
							<CardContent className="p-6 space-y-6">
								<div className="flex items-center justify-between">
									<div className="space-y-0.5">
										<Label className="text-sm font-medium">
											Hardware Acceleration
										</Label>
										<p className="text-xs text-muted-foreground">
											Optimize file checksums and UI using
											GPU resources
											<Badge
												variant="secondary"
												className="ml-2 text-[10px] font-medium"
											>
												Recommended
											</Badge>
										</p>
									</div>
									<Switch
										checked={settings.hardwareAcceleration}
										onCheckedChange={(val) =>
											setSettings({
												...settings,
												hardwareAcceleration: val,
											})
										}
										className="shrink-0"
									/>
								</div>

								<div className="space-y-4 pt-4 border-t border-border">
									<div className="flex items-center justify-between">
										<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
											Cache Allocation
										</Label>
										<Badge
											variant="outline"
											className="font-mono font-semibold text-primary bg-primary/5 border-primary/20 text-xs"
										>
											{settings.cacheSize} MB
										</Badge>
									</div>
									<Input
										type="range"
										min="100"
										max="5000"
										step="100"
										value={settings.cacheSize}
										onChange={(e) =>
											setSettings({
												...settings,
												cacheSize: e.target.value,
											})
										}
										className="h-1.5 bg-muted accent-primary cursor-pointer border-none p-0 appearance-none rounded-full"
									/>
									<div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 border border-border">
										<div className="flex items-center gap-2 text-xs text-muted-foreground">
											<RefreshCw
												className={cn(
													"h-3.5 w-3.5",
													isClearingCache &&
														"animate-spin",
												)}
											/>
											Buffered file chunk storage
										</div>
										<AlertDialog>
											<AlertDialogTrigger asChild>
												<Button
													variant="outline"
													size="sm"
													className="h-8 px-3 text-xs font-medium text-destructive hover:bg-destructive/10 border-destructive/30 transition-colors"
													disabled={isClearingCache}
												>
													<Trash2 className="h-3.5 w-3.5 mr-1.5" />
													{isClearingCache
														? "Clearing..."
														: "Clear Cache"}
												</Button>
											</AlertDialogTrigger>
											<AlertDialogContent>
												<AlertDialogHeader>
													<AlertDialogTitle>
														Clear Cache
													</AlertDialogTitle>
													<AlertDialogDescription>
														This will clear all
														cached messages, file
														transfers, and
														discovered devices. Your
														identity, device name,
														and preferences will be
														preserved.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel>
														Cancel
													</AlertDialogCancel>
													<AlertDialogAction
														onClick={
															handleClearCache
														}
														className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
													>
														Clear Cache
													</AlertDialogAction>
												</AlertDialogFooter>
											</AlertDialogContent>
										</AlertDialog>
									</div>
								</div>
							</CardContent>
						</Card>
					</section>

					{/* ── About ── */}
					<section id="about">
						<div className="flex items-center gap-3 mb-4">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
								<Info className="h-4 w-4 text-primary" />
							</div>
							<div>
								<h2 className="text-sm font-semibold tracking-tight">
									About
								</h2>
								<p className="text-xs text-muted-foreground">
									Hyper Connect platform intelligence
								</p>
							</div>
						</div>
						<Card className="shadow-sm overflow-hidden">
							{/* Branding block */}
							<div className="flex flex-col items-center text-center p-8 space-y-3 border-b border-border bg-muted/30">
								<div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center shadow-md">
									<RefreshCw className="h-7 w-7 text-primary-foreground animate-spin-slow" />
								</div>
								<div>
									<h3 className="text-base font-bold tracking-tight">
										Hyper Connect
									</h3>
									<p className="text-xs text-muted-foreground mt-0.5">
										v0.1.0-alpha.5 · Build 2026
									</p>
								</div>
								<Badge
									variant="secondary"
									className="text-[10px] uppercase font-semibold tracking-widest"
								>
									Release Candidate
								</Badge>
							</div>

							{/* Info rows */}
							<div className="divide-y divide-border">
								{[
									{
										label: "Platform",
										value:
											deviceIdentity?.platform ||
											"Unknown",
										icon: Globe,
									},
									{
										label: "Identity",
										value: localDeviceId || "—",
										icon: Lock,
										isMono: true,
									},
								].map((item) => (
									<div
										key={item.label}
										className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors"
									>
										<div className="flex items-center gap-2">
											<item.icon className="h-4 w-4 text-muted-foreground" />
											<span className="text-xs font-medium">
												{item.label}
											</span>
										</div>
										<span
											className={cn(
												"text-xs text-muted-foreground truncate max-w-[200px]",
												item.isMono &&
													"font-mono bg-muted px-1.5 py-0.5 rounded-md",
											)}
										>
											{item.value}
										</span>
									</div>
								))}
							</div>

							{/* Link buttons */}
							<div className="flex flex-wrap gap-1 justify-center p-3 border-t border-border bg-muted/20">
								<Button
									variant="ghost"
									size="sm"
									className="text-xs gap-1.5 h-8 rounded-md font-medium"
								>
									<ExternalLink className="h-3.5 w-3.5" />
									Privacy
								</Button>
								<Button
									variant="ghost"
									size="sm"
									className="text-xs gap-1.5 h-8 rounded-md font-medium"
								>
									<ExternalLink className="h-3.5 w-3.5" />
									Terms
								</Button>
								<Button
									variant="ghost"
									size="sm"
									className="text-xs gap-1.5 h-8 rounded-md font-medium"
								>
									<Shield className="h-3.5 w-3.5" />
									Licenses
								</Button>
							</div>
						</Card>
					</section>

					{/* ── Danger Zone ── */}
					<section id="danger-zone">
						<div className="flex items-center gap-3 mb-4">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
								<AlertTriangle className="h-4 w-4 text-destructive" />
							</div>
							<div>
								<h2 className="text-sm font-semibold tracking-tight">
									Danger Zone
								</h2>
								<p className="text-xs text-muted-foreground">
									Irreversible actions that affect your data
								</p>
							</div>
						</div>
						<Card className="border-destructive/30 shadow-sm">
							<CardContent className="p-6">
								<div className="flex items-start justify-between gap-6">
									<div className="space-y-1">
										<h3 className="text-sm font-semibold">
											Reset App
										</h3>
										<p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
											Permanently delete all messages,
											file transfers, discovered devices,
											and your device identity. You will
											be taken through onboarding again.
										</p>
									</div>
									<AlertDialog>
										<AlertDialogTrigger asChild>
											<Button
												variant="destructive"
												size="sm"
												className="h-9 px-4 text-xs font-medium gap-2 shrink-0"
												disabled={isResetting}
											>
												{isResetting ? (
													<RefreshCw className="h-3.5 w-3.5 animate-spin" />
												) : (
													<Trash2 className="h-3.5 w-3.5" />
												)}
												{isResetting
													? "Resetting..."
													: "Reset App"}
											</Button>
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>
													Are you absolutely sure?
												</AlertDialogTitle>
												<AlertDialogDescription>
													This action cannot be
													undone. This will
													permanently delete:
												</AlertDialogDescription>
												<ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 pt-2">
													<li>
														All messages and chat
														history
													</li>
													<li>
														All file transfer
														records
													</li>
													<li>
														Discovered devices and
														connections
													</li>
													<li>
														Your device identity and
														display name
													</li>
													<li>
														All app preferences and
														settings
													</li>
												</ul>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel>
													Cancel
												</AlertDialogCancel>
												<AlertDialogAction
													onClick={handleResetApp}
													className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
												>
													Yes, reset everything
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								</div>
							</CardContent>
						</Card>
					</section>

					{/* Save button */}
					<div className="flex items-center justify-end gap-3 pt-2 pb-2">
						{hasUnsavedChanges && (
							<span className="text-xs text-amber-500 font-medium">
								Unsaved changes
							</span>
						)}
						<Button
							onClick={handleSave}
							disabled={!hasUnsavedChanges || isSaving}
							className="gap-2 px-4 h-9 text-sm shadow-sm"
						>
							{isSaving ? (
								<RefreshCw className="h-4 w-4 animate-spin" />
							) : (
								<Save className="h-4 w-4" />
							)}
							{isSaving ? "Saving..." : "Save Changes"}
						</Button>
					</div>

					<div className="h-4" />
				</div>
			</ScrollArea>
		</div>
	);
}
