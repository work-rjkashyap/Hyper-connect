"use client";

import { TechIcons } from "./tech-icons";

const coreTech = [
  { name: "Electron", icon: TechIcons.electron },
  { name: "React", icon: TechIcons.react },
  { name: "Vite", icon: TechIcons.vite },
  { name: "TypeScript", icon: TechIcons.typescript },
  { name: "Next.js", icon: TechIcons.nextjs },
  { name: "Tailwind CSS", icon: TechIcons.tailwindcss },
  { name: "Vercel", icon: TechIcons.vercel },
];

const TechIcon = ({
  icon: Icon,
  name,
}: {
  // biome-ignore lint/suspicious/noExplicitAny: SVG icon components have varying prop signatures
  icon: React.ComponentType<any>;
  name: string;
}) => {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-2 group cursor-default">
      <div className="w-8 h-8 opacity-40 grayscale group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-300 flex items-center justify-center">
        <Icon />
      </div>
      <span className="text-[10px] uppercase tracking-widest text-fd-foreground/30 font-medium group-hover:text-fd-foreground/60 transition-colors duration-300">
        {name}
      </span>
    </div>
  );
};

export const TrustedBy = () => {
  // Duplicate for seamless scroll
  const allTech = [...coreTech, ...coreTech, ...coreTech, ...coreTech];

  return (
    <section className="py-10 border-y border-border bg-fd-card/30 overflow-hidden relative">
      {/* Fade overlays */}
      <div className="absolute inset-y-0 left-0 w-32 bg-linear-to-r from-fd-background to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-32 bg-linear-to-l from-fd-background to-transparent z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6 px-4">
          <div className="h-px bg-border flex-1" />
          <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-fd-foreground/40 whitespace-nowrap">
            Built with modern stack
          </span>
          <div className="h-px bg-border flex-1" />
        </div>

        <div className="flex relative overflow-hidden">
          <div className="flex animate-marquee shrink-0 gap-8">
            {allTech.map((tech, i) => (
              <TechIcon
                key={`${tech.name}-${i}`}
                icon={tech.icon}
                name={tech.name}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
