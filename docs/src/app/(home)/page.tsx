import { Download, Github, Globe, Shield, Zap } from 'lucide-react'
import Link from 'next/link'
// Hoist static data outside component (rendering-hoist-jsx)
const FEATURES = [
  {
    id: 'speed',
    icon: Zap,
    title: 'Blazing Fast',
    description:
      'Built with performance in mind. Transfer files at the speed of your local network without any cloud bottlenecks.',
    bgLight: 'bg-blue-50',
    bgDark: 'dark:bg-blue-900/20',
    textLight: 'text-blue-600',
    textDark: 'dark:text-blue-400'
  },
  {
    id: 'discovery',
    icon: Globe,
    title: 'Local Discovery',
    description:
      'Automatically finds devices on your LAN using Bonjour/mDNS. No configuration or IP typing required.',
    bgLight: 'bg-purple-50',
    bgDark: 'dark:bg-purple-900/20',
    textLight: 'text-purple-600',
    textDark: 'dark:text-purple-400'
  },
  {
    id: 'security',
    icon: Shield,
    title: 'Secure by Design',
    description:
      'Your data never leaves your local network. Direct peer-to-peer connection with end-to-end encryption.',
    bgLight: 'bg-green-50',
    bgDark: 'dark:bg-green-900/20',
    textLight: 'text-green-600',
    textDark: 'dark:text-green-400'
  }
] as const
const TECH_STACK = ['Electron', 'React', 'TypeScript', 'Tailwind', 'Rust (Core)'] as const
const FOOTER_LINKS = [
  { href: '/docs', label: 'Documentation' },
  { href: 'https://github.com/work-rjkashyap/Hyper-connect', label: 'GitHub' },
  { href: 'https://twitter.com', label: 'Twitter' }
] as const
// Derived state computed once (rerender-derived-state-no-effect)
const CURRENT_YEAR = new Date().getFullYear()
export default function HomePage(): React.ReactElement {
  return (
    <div className="flex flex-col min-h-screen bg-(--zed-bg) transition-colors duration-300">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden px-6 text-center z-10">
        <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px]"></div>
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-77.5 w-77.5 rounded-full bg-blue-400 opacity-20 blur-[100px] dark:opacity-10"></div>
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          <h1 className="text-5xl md:text-7xl font-serif text-(--zed-text-primary) mb-6 tracking-tight">
            Hyper Connect
          </h1>
          <p className="text-xl md:text-2xl text-(--zed-text-secondary) mb-10 max-w-2xl font-light leading-relaxed opacity-90">
            Seamless communication and file sharing between devices on your local network. Fast,
            secure, and purely peer-to-peer.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
            <Link
              href="/docs"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-md bg-(--zed-blue) text-white font-medium shadow-(--zed-shadow-btn) hover:opacity-90 transition-all text-lg"
            >
              <Download className="w-5 h-5" />
              Download
            </Link>
            <a
              href="https://github.com/work-rjkashyap/Hyper-connect"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-md bg-(--zed-card-bg) border border-(--zed-border) text-(--zed-text-primary) font-medium shadow-sm hover:opacity-90 transition-all text-lg"
            >
              <Github className="w-5 h-5" />
              View on GitHub
            </a>
          </div>
          <div className="mt-12 p-2 bg-(--zed-card-bg) rounded-lg border border-(--zed-border) shadow-xl max-w-3xl w-full rotate-1 hover:rotate-0 transition-transform duration-500">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-(--zed-border) bg-[rgba(128,128,128,0.05)] rounded-t-lg">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="text-xs text-(--zed-text-secondary) font-mono flex-1 text-center">
                hyper-connect — bash
              </div>
            </div>
            <div className="p-6 font-mono text-left text-sm md:text-base bg-(--zed-card-bg) overflow-hidden text-(--zed-text-primary)">
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
      <section className="py-24 px-6 bg-[rgba(128,128,128,0.02)] border-t border-(--zed-border)">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <div key={feature.id} className="group">
                  <div
                    className={`mb-4 inline-flex p-3 rounded-lg ${feature.bgLight} ${feature.bgDark} ${feature.textLight} ${feature.textDark} group-hover:scale-110 transition-transform`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-(--zed-text-primary)">
                    {feature.title}
                  </h3>
                  <p className="text-(--zed-text-secondary) leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>
      {/* Tech Stack / Footer Lite */}
      <section className="py-20 px-6 border-t border-(--zed-border) bg-(--zed-bg)">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-serif font-bold mb-8 text-(--zed-text-primary)">
            Built for developers, by developers.
          </h2>
          <div className="flex flex-wrap justify-center gap-6 opacity-60 grayscale hover:grayscale-0 transition-all duration-500 text-(--zed-text-secondary)">
            {TECH_STACK.map((tech) => (
              <span key={tech} className="font-semibold">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>
      {/* Footer */}
      <footer className="py-12 px-6 border-t border-(--zed-border) bg-(--zed-card-bg) text-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-(--zed-text-secondary)">
            &copy; {CURRENT_YEAR} Hyper Connect. Open Source.
          </div>
          <div className="flex gap-8">
            {FOOTER_LINKS.map(({ href, label }) =>
              href.startsWith('http') ? (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-(--zed-text-secondary) hover:text-(--zed-blue) transition-colors"
                >
                  {label}
                </a>
              ) : (
                <Link
                  key={label}
                  href={href}
                  className="text-(--zed-text-secondary) hover:text-(--zed-blue) transition-colors"
                >
                  {label}
                </Link>
              )
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
