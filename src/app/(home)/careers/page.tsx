import {
  BookOpen,
  Code,
  GitPullRequest,
  Heart,
  Monitor,
  Palette,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LandingFooter } from "@/components/landing/landing-footer";

export const metadata: Metadata = {
  title: "Contribute — Hyper Connect",
  description:
    "Contribute to Hyper Connect. Join our open source community and help build the future of local-first device communication.",
};

const reasons = [
  {
    icon: Code,
    title: "Open Source First",
    description:
      "Every line of code is public. Contribute features, fix bugs, or improve performance — all in the open.",
  },
  {
    icon: Users,
    title: "Welcoming Community",
    description:
      "We review every PR with care and mentor new contributors. First-time open source? You're welcome here.",
  },
  {
    icon: Heart,
    title: "Real Impact",
    description:
      "Your contributions ship to real users. Help people share files privately on their own network.",
  },
  {
    icon: GitPullRequest,
    title: "Ship Fast",
    description:
      "Small, focused codebase with fast CI. Most PRs are reviewed within 24 hours.",
  },
];

const areas = [
  {
    icon: Code,
    title: "Core Engine",
    description:
      "Work on mDNS discovery, peer-to-peer connections, encryption, and the TCP file transfer layer.",
    tags: ["Rust", "Networking", "Cryptography"],
  },
  {
    icon: Monitor,
    title: "Desktop Application",
    description:
      "Improve the Electron-based desktop app — UI components, system tray integration, and auto-updates.",
    tags: ["TypeScript", "Electron", "React"],
  },
  {
    icon: BookOpen,
    title: "Documentation",
    description:
      "Write guides, improve API docs, add examples, and help make Hyper Connect easier to use for everyone.",
    tags: ["MDX", "Technical Writing"],
  },
  {
    icon: Palette,
    title: "Design & UX",
    description:
      "Design new features, improve existing workflows, create icons, and help shape the visual identity.",
    tags: ["Figma", "UI/UX", "Accessibility"],
  },
];

export default function CareersPage() {
  return (
    <>
      <main className="bg-(--zed-bg) min-h-screen">
        {/* Hero */}
        <section className="relative pt-28 pb-14 border-b border-border">
          <div className="container max-w-3xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-fd-accent border border-border text-[10px] font-bold tracking-widest uppercase text-fd-muted-foreground mb-4">
              Open Source
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-fd-foreground mb-3 tracking-tight">
              Contribute to{" "}
              <span className="bg-linear-to-r from-cyan-600 to-violet-600 dark:from-cyan-400 dark:to-violet-400 bg-clip-text text-transparent">
                Hyper Connect
              </span>
            </h1>
            <p className="text-sm text-fd-muted-foreground font-medium max-w-lg leading-relaxed">
              Hyper Connect is built in the open. Whether you write code, docs,
              or designs — every contribution matters.
            </p>
          </div>
        </section>

        {/* Why Contribute */}
        <section className="relative py-14 border-b border-border">
          <div className="container max-w-3xl">
            <h2 className="text-xl font-bold text-fd-foreground mb-6 tracking-tight">
              Why Contribute
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reasons.map((reason) => (
                <div
                  key={reason.title}
                  className="rounded-md border border-border bg-fd-card/50 dark:bg-fd-card/30 p-5 backdrop-blur-sm"
                >
                  <div className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-border/50 mb-3">
                    <reason.icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-fd-foreground mb-1.5 tracking-tight">
                    {reason.title}
                  </h3>
                  <p className="text-[13px] text-fd-muted-foreground leading-relaxed font-medium">
                    {reason.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contribution Areas */}
        <section className="relative py-14">
          <div className="container max-w-3xl">
            <h2 className="text-xl font-bold text-fd-foreground mb-6 tracking-tight">
              Areas to Contribute
            </h2>
            <div className="space-y-3">
              {areas.map((area) => (
                <div
                  key={area.title}
                  className="group flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-md border border-border bg-fd-card/50 dark:bg-fd-card/30 p-5 backdrop-blur-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-border/50 shrink-0 mt-0.5">
                      <area.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-fd-foreground tracking-tight mb-1">
                        {area.title}
                      </h3>
                      <p className="text-[12px] text-fd-muted-foreground font-medium leading-relaxed">
                        {area.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 md:shrink-0">
                    {area.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-0.5 rounded-full bg-fd-accent border border-border text-[10px] font-bold tracking-widest uppercase text-fd-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-8 rounded-md border border-border bg-fd-card/50 dark:bg-fd-card/30 p-6 backdrop-blur-sm text-center">
              <h3 className="text-sm font-bold text-fd-foreground mb-2 tracking-tight">
                Ready to contribute?
              </h3>
              <p className="text-[13px] text-fd-muted-foreground font-medium mb-4">
                Check out our GitHub repository, pick an issue, and submit a
                pull request.
              </p>
              <Link
                href="https://github.com/work-rjkashyap/Hyper-connect"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-fd-primary text-fd-primary-foreground text-sm font-bold tracking-tight transition-opacity hover:opacity-90"
              >
                <GitPullRequest className="w-4 h-4" />
                View on GitHub
              </Link>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </>
  );
}
