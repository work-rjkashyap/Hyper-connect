import { useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Pencil, Monitor, Smartphone, Laptop, Wifi, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store';
import type { Device } from '@/lib/schemas';

// Helper to get OS icon
const getOSIcon = (os?: string) => {
    if (!os) return Monitor;
    switch (os.toLowerCase()) {
        case 'windows': return Monitor;
        case 'mac':
        case 'macos': return Laptop;
        case 'linux': return Monitor;
        case 'android':
        case 'ios': return Smartphone;
        default: return Monitor;
    }
};

export default function DiscoveryPage() {
    const navigate = useNavigate();
    const { devices, deviceName, setDeviceName } = useAppStore();
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(deviceName || '');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (editName.trim()) {
            setDeviceName(editName.trim());
            setIsEditing(false);
        }
    };

    const handleCancel = () => {
        setEditName(deviceName || '');
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') handleCancel();
    };

    const handleDeviceClick = (device: Device) => {
        navigate(`/chat/${device.id}`);
    };

    return (
        <div className="flex flex-col h-full bg-background scroll-smooth">
            {/* Minimal Header */}
            <div className="px-8 pt-8 pb-6 flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tighter text-foreground flex items-center gap-3">
                        Local Discovery
                        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none font-bold text-[10px] uppercase tracking-wider px-2 h-5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                            Live
                        </Badge>
                    </h1>
                    <p className="text-sm text-muted-foreground font-medium">
                        Finding devices running <span className="text-primary font-bold">Hyper Connect</span> on your network.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-right mr-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">My Device</p>
                        {isEditing ? (
                            <div className="flex items-center gap-2 mt-1">
                                <Input
                                    ref={inputRef}
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="h-8 w-40 text-sm font-bold bg-muted/50 border-primary/20 focus-visible:ring-primary/30"
                                />
                                <div className="flex items-center gap-1">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 rounded-lg text-emerald-500 hover:bg-emerald-500/10"
                                        onClick={handleSave}
                                    >
                                        <Check className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10"
                                        onClick={handleCancel}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm font-bold">{deviceName || 'My Device'}</p>
                        )}
                    </div>
                    {!isEditing && (
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-xl hover:bg-primary/5 transition-colors border-border/50"
                            onClick={() => {
                                setEditName(deviceName || '');
                                setIsEditing(true);
                            }}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Device Grid */}
            <div className="flex-1 px-8 pb-10">
                {devices.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-6 pt-12">
                        <div className="relative">
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute -inset-10 bg-primary/10 blur-3xl rounded-full"
                            />
                            <div className="w-24 h-24 rounded-3xl bg-muted/30 flex items-center justify-center border border-dashed border-muted-foreground/30">
                                <Radio className="w-10 h-10 text-muted-foreground/30" strokeWidth={1.5} />
                            </div>
                        </div>
                        <div className="text-center max-w-xs space-y-2">
                            <h3 className="text-lg font-bold tracking-tight">Looking for connections...</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Connect to the same Wi-Fi and open Hyper Connect on other devices.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        <AnimatePresence mode="popLayout">
                            {devices.map((device, index) => {
                                const Icon = getOSIcon(device.os);
                                return (
                                    <motion.div
                                        key={device.id}
                                        layout
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: index * 0.05 }}
                                    >
                                        <Card
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => handleDeviceClick(device)}
                                            className="group relative cursor-pointer overflow-hidden border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 rounded-2xl bg-card"
                                        >
                                            <CardContent className="p-5">
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="p-3 rounded-2xl bg-primary/5 group-hover:bg-primary/10 transition-colors">
                                                        <Icon className="w-8 h-8 text-primary/70 group-hover:text-primary transition-colors" strokeWidth={1.5} />
                                                    </div>
                                                    <Badge variant="outline" className="text-[9px] font-black uppercase bg-muted/30 border-none group-hover:bg-primary/10 group-hover:text-primary transition-colors h-5">
                                                        {device.os || 'Unknown'}
                                                    </Badge>
                                                </div>

                                                <div className="space-y-1">
                                                    <h3 className="font-bold text-foreground truncate group-hover:text-primary transition-colors">
                                                        {device.name}
                                                    </h3>
                                                    <p className="text-[10px] text-muted-foreground font-medium font-mono">
                                                        {device.hostname}
                                                    </p>
                                                </div>

                                                <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground/60 tracking-wider">
                                                        <Wifi className="w-3 h-3" />
                                                        LOCAL NETWORK
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 rounded-lg text-primary bg-primary/5 hover:bg-primary/10"
                                                    >
                                                        <ArrowRightIcon className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}

function ArrowRightIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
        </svg>
    );
}
