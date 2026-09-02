import React from 'react';
import { Lock, Plus, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const FAQS = [
  {
    q: 'What are the primary portals and roles in GymTech?',
    a: 'GymTech features a clean role-based architecture: Owner / Admin for complete gym operations, package management, attendance, and revenue; Trainer Desk for high-speed check-ins and PT client allocations; and Member Portal for members to check their plan status and digital QR card.',
  },
  {
    q: 'How does the automated WhatsApp receipt feature work?',
    a: 'When a payment or renewal is recorded, GymTech generates a pre-formatted click-to-chat WhatsApp link with the member\u2019s unique receipt number, package details, and transaction amount. Your front desk can share official receipts with one tap without paying third-party WhatsApp API costs.',
  },
  {
    q: 'How is gym data secured and isolated?',
    a: 'Every gym\u2019s data is strictly isolated with tenant-scoped queries enforced on the API layer. A gym owner or staff can never access another gym\u2019s members, payments, or financial reports.',
  },
  {
    q: 'Can I import existing members from our Excel spreadsheet?',
    a: 'Yes! GymTech provides a built-in one-click member import tool. You can upload your existing member list with phone numbers, joining dates, and plan details in seconds, or our team will migrate it for you for free.',
  },
  {
    q: 'What happens when a member travels or gets injured?',
    a: 'GymTech includes a native Freeze / Pause feature. You can pause a member\u2019s active plan with one click. Their remaining active days are preserved exactly and restored when you unfreeze their account.',
  },
] as const;

export const FaqSection: React.FC = () => {
  return (
    <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-[var(--border)]/60 w-full">
      <div className="text-center mb-12">
        <Badge variant="outline" className="mb-3 px-3 py-1 rounded-full border-primary/30 bg-primary/10 text-primary text-xs font-mono font-bold tracking-wider uppercase">
          <Lock className="size-3 text-primary mr-1.5 inline" />
          <span>COMMON QUESTIONS</span>
        </Badge>
        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Frequently Asked Questions
        </h2>
        <p className="text-muted-foreground text-xs sm:text-sm mt-2">
          Everything you need to know about setting up and running GymTech.
        </p>
      </div>

      <ul className="divide-y divide-[var(--border)]/60 rounded-xl border border-[var(--border)]/60 bg-card">
        {FAQS.map((item, i) => (
          <li key={i}>
            <details className="group" {...(i === 0 ? { open: true } : {})}>
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4 text-sm font-medium text-foreground hover:text-primary transition-colors">
                <span>{item.q}</span>
                <span className="size-6 rounded-full border border-[var(--border)]/60 flex items-center justify-center text-muted-foreground group-open:text-primary group-open:border-primary/40 transition-colors">
                  <Plus className="size-3.5 group-open:hidden" />
                  <Minus className="size-3.5 hidden group-open:block" />
                </span>
              </summary>
              <div className="px-5 pb-5 -mt-1 text-sm text-muted-foreground leading-relaxed">
                {item.a}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
};
