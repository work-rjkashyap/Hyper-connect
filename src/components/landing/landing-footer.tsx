"use client";

import { Github, Twitter } from "lucide-react";
import Link from "next/link";
import { HyperconnectLogo } from "@/components/logo";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Getting Started", href: "/docs" },
      { label: "API Reference", href: "/docs" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Examples", href: "/docs" },
      { label: "Tutorials", href: "/docs" },
      { label: "Blog", href: "/blog" },
      { label: "Community", href: "/docs" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function LandingFooter(): React.ReactElement {
  return (
    <footer className="relative border-t border-border bg-fd-accent/10">
      <div className="container py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand column */}
          <div className="col-span-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 mb-4 group text-fd-foreground"
            >
              <HyperconnectLogo className="w-6 h-6" />
              <span className="font-bold text-base tracking-tight uppercase">
                Hyper Connect
              </span>
            </Link>
            <p className="text-[13px] text-fd-muted-foreground max-w-xs mb-6 leading-5 font-medium">
              The private local sharing layer for your network. Cross-platform,
              secure, and zero-configuration.
            </p>
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/work-rjkashyap/Hyper-connect"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-md border border-border text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-accent transition-all"
                aria-label="GitHub"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-md border border-border text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-accent transition-all"
                aria-label="Twitter"
              >
                <Twitter className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-[10px] font-bold text-fd-foreground mb-4 tracking-widest uppercase opacity-40">
                {col.title}
              </h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-fd-muted-foreground hover:text-fd-foreground transition-colors font-medium"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-14 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[11px] font-bold text-fd-muted-foreground/50 tracking-tight">
            &copy; {new Date().getFullYear()} Hyper Connect. All rights
            reserved.
          </p>
          <p className="text-[11px] font-bold text-fd-muted-foreground/50 tracking-tight">
            Built for the next generation of connected apps.
          </p>
        </div>
      </div>
    </footer>
  );
}
