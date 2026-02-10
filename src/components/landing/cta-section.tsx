"use client";

import { motion } from "framer-motion";
import { ArrowRight, Download, Monitor, Sparkles } from "lucide-react";
import { FaAndroid, FaApple, FaLinux, FaWindows } from "react-icons/fa";
import { RiSmartphoneLine } from "react-icons/ri";

export function CtaSection(): React.ReactElement {
  return (
    <section className="relative py-20 border-t border-border overflow-hidden bg-fd-accent/10">
      <div className="container relative text-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 mb-6 rounded-full border border-border bg-fd-accent text-[10px] font-bold tracking-widest uppercase text-fd-muted-foreground">
            <Sparkles className="w-3 h-3" />
            Cross-platform desktop sharing
          </div>

          <h2 className="text-3xl font-bold text-fd-foreground mb-4 tracking-tight">
            Ready for{" "}
            <span className="bg-linear-to-r from-zinc-600 to-zinc-900 dark:from-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent">
              seamless sharing?
            </span>
          </h2>

          <p className="text-base text-fd-muted-foreground mb-8 font-medium leading-relaxed">
            Join thousands using Hyper Connect to bridge their devices. Download
            for your platform today.
          </p>

          <div className="flex flex-col items-center gap-10">
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href="https://github.com/work-rjkashyap/Hyper-connect/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 group inline-flex items-center gap-2 px-6 rounded-md bg-fd-primary text-fd-primary-foreground font-bold text-sm tracking-tight shadow-md hover:opacity-90 transition-all duration-300"
              >
                <Download className="w-4 h-4" />
                Download for macOS
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="https://github.com/work-rjkashyap/Hyper-connect/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 inline-flex items-center gap-2 px-6 rounded-md border border-border text-fd-foreground font-bold text-sm tracking-tight hover:bg-fd-accent transition-all duration-300"
              >
                <Monitor className="w-4 h-4" />
                Windows & Linux
              </a>
            </div>

            {/* Platforms Container */}
            <div className="space-y-6">
              {/* Desktop Platforms */}
              <div className="flex flex-col items-center gap-3">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-fd-muted-foreground/40">
                  Available on
                </span>
                <div className="flex items-center gap-8 text-fd-muted-foreground/60">
                  <div className="flex flex-col items-center gap-1.5 hover:text-fd-foreground transition-colors group cursor-default">
                    <FaApple className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="text-[9px] font-bold tracking-widest uppercase">
                      macOS
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 hover:text-fd-foreground transition-colors group cursor-default">
                    <FaWindows className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="text-[9px] font-bold tracking-widest uppercase">
                      Windows
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 hover:text-fd-foreground transition-colors group cursor-default">
                    <FaLinux className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="text-[9px] font-bold tracking-widest uppercase">
                      Linux
                    </span>
                  </div>
                </div>
              </div>

              {/* Mobile - Coming Soon */}
              <div className="flex flex-col items-center gap-3">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-fd-muted-foreground/40">
                  Coming Soon
                </span>
                <div className="flex items-center gap-8 text-fd-muted-foreground/30">
                  <div className="flex flex-col items-center gap-1.5 group cursor-default">
                    <FaAndroid className="w-5 h-5" />
                    <span className="text-[9px] font-bold tracking-widest uppercase">
                      Android
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 group cursor-default">
                    <RiSmartphoneLine className="w-5 h-5" />
                    <span className="text-[9px] font-bold tracking-widest uppercase">
                      iOS App
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
