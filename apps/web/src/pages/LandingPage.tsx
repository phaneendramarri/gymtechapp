import React, { useState, useEffect } from 'react';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { BentoGrid } from '@/components/landing/BentoGrid';
import { GymOSFlow } from '@/components/landing/GymOSFlow';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { PricingSection } from '@/components/landing/PricingSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { CTASection } from '@/components/landing/CTASection';
import { FooterSection } from '@/components/landing/FooterSection';

export const LandingPage: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    document.title = 'GymTech — Modern Gym Management Software';
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    const sections = ['product', 'how-it-works', 'pricing', 'faq'];
    const observers: IntersectionObserver[] = [];

    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(id);
        },
        { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observers.forEach((o) => o.disconnect());
    };
  }, []);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'GymTech',
        applicationCategory: 'BusinessApplication, HealthApplication',
        operatingSystem: 'Web, Windows, Android, iOS',
        description: 'India\'s leading Gym Management SaaS for gym owners. Biometric attendance, WhatsApp renewals, 18% GST billing, trainer commissions, and member self-service portals.',
        url: 'https://gymtech.app',
        keywords: 'gym management saas, gym management software india, biometric gym attendance, gym billing software, gym pos',
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.9',
          ratingCount: '148',
          bestRating: '5',
          worstRating: '1',
        },
        offers: {
          '@type': 'Offer',
          price: '999',
          priceCurrency: 'INR',
          description: 'Free trial available. Paid plans starting at ₹999/month.',
        },
        provider: {
          '@type': 'Organization',
          name: 'GymTech',
          url: 'https://gymtech.app',
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What are the primary portals and roles in GymTech?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'GymTech features a clean role-based architecture: Owner / Admin for complete gym operations, package management, attendance, and revenue; Trainer Desk for high-speed check-ins and PT client allocations; and Member Portal for members to check their plan status and digital QR card.',
            },
          },
          {
            '@type': 'Question',
            name: 'How does the automated WhatsApp receipt feature work?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'When a payment or renewal is recorded, GymTech generates an instant automated WhatsApp receipt with the member\'s unique receipt number, package details, GST split, and transaction amount without requiring costly third-party API fees.',
            },
          },
          {
            '@type': 'Question',
            name: 'How is gym data secured and isolated in this SaaS?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Every gym\'s data is strictly isolated with tenant-scoped queries enforced on the database and API layer. A gym owner or staff can never access another gym\'s members, payments, or financial reports.',
            },
          },
          {
            '@type': 'Question',
            name: 'Can I import existing members from our Excel spreadsheet?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes! GymTech provides a built-in one-click member import tool. You can upload your existing member list with phone numbers, joining dates, and plan details in seconds, or our team will migrate it for you for free.',
            },
          },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-(--bg) text-(--ink) flex flex-col selection:bg-(--iron-soft) selection:text-(--ink) font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingNavbar isScrolled={isScrolled} activeSection={activeSection} />

      <main className="flex-1 flex flex-col">
        <HeroSection />

        {/* Bento grid — all features at a glance. */}
        <BentoGrid />

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
