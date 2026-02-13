import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
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
    ExternalLink
} from 'lucide-react';
export default function SettingsPage() {
    const { deviceName, theme, toggleTheme, setDeviceName } = useAppStore();
    const [localDeviceName, setLocalDeviceName] = useState(deviceName || 'My Device');
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    // Mock settings state (in real app these would be in the store)
    const [settings, setSettings] = useState({
        autoDiscovery: true,
        notifications: true,
        soundEnabled: true,
        autoUpdate: true,
        visibleToAll: true,
        hardwareAcceleration: true,
        requireApproval: true,
        blockUnknown: false,
        port: '5353',
        cacheSize: '500',
        deviceDescription: "John's MacBook Pro"
    });
    useEffect(() => {
        setHasUnsavedChanges(localDeviceName !== deviceName);
    }, [localDeviceName, deviceName]);
    const handleSave = () => {
        setIsSaving(true);
        if (localDeviceName.trim()) {
            setDeviceName(localDeviceName);
        }
        // Simulate API call
        setTimeout(() => {
            setIsSaving(false);
            setHasUnsavedChanges(false);
        }, 800);
    };
    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            {/* Header */}
            <header className="flex h-20 shrink-0 items-center justify-between border-b border-border px-6 pt-6 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <SettingsIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight text-foreground">App Settings</h1>
                        <p className="text-xs text-muted-foreground">
                            Configure your Hyper Connect experience
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {hasUnsavedChanges && (
                        <span className="text-xs text-amber-500 font-medium animate-pulse">
                            Unsaved changes
                        </span>
                    )}
                    <Button
                        onClick={handleSave}
                        size="sm"
                        disabled={!hasUnsavedChanges || isSaving}
                        className="gap-2 px-4 shadow-sm"
                    >
                        {isSaving ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </header>
            {/* Content Area */}
            <ScrollArea className="flex-1 bg-background/50">
                <div className="max-w-3xl mx-auto p-6 space-y-10">
                    {/* General Section */}
                    <section id="general">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-xl bg-violet-500/10 dark:bg-violet-500/20 shadow-inner">
                                <User className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight text-foreground">General</h2>
                                <p className="text-xs text-muted-foreground">Personalize how your device appears to others</p>
                            </div>
                        </div>
                        <Card className="overflow-hidden border-border/50 shadow-sm">
                            <CardContent className="p-6 space-y-6">
                                <div className="grid gap-2">
                                    <Label htmlFor="device-name" className="text-sm font-bold">Display Name</Label>
                                    <div className="flex gap-3">
                                        <Input
                                            id="device-name"
                                            value={localDeviceName}
                                            onChange={(e) => setLocalDeviceName(e.target.value)}
                                            placeholder="Enter device name"
                                            className="max-w-md h-10 focus-visible:ring-primary text-sm"
                                        />
                                        <Badge variant="outline" className="h-10 px-3 bg-muted/30 border-dashed text-[10px] font-semibold">
                                            Active
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        This name will be broadcasted via mDNS to other LAN peers.
                                    </p>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="device-description" className="text-sm font-bold">Description</Label>
                                    <Input
                                        id="device-description"
                                        value={settings.deviceDescription}
                                        onChange={(e) => setSettings({ ...settings, deviceDescription: e.target.value })}
                                        placeholder="e.g., John's MacBook Pro"
                                        className="max-w-md h-10 focus-visible:ring-primary text-sm"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        A short note to help peers identify this hardware.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                    {/* Appearance Section */}
                    <section id="appearance">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 shadow-inner">
                                <Palette className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight text-foreground">Appearance</h2>
                                <p className="text-xs text-muted-foreground">Customize the visual experience</p>
                            </div>
                        </div>
                        <Card className="border-border/50 shadow-sm overflow-hidden">
                            <CardContent className="p-0">
                                <div className="flex items-center justify-between p-6 border-b border-border/50 bg-muted/5">
                                    <div className="space-y-0.5">
                                        <Label className="text-base font-bold">Interface Theme</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Switch between light and dark modes
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border border-border/50">
                                        <Button
                                            variant={theme === 'light' ? 'secondary' : 'ghost'}
                                            size="sm"
                                            onClick={() => theme !== 'light' && toggleTheme()}
                                            className="h-8 px-4 rounded-md font-medium text-xs"
                                        >
                                            Light
                                        </Button>
                                        <Button
                                            variant={theme === 'dark' ? 'secondary' : 'ghost'}
                                            size="sm"
                                            onClick={() => theme !== 'dark' && toggleTheme()}
                                            className="h-8 px-4 rounded-md font-medium text-xs"
                                        >
                                            Dark
                                        </Button>
                                    </div>
                                </div>
                                <div className="p-6 space-y-4">
                                    <Label className="text-sm font-bold">Accent Color</Label>
                                    <div className="flex flex-wrap gap-4">
                                        {[
                                            { name: 'Violet', value: 'oklch(0.6333 0.0309 154.9039)' },
                                            { name: 'Blue', value: 'oklch(0.5624 0.1743 260.1433)' },
                                            { name: 'Green', value: 'oklch(0.6744 0.1427 156.0110)' },
                                            { name: 'Orange', value: 'oklch(0.7209 0.1489 60.9474)' }
                                        ].map((color) => (
                                            <div key={color.name} className="flex flex-col items-center gap-2 text-center group">
                                                <button
                                                    className={cn(
                                                        "w-10 h-10 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center shadow-md",
                                                        color.name === 'Violet' ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:ring-2 hover:ring-muted-foreground/30 ring-offset-1 ring-offset-background"
                                                    )}
                                                    style={{ backgroundColor: color.value }}
                                                >
                                                    {color.name === 'Violet' && <Check className="h-4 w-4 text-white drop-shadow-sm" />}
                                                </button>
                                                <span className="text-[10px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">{color.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                    {/* Notifications */}
                    <section id="notifications">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 shadow-inner">
                                <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight text-foreground">Notifications</h2>
                                <p className="text-sm text-muted-foreground transition-colors group-hover:text-foreground">Manage your alerts and sounds</p>
                            </div>
                        </div>
                        <Card className="border-border/50 shadow-sm divide-y divide-border/50 overflow-hidden">
                            <div className="flex items-center justify-between p-6 hover:bg-muted/5 transition-colors">
                                <div className="flex gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0 shadow-inner">
                                        <Bell className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <Label className="text-base font-bold">Enable Notifications</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Push notifications for messages and files
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    checked={settings.notifications}
                                    onCheckedChange={(val) => setSettings({ ...settings, notifications: val })}
                                />
                            </div>
                            <div className="flex items-center justify-between p-6 hover:bg-muted/5 transition-colors group">
                                <div className="flex gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0 shadow-inner">
                                        <Globe className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <Label className="text-base font-bold">Sound Feedback</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Play unique sounds for different events
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    checked={settings.soundEnabled}
                                    onCheckedChange={(val) => setSettings({ ...settings, soundEnabled: val })}
                                    disabled={!settings.notifications}
                                />
                            </div>
                        </Card>
                    </section>
                    {/* Network */}
                    <section id="network">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 shadow-inner">
                                <Wifi className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight text-foreground">Network & Discovery</h2>
                                <p className="text-xs text-muted-foreground">Control local network visibility</p>
                            </div>
                        </div>
                        <Card className="border-border/50 shadow-sm overflow-hidden">
                            <CardContent className="p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-base font-bold">Global Visibility</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Allow any device on this network to find you
                                        </p>
                                    </div>
                                    <Switch
                                        checked={settings.visibleToAll}
                                        onCheckedChange={(val) => setSettings({ ...settings, visibleToAll: val })}
                                    />
                                </div>
                                <div className="space-y-3 p-4 rounded-xl bg-muted/40 border border-border/50 border-dashed">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="port" className="text-sm font-bold">mDNS Discovery Port</Label>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="font-mono text-[9px] uppercase px-1.5">UDP/TCP</Badge>
                                            <Input
                                                id="port"
                                                type="number"
                                                value={settings.port}
                                                onChange={(e) => setSettings({ ...settings, port: e.target.value })}
                                                className="w-24 h-9 text-right bg-background font-mono text-xs font-bold"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground leading-relaxed flex items-start gap-1.5">
                                        <Info className="h-3 w-3 mt-0.5 shrink-0" />
                                        Advanced: Standard is 5353. Only change if you experience network conflicts.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                    {/* Security */}
                    <section id="security">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 shadow-inner">
                                <Shield className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight text-foreground">Privacy & Security</h2>
                                <p className="text-xs text-muted-foreground">Protect your data and connections</p>
                            </div>
                        </div>
                        <Card className="border-border/50 shadow-sm overflow-hidden">
                            <CardContent className="p-0">
                                <div className="p-6 flex items-start gap-4 bg-emerald-500/5 dark:bg-emerald-500/10 border-b border-border/50 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-2 opacity-5">
                                        <Lock className="h-16 w-16 rotate-12" />
                                    </div>
                                    <div className="mt-1 p-1 bg-emerald-500 rounded-full shadow-md shadow-emerald-500/20">
                                        <Check className="h-3 w-3 text-white" />
                                    </div>
                                    <div className="space-y-1 relative z-10">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-bold text-emerald-800 dark:text-emerald-400">Post-Quantum Encryption</h3>
                                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-[9px] uppercase font-black tracking-widest px-1.5">Active</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                                            All transfers and messages are secured with AES-256-GCM.
                                            Hyper Connect uses perfect forward secrecy to ensure your data stays private.
                                        </p>
                                    </div>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base font-bold">Strict Verification</Label>
                                            <p className="text-xs text-muted-foreground">
                                                Require manual approval for all incoming transfers
                                            </p>
                                        </div>
                                        <Switch
                                            checked={settings.requireApproval}
                                            onCheckedChange={(val) => setSettings({ ...settings, requireApproval: val })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base font-bold">Stealth Mode</Label>
                                            <p className="text-xs text-muted-foreground">
                                                Only allow connections from known/paired devices
                                            </p>
                                        </div>
                                        <Switch
                                            checked={settings.blockUnknown}
                                            onCheckedChange={(val) => setSettings({ ...settings, blockUnknown: val })}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                    {/* Advanced */}
                    <section id="advanced">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-xl bg-slate-500/10 dark:bg-slate-500/20 shadow-inner">
                                <SettingsIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight text-foreground">Advanced</h2>
                                <p className="text-xs text-muted-foreground">Fine-tune performance and system hooks</p>
                            </div>
                        </div>
                        <Card className="border-border/50 shadow-sm p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base font-bold">Hardware Acceleration</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Optimize file checksums and UI using GPU resources
                                        <Badge variant="secondary" className="ml-2 text-[9px] uppercase">Recommended</Badge>
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.hardwareAcceleration}
                                    onCheckedChange={(val) => setSettings({ ...settings, hardwareAcceleration: val })}
                                />
                            </div>
                            <div className="space-y-4 pt-4 border-t border-border/50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cache Allocation</Label>
                                    </div>
                                    <Badge variant="outline" className="font-black text-primary px-2 py-0.5 bg-primary/5 border-primary/20 text-xs">{settings.cacheSize} MB</Badge>
                                </div>
                                <Input
                                    type="range"
                                    min="100"
                                    max="5000"
                                    step="100"
                                    value={settings.cacheSize}
                                    onChange={(e) => setSettings({ ...settings, cacheSize: e.target.value })}
                                    className="h-1.5 bg-muted accent-primary cursor-pointer border-none p-0 appearance-none rounded-full"
                                />
                                <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg border border-border/50">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        Buffered file chunk storage
                                    </div>
                                    <Button variant="outline" size="sm" className="h-8 px-3 text-[10px] font-bold text-destructive hover:bg-destructive/10 border-destructive/20 transition-all">
                                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                        Clear Cache
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </section>
                    {/* About */}
                    <section id="about">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-xl bg-primary/10 shadow-inner">
                                <Info className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight text-foreground">About</h2>
                                <p className="text-xs text-muted-foreground">Hyper Connect platform intelligence</p>
                            </div>
                        </div>
                        <Card className="border-border/50 shadow-sm overflow-hidden bg-card/60 backdrop-blur-md">
                            <div className="p-8 flex flex-col items-center text-center space-y-4 relative overflow-hidden">
                                <div className="absolute inset-0 bg-primary/5 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
                                <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 rotate-3 transform transition-transform hover:rotate-0 duration-500 relative z-10">
                                    <RefreshCw className="h-8 w-8 text-primary-foreground animate-spin-slow" />
                                </div>
                                <div className="relative z-10">
                                    <h3 className="text-xl font-black tracking-tighter">Hyper Connect</h3>
                                    <p className="text-xs font-medium text-muted-foreground">v0.1.0-alpha.5 Build 2026</p>
                                </div>
                                <Badge variant="secondary" className="bg-primary/20 text-primary hover:bg-primary/30 border-none px-4 py-1 text-[9px] font-black uppercase tracking-widest relative z-10">
                                    Release Candidate
                                </Badge>
                            </div>
                            <div className="border-t border-border/50 bg-muted/20">
                                {[
                                    { label: 'Platform', value: 'macOS 15.2 (Silicon)', icon: Globe },
                                    { label: 'Identity', value: 'a3b9f2e1-4c5d-4a3b-9f2e-14c5d4a3b9f2', icon: Lock, isMono: true },
                                ].map((item) => (
                                    <div key={item.label} className="px-6 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <item.icon className="h-4 w-4 text-muted-foreground/70" />
                                            <span className="text-xs font-bold text-foreground/80">{item.label}</span>
                                        </div>
                                        <span className={cn("text-[10px] text-muted-foreground truncate max-w-[200px] font-medium", item.isMono && "font-mono bg-background/50 px-1.5 py-0.5 rounded")}>
                                            {item.value}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 flex flex-wrap gap-2 justify-center border-t border-border/50 bg-muted/10">
                                <Button variant="ghost" size="sm" className="text-[10px] font-bold gap-1.5 h-8 px-3 rounded-md">
                                    <ExternalLink className="h-3.5 w-3.5 text-primary" />
                                    Privacy
                                </Button>
                                <Button variant="ghost" size="sm" className="text-[10px] font-bold gap-1.5 h-8 px-3 rounded-md">
                                    <ExternalLink className="h-3.5 w-3.5 text-primary" />
                                    Terms
                                </Button>
                                <Button variant="ghost" size="sm" className="text-[10px] font-bold gap-1.5 h-8 px-3 rounded-md">
                                    <Shield className="h-3.5 w-3.5 text-primary" />
                                    Licenses
                                </Button>
                            </div>
                        </Card>
                    </section>
                    {/* Footer Spacer */}
                    <div className="h-8" />
                </div>
            </ScrollArea>
        </div>
    );
}
