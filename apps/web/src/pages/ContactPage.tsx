import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Mail, MapPin, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

export const ContactPage: React.FC = () => {
  const TARGET_EMAIL = 'ap.fitapp@gmail.com';
  const [searchParams] = useSearchParams();

  const planParam = searchParams.get('plan');
  const intentParam = searchParams.get('intent');
  const initialSubject = planParam
    ? `Free Trial Request — ${planParam} Plan`
    : intentParam === 'demo'
    ? 'Book a Walkthrough Demo'
    : intentParam === 'trial'
    ? 'Start Free Trial Request'
    : '';

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: initialSubject,
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Contact & Start Free Trial — GymTech';
  }, []);

  const getEmailUrls = () => {
    const subject = formData.subject ? `[GymTech] ${formData.subject}` : 'GymTech Free Trial & Inquiry';
    const body = `Hi GymTech Team,

Name: ${formData.name || 'Not provided'}
From Email: ${formData.email || 'Not provided'}

Message / Gym Details:
${formData.message || ''}

Looking forward to getting in touch!`;

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(TARGET_EMAIL)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const mailtoUrl = `mailto:${TARGET_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return { gmailUrl, mailtoUrl, subject, body };
  };

  const handleSendToGmail = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      setError('Please fill in your name, email, and message.');
      return;
    }
    setError(null);
    setIsSubmitting(true);

    const { gmailUrl, mailtoUrl } = getEmailUrls();

    // Try opening Gmail composer in a new tab
    const win = window.open(gmailUrl, '_blank');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      // If popup blocker intervened, trigger mailto directly
      window.location.href = mailtoUrl;
    }

    setSubmitted(true);
    setIsSubmitting(false);
  };

  const handleSendMailto = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      setError('Please fill in your name, email, and message.');
      return;
    }
    setError(null);
    const { mailtoUrl } = getEmailUrls();
    window.location.href = mailtoUrl;
    setSubmitted(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  if (submitted) {
    const { gmailUrl, mailtoUrl } = getEmailUrls();
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border bg-card">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
              </Link>
              <h1 className="font-display text-lg font-semibold text-foreground">Contact & Free Trial</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-16 text-center space-y-6">
          <div className="inline-flex items-center justify-center size-16 rounded-full bg-emerald-500 text-white mb-2 shadow-sm">
            <CheckCircle2 className="size-8" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-2xl font-bold text-foreground">Email Composer Launched!</h2>
            <p className="text-muted-foreground max-w-md mx-auto text-sm">
              Your inquiry from <strong className="text-foreground">{formData.email}</strong> is ready to send to{' '}
              <strong className="text-primary font-mono">{TARGET_EMAIL}</strong>.
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Once we receive your email, our team will review your gym details and get in touch with you right away to set up your account.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button asChild className="gap-2 w-full sm:w-auto">
              <a href={gmailUrl} target="_blank" rel="noopener noreferrer">
                <Mail className="size-4" />
                Send via Gmail
              </a>
            </Button>
            <Button asChild variant="outline" className="gap-2 w-full sm:w-auto">
              <a href={mailtoUrl}>
                <Send className="size-4" />
                Open Email App
              </a>
            </Button>
            <Button variant="ghost" onClick={() => setSubmitted(false)} className="w-full sm:w-auto text-xs">
              Edit Message
            </Button>
          </div>

          <div className="pt-6">
            <Link to="/">
              <Button variant="outline" size="sm">Return Home</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

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
            <h1 className="font-display text-lg font-semibold text-foreground">Contact & Free Trial</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="grid gap-12 md:grid-cols-2">
          {/* Contact Info */}
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">Start Free or Reach Out</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Looking to start your free trial or have questions about GymTech? Simply send us an email and our team will get in touch with you directly to set up your gym workspace.
              </p>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-primary font-medium text-sm">
                <Mail className="size-4" />
                <span>Email-Only Support & Onboarding</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We currently handle all trial onboarding, account setups, and queries exclusively via email to provide dedicated, recorded assistance.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="text-muted-foreground mt-0.5"><Mail className="size-5" /></div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Official Email</p>
                  <a
                    href={`mailto:${TARGET_EMAIL}`}
                    className="text-sm font-medium text-primary hover:underline block font-mono"
                  >
                    {TARGET_EMAIL}
                  </a>
                  <div className="flex items-center gap-2 pt-1 text-xs">
                    <a
                      href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(TARGET_EMAIL)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                    >
                      <Mail className="size-3" />
                      Compose in Gmail &rarr;
                    </a>
                  </div>
                </div>
              </div>
              <ContactItem icon={<MapPin className="size-5" />} label="Location" value="Mumbai, India" />
            </div>
          </div>

          {/* Contact Form */}
          <Card>
            <CardHeader>
              <CardTitle>Send a Message</CardTitle>
              <CardDescription>
                Clicking will open Gmail addressed to <strong className="font-mono text-foreground">{TARGET_EMAIL}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <form onSubmit={handleSendToGmail} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Rahul Sharma"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Your Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="rahul@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    name="subject"
                    placeholder="e.g. Free Trial Request / Gym Setup"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message / Gym Details</Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder="Tell us your gym name, location, and member count. We will get in touch with you shortly to set up your account..."
                    rows={4}
                    value={formData.message}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button type="submit" className="flex-1 gap-2" disabled={isSubmitting}>
                    <Mail className="size-4" />
                    Send via Gmail
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendMailto}
                    className="gap-2"
                    disabled={isSubmitting}
                    title="Open in your default email client (Outlook, Apple Mail, etc.)"
                  >
                    <Send className="size-4" />
                    Email App
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground text-center">
                  Sends directly to <span className="font-mono text-foreground font-semibold">{TARGET_EMAIL}</span> from your mail account.
                </p>
              </form>
            </CardContent>
          </Card>
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

const ContactItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({
  icon,
  label,
  value,
}) => (
  <div className="flex items-center gap-3">
    <div className="text-muted-foreground">{icon}</div>
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  </div>
);

export default ContactPage;
