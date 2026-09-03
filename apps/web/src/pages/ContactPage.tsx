import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, MessageCircle, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // In a real app, this would call an API endpoint
      // For now, simulate a submission
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setSubmitted(true);
    } catch {
      setError('Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-(--bg)">
        <header className="border-b border-(--border) bg-(--surface)">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="size-4" />
                Back
              </Button>
            </Link>
            <h1 className="font-display text-lg font-semibold text-(--fg)">Contact Us</h1>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-16 text-center">
          <div className="inline-flex items-center justify-center size-16 rounded-full bg-(--ok) text-white mb-4">
            <CheckCircle2 className="size-8" />
          </div>
          <h2 className="font-display text-2xl font-bold text-(--fg) mb-2">Message Sent!</h2>
          <p className="text-(--ink-2) mb-8">
            Thank you for reaching out. We'll get back to you within 24-48 hours.
          </p>
          <Link to="/">
            <Button variant="outline">Return Home</Button>
          </Link>
        </main>
      </div>
    );
  }

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
          <h1 className="font-display text-lg font-semibold text-(--fg)">Contact Us</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="grid gap-12 md:grid-cols-2">
          {/* Contact Info */}
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-(--fg) mb-2">Get in Touch</h2>
              <p className="text-(--ink-2)">
                Have a question, suggestion, or need help? We'd love to hear from you.
              </p>
            </div>

            <div className="space-y-4">
              <ContactItem icon={<Mail className="size-5" />} label="Email" value="support@gymtech.app" />
              <ContactItem icon={<Phone className="size-5" />} label="Phone" value="+91 98765 43210" />
              <ContactItem icon={<MapPin className="size-5" />} label="Address" value="Mumbai, India" />
            </div>

            <div className="pt-4 border-t border-(--border)">
              <p className="text-sm text-(--ink-2) mb-3">Quick responses on WhatsApp</p>
              <a
                href="https://wa.me/919876543210"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#25D366] text-white hover:bg-[#25D366]/90 transition-colors"
              >
                <MessageCircle className="size-5" />
                Chat on WhatsApp
              </a>
            </div>
          </div>

          {/* Contact Form */}
          <Card>
            <CardHeader>
              <CardTitle>Send a Message</CardTitle>
              <CardDescription>Fill out the form below and we'll get back to you</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (optional)</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    name="subject"
                    placeholder="How can we help?"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder="Tell us more about your inquiry..."
                    rows={4}
                    value={formData.message}
                    onChange={handleChange}
                    required
                  />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>Sending...</>
                  ) : (
                    <>
                      <Send className="size-4" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
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

const ContactItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({
  icon,
  label,
  value,
}) => (
  <div className="flex items-center gap-3">
    <div className="text-(--ink-3)">{icon}</div>
    <div>
      <p className="text-xs text-(--ink-3)">{label}</p>
      <p className="text-sm text-(--fg)">{value}</p>
    </div>
  </div>
);

export default ContactPage;
