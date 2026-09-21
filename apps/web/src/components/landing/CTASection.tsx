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
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-bg">
      <div className="relative max-w-4xl mx-auto text-center overflow-hidden rounded-[2rem] bg-ink text-ink-inverse px-6 py-16 sm:px-16 sm:py-20">
        {/* Warm glow inside the closer panel */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 80% at 50% 110%, rgba(251,146,60,0.35) 0%, transparent 65%)',
          }}
        />
        <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-60">{isDemo ? 'See it on your data' : 'Ready when you are'}</p>
        <h2 className="text-display-serif-sm sm:text-display-serif mt-4">
          {isDemo
            ? 'See GymTech run in your gym in 20 minutes.'
            : 'Start your 14-day free trial.'}
        </h2>
        <p className="text-[15px] mt-5 max-w-xl mx-auto opacity-70 leading-relaxed">
          {isDemo
            ? 'A 20-minute walkthrough with our team on your own member data. No slides, no sales pitch.'
            : 'No credit card. Set up your gym, import members, and run live check-ins by tomorrow morning.'}
        </p>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="bg-iron hover:bg-iron-hover text-white font-semibold h-12 px-7 gap-2 rounded-full shadow-[0_8px_32px_rgba(251,146,60,0.35)]"
          >
            <a href={isDemo ? '/contact?intent=demo' : '/login'}>

              {isDemo ? <Calendar className="size-4" /> : <ArrowRight className="size-4" />}
              {isDemo ? 'Book a walkthrough' : 'Start free trial'}
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 px-7 font-medium text-sm rounded-full border-white/20 text-ink-inverse hover:bg-white/10 hover:text-ink-inverse"
          >
            <a href="#pricing">Compare plans</a>
          </Button>
        </div>
        <p className="mt-7 text-[11px] font-mono opacity-50">
          No credit card · Free migration · Cancel anytime
        </p>
        </div>
      </div>
    </section>
  );
};
