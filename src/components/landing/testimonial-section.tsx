"use client";

import { Quote } from "lucide-react";

const testimonials = [
  {
    quote:
      "Hyper Connect changed how we build real-time applications. What used to take weeks now takes an afternoon.",
    author: "Alex Chen",
    role: "CTO · CloudScale",
    avatar: "AC",
  },
  {
    quote:
      "The privacy first approach is exactly what we needed for our internal health-tech tools. Zero data leakage.",
    author: "Sarah Miller",
    role: "Lead Dev · MedSync",
    avatar: "SM",
  },
  {
    quote:
      "Local sharing speed is incredible. 80MB/s on a standard local network without any complex configuration.",
    author: "James Wilson",
    role: "Architect · Streamline",
    avatar: "JW",
  },
  {
    quote:
      "Type safety eliminated an entire class of bugs. Our cross-platform sync has never been more stable.",
    author: "Elena Rossi",
    role: "Senior Engineer · Velo",
    avatar: "ER",
  },
  {
    quote:
      "The mDNS discovery is flawless. It just works as soon as you open the app on any device reaching the network.",
    author: "David Park",
    role: "Founder · DevOpsly",
    avatar: "DP",
  },
  {
    quote:
      "Building our local-first collaborative editor was a breeze with the Hyper-connect identity layer.",
    author: "Maya Gupta",
    role: "Product Manager · EditFlow",
    avatar: "MG",
  },
];

function TestimonialCard({
  testimonial,
}: {
  testimonial: (typeof testimonials)[0];
}) {
  return (
    <div className="shrink-0 w-[300px] md:w-[350px] rounded-md border border-border bg-fd-card p-6 shadow-sm flex flex-col justify-between hover:border-fd-primary/30 transition-colors">
      <div>
        <Quote className="w-5 h-5 text-fd-primary/20 mb-4" />
        <blockquote className="text-[13px] font-medium text-fd-foreground mb-6 leading-relaxed italic">
          &ldquo;{testimonial.quote}&rdquo;
        </blockquote>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-fd-accent border border-border flex items-center justify-center text-fd-foreground font-bold text-[10px]">
          {testimonial.avatar}
        </div>
        <div>
          <p className="text-[12px] font-bold text-fd-foreground">
            {testimonial.author}
          </p>
          <p className="text-[10px] text-fd-muted-foreground uppercase tracking-widest font-bold">
            {testimonial.role}
          </p>
        </div>
      </div>
    </div>
  );
}

export function TestimonialSection(): React.ReactElement {
  // Duplicate for seamless loop
  const duplicatedTestimonials = [...testimonials, ...testimonials];

  return (
    <section className="relative py-14 border-t border-border overflow-hidden">
      <div className="container mb-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-fd-accent border border-border text-[10px] font-bold tracking-widest uppercase text-fd-muted-foreground mb-4">
            Testimonials
          </div>
          <h2 className="text-2xl font-bold text-fd-foreground mb-3 tracking-tight">
            Trusted by{" "}
            <span className="bg-linear-to-r from-cyan-600 to-violet-600 dark:from-cyan-400 dark:to-violet-400 bg-clip-text text-transparent">
              innovators
            </span>
          </h2>
          <p className="text-sm text-fd-muted-foreground font-medium leading-relaxed max-w-lg">
            See why developers around the world choose Hyper Connect for their
            private local-first applications.
          </p>
        </div>
      </div>

      <div className="relative flex flex-col gap-4">
        {/* Left-to-right marquee */}
        <div className="flex gap-4 animate-marquee hover:[animation-play-state:paused] transition-all">
          {duplicatedTestimonials.map((t, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Static list for marquee
            <TestimonialCard key={`ltr-${i}`} testimonial={t} />
          ))}
        </div>

        {/* Right-to-left marquee (with inverse animation if added, or just different speed) */}
        {/* For now, just another row with offset or different content */}
        <div className="flex gap-4 animate-marquee [animation-direction:reverse] hover:[animation-play-state:paused] transition-all">
          {[
            ...testimonials.slice(2),
            ...testimonials.slice(0, 2),
            ...testimonials.slice(2),
            ...testimonials.slice(0, 2),
          ].map((t, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Static list for marquee
            <TestimonialCard key={`rtl-${i}`} testimonial={t} />
          ))}
        </div>

        {/* Gradient overlays for fade out */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-linear-to-r from-fd-background to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-linear-to-l from-fd-background to-transparent z-10 pointer-events-none" />
      </div>
    </section>
  );
}
