import React, { useState, useEffect } from 'react';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { GymOSFlow } from '@/components/landing/GymOSFlow';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { PricingSection } from '@/components/landing/PricingSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { CTASection } from '@/components/landing/CTASection';
import { FooterSection } from '@/components/landing/FooterSection';

export const LandingPage: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[var(--bg)] text-[var(--ink)] flex flex-col selection:bg-[var(--iron-soft)] selection:text-[var(--ink)] font-sans">
      <LandingNavbar isScrolled={isScrolled} />

      <main className="flex-1 flex flex-col">
        <HeroSection />

        {/* "What you actually do with it" — three concrete workflows. */}
        <GymOSFlow />

        {/* "Onboarded in an afternoon" — three-step day-1 flow. */}
        <HowItWorks />

        {/* Honest pricing, three plans. */}
        <PricingSection />

        {/* Questions gym owners actually ask. */}
        <FaqSection />

        {/* Final ask. */}
        <CTASection />
      </main>

      <FooterSection />
    </div>
  );
};

export default LandingPage;
