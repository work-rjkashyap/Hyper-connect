import { Download, Github, Globe, Shield, Zap } from 'lucide-react'
import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'

export default function HomePage(): React.ReactElement {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--zed-bg)] transition-colors duration-300">
      <nav className="absolute top-0 right-0 p-6 z-50">
        <ThemeToggle />
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden px-6 text-center z-10">
        <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-blue-400 opacity-20 blur-[100px] dark:opacity-10"></div>

        <div className="max-w-4xl mx-auto flex flex-col items-center">
          <h1 className="text-5xl md:text-7xl font-serif text-[var(--zed-text-primary)] mb-6 tracking-tight">
            Hyper Connect
          </h1>
          <p className="text-xl md:text-2xl text-[var(--zed-text-secondary)] mb-10 max-w-2xl font-light leading-relaxed opacity-90">
            Seamless communication and file sharing between devices on your local network. Fast,
            secure, and purely peer-to-peer.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
            <Link
              href="/docs"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-md bg-[var(--zed-blue)] text-white font-medium shadow-[var(--zed-shadow-btn)] hover:opacity-90 transition-all text-lg"
            >
              <Download className="w-5 h-5" />
              Download
            </Link>
            <a
              href="https://github.com/work-rjkashyap/Hyper-connect"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-md bg-[var(--zed-card-bg)] border border-[var(--zed-border)] text-[var(--zed-text-primary)] font-medium shadow-sm hover:opacity-90 transition-all text-lg"
            >
              <Github className="w-5 h-5" />
              View on GitHub
            </a>
          </div>

          <div className="mt-12 p-2 bg-[var(--zed-card-bg)] rounded-lg border border-[var(--zed-border)] shadow-xl max-w-3xl w-full rotate-1 hover:rotate-0 transition-transform duration-500">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--zed-border)] bg-[rgba(128,128,128,0.05)] rounded-t-lg">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="text-xs text-[var(--zed-text-secondary)] font-mono flex-1 text-center">
                hyper-connect — bash
              </div>
            </div>
            <div className="p-6 font-mono text-left text-sm md:text-base bg-[var(--zed-card-bg)] overflow-hidden text-[var(--zed-text-primary)]">
              <span className="text-blue-600 dark:text-blue-400">➜</span>{' '}
              <span className="text-purple-600 dark:text-purple-400">~</span> hyper-connect start
              <br />
              <span className="text-green-600 dark:text-green-400">✔</span> Discovery service
              started on port 5353
              <br />
              <span className="text-green-600 dark:text-green-400">✔</span> Device &ldquo;MacBook
              Pro&rdquo; found [192.168.1.15]
              <br />
              <span className="text-green-600 dark:text-green-400">✔</span> Device &ldquo;Windows
              Desktop&rdquo; found [192.168.1.20]
              <br />
              <span className="text-blue-600 dark:text-blue-400">ℹ</span> Ready to transfer files...
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 bg-[rgba(128,128,128,0.02)] border-t border-[var(--zed-border)]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12">
            <div className="group">
              <div className="mb-4 inline-flex p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-[var(--zed-text-primary)]">
                Blazing Fast
              </h3>
              <p className="text-[var(--zed-text-secondary)] leading-relaxed">
                Built with performance in mind. Transfer files at the speed of your local network
                without any cloud bottlenecks.
              </p>
            </div>

            <div className="group">
              <div className="mb-4 inline-flex p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-[var(--zed-text-primary)]">
                Local Discovery
              </h3>
              <p className="text-[var(--zed-text-secondary)] leading-relaxed">
                Automatically finds devices on your LAN using Bonjour/mDNS. No configuration or IP
                typing required.
              </p>
            </div>

            <div className="group">
              <div className="mb-4 inline-flex p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-[var(--zed-text-primary)]">
                Secure by Design
              </h3>
              <p className="text-[var(--zed-text-secondary)] leading-relaxed">
                Your data never leaves your local network. Direct peer-to-peer connection with
                end-to-end encryption.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack / Footer Lite */}
      <section className="py-20 px-6 border-t border-[var(--zed-border)] bg-[var(--zed-bg)]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-serif font-bold mb-8 text-[var(--zed-text-primary)]">
            Built for developers, by developers.
          </h2>
          <div className="flex flex-wrap justify-center gap-6 opacity-60 grayscale hover:grayscale-0 transition-all duration-500 text-[var(--zed-text-secondary)]">
            <span className="font-semibold">Electron</span>
            <span className="font-semibold">React</span>
            <span className="font-semibold">TypeScript</span>
            <span className="font-semibold">Tailwind</span>
            <span className="font-semibold">Rust (Core)</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[var(--zed-border)] bg-[var(--zed-card-bg)] text-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-[var(--zed-text-secondary)]">
            &copy; {new Date().getFullYear()} Hyper Connect. Open Source.
          </div>
          <div className="flex gap-8">
            <Link
              href="/docs"
              className="text-[var(--zed-text-secondary)] hover:text-[var(--zed-blue)] transition-colors"
            >
              Documentation
            </Link>
            <a
              href="https://github.com/work-rjkashyap/Hyper-connect"
              className="text-[var(--zed-text-secondary)] hover:text-[var(--zed-blue)] transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://twitter.com"
              className="text-[var(--zed-text-secondary)] hover:text-[var(--zed-blue)] transition-colors"
            >
              Twitter
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
