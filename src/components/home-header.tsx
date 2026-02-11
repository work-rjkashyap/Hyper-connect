"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { Command, Github, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FaXTwitter } from "react-icons/fa6";
import { HyperconnectLogo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export function HomeHeader(): React.ReactElement {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { setOpenSearch } = useSearchContext();

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navLinks = [
        { name: "Docs", href: "/docs" },
    ];

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${scrolled
                    ? "py-3 bg-fd-background/80 backdrop-blur-md border-border shadow-xs"
                    : "py-4 bg-transparent border-transparent"
                }`}
        >
            <div className="container flex items-center justify-between gap-4">
                {/* Left: Logo & Nav */}
                <div className="flex items-center gap-8">
                    <Link href="/" className="group flex items-center gap-2">
                        <HyperconnectLogo className="w-8 h-8 shrink-0 text-fd-foreground" />
                    </Link>

                    <nav className="hidden lg:flex items-center gap-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className="h-8 px-3 inline-flex items-center text-sm font-normal text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-accent rounded-md transition-all"
                            >
                                {link.name}
                            </Link>
                        ))}
                    </nav>
                </div>

                {/* Right: Search, Socials, Theme */}
                <div className="flex items-center gap-2 sm:gap-4">
                    {/* Search Trigger */}
                    <button
                        type="button"
                        onClick={() => setOpenSearch(true)}
                        className="hidden md:flex items-center justify-between w-48 lg:w-64 h-8 px-3 rounded-md bg-fd-accent/50 border border-border hover:border-fd-accent-foreground/20 text-fd-muted-foreground transition-all group"
                    >
                        <div className="flex items-center gap-2">
                            <Search className="w-3.5 h-3.5" />
                            <span className="text-[13px]">Search...</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="flex items-center justify-center w-4 h-4 rounded-xs border border-border bg-fd-background text-[10px] font-bold">
                                <Command className="w-2.5 h-2.5" />
                            </div>
                            <div className="flex items-center justify-center w-4 h-4 rounded-xs border border-border bg-fd-background text-[10px] font-bold underline decoration-fd-muted-foreground/30">
                                K
                            </div>
                        </div>
                    </button>

                    <div className="flex items-center gap-1 sm:gap-2">
                        <a
                            href="https://github.com/work-rjkashyap/Hyper-connect"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="size-8 flex items-center justify-center text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-accent rounded-md transition-all"
                            aria-label="GitHub"
                        >
                            <Github className="w-5 h-5" />
                        </a>
                        <a
                            href="https://x.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="size-8 flex items-center justify-center text-fd-muted-foreground hover:text-fd-foreground hover:bg-fd-accent rounded-md transition-all"
                            aria-label="X (Twitter)"
                        >
                            <FaXTwitter className="w-4 h-4" />
                        </a>
                        <div className="w-px h-4 bg-border mx-1 hidden sm:block" />
                        <ThemeToggle />
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button
                        type="button"
                        className="p-1.5 text-fd-foreground hover:bg-fd-accent rounded-md transition-colors lg:hidden"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        {mobileMenuOpen ? (
                            <X className="w-5 h-5" />
                        ) : (
                            <Menu className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </div>

            {/* Mobile Nav Overlay */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="absolute top-full left-0 right-0 overflow-hidden bg-fd-background border-b border-border lg:hidden shadow-lg"
                    >
                        <div className="flex flex-col p-4 gap-1">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    className="h-10 px-4 flex items-center rounded-md text-sm font-medium text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-foreground"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}
