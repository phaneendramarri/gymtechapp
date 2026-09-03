import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const PrivacyPage: React.FC = () => {
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
          <h1 className="font-display text-lg font-semibold text-(--fg)">Privacy Policy</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="space-y-8">
          {/* Intro */}
          <section className="flex items-start gap-4">
            <div className="inline-flex items-center justify-center size-12 rounded-xl bg-(--accent)/10 text-(--accent)">
              <Shield className="size-6" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-(--fg)">Privacy Policy</h2>
              <p className="text-sm text-(--ink-3)">Last updated: January 1, 2025</p>
            </div>
          </section>

          {/* Privacy Content */}
          <div className="prose prose-sm max-w-none space-y-6">
            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">1. Information We Collect</h3>
              <p className="text-(--ink-2)">
                We collect information you provide directly to us, including:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-(--ink-2)">
                <li><strong>Account Information:</strong> Name, email address, phone number, and business information when you register</li>
                <li><strong>Member Data:</strong> Information about gym members including name, contact details, health information, and membership status</li>
                <li><strong>Payment Information:</strong> Payment details and transaction history (processed securely via third-party payment providers)</li>
                <li><strong>Usage Data:</strong> How you interact with our Service, including attendance logs and feature usage</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">2. How We Use Your Information</h3>
              <p className="text-(--ink-2)">We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-1 text-(--ink-2)">
                <li>Provide, maintain, and improve our Services</li>
                <li>Process transactions and send related information</li>
                <li>Send you technical notices, updates, and support messages</li>
                <li>Respond to your comments, questions, and customer service requests</li>
                <li>Monitor and analyze trends, usage, and activities in connection with our Services</li>
                <li>Detect, investigate, and prevent fraudulent or unauthorized transactions</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">3. Data Security</h3>
              <p className="text-(--ink-2)">
                We implement industry-standard security measures to protect your data, including:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-(--ink-2)">
                <li>Encryption of data in transit using TLS/SSL</li>
                <li>Encryption of sensitive data at rest</li>
                <li>Regular security audits and penetration testing</li>
                <li>Access controls and authentication mechanisms</li>
                <li>Secure cloud infrastructure with Cloudflare protection</li>
              </ul>
              <p className="text-(--ink-2) mt-3">
                While we strive to protect your information, no method of transmission over the Internet or 
                electronic storage is 100% secure. We cannot guarantee absolute security.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">4. Data Retention</h3>
              <p className="text-(--ink-2)">
                We retain your information for as long as your account is active or as needed to provide 
                you services. We will retain and use your information as necessary to comply with our 
                legal obligations, resolve disputes, and enforce our agreements.
              </p>
              <p className="text-(--ink-2)">
                Upon request, we can export or delete your data in accordance with applicable data 
                protection laws.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">5. Your Rights</h3>
              <p className="text-(--ink-2)">Depending on your location, you may have the right to:</p>
              <ul className="list-disc pl-6 space-y-1 text-(--ink-2)">
                <li>Access the personal information we hold about you</li>
                <li>Request correction of inaccurate information</li>
                <li>Request deletion of your personal information</li>
                <li>Object to or restrict certain processing activities</li>
                <li>Data portability (receive your data in a structured format)</li>
                <li>Withdraw consent at any time (where applicable)</li>
              </ul>
              <p className="text-(--ink-2)">
                To exercise these rights, please contact us at{' '}
                <a href="mailto:privacy@gymtech.app" className="text-(--accent) hover:underline">
                  privacy@gymtech.app
                </a>
                .
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">6. Cookies & Tracking</h3>
              <p className="text-(--ink-2)">
                We use cookies and similar tracking technologies to operate our Service. Essential cookies 
                are required for the Service to function properly. We may also use analytics cookies to 
                understand how you use our Service.
              </p>
              <p className="text-(--ink-2)">
                You can control cookie preferences through your browser settings. Disabling cookies may 
                affect the functionality of our Service.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">7. Third-Party Services</h3>
              <p className="text-(--ink-2)">
                We may employ third-party companies and individuals to facilitate our Service, provide 
                services on our behalf, or assist us in analyzing how our Service is used. These third 
                parties have access to your Personal Information only to perform these tasks on our behalf 
                and are obligated not to disclose or use it for any other purpose.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">8. Children's Privacy</h3>
              <p className="text-(--ink-2)">
                Our Service is not intended for individuals under the age of 18. We do not knowingly 
                collect personal information from children under 18. If you become aware that a child 
                has provided us with personal information, please contact us so we can delete such information.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">9. International Transfers</h3>
              <p className="text-(--ink-2)">
                Your information may be transferred to and maintained on servers located outside your 
                state, province, country, or other governmental jurisdiction where the data protection 
                laws may differ. We ensure appropriate safeguards are in place for such transfers.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">10. Changes to This Policy</h3>
              <p className="text-(--ink-2)">
                We may update our Privacy Policy from time to time. We will notify you of any changes 
                by posting the new Privacy Policy on this page and updating the "Last updated" date.
              </p>
              <p className="text-(--ink-2)">
                You are advised to review this Privacy Policy periodically for any changes. Changes to 
                this Privacy Policy are effective when they are posted on this page.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-(--fg)">11. Contact Us</h3>
              <p className="text-(--ink-2)">
                If you have any questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <ul className="list-none space-y-1 text-(--ink-2)">
                <li>Email: <a href="mailto:privacy@gymtech.app" className="text-(--accent) hover:underline">privacy@gymtech.app</a></li>
                <li>Address: Mumbai, India</li>
              </ul>
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

export default PrivacyPage;
