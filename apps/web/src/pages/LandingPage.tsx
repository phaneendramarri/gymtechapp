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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'GymTech',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: 'Complete gym management platform for Indian gyms. Manage members, memberships, payments, attendance, staff, reports, and member portal in one clean platform.',
    url: 'https://gymtech.in',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
      description: 'Free plan available. Paid plans starting at ₹999/month.',
    },
    provider: {
      '@type': 'Organization',
      name: 'GymTech',
      url: 'https://gymtech.in',
    },
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-(--bg) text-(--ink) flex flex-col selection:bg-(--iron-soft) selection:text-(--ink) font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
