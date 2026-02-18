import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Globe, Shield, Zap, ArrowRight, Check, Loader2 } from "lucide-react";
import type { DeviceIdentity } from "@/types";

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
      // Persist display name to Rust backend (saves to device-identity.json on disk)
      await invoke("update_display_name", { name: trimmedName });

      // Fetch the full identity so we use the real backend-generated device_id
      const identity = await invoke<DeviceIdentity>("get_device_info");

      // Sync into Zustand (persisted to localStorage via the store's partialize)
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
    <div className="fixed inset-0 z-100 bg-background flex items-center justify-center p-6 overflow-hidden">
      {/* Animated Background Gradients */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/20 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            x: [0, -40, 0],
            opacity: [0.1, 0.15, 0.1],
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
              className="space-y-6 sm:space-y-8 text-center"
            >
              <div className="space-y-3 sm:space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-16 h-16 sm:w-20 sm:h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6"
                >
                  <Globe className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                </motion.div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tighter">
                  Welcome to Hyper Connect
                </h1>
                <p className="text-muted-foreground text-base sm:text-lg max-w-sm mx-auto">
                  The fastest way to share files and messages across your local
                  devices.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:gap-4 text-left">
                <FeatureCard
                  icon={
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                  }
                  title="Zero Configuration"
                  desc="Find devices instantly using mDNS. No setup required."
                />
                <FeatureCard
                  icon={
                    <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                  }
                  title="Private & Secure"
                  desc="Your data never leaves your local network."
                />
              </div>

              <Button
                size="lg"
                className="w-full h-12 sm:h-14 text-base sm:text-lg font-bold rounded-2xl group"
                onClick={() => setStep(2)}
              >
                Get Started
                <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 sm:space-y-8"
            >
              <div className="space-y-1 sm:space-y-2">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tighter">
                  Identity
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground">
                  How should other devices see you on the network?
                </p>
              </div>

              <div className="space-y-4 sm:space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="name"
                    className="text-xs sm:text-sm font-bold ml-1"
                  >
                    Device Name
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g. My Laptop, iPhone 15"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError(null);
                    }}
                    className="h-11 sm:h-14 text-sm sm:text-lg font-medium rounded-2xl bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-primary"
                    autoFocus
                    disabled={isLoading}
                    onKeyDown={(e) =>
                      e.key === "Enter" && !isLoading && handleComplete()
                    }
                  />
                  {error && (
                    <p className="text-xs text-destructive ml-1">{error}</p>
                  )}
                </div>

                <CardPreview name={name} />
              </div>

              <div className="flex gap-2 sm:gap-3">
                <Button
                  variant="ghost"
                  className="h-11 sm:h-14 px-4 sm:px-8 font-bold rounded-2xl text-sm sm:text-base"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
                <Button
                  size="lg"
                  className="flex-1 h-11 sm:h-14 text-sm sm:text-lg font-bold rounded-2xl"
                  disabled={!name.trim() || isLoading}
                  onClick={handleComplete}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="ml-2 w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Complete Setup
                      <Check className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
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

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-muted/30 border border-border/50">
      <div className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-background flex items-center justify-center shadow-sm">
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-xs sm:text-sm">{title}</h3>
        <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
          {desc}
        </p>
      </div>
    </div>
  );
}

function CardPreview({ name }: { name: string }) {
  return (
    <div className="p-3 sm:p-4 rounded-2xl bg-primary/5 border border-primary/10 border-dashed">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs sm:text-sm shrink-0">
          {name ? name[0].toUpperCase() : "?"}
        </div>
        <div className="min-w-0">
          <p className="text-[9px] sm:text-[10px] text-primary/60 font-black uppercase tracking-widest">
            Network Discovery
          </p>
          <p className="font-bold text-xs sm:text-base text-foreground truncate">
            {name || "Waiting for name..."}
          </p>
        </div>
      </div>
    </div>
  );
}
