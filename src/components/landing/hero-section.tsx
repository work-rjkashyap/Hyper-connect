"use client";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Download, Github, Terminal } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

const pills = [
  "Zero Configuration",
  "mDNS Discovery",
  "P2P File Transfer",
  "End-to-End Encryption",
  "Cross-Platform",
  "Real-time Chat",
  "Zero Configuration",
  "mDNS Discovery",
  "P2P File Transfer",
  "End-to-End Encryption",
  "Cross-Platform",
  "Real-time Chat",
];
const codeLines = [
  {
    num: 1,
    text: "[Hyper-connect] Starting engine...",
    color: "text-slate-400",
  },
  {
    num: 2,
    text: "[Hyper-connect] Searching for devices...",
    color: "text-teal-500",
  },
  { num: 3, text: "", color: "" },
  {
    num: 4,
    text: "[Discovery] Found: iPhone 15 (192.168.1.15)",
    color: "text-emerald-500",
  },
  {
    num: 5,
    text: "[Discovery] Found: MacBook Pro (192.168.1.22)",
    color: "text-emerald-500",
  },
  {
    num: 6,
    text: "[Discovery] Found: Ubuntu-Server (192.168.1.60)",
    color: "text-emerald-500",
  },
  { num: 7, text: "", color: "" },
  {
    num: 8,
    text: "[Transfer] Connecting to MacBook Pro...",
    color: "text-slate-500 dark:text-slate-300",
  },
  {
    num: 9,
    text: "[Transfer] Sending 'project_blueprint.pdf'...",
    color: "text-teal-500",
  },
  {
    num: 10,
    text: "[Transfer] Progress: ████████░░░ 72%",
    color: "text-teal-600",
  },
  {
    num: 11,
    text: "[Transfer] Speed: 84.5 MB/s",
    color: "text-slate-400 dark:text-slate-400",
  },
  { num: 12, text: "", color: "" },
  {
    num: 13,
    text: "[Done] 'project_blueprint.pdf' shared.",
    color: "text-emerald-500",
  },
];
export function HeroSection(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 25, stiffness: 150 };
  const springX = useSpring(mouseX, springConfig);
  const springY = useSpring(mouseY, springConfig);
  const spotlightBackground = useTransform(
    [springX, springY],
    ([x, y]) =>
      `radial-gradient(1000px circle at ${x}px ${y}px, var(--color-fd-primary), transparent 40%)`,
  );
  function handleMouseMove({
    currentTarget,
    clientX,
    clientY,
  }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }
  return (
    <section
      ref={containerRef}
      onMouseMove={handleMouseMove}
      aria-label="Hero Section"
      className="relative overflow-hidden pt-28 pb-14 bg-fd-background"
    >
      {/* Top Light Source */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[80%] max-w-5xl h-125 bg-fd-primary/10 dark:bg-fd-primary/20 blur-[120px] rounded-full pointer-events-none" />
      {/* Grid Background */}
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-80 bg-linear-to-t from-fd-background via-fd-background/50 to-transparent pointer-events-none z-1" />
      {/* Spotlight Effect (Mouse Follow) */}
      <motion.div
        className="absolute inset-0 pointer-events-none opacity-[0.08] dark:opacity-[0.12]"
        style={{ background: spotlightBackground }}
      />
      <div className="container relative py-1 md:py-4">
        <div className="grid lg:grid-cols-2 gap-8 items-start lg:items-center">
          {/* Left – Copy */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="space-y-4"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-fd-accent/50 text-[10px] font-bold tracking-widest uppercase text-fd-foreground backdrop-blur-md">
              <span className="w-1 h-1 rounded-full bg-fd-foreground animate-pulse" />
              Private local sharing
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-2 leading-[1.1] text-pretty text-fd-foreground">
              Share everything <br />
              <span className="text-fd-muted-foreground">
                across any device.
              </span>
            </h1>
            <p className="text-sm md:text-base text-fd-muted-foreground font-medium max-w-lg mb-6 leading-relaxed">
              Hyper Connect is the cross-platform sharing layer for your local
              network. No cloud, no configuration — just seamless connectivity.
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <Link
                href="/docs"
                className="h-10 group inline-flex items-center gap-2 px-5 rounded-md bg-fd-foreground text-fd-background font-bold text-sm tracking-tight shadow-sm hover:opacity-90 transition-all duration-300"
              >
                <Download className="w-4 h-4" />
                Download App
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="https://github.com/work-rjkashyap/Hyper-connect"
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 inline-flex items-center gap-2 px-5 rounded-md border border-border text-fd-foreground font-bold text-sm tracking-tight hover:bg-fd-accent transition-all duration-300 bg-fd-accent/20 backdrop-blur-sm"
              >
                <Github className="w-4 h-4" />
                GitHub
              </a>
            </div>
            {/* Install command */}
            <div className="pt-4">
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-md bg-fd-accent/30 border border-border font-mono text-[12px] backdrop-blur-md">
                <span className="text-fd-muted-foreground select-none">#</span>
                <span className="text-fd-foreground/80">
                  brew install hyper-connect
                </span>
                <span className="w-1.5 h-3.5 bg-fd-foreground animate-[blink_1s_infinite]" />
              </div>
            </div>
          </motion.div>
          <div className="relative hidden lg:block">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: 0.2,
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative"
            >
              <div className="relative rounded-md border border-border bg-fd-card/80 dark:bg-black/60 backdrop-blur-2xl shadow-xl overflow-hidden group transition-all duration-500 hover:shadow-2xl hover:border-fd-foreground/20">
                {/* Internal glow */}
                <div className="absolute inset-0 bg-linear-to-br from-fd-foreground/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                {/* Dotted Background on Hover */}
                <div className="absolute inset-0 bg-dot opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none" />
                {/* Title bar */}
                <div className="flex items-center gap-2 px-4 py-2 bg-fd-accent/30 border-b border-border backdrop-blur-md relative z-10">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-fd-foreground/10 border border-border" />
                    <div className="w-2.5 h-2.5 rounded-full bg-fd-foreground/10 border border-border" />
                    <div className="w-2.5 h-2.5 rounded-full bg-fd-foreground/10 border border-border" />
                  </div>
                  <div className="flex items-center gap-2 ml-4 text-[10px] font-bold tracking-widest uppercase text-fd-muted-foreground/60">
                    <Terminal className="w-3 h-3" />
                    <span>Logs — Hyper-connect Engine</span>
                  </div>
                </div>
                {/* Code content */}
                <div className="p-6 font-mono text-[11px] md:text-[12px] leading-6 overflow-hidden">
                  {codeLines.map((line) => (
                    <div key={line.num} className="flex">
                      <span className="w-6 text-right text-fd-muted-foreground/30 select-none mr-4">
                        {line.num}
                      </span>
                      <span
                        className={line.color
                          .replace("teal", "neutral")
                          .replace("emerald", "neutral")
                          .replace("slate", "neutral")}
                      >
                        {line.text}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Bottom bar */}
                <div className="flex items-center gap-2 px-4 py-2 bg-fd-accent/20 border-t border-border text-[9px] font-bold tracking-widest uppercase text-fd-muted-foreground/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-fd-foreground/50 animate-pulse" />
                  <span>Engine Active</span>
                  <span className="ml-auto">Local Discovery On</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
        {/* Scrolling pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-12 overflow-hidden relative"
        >
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-linear-to-r from-fd-background to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-linear-to-l from-fd-background to-transparent z-10" />
          <div className="flex gap-4 animate-marquee py-2">
            {pills.map((pill, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: Static pills
                key={`${pill}-${i}`}
                className="shrink-0 px-4 py-1.5 rounded-md border border-border bg-fd-accent/30 text-[10px] font-bold tracking-widest uppercase text-fd-muted-foreground whitespace-nowrap backdrop-blur-sm hover:text-fd-foreground hover:border-fd-muted-foreground/20 transition-colors cursor-default"
              >
                {pill}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
