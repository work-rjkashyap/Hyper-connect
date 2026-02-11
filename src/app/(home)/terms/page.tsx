import type { Metadata } from "next";
import { LandingFooter } from "@/components/landing/landing-footer";

export const metadata: Metadata = {
  title: "Terms of Service — Hyper Connect",
  description:
    "Terms of Service for Hyper Connect. Understand the terms governing your use of our software.",
};

const sections = [
  {
    title: "1. Acceptance of Terms",
    content:
      'By downloading, installing, or using Hyper Connect ("the Software"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Software.',
  },
  {
    title: "2. License Grant",
    content:
      "Hyper Connect is open-source software distributed under the MIT License. You are granted a free, non-exclusive, worldwide license to use, copy, modify, and distribute the Software, subject to the conditions of the MIT License.",
  },
  {
    title: "3. Acceptable Use",
    items: [
      "You may use Hyper Connect for any lawful purpose on devices you own or have authorization to use.",
      "You must not use the Software to transfer illegal content, malware, or any material that violates applicable laws.",
      "You must not attempt to intercept, tamper with, or reverse-engineer the encryption protocols used by the Software.",
      "You must not use the Software to gain unauthorized access to devices or networks.",
    ],
  },
  {
    title: "4. Disclaimer of Warranties",
    content:
      'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE SOFTWARE IS WITH YOU.',
  },
  {
    title: "5. Limitation of Liability",
    content:
      "IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.",
  },
  {
    title: "6. Data & Privacy",
    content:
      "Hyper Connect operates entirely on your local network. We do not collect, store, or process your personal data. For full details, please refer to our Privacy Policy.",
  },
  {
    title: "7. Updates",
    content:
      "Hyper Connect may include an auto-update feature that checks for new versions. You can disable this feature in the application settings. We are not responsible for any issues arising from running outdated versions of the Software.",
  },
  {
    title: "8. Termination",
    content:
      "You may stop using the Software at any time by uninstalling it. Since the Software is local-only and requires no account, there is no account termination process.",
  },
  {
    title: "9. Changes to Terms",
    content:
      "We reserve the right to modify these terms at any time. Changes will be posted on this page with an updated revision date. Continued use of the Software after modifications constitutes acceptance of the revised terms.",
  },
  {
    title: "10. Governing Law",
    content:
      "These terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles.",
  },
  {
    title: "11. Contact",
    content:
      "For questions about these Terms of Service, please contact us at legal@hyperconnect.dev or open an issue on our GitHub repository.",
  },
];

export default function TermsPage() {
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
              Terms of Service
            </h1>
            <p className="text-sm text-fd-muted-foreground font-medium max-w-lg leading-relaxed">
              Last updated: February 2026. Please read these terms carefully
              before using Hyper Connect.
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
                          {item}
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
