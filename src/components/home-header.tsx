"use client";

import Link from "next/link";
import { HyperconnectLogo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export function HomeHeader(): React.ReactElement {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 px-6 md:px-12 py-6 animate-[fadeInDown_0.6s_ease-out]">
            <nav className="max-w-7xl mx-auto flex items-center justify-between">
                <Link href="/" className="group flex items-center gap-3">
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-violet-500 blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
                        <div className="relative flex items-center px-3 py-2 bg-slate-900/80 backdrop-blur-xl border-2 border-slate-700 group-hover:border-cyan-400 transition-colors">
                            <HyperconnectLogo className="w-7 h-7 shrink-0" />
                        </div>
                    </div>
                </Link>

                <div className="flex items-center gap-6">
                    <Link
                        href="/docs"
                        className="hidden md:inline-flex text-sm font-bold tracking-wider text-slate-300 hover:text-cyan-400 transition-colors"
                    >
                        DOCS
                    </Link>
                    <a
                        href="https://github.com/work-rjkashyap/Hyper-connect"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden md:inline-flex text-sm font-bold tracking-wider text-slate-300 hover:text-cyan-400 transition-colors"
                    >
                        GITHUB
                    </a>
                    <ThemeToggle />
                </div>
            </nav>
        </header>
    );
}
