import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

export const PrivacyPage: React.FC = () => {
  useEffect(() => {
    document.title = 'Privacy Policy — GymTech';
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="size-4" />
                Back
              </Button>
            </Link>
            <h1 className="font-display text-lg font-semibold text-foreground">Privacy Policy</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="space-y-8">
          {/* Intro */}
          <section className="flex items-start gap-4">
            <div className="inline-flex items-center justify-center size-12 rounded-xl bg-primary/10 text-primary">
              <Shield className="size-6" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">Privacy Policy</h2>
              <p className="text-sm text-muted-foreground">Last updated: January 1, 2025</p>
            </div>
          </section>

          {/* Privacy Content */}
          <div className="prose prose-sm max-w-none space-y-6">
            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-foreground">1. Information We Collect</h3>
              <p className="text-muted-foreground leading-relaxed">
                We collect information you provide directly to us, including:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li><strong>Account Information:</strong> Name, email address, phone number, and business information when you register</li>
                <li><strong>Member Data:</strong> Information about gym members including name, contact details, health information, and membership status</li>
                <li><strong>Payment Information:</strong> Payment details and transaction history (processed securely via third-party payment providers)</li>
                <li><strong>Usage Data:</strong> How you interact with our Service, including attendance logs and feature usage</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-foreground">2. How We Use Your Information</h3>
              <p className="text-muted-foreground leading-relaxed">We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li>Provide, maintain, and improve our Services</li>
                <li>Process transactions and send related information</li>
                <li>Send you technical notices, updates, and support messages</li>
                <li>Respond to your comments, questions, and customer service requests</li>
                <li>Monitor and analyze trends, usage, and activities in connection with our Services</li>
                <li>Detect, investigate, and prevent fraudulent or unauthorized transactions</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-foreground">3. Data Security</h3>
              <p className="text-muted-foreground leading-relaxed">
                We implement industry-standard security measures to protect your data, including:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li>Encryption of data in transit using TLS/SSL</li>
                <li>Encryption of sensitive data at rest</li>
                <li>Regular security audits and penetration testing</li>
                <li>Access controls and authentication mechanisms</li>
                <li>Secure cloud infrastructure with Cloudflare protection</li>
              </ul>
              <p className="text-muted-foreground mt-3 leading-relaxed">
                While we strive to protect your information, no method of transmission over the Internet or 
                electronic storage is 100% secure. We cannot guarantee absolute security.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-foreground">4. Data Retention</h3>
              <p className="text-muted-foreground leading-relaxed">
                We retain your information for as long as your account is active or as needed to provide 
                you services. We will retain and use your information as necessary to comply with our 
                legal obligations, resolve disputes, and enforce our agreements.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Upon request, we can export or delete your data in accordance with applicable data 
                protection laws.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-foreground">5. Your Rights</h3>
              <p className="text-muted-foreground leading-relaxed">Depending on your location, you may have the right to:</p>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                <li>Access the personal information we hold about you</li>
                <li>Request correction of inaccurate information</li>
                <li>Request deletion of your personal information</li>
                <li>Object to or restrict certain processing activities</li>
                <li>Data portability (receive your data in a structured format)</li>
                <li>Withdraw consent at any time (where applicable)</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                To exercise these rights, please contact us at{' '}
                <a href="mailto:ap.fitapp@gmail.com" className="text-primary hover:underline font-medium">
                  ap.fitapp@gmail.com
                </a>
                .
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-foreground">6. Cookies & Tracking</h3>
              <p className="text-muted-foreground leading-relaxed">
                We use cookies and similar tracking technologies to operate our Service. Essential cookies 
                are required for the Service to function properly. We may also use analytics cookies to 
                understand how you use our Service.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                You can control cookie preferences through your browser settings. Disabling cookies may 
                affect the functionality of our Service.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-foreground">7. Third-Party Services</h3>
              <p className="text-muted-foreground leading-relaxed">
                We may employ third-party companies and individuals to facilitate our Service, provide 
                services on our behalf, or assist us in analyzing how our Service is used. These third 
                parties have access to your Personal Information only to perform these tasks on our behalf 
                and are obligated not to disclose or use it for any other purpose.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-foreground">8. Children's Privacy</h3>
              <p className="text-muted-foreground leading-relaxed">
                Our Service is not intended for individuals under the age of 18. We do not knowingly 
                collect personal information from children under 18. If you become aware that a child 
                has provided us with personal information, please contact us so we can delete such information.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-foreground">9. International Transfers</h3>
              <p className="text-muted-foreground leading-relaxed">
                Your information may be transferred to and maintained on servers located outside your 
                state, province, country, or other governmental jurisdiction where the data protection 
                laws may differ. We ensure appropriate safeguards are in place for such transfers.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-foreground">10. Changes to This Policy</h3>
              <p className="text-muted-foreground leading-relaxed">
                We may update our Privacy Policy from time to time. We will notify you of any changes 
                by posting the new Privacy Policy on this page and updating the "Last updated" date.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                You are advised to review this Privacy Policy periodically for any changes. Changes to 
                this Privacy Policy are effective when they are posted on this page.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-semibold text-foreground">11. Contact Us</h3>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <ul className="list-none space-y-1 text-muted-foreground">
                <li>Email: <a href="mailto:ap.fitapp@gmail.com" className="text-primary hover:underline font-medium">ap.fitapp@gmail.com</a></li>
                <li>Address: Mumbai, India</li>
              </ul>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-12">
        <div className="max-w-3xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} GymTech. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PrivacyPage;
