import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { FAQ } from "@/components/landing/FAQ";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { MarketingPitch } from "@/components/landing/MarketingPitch";
import { Pricing } from "@/components/landing/Pricing";
import { PlatformSuite } from "@/components/landing/PlatformSuite";
import { ShirtStudio } from "@/components/landing/ShirtStudio";
import { SocialProof } from "@/components/landing/SocialProof";
import { WhatsAppFloat } from "@/components/landing/WhatsAppFloat";

export function LandingPage({
  affiliateMode = false,
  affiliateWhatsapp = null,
}: {
  affiliateMode?: boolean;
  affiliateWhatsapp?: string | null;
} = {}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Halftone dot pattern overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 halftone-dots opacity-60"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-0 h-[28rem] w-[28rem] halftone-dots-dense halftone-fade-l opacity-70"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[60%] -left-20 h-[24rem] w-[24rem] halftone-dots-dense halftone-fade-r opacity-60"
      />
      <div className="relative z-10">
        <Header affiliateMode={affiliateMode} />
        <Hero />
        <MarketingPitch />
        <PlatformSuite />
        <Features />
        <SocialProof />
        <ShirtStudio />
        <HowItWorks />
        <Pricing affiliateMode={affiliateMode} />
        <FAQ />
        <Footer />
        <WhatsAppFloat phone={affiliateMode ? affiliateWhatsapp : null} />
      </div>
    </main>
  );
}
