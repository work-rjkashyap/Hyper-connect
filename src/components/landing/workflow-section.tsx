"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Link as LinkIcon, Search, Share2 } from "lucide-react";
import { useState } from "react";

const steps = [
  {
    id: "discover",
    label: "Step 1",
    icon: Search,
    title: "Device Discovery",
    description:
      "Hyper Connect automatically finds supported devices on your network using mDNS. No setup required.",
    logs: `[mDNS] Querying for local peers...
[Node] iPhone (192.168.1.15) discovered.
[Node] Desktop-PC (192.168.1.42) discovered.`,
  },
  {
    id: "connect",
    label: "Step 2",
    icon: LinkIcon,
    title: "Secure Connection",
    description:
      "Pair devices with a single tap. Once connected, an end-to-end encrypted tunnel is established.",
    logs: `[Connect] Pairing with Desktop-PC...
[Auth] Handshake successful.
[Secure] Encrypted session established.`,
  },
  {
    id: "share",
    label: "Step 3",
    icon: Share2,
    title: "Sync & Share",
    description:
      "Drag and drop files or send messages across devices. Real-time progress tracking keeps you informed.",
    logs: `[Transfer] Sending 'holiday_video.mp4'...
[P2P] Streaming via local TCP...
[Transfer] 450MB / 1.2GB (42MB/s)`,
  },
];

export function WorkflowSection(): React.ReactElement {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section className="relative py-14 border-t border-border bg-fd-accent/10 dark:bg-fd-background">
      <div className="container overflow-hidden">
        <div className="max-w-2xl mb-10">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-fd-accent border border-border text-[10px] font-bold tracking-widest uppercase text-fd-muted-foreground mb-4">
            Workflow
          </div>
          <h2 className="text-2xl font-bold text-fd-foreground mb-3 tracking-tight">
            How it{" "}
            <span className="bg-linear-to-r from-cyan-600 to-violet-600 dark:from-cyan-400 dark:to-violet-400 bg-clip-text text-transparent">
              works
            </span>
          </h2>
          <p className="text-sm text-fd-muted-foreground font-medium max-w-lg leading-relaxed">
            Three simple steps to seamless local connectivity across all your
            devices.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.5fr] gap-8 items-start">
          {/* Tabs */}
          <div className="space-y-2">
            {steps.map((step, i) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(i)}
                className={`w-full group relative flex items-start gap-4 p-4 rounded-md border text-left transition-all duration-200 ${
                  activeStep === i
                    ? "bg-fd-accent dark:bg-fd-accent/60 border-fd-primary/30 ring-1 ring-fd-primary/10 dark:ring-fd-primary/20"
                    : "bg-transparent border-border hover:bg-fd-accent/50 dark:hover:bg-fd-accent/30 hover:border-fd-muted-foreground/20"
                }`}
              >
                <div
                  className={`p-2 rounded-md border ${
                    activeStep === i
                      ? "bg-fd-primary text-white dark:text-black border-fd-primary"
                      : "bg-fd-accent/50 dark:bg-fd-accent/30 text-fd-muted-foreground border-border"
                  }`}
                >
                  <step.icon className="w-4 h-4" />
                </div>
                <div>
                  <h4
                    className={`text-sm font-bold tracking-tight mb-1 ${activeStep === i ? "text-fd-foreground" : "text-fd-muted-foreground/80"}`}
                  >
                    {step.title}
                  </h4>
                  <p className="text-[12px] text-fd-muted-foreground leading-snug line-clamp-1">
                    {step.description}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Code/Terminal */}
          <div className="relative">
            <div className="relative rounded-md border border-border bg-fd-card/50 dark:bg-black/60 backdrop-blur-xl overflow-hidden shadow-sm dark:shadow-none">
              <div className="flex items-center gap-2 px-4 py-2 bg-fd-accent/30 dark:bg-fd-accent/20 border-b border-border">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-fd-foreground/5 dark:bg-fd-foreground/10 border border-border" />
                  <div className="w-2 h-2 rounded-full bg-fd-foreground/5 dark:bg-fd-foreground/10 border border-border" />
                  <div className="w-2 h-2 rounded-full bg-fd-foreground/5 dark:bg-fd-foreground/10 border border-border" />
                </div>
                <span className="ml-2 text-[10px] font-bold tracking-widest uppercase text-fd-muted-foreground/50">
                  Process Log — {steps[activeStep].id}
                </span>
              </div>
              <AnimatePresence mode="wait">
                <motion.pre
                  key={activeStep}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.3 }}
                  className="p-5 text-[12px] font-mono leading-relaxed"
                >
                  <code className="text-fd-foreground/80 dark:text-fd-foreground/70 block font-bold dark:font-normal">
                    {steps[activeStep].logs}
                  </code>
                </motion.pre>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
