"use client";

import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle(): React.ReactElement {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-11 h-6 rounded-full bg-fd-accent border border-border" />
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="group relative flex items-center w-11 h-6 px-1 rounded-full bg-fd-accent border border-border hover:border-fd-foreground/20 transition-colors cursor-pointer"
      aria-label="Toggle Theme"
    >
      <motion.div
        initial={false}
        animate={{
          x: isDark ? 20 : 0,
          backgroundColor: isDark ? "#ffffff" : "#000000",
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
        }}
        className="flex items-center justify-center w-4 h-4 rounded-full shadow-sm"
      >
        {isDark ? (
          <Moon className="w-2.5 h-2.5 text-black" />
        ) : (
          <Sun className="w-2.5 h-2.5 text-white" />
        )}
      </motion.div>
    </button>
  );
}
