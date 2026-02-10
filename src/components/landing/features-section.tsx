"use client";

import {
  MessageSquare,
  MonitorIcon,
  RefreshCw,
  Search,
  ShieldCheck,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: Search,
    title: "Zero-Config Discovery",
    description:
      "Find devices on your local network instantly using mDNS. No manual pairing required.",
    gradient: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  },
  {
    icon: Zap,
    title: "Fast Sharing",
    description:
      "Transfer files and folders at maximum local network speeds without hitting the cloud.",
    gradient: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  },
  {
    icon: MonitorIcon,
    title: "Cross-Platform",
    description:
      "Seamlessly connect and share between macOS, Windows, and Linux unified experience.",
    gradient: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  },
  {
    icon: MessageSquare,
    title: "Secure Messaging",
    description:
      "Chat instantly with devices on your network. Secure local messaging with replies and emojis.",
    gradient: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  },
  {
    icon: ShieldCheck,
    title: "Privacy First",
    description:
      "Your data never leaves your local network. End-to-end encrypted connections.",
    gradient: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  },
  {
    icon: RefreshCw,
    title: "Auto-Updates",
    description:
      "Stay up-to-date with a robust background update system that ensures latest features.",
    gradient: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  },
];

function FeatureCard({ feature }: { feature: (typeof features)[0] }) {
  const Icon = feature.icon;

  return (
    <div className="group relative rounded-md border border-border bg-fd-card/50 p-6 transition-all duration-300 hover:border-fd-primary/30 hover:shadow-lg backdrop-blur-sm hover:backdrop-blur-md overflow-hidden">
      {/* Dotted Background on Hover */}
      <div className="absolute inset-0 bg-dot opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Internal glow on hover */}
      <div className="absolute inset-0 bg-linear-to-br from-fd-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="relative z-10">
        <div
          className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${feature.gradient} mb-4 border border-border/50`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="text-base font-semibold text-fd-foreground mb-2 leading-tight">
          {feature.title}
        </h3>
        <p className="text-[13px] text-fd-muted-foreground leading-5 font-medium">
          {feature.description}
        </p>
      </div>
    </div>
  );
}

export function FeaturesSection(): React.ReactElement {
  return (
    <section className="relative py-14 border-t border-border bg-fd-accent/10">
      <div className="container">
        <div className="mb-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-fd-accent border border-border text-[10px] font-bold tracking-widest uppercase text-fd-muted-foreground mb-4">
            Features
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-fd-foreground mb-3 tracking-tight">
            Everything you need to{" "}
            <span className="bg-linear-to-r from-zinc-600 to-zinc-900 dark:from-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent">
              share at scale
            </span>
          </h2>
          <p className="text-sm text-fd-muted-foreground font-medium leading-relaxed">
            A powerful device communication system that enables seamless
            communication and file sharing between devices on your local
            network.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
