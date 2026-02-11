import type { Metadata } from "next";
import { LandingFooter } from "@/components/landing/landing-footer";

export const metadata: Metadata = {
  title: "Privacy Policy — Hyper Connect",
  description:
    "Privacy Policy for Hyper Connect. Learn how we handle your data — spoiler: it never leaves your network.",
};

const sections = [
  {
    title: "Overview",
    content:
      "Hyper Connect is a local-first application. Your data stays on your local network and is never transmitted to our servers or any third-party services. This privacy policy explains our data practices in detail.",
  },
  {
    title: "Data We Collect",
    items: [
      "**No personal data.** Hyper Connect does not require account creation, login, or any personal information to function.",
      "**No telemetry.** We do not collect usage analytics, crash reports, or behavioral data unless you explicitly opt in to a future telemetry program.",
      "**No cloud storage.** Files shared through Hyper Connect are transferred directly between devices on your local network via peer-to-peer connections.",
      "**Auto-update checks.** The application may periodically check for updates by contacting our GitHub releases endpoint. This request contains only the current application version and your platform (e.g., macOS arm64).",
    ],
  },
  {
    title: "Data in Transit",
    content:
      "All data transferred between devices is encrypted using end-to-end encryption. Files, messages, and metadata are transmitted directly between peers over your local network. No data passes through external servers.",
  },
  {
    title: "Third-Party Services",
    items: [
      "**GitHub** — Used for hosting releases and update checks. Subject to GitHub's privacy policy.",
      "**mDNS/Bonjour** — Used for local device discovery. This is a local network protocol and does not transmit data outside your network.",
    ],
  },
  {
    title: "Cookies & Tracking",
    content:
      "The Hyper Connect desktop application does not use cookies, tracking pixels, or any web-based tracking mechanisms. Our documentation website may use minimal analytics — see the website's own cookie notice for details.",
  },
  {
    title: "Children's Privacy",
    content:
      "Hyper Connect does not collect any personal information from anyone, including children under 13. Since no data is collected, there is no risk of inadvertent collection of children's data.",
  },
  {
    title: "Changes to This Policy",
    content:
      "We may update this policy from time to time. Changes will be reflected on this page with an updated revision date. Continued use of Hyper Connect after changes constitutes acceptance of the revised policy.",
  },
  {
    title: "Contact",
    content:
      "If you have questions about this privacy policy, please reach out to us at privacy@hyperconnect.dev or open an issue on our GitHub repository.",
  },
];

export default function PrivacyPage() {
  return (
    <>
      <main className="bg-(--zed-bg) min-h-screen">
        {/* Hero */}
        <section className="relative pt-28 pb-14 border-b border-border">
          <div className="container max-w-3xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-fd-accent border border-border text-[10px] font-bold tracking-widest uppercase text-fd-muted-foreground mb-4">
              Legal
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-fd-foreground mb-3 tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-sm text-fd-muted-foreground font-medium max-w-lg leading-relaxed">
              Last updated: February 2026. Your privacy matters to us — and
              since Hyper Connect is local-first, your data never leaves your
              network.
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="relative py-14">
          <div className="container max-w-3xl">
            <div className="space-y-6">
              {sections.map((section) => (
                <div
                  key={section.title}
                  className="rounded-md border border-border bg-fd-card/50 dark:bg-fd-card/30 p-6 backdrop-blur-sm"
                >
                  <h2 className="text-base font-bold text-fd-foreground mb-3 tracking-tight">
                    {section.title}
                  </h2>
                  {section.content && (
                    <p className="text-[13px] text-fd-muted-foreground leading-relaxed font-medium">
                      {section.content}
                    </p>
                  )}
                  {section.items && (
                    <ul className="space-y-2">
                      {section.items.map((item, idx) => (
                        <li
                          // biome-ignore lint/suspicious/noArrayIndexKey: Static content
                          key={idx}
                          className="flex items-start gap-2 text-[13px] text-fd-muted-foreground leading-relaxed font-medium"
                        >
                          <span className="mt-2 w-1 h-1 rounded-full bg-fd-muted-foreground/40 shrink-0" />
                          <span
                            // biome-ignore lint/security/noDangerouslySetInnerHtml: Static content with bold markers
                            dangerouslySetInnerHTML={{
                              __html: item.replace(
                                /\*\*(.+?)\*\*/g,
                                '<strong class="text-fd-foreground">$1</strong>',
                              ),
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </>
  );
}
