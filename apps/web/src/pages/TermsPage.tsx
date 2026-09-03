import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const TermsPage: React.FC = () => {
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
          <h1 className="font-display text-lg font-semibold text-(--fg)">Terms of Service</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="space-y-8">
          {/* Intro */}
          <section className="flex items-start gap-4">
            <div className="inline-flex items-center justify-center size-12 rounded-xl bg-(--accent)/10 text-(--accent)">
              <FileText className="size-6" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-(--fg)">Terms of Service</h2>
              <p className="text-sm text-(--ink-3)">Last updated: January 1, 2025</p>
            </div>
          </section>

          {/* Terms Content */}
          <div className="prose prose-sm max-w-none space-y-6">
            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">1. Acceptance of Terms</h3>
              <p className="text-(--ink-2)">
                By accessing and using GymTech ("the Service"), you accept and agree to be bound by the terms 
                and provision of this agreement. If you do not agree to abide by these terms, please do not 
                use this Service.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">2. Description of Service</h3>
              <p className="text-(--ink-2)">
                GymTech is a cloud-based gym management platform that provides tools for managing members, 
                memberships, attendance tracking, payment processing, and related administrative functions for 
                fitness facilities.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">3. User Responsibilities</h3>
              <p className="text-(--ink-2)">You agree to:</p>
              <ul className="list-disc pl-6 space-y-1 text-(--ink-2)">
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain the security of your account credentials</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
                <li>Not use the Service for any illegal or unauthorized purpose</li>
                <li>Comply with all applicable laws and regulations</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">4. Data Ownership</h3>
              <p className="text-(--ink-2)">
                You retain ownership of all data you input into the Service. We claim no ownership rights 
                over any data you provide. By using the Service, you grant us a limited license to host 
                and process your data solely for the purpose of providing the Service to you.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">5. Privacy & Data Protection</h3>
              <p className="text-(--ink-2)">
                Your privacy is important to us. Please review our Privacy Policy, which also governs your 
                use of the Service, to understand our practices regarding the collection and use of your 
                personal information.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">6. Subscription & Payments</h3>
              <p className="text-(--ink-2)">
                Subscription fees are billed in advance on a monthly or annual basis. All fees are 
                non-refundable except as required by law. We reserve the right to change pricing with 
                30 days prior notice.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">7. Limitation of Liability</h3>
              <p className="text-(--ink-2)">
                GymTech shall not be liable for any indirect, incidental, special, consequential, or 
                punitive damages, including without limitation, loss of profits, data, use, goodwill, or 
                other intangible losses resulting from your use of the Service.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">8. Service Availability</h3>
              <p className="text-(--ink-2)">
                We strive to provide 99.9% uptime but do not guarantee uninterrupted access to the 
                Service. Scheduled maintenance may occur with prior notice. We are not liable for any 
                downtime or data loss due to circumstances beyond our control.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">9. Termination</h3>
              <p className="text-(--ink-2)">
                We may terminate or suspend your account immediately, without prior notice, for any breach 
                of these Terms. Upon termination, your right to use the Service will cease immediately. 
                Data retention policies apply as described in our Privacy Policy.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">10. Changes to Terms</h3>
              <p className="text-(--ink-2)">
                We reserve the right to modify these terms at any time. We will provide notice of 
                significant changes via email or through the Service. Your continued use after such 
                modifications constitutes acceptance of the updated terms.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">11. Contact Information</h3>
              <p className="text-(--ink-2)">
                If you have any questions about these Terms, please contact us at{' '}
                <a href="mailto:legal@gymtech.app" className="text-(--accent) hover:underline">
                  legal@gymtech.app
                </a>
                .
              </p>
            </section>
          </div>
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

export default TermsPage;
