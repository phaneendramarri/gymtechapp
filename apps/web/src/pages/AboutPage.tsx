import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Dumbbell, Users, TrendingUp, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-(--bg)">
      {/* Header */}
      <header className="border-b border-(--border) bg-(--surface)">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="size-4" />
              Back
            </Button>
          </Link>
          <h1 className="font-display text-lg font-semibold text-(--fg)">About GymTech</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="space-y-8">
          {/* Hero */}
          <section className="text-center space-y-4">
            <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-(--accent) text-white mb-4">
              <Dumbbell className="size-8" />
            </div>
            <h2 className="font-display text-3xl font-bold text-(--fg)">GymTech</h2>
            <p className="text-lg text-(--ink-2)">
              All-in-one gym management software for modern fitness businesses
            </p>
            <p className="text-sm text-(--ink-3)">Version 1.0.0</p>
          </section>

          {/* Features */}
          <section className="grid gap-4">
            <h3 className="font-display text-lg font-semibold text-(--fg)">What We Offer</h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <FeatureCard
                icon={<Users className="size-5" />}
                title="Member Management"
                description="Track members, memberships, and attendance with ease. Handle renewals and freeze periods seamlessly."
              />
              <FeatureCard
                icon={<TrendingUp className="size-5" />}
                title="Revenue Tracking"
                description="Monitor payments, pending dues, and PT commissions. Get insights into your gym's financial health."
              />
              <FeatureCard
                icon={<Dumbbell className="size-5" />}
                title="Plan Management"
                description="Create flexible membership plans with custom durations and pricing. Support for various payment modes."
              />
              <FeatureCard
                icon={<Shield className="size-5" />}
                title="Secure & Reliable"
                description="Enterprise-grade security with role-based access control. Your data is always safe with us."
              />
            </div>
          </section>

          {/* Tech Stack */}
          <section className="space-y-4">
            <h3 className="font-display text-lg font-semibold text-(--fg)">Built With</h3>
            <div className="flex flex-wrap gap-2">
              {['React', 'TypeScript', 'Cloudflare Workers', 'D1 Database', 'Drizzle ORM', 'Hono'].map((tech) => (
                <span
                  key={tech}
                  className="px-3 py-1 text-sm rounded-full bg-(--bg-secondary) text-(--ink-2) border border-(--border)"
                >
                  {tech}
                </span>
              ))}
            </div>
          </section>

          {/* Contact CTA */}
          <section className="text-center py-8 border-t border-(--border)">
            <p className="text-(--ink-2) mb-4">Have questions or feedback?</p>
            <Link to="/contact">
              <Button variant="outline">Contact Us</Button>
            </Link>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-(--border) py-6 mt-12">
        <div className="max-w-3xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-(--ink-3)">
          <p>© {new Date().getFullYear()} GymTech. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/about" className="hover:text-(--fg) transition-colors">About</Link>
            <Link to="/contact" className="hover:text-(--fg) transition-colors">Contact</Link>
            <Link to="/terms" className="hover:text-(--fg) transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-(--fg) transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({
  icon,
  title,
  description,
}) => (
  <div className="p-4 rounded-lg border border-(--border) bg-(--surface) space-y-2">
    <div className="text-(--accent)">{icon}</div>
    <h4 className="font-medium text-(--fg)">{title}</h4>
    <p className="text-sm text-(--ink-2)">{description}</p>
  </div>
);

export default AboutPage;
