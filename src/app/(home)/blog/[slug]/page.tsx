import { ArrowLeft, Calendar, Clock, Tag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { blogPosts, getAllSlugs, getBlogPost } from "@/lib/blog-data";
import { LandingFooter } from "@/components/landing/landing-footer";

export function generateStaticParams() {
    return getAllSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({
    params,
}: {
    params: { slug: string };
}): Metadata {
    const post = getBlogPost(params.slug);
    if (!post) return { title: "Post Not Found" };

    return {
        title: `${post.title} — Hyper Connect Blog`,
        description: post.description,
    };
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

function renderContent(content: string[]) {
    return content.map((block, idx) => {
        // Heading
        if (block.startsWith("## ")) {
            return (
                <h2
                    // biome-ignore lint/suspicious/noArrayIndexKey: Static content
                    key={idx}
                    className="text-lg font-bold text-fd-foreground tracking-tight mt-8 mb-3"
                >
                    {block.slice(3)}
                </h2>
            );
        }

        // Paragraph
        return (
            <p
                // biome-ignore lint/suspicious/noArrayIndexKey: Static content
                key={idx}
                className="text-[14px] text-fd-muted-foreground leading-relaxed font-medium mb-4"
            >
                {block}
            </p>
        );
    });
}

export default async function BlogPostPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const post = getBlogPost(slug);
    if (!post) notFound();

    // Find adjacent posts for navigation
    const currentIndex = blogPosts.findIndex((p) => p.slug === slug);
    const prevPost = currentIndex > 0 ? blogPosts[currentIndex - 1] : null;
    const nextPost =
        currentIndex < blogPosts.length - 1
            ? blogPosts[currentIndex + 1]
            : null;

    return (
        <>
            <main className="bg-(--zed-bg) min-h-screen">
                {/* Cover Image */}
                <div className="relative h-48 md:h-64 overflow-hidden">
                    <img
                        src={post.coverImage}
                        alt={post.title}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/30 to-transparent" />
                </div>

                {/* Header */}
                <section className="relative pb-14 pt-8 border-b border-border">
                    <div className="container max-w-3xl">
                        <Link
                            href="/blog"
                            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-fd-muted-foreground hover:text-fd-foreground transition-colors mb-6"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Back to Blog
                        </Link>

                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            {post.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-fd-accent border border-border text-[10px] font-bold tracking-widest uppercase text-fd-muted-foreground"
                                >
                                    <Tag className="w-2.5 h-2.5" />
                                    {tag}
                                </span>
                            ))}
                        </div>

                        <h1 className="text-2xl md:text-3xl font-bold text-fd-foreground mb-4 tracking-tight leading-tight">
                            {post.title}
                        </h1>

                        <div className="flex flex-wrap items-center gap-4 text-[12px] text-fd-muted-foreground font-bold">
                            <span className="inline-flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatDate(post.date)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                {post.readTime}
                            </span>
                            <span>{post.author}</span>
                        </div>
                    </div>
                </section>

                {/* Content */}
                <section className="relative py-14">
                    <div className="container max-w-3xl">
                        <div className="rounded-md border border-border bg-fd-card/50 dark:bg-fd-card/30 p-6 md:p-8 backdrop-blur-sm">
                            <p className="text-[15px] text-fd-foreground/80 leading-relaxed font-medium mb-6 pb-6 border-b border-border">
                                {post.description}
                            </p>
                            {renderContent(post.content)}
                        </div>

                        {/* Post Navigation */}
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {prevPost ? (
                                <Link
                                    href={`/blog/${prevPost.slug}`}
                                    className="group rounded-md border border-border bg-fd-card/50 dark:bg-fd-card/30 p-5 backdrop-blur-sm transition-all duration-200 hover:border-fd-primary/30 hover:bg-fd-accent/50"
                                >
                                    <span className="text-[10px] font-bold tracking-widest uppercase text-fd-muted-foreground/60">
                                        ← Previous
                                    </span>
                                    <p className="text-sm font-bold text-fd-foreground tracking-tight mt-1 group-hover:text-fd-primary transition-colors line-clamp-1">
                                        {prevPost.title}
                                    </p>
                                </Link>
                            ) : (
                                <div />
                            )}
                            {nextPost && (
                                <Link
                                    href={`/blog/${nextPost.slug}`}
                                    className="group rounded-md border border-border bg-fd-card/50 dark:bg-fd-card/30 p-5 backdrop-blur-sm transition-all duration-200 hover:border-fd-primary/30 hover:bg-fd-accent/50 text-right"
                                >
                                    <span className="text-[10px] font-bold tracking-widest uppercase text-fd-muted-foreground/60">
                                        Next →
                                    </span>
                                    <p className="text-sm font-bold text-fd-foreground tracking-tight mt-1 group-hover:text-fd-primary transition-colors line-clamp-1">
                                        {nextPost.title}
                                    </p>
                                </Link>
                            )}
                        </div>
                    </div>
                </section>
            </main>
            <LandingFooter />
        </>
    );
}
