import React from 'react';
import { Lock, Plus, Minus } from 'lucide-react';

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
    <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-(--line)/60 w-full">
      <div className="text-center mb-12">
        <div className="mb-3 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-(--iron)/30 bg-(--iron)/10 text-(--iron) text-xs font-mono font-bold tracking-wider uppercase">
          <Lock className="size-3 mr-1.5 inline" />
          <span>COMMON QUESTIONS</span>
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
          Frequently Asked Questions
        </h2>
        <p className="text-ink-3 text-xs sm:text-sm mt-2">
          Everything you need to know about setting up and running GymTech.
        </p>
      </div>

      <ul className="divide-y divide-(--line)/60 rounded-xl border border-(--line)/60 bg-(--surface)">
        {FAQS.map((item, i) => (
          <li key={i}>
            <details className="group" {...(i === 0 ? { open: true } : {})}>
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4 text-sm font-medium text-ink hover:text-(--iron) transition-colors">
                <span>{item.q}</span>
                <span className="size-6 rounded-full border border-(--line)/60 flex items-center justify-center text-ink-3 group-open:text-(--iron) group-open:border-(--iron)/40 transition-colors">
                  <Plus className="size-3.5 group-open:hidden" />
                  <Minus className="size-3.5 hidden group-open:block" />
                </span>
              </summary>
              <div className="px-5 pb-5 -mt-1 text-sm text-ink-3 leading-relaxed">
                {item.a}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
};
