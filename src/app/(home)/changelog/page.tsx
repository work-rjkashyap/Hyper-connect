import fs from "node:fs";
import path from "node:path";
import {
    Bug,
    Code,
    FileText,
    Palette,
    Rocket,
    Settings,
    Wrench,
} from "lucide-react";
import type { Metadata } from "next";
import { LandingFooter } from "@/components/landing/landing-footer";

export const metadata: Metadata = {
    title: "Changelog — Hyper Connect",
    description:
        "All notable changes and updates to Hyper Connect, documented by version.",
};

interface ChangelogEntry {
    version: string;
    date: string | null;
    sections: {
        title: string;
        emoji: string;
        items: string[];
    }[];
}

function parseChangelog(content: string): ChangelogEntry[] {
    const entries: ChangelogEntry[] = [];
    let currentEntry: ChangelogEntry | null = null;
    let currentSection: { title: string; emoji: string; items: string[] } | null =
        null;

    const lines = content.split("\n");

    for (const line of lines) {
        // Match version headers: ## [1.8.0] - 2026-02-03 or ## [Unreleased]
        const versionMatch = line.match(
            /^## \[([^\]]+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?/,
        );
        if (versionMatch) {
            if (currentSection && currentEntry) {
                currentEntry.sections.push(currentSection);
            }
            if (currentEntry) {
                entries.push(currentEntry);
            }
            currentEntry = {
                version: versionMatch[1],
                date: versionMatch[2] || null,
                sections: [],
            };
            currentSection = null;
            continue;
        }

        // Match section headers: ### 🚀 Features
        const sectionMatch = line.match(/^### (.+)/);
        if (sectionMatch && currentEntry) {
            if (currentSection) {
                currentEntry.sections.push(currentSection);
            }
            const rawTitle = sectionMatch[1].trim();
            // Extract emoji if present
            const emojiMatch = rawTitle.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u);
            const emoji = emojiMatch ? emojiMatch[1] : "";
            const title = emoji ? rawTitle.slice(emojiMatch![0].length) : rawTitle;

            currentSection = { title, emoji, items: [] };
            continue;
        }

        // Match list items: - Some change
        const itemMatch = line.match(/^- (.+)/);
        if (itemMatch && currentSection) {
            currentSection.items.push(itemMatch[1].trim());
        }
    }

    // Push last section and entry
    if (currentSection && currentEntry) {
        currentEntry.sections.push(currentSection);
    }
    if (currentEntry) {
        entries.push(currentEntry);
    }

    return entries;
}

function getCategoryIcon(title: string, emoji: string) {
    const lower = title.toLowerCase();
    if (emoji === "🚀" || lower.includes("feature"))
        return <Rocket className="w-3.5 h-3.5" />;
    if (emoji === "🐛" || lower.includes("bug") || lower.includes("fix"))
        return <Bug className="w-3.5 h-3.5" />;
    if (emoji === "📚" || lower.includes("doc"))
        return <FileText className="w-3.5 h-3.5" />;
    if (emoji === "🚜" || lower.includes("refactor"))
        return <Wrench className="w-3.5 h-3.5" />;
    if (emoji === "🎨" || lower.includes("styl"))
        return <Palette className="w-3.5 h-3.5" />;
    if (emoji === "⚙️" || lower.includes("miscellaneous") || lower.includes("build"))
        return <Settings className="w-3.5 h-3.5" />;
    return <Code className="w-3.5 h-3.5" />;
}

function getCategoryColor(title: string, emoji: string): string {
    const lower = title.toLowerCase();
    if (emoji === "🚀" || lower.includes("feature"))
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    if (emoji === "🐛" || lower.includes("bug") || lower.includes("fix"))
        return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    if (emoji === "📚" || lower.includes("doc"))
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    if (emoji === "🚜" || lower.includes("refactor"))
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    if (emoji === "🎨" || lower.includes("styl"))
        return "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20";
    if (emoji === "⚙️" || lower.includes("miscellaneous") || lower.includes("build"))
        return "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20";
    return "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20";
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

export default function ChangelogPage() {
    const changelogPath = path.join(process.cwd(), "CHANGELOG.md");
    const content = fs.readFileSync(changelogPath, "utf-8");
    const entries = parseChangelog(content);

    return (
        <>
            <main className="bg-(--zed-bg) min-h-screen">
                <section className="relative pt-28 pb-14 border-b border-border">
                    <div className="container max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-fd-accent border border-border text-[10px] font-bold tracking-widest uppercase text-fd-muted-foreground mb-4">
                            Updates
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-fd-foreground mb-3 tracking-tight">
                            Changelog
                        </h1>
                        <p className="text-sm text-fd-muted-foreground font-medium max-w-lg leading-relaxed">
                            All notable changes to Hyper Connect are documented here. Each
                            release includes new features, bug fixes, and improvements.
                        </p>
                    </div>
                </section>

                <section className="relative py-14">
                    <div className="container max-w-3xl">
                        <div className="relative">
                            {/* Timeline line */}
                            <div className="absolute left-1.75 top-2 bottom-2 w-px bg-border hidden md:block" />

                            <div className="space-y-12">
                                {entries.map((entry) => (
                                    <div key={entry.version} className="relative">
                                        {/* Timeline dot */}
                                        <div className="absolute left-0 top-1.5 w-3.75 h-3.75 rounded-full border-2 border-fd-primary bg-fd-background z-10 hidden md:block" />

                                        <div className="md:pl-10">
                                            {/* Version header */}
                                            <div className="flex flex-wrap items-center gap-3 mb-5">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-fd-primary text-fd-primary-foreground text-sm font-bold tracking-tight">
                                                    v{entry.version === "Unreleased" ? "Next" : entry.version}
                                                </span>
                                                {entry.date && (
                                                    <span className="text-[13px] text-fd-muted-foreground font-medium">
                                                        {formatDate(entry.date)}
                                                    </span>
                                                )}
                                                {entry.version === "Unreleased" && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold tracking-widest uppercase">
                                                        Upcoming
                                                    </span>
                                                )}
                                            </div>

                                            {/* Sections */}
                                            <div className="space-y-5">
                                                {entry.sections.map((section) => (
                                                    <div
                                                        key={`${entry.version}-${section.title}`}
                                                        className="rounded-md border border-border bg-fd-card/50 dark:bg-fd-card/30 p-5 backdrop-blur-sm"
                                                    >
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <div
                                                                className={`inline-flex items-center justify-center w-6 h-6 rounded-md border ${getCategoryColor(section.title, section.emoji)}`}
                                                            >
                                                                {getCategoryIcon(section.title, section.emoji)}
                                                            </div>
                                                            <h3 className="text-sm font-bold text-fd-foreground tracking-tight">
                                                                {section.title}
                                                            </h3>
                                                        </div>
                                                        <ul className="space-y-1.5">
                                                            {section.items.map((item) => (
                                                                <li
                                                                    key={`${entry.version}-${section.title}-${item.slice(0, 40)}`}
                                                                    className="flex items-start gap-2 text-[13px] text-fd-muted-foreground leading-relaxed font-medium"
                                                                >
                                                                    <span className="mt-2 w-1 h-1 rounded-full bg-fd-muted-foreground/40 shrink-0" />
                                                                    {item}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
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
