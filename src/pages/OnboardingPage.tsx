import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe, Shield, Zap, ArrowRight, Check } from 'lucide-react';

export default function OnboardingPage() {
    const { setOnboarded, setDeviceName, setLocalDeviceId } = useAppStore();
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');

    const handleComplete = () => {
        if (!name.trim()) return;
        setDeviceName(name);
        setLocalDeviceId(crypto.randomUUID());
        setOnboarded(true);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center p-6 overflow-hidden">
            {/* Animated Background Gradients */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        x: [0, 50, 0],
                        opacity: [0.1, 0.2, 0.1]
                    }}
                    transition={{ duration: 10, repeat: Infinity }}
                    className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/20 rounded-full blur-[120px]"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.3, 1],
                        x: [0, -40, 0],
                        opacity: [0.1, 0.15, 0.1]
                    }}
                    transition={{ duration: 12, repeat: Infinity }}
                    className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-violet-600/10 rounded-full blur-[100px]"
                />
            </div>

            <div className="relative w-full max-w-lg">
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-8 text-center"
                        >
                            <div className="space-y-4">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6"
                                >
                                    <Globe className="w-10 h-10 text-primary" />
                                </motion.div>
                                <h1 className="text-4xl font-black tracking-tighter">Welcome to Hyper Connect</h1>
                                <p className="text-muted-foreground text-lg max-w-sm mx-auto">
                                    The fastest way to share files and messages across your local devices.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 text-left">
                                <FeatureCard
                                    icon={<Zap className="w-5 h-5 text-amber-500" />}
                                    title="Zero Configuration"
                                    desc="Find devices instantly using mDNS. No setup required."
                                />
                                <FeatureCard
                                    icon={<Shield className="w-5 h-5 text-emerald-500" />}
                                    title="Private & Secure"
                                    desc="Your data never leaves your local network."
                                />
                            </div>

                            <Button
                                size="lg"
                                className="w-full h-14 text-lg font-bold rounded-2xl group"
                                onClick={() => setStep(2)}
                            >
                                Get Started
                                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-8"
                        >
                            <div className="space-y-2">
                                <h2 className="text-3xl font-black tracking-tighter">Identity</h2>
                                <p className="text-muted-foreground">How should other devices see you on the network?</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-sm font-bold ml-1">Device Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g. My Laptop, iPhone 15"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="h-14 text-lg font-medium rounded-2xl bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-primary"
                                        autoFocus
                                        onKeyDown={(e) => e.key === 'Enter' && handleComplete()}
                                    />
                                </div>

                                <CardPreview name={name} />
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    variant="ghost"
                                    className="h-14 px-8 font-bold rounded-2xl"
                                    onClick={() => setStep(1)}
                                >
                                    Back
                                </Button>
                                <Button
                                    size="lg"
                                    className="flex-1 h-14 text-lg font-bold rounded-2xl"
                                    disabled={!name.trim()}
                                    onClick={handleComplete}
                                >
                                    Complete Setup
                                    <Check className="ml-2 w-5 h-5" />
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
    return (
        <div className="flex gap-4 p-4 rounded-2xl bg-muted/30 border border-border/50">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-background flex items-center justify-center shadow-sm">
                {icon}
            </div>
            <div>
                <h3 className="font-bold text-sm">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
        </div>
    );
}

function CardPreview({ name }: { name: string }) {
    return (
        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 border-dashed">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black">
                    {name ? name[0].toUpperCase() : '?'}
                </div>
                <div>
                    <p className="text-[10px] text-primary/60 font-black uppercase tracking-widest">Network Discovery</p>
                    <p className="font-bold text-foreground truncate max-w-[200px]">{name || 'Waiting for name...'}</p>
                </div>
            </div>
        </div>
    );
}
