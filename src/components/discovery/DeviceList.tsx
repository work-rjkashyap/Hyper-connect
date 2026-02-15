import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Smartphone, Laptop } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Device } from '@/types';

interface DeviceListProps {
    devices: Device[];
    onDeviceClick?: (device: Device) => void;
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: {
            type: "spring" as const,
            stiffness: 300,
            damping: 24
        }
    },
    exit: { scale: 0.95, opacity: 0 }
};

export default function DeviceList({ devices, onDeviceClick }: DeviceListProps) {
    const getOSIcon = (platform?: string) => {
        if (!platform) return Monitor;

        switch (os.toLowerCase()) {
            case 'windows':
                return Monitor;
            case 'mac':
            case 'macos':
                return Laptop;
            case 'linux':
                return Monitor;
            case 'android':
            case 'ios':
                return Smartphone;
            default:
                return Monitor;
        }
    };

    const getStatusColor = (lastSeen: number) => {
        const now = Date.now();
        const diff = now - lastSeen * 1000;

        if (diff < 60000) return 'bg-emerald-500 shadow-[0_0_8px_var(--emerald-500)]';
        if (diff < 300000) return 'bg-amber-500 shadow-[0_0_8px_var(--amber-500)]';
        return 'bg-muted-foreground';
    };

    const formatLastSeen = (lastSeen: number) => {
        const now = Date.now();
        const diff = now - lastSeen * 1000;

        if (diff < 60000) return 'Online';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    };

    if (devices.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center h-full p-12 text-center"
            >
                <div className="relative mb-6">
                    <motion.div
                        animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
                        transition={{ duration: 4, repeat: Infinity }}
                        className="absolute inset-0 bg-primary blur-2xl rounded-full"
                    />
                    <div className="relative w-24 h-24 rounded-3xl bg-muted/50 border border-border flex items-center justify-center">
                        <Monitor className="h-10 w-10 text-muted-foreground" />
                    </div>
                </div>
                <h3 className="font-black text-xl text-foreground mb-2">Searching for connection...</h3>
                <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                    Make sure other devices on this network have <span className="text-primary font-bold">Hyper-Connect</span> open and discovery enabled.
                </p>
                <motion.div
                    animate={{ x: [-10, 10, -10] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="mt-8 flex gap-1"
                >
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-1.5 w-1.5 rounded-full bg-primary/30" />
                    ))}
                </motion.div>
            </motion.div>
        );
    }

    return (
        <ScrollArea className="h-full">
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
                <AnimatePresence mode="popLayout">
                    {devices.map((device) => {
                        const Icon = getOSIcon(device.platform);
                        return (
                            <motion.button
                                key={device.device_id}
                                variants={itemVariants}
                                layout
                                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                                whileTap={{ scale: 0.98 }}
                                className="group relative flex items-start gap-4 p-5 rounded-2xl border border-border bg-card text-left transition-all hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5"
                                onClick={() => onDeviceClick?.(device)}
                            >
                                <div className="relative shrink-0">
                                    <Avatar className="h-14 w-14 rounded-xl border border-border/50 bg-muted/20">
                                        <AvatarFallback className="bg-primary/10 text-primary font-black text-lg">
                                            {device.display_name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span
                                        className={cn(
                                            "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-card z-10",
                                            getStatusColor(device.last_seen)
                                        )}
                                    />
                                </div>

                                <div className="flex-1 min-w-0 pt-0.5">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <h3 className="font-bold leading-none text-foreground truncate group-hover:text-primary transition-colors">
                                            {device.display_name}
                                        </h3>
                                        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                                    </div>

                                    <p className="text-[11px] font-mono text-muted-foreground truncate mb-3 bg-muted/30 px-1.5 py-0.5 rounded w-fit">
                                        {device.addresses[0] || 'Unknown IP'}
                                    </p>

                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="text-[9px] h-5 px-2 font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none shadow-none">
                                            {formatLastSeen(device.last_seen)}
                                        </Badge>
                                        {device.os && (
                                            <Badge variant="outline" className="text-[9px] h-5 px-2 font-bold uppercase tracking-wider border-border/50 text-muted-foreground">
                                                {device.os}
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="w-2 h-2 rounded-full bg-primary" />
                                </div>
                            </motion.button>
                        );
                    })}
                </AnimatePresence>
            </motion.div>
        </ScrollArea>
    );
}
