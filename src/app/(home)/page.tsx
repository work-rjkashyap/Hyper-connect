import { CtaSection } from "@/components/landing/cta-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HeroSection } from "@/components/landing/hero-section";
import { LandingFooter } from "@/components/landing/landing-footer";
import { TestimonialSection } from "@/components/landing/testimonial-section";
import { TrustedBy } from "@/components/landing/trusted-by";
import { WorkflowSection } from "@/components/landing/workflow-section";

export default function HomePage() {
  return (
    <main className="bg-(--zed-bg) min-h-screen">
      <HeroSection />
      <TrustedBy />
      <FeaturesSection />
      <WorkflowSection />
      <TestimonialSection />
      <CtaSection />
      <LandingFooter />
    </main>
  );
}
