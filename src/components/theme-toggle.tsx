"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle(): React.ReactElement {
  const { setTheme, resolvedTheme } = useTheme();

  // Simple client-side check to avoid hydration mismatch
  const isMounted = typeof window !== "undefined";

  if (!isMounted) {
    return <div className="w-9 h-9" />; // Placeholder to avoid hydration mismatch
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="p-2 rounded-md hover:bg-[var(--zed-border)] transition-colors text-[var(--zed-text-secondary)] hover:text-[var(--zed-text-primary)]"
      aria-label="Toggle Theme"
    >
      {resolvedTheme === "dark" ? (
        <Moon className="w-5 h-5" />
      ) : (
        <Sun className="w-5 h-5" />
      )}
    </button>
  );
}
