import { ArrowRight, Calendar, Clock, Tag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LandingFooter } from "@/components/landing/landing-footer";
import { blogPosts } from "@/lib/blog-data";

export const metadata: Metadata = {
  title: "Blog — Hyper Connect",
  description:
    "Engineering insights, product updates, and behind-the-scenes from the Hyper Connect team.",
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPage() {
  return (
    <>
      <main className="bg-(--zed-bg) min-h-screen">
        {/* Hero */}
        <section className="relative pt-28 pb-14 border-b border-border">
          <div className="container max-w-5xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-fd-accent border border-border text-[10px] font-bold tracking-widest uppercase text-fd-muted-foreground mb-4">
              Blog
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-fd-foreground mb-3 tracking-tight">
              From the{" "}
              <span className="bg-linear-to-r from-cyan-600 to-violet-600 dark:from-cyan-400 dark:to-violet-400 bg-clip-text text-transparent">
                team
              </span>
            </h1>
            <p className="text-sm text-fd-muted-foreground font-medium max-w-lg leading-relaxed">
              Engineering insights, product updates, and behind-the-scenes from
              building Hyper Connect.
            </p>
          </div>
        </section>

        {/* Posts Grid */}
        <section className="relative py-14">
          <div className="container max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {blogPosts.map((post, idx) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className={`blog-card group block rounded-lg border border-border bg-fd-card/50 dark:bg-fd-card/30 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-fd-primary/30 hover:shadow-xl hover:shadow-fd-primary/5 hover:-translate-y-1 ${
                    idx === 0 ? "md:col-span-3" : ""
                  }`}
                  style={
                    {
                      "--_glow": "linear-gradient(135deg, #06b6d4, #8b5cf6)",
                    } as React.CSSProperties
                  }
                >
                  {/* Cover Image */}
                  <div
                    className={`blog-card-image relative overflow-hidden ${
                      idx === 0 ? "h-52 md:h-64" : "h-44"
                    }`}
                  >
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-transparent transition-opacity duration-300 group-hover:from-black/70" />

                    {/* Tags overlay */}
                    <div className="blog-card-tags absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                      {idx === 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold tracking-widest uppercase backdrop-blur-sm">
                          Latest
                        </span>
                      )}
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 text-white/90 text-[10px] font-bold tracking-widest uppercase backdrop-blur-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="blog-card-content p-5">
                    <h2
                      className={`font-bold text-fd-foreground tracking-tight mb-2 group-hover:text-fd-primary transition-colors duration-300 ${
                        idx === 0 ? "text-lg" : "text-sm"
                      }`}
                    >
                      {post.title}
                    </h2>

                    <p className="text-[13px] text-fd-muted-foreground leading-relaxed font-medium mb-4 line-clamp-2">
                      {post.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-fd-muted-foreground/70 font-bold">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(post.date)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {post.readTime}
                        </span>
                        <span className="hidden sm:inline">{post.author}</span>
                      </div>
                      <span className="blog-card-arrow text-[12px] font-bold text-fd-primary flex items-center gap-1">
                        Read
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </>
  );
}
