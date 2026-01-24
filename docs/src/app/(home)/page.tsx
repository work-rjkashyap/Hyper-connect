import Link from 'next/link'
import {
  Radio,
  MessageSquare,
  FolderUp,
  Download,
  Palette,
  Shield,
  Github,
  BookOpen,
  ArrowRight,
  Sparkles
} from 'lucide-react'

export default function HomePage(): React.JSX.Element {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 mb-8">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Cross-platform device communication
              </span>
            </div>

            {/* Main Heading */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 text-gray-900 dark:text-white">
              Hyper Connect
            </h1>

            {/* Subheading */}
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto font-light">
              Seamless communication and file sharing between devices on your local network
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/docs"
                className="group inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
              >
                Get Started
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <a
                href="https://github.com/work-rjkashyap/Hyper-connect"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
              >
                <Github className="w-4 h-4" />
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid Features */}
      <section className="py-20 bg-gray-50 dark:bg-gray-950">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
                Everything you need
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Built for modern device communication
              </p>
            </div>

            {/* Bento Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Large Card - Device Discovery */}
              <div className="md:col-span-2 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
                    <Radio className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                      Automatic Device Discovery
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Discover devices on your local network automatically using Bonjour/mDNS. No
                      manual configuration required.
                    </p>
                  </div>
                </div>
              </div>

              {/* Medium Card - Real-time Messaging */}
              <div className="p-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
                <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950 w-fit mb-4">
                  <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                  Real-time Messaging
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Send messages instantly with emoji support and threading.
                </p>
              </div>

              {/* Medium Card - File Transfer */}
              <div className="p-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
                <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950 w-fit mb-4">
                  <FolderUp className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                  File Transfer
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Share files with drag-and-drop and progress tracking.
                </p>
              </div>

              {/* Large Card - Auto-Update */}
              <div className="md:col-span-2 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950">
                    <Download className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                      Auto-Update System
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Stay up-to-date with automatic update checking, background downloads, and
                      seamless installation across all platforms.
                    </p>
                  </div>
                </div>
              </div>

              {/* Small Card - Modern UI */}
              <div className="p-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 w-fit mb-4">
                  <Palette className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                  Modern UI
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Beautiful interface with dark mode and smooth animations.
                </p>
              </div>

              {/* Small Card - Secure */}
              <div className="p-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
                <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950 w-fit mb-4">
                  <Shield className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                  Secure & Private
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Local network only. No cloud servers required.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              Download for your platform
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-12">
              Available for macOS, Windows, and Linux
            </p>

            <div className="grid md:grid-cols-3 gap-4">
              <a
                href="https://github.com/work-rjkashyap/Hyper-connect/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="group p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
              >
                <div className="text-4xl mb-3">🍎</div>
                <h3 className="font-semibold mb-1 text-gray-900 dark:text-white">macOS</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Download DMG</p>
                <div className="inline-flex items-center gap-1 text-sm text-gray-900 dark:text-white group-hover:gap-2 transition-all">
                  Download
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </a>

              <a
                href="https://github.com/work-rjkashyap/Hyper-connect/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="group p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
              >
                <div className="text-4xl mb-3">🪟</div>
                <h3 className="font-semibold mb-1 text-gray-900 dark:text-white">Windows</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Download Installer</p>
                <div className="inline-flex items-center gap-1 text-sm text-gray-900 dark:text-white group-hover:gap-2 transition-all">
                  Download
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </a>

              <a
                href="https://github.com/work-rjkashyap/Hyper-connect/releases/latest"
                target="_blank"
                rel="noopener noreferrer"
                className="group p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
              >
                <div className="text-4xl mb-3">🐧</div>
                <h3 className="font-semibold mb-1 text-gray-900 dark:text-white">Linux</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Download AppImage</p>
                <div className="inline-flex items-center gap-1 text-sm text-gray-900 dark:text-white group-hover:gap-2 transition-all">
                  Download
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-20 bg-gray-50 dark:bg-gray-950">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-3 text-gray-900 dark:text-white">
              Built with modern technologies
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-12">
              Powered by industry-leading frameworks
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              {[
                'Electron',
                'React',
                'TypeScript',
                'Tailwind CSS',
                'Radix UI',
                'Zustand',
                'Electron Vite',
                'electron-updater'
              ].map((tech) => (
                <div
                  key={tech}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {tech}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              Start building today
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
              Get started with Hyper Connect and experience seamless device communication
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                Read Documentation
              </Link>

              <a
                href="https://github.com/work-rjkashyap/Hyper-connect/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
              >
                View Releases
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
