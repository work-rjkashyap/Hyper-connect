import {
    Globe,
    Shield,
    Users,
    Zap,
} from "lucide-react";
import type { Metadata } from "next";
import { LandingFooter } from "@/components/landing/landing-footer";

export const metadata: Metadata = {
    title: "About — Hyper Connect",
    description:
        "Learn about Hyper Connect — the private, cross-platform local sharing layer for your network.",
};

const values = [
    {
        icon: Shield,
        title: "Privacy First",
        description:
            "Your data never leaves your local network. We believe privacy is a fundamental right, not a feature toggle.",
    },
    {
        icon: Zap,
        title: "Performance Obsessed",
        description:
            "We optimize for speed at every layer — from mDNS discovery to raw TCP file transfers at LAN speeds.",
    },
    {
        icon: Globe,
        title: "Cross-Platform",
        description:
            "One experience across macOS, Windows, and Linux. We build for every platform, not just the popular ones.",
    },
    {
        icon: Users,
        title: "Community Driven",
        description:
            "Open source from day one. We build in public, accept contributions, and listen to our community.",
    },
];

const timeline = [
    {
        year: "2026",
        title: "Public Launch",
        description:
            "Hyper Connect launches with support for macOS, Windows, and Linux. Zero-config device discovery and encrypted file sharing.",
    },
    {
        year: "2025",
        title: "Development Begins",
        description:
            "The idea for a simple, private, local-first sharing tool takes shape. Early prototypes built with Electron and mDNS.",
    },
];

export default function AboutPage() {
    return (
        <>
            <main className="bg-(--zed-bg) min-h-screen">
                {/* Hero */}
                <section className="relative pt-28 pb-14 border-b border-border">
                    <div className="container max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-fd-accent border border-border text-[10px] font-bold tracking-widest uppercase text-fd-muted-foreground mb-4">
                            Company
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-fd-foreground mb-3 tracking-tight">
                            About{" "}
                            <span className="bg-linear-to-r from-cyan-600 to-violet-600 dark:from-cyan-400 dark:to-violet-400 bg-clip-text text-transparent">
                                Hyper Connect
                            </span>
                        </h1>
                        <p className="text-sm text-fd-muted-foreground font-medium max-w-lg leading-relaxed">
                            We&apos;re building the private local sharing layer for your
                            network — cross-platform, secure, and zero-configuration.
                        </p>
                    </div>
                </section>

                {/* Mission */}
                <section className="relative py-14 border-b border-border">
                    <div className="container max-w-3xl">
                        <h2 className="text-xl font-bold text-fd-foreground mb-4 tracking-tight">
                            Our Mission
                        </h2>
                        <div className="rounded-md border border-border bg-fd-card/50 dark:bg-fd-card/30 p-6 backdrop-blur-sm">
                            <p className="text-[14px] text-fd-muted-foreground leading-relaxed font-medium">
                                In a world where every file transfer gets routed through the
                                cloud, we believe there&apos;s a better way. Hyper Connect
                                enables seamless communication between devices on your local
                                network — no accounts, no cloud, no compromises. Just fast,
                                private, peer-to-peer sharing the way it should be.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Values */}
                <section className="relative py-14 border-b border-border">
                    <div className="container max-w-3xl">
                        <h2 className="text-xl font-bold text-fd-foreground mb-6 tracking-tight">
                            What We Believe
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {values.map((value) => (
                                <div
                                    key={value.title}
                                    className="rounded-md border border-border bg-fd-card/50 dark:bg-fd-card/30 p-5 backdrop-blur-sm"
                                >
                                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-border/50 mb-3">
                                        <value.icon className="w-4 h-4" />
                                    </div>
                                    <h3 className="text-sm font-bold text-fd-foreground mb-1.5 tracking-tight">
                                        {value.title}
                                    </h3>
                                    <p className="text-[13px] text-fd-muted-foreground leading-relaxed font-medium">
                                        {value.description}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Timeline */}
                <section className="relative py-14">
                    <div className="container max-w-3xl">
                        <h2 className="text-xl font-bold text-fd-foreground mb-6 tracking-tight">
                            Our Journey
                        </h2>
                        <div className="relative">
                            <div className="absolute left-1.75 top-2 bottom-2 w-px bg-border hidden md:block" />
                            <div className="space-y-8">
                                {timeline.map((item) => (
                                    <div key={item.year} className="relative">
                                        <div className="absolute left-0 top-1.5 w-3.75 h-3.75 rounded-full border-2 border-fd-primary bg-fd-background z-10 hidden md:block" />
                                        <div className="md:pl-10">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-fd-primary text-fd-primary-foreground text-sm font-bold tracking-tight">
                                                    {item.year}
                                                </span>
                                                <h3 className="text-sm font-bold text-fd-foreground tracking-tight">
                                                    {item.title}
                                                </h3>
                                            </div>
                                            <p className="text-[13px] text-fd-muted-foreground leading-relaxed font-medium">
                                                {item.description}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            </main>
            <LandingFooter />
        </>
    );
}
