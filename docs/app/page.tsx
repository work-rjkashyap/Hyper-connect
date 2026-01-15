import Link from 'next/link';

export default function HomePage() {
    return (
        <main className="flex h-screen flex-col items-center justify-center text-center px-4">
            <h1 className="mb-4 text-4xl font-bold">HyperConnect Documentation</h1>
            <p className="mb-8 text-xl text-muted-foreground">
                Seamless device connectivity with modern technology
            </p>
            <Link
                href="/docs"
                className="rounded-lg bg-primary px-6 py-3 text-primary-foreground hover:bg-primary/90"
            >
                Get Started
            </Link>
        </main>
    );
}
