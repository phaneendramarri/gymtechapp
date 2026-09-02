import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const CTASection: React.FC = () => {
  const location = useLocation();
  const isDemo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('intent') === 'demo';
  }, [location.search]);

  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-[var(--bg)] border-t border-[var(--line)]">
      <div className="max-w-3xl mx-auto text-center">
        <p className="gt-kicker">{isDemo ? 'See it on your data' : 'Ready when you are'}</p>
        <h2 className="text-display-serif-sm sm:text-display-serif text-ink mt-4">
          {isDemo
            ? 'See GymTech run in your gym in 20 minutes.'
            : 'Start your 14-day free trial.'}
        </h2>
        <p className="text-body text-ink-2 mt-5 max-w-xl mx-auto">
          {isDemo
            ? 'A 20-minute walkthrough with our team on your own member data. No slides, no sales pitch.'
            : 'No credit card. Set up your gym, import members, and run live check-ins by tomorrow morning.'}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="bg-[var(--ink)] text-[var(--ink-inverse)] hover:bg-[var(--ink-2)] border-[var(--ink)] font-medium h-11 px-6 gap-2 rounded-lg"
          >
            <a href={isDemo ? '#/contact?intent=demo' : '#/login'}>
              {isDemo ? <Calendar className="size-4" /> : <ArrowRight className="size-4" />}
              {isDemo ? 'Book a walkthrough' : 'Start free trial'}
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-11 px-6 font-medium text-sm border-[var(--line)] hover:bg-[var(--surface-2)] rounded-lg"
          >
            <a href="#pricing">Compare plans</a>
          </Button>
        </div>
        <p className="mt-6 text-[11px] text-ink-3 font-mono">
          No credit card · Free migration · Cancel anytime
        </p>
      </div>
    </section>
  );
};
