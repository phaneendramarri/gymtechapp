import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Layers,
  CreditCard,
  QrCode,
  BarChart3,
  Check,
  Search,
  Plus,
  ArrowRight,
  MessageSquare,
  Sparkles,
  Download,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Clock,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AnimatedCounter } from '@/components/shared/AnimatedCounter';

const TABS = [
  { id: 'members', step: '01', title: 'Members & Profiles', icon: Users },
  { id: 'plans', step: '02', title: 'Plans & Pricing', icon: Layers },
  { id: 'payments', step: '03', title: 'Bills & WhatsApp Receipts', icon: CreditCard },
  { id: 'attendance', step: '04', title: 'Daily Attendance', icon: QrCode },
  { id: 'dashboard', step: '05', title: 'Reports & Revenue', icon: BarChart3 },
] as const;

type TabId = typeof TABS[number]['id'];

export const ProductWorkflowShowcase: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('members');
  const [kioskStatus, setKioskStatus] = useState<'pass' | 'deny'>('pass');
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'CASH' | 'CARD'>('UPI');
  const [memberFilter, setMemberFilter] = useState<'ALL' | 'ACTIVE' | 'FROZEN'>('ALL');

  return (
    <section id="product" className="py-20 sm:py-28 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-[10px] font-mono font-bold tracking-wider uppercase mb-4">
            <Sparkles className="size-3 text-primary" />
            DEEP-DIVE PRODUCT CAPABILITIES
          </div>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-4 leading-tight">
            Explore the interface
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            Switch between modules to see how GymTech powers day-to-day operations with speed and precision.
          </p>
        </div>

        {/* Tab Selector Bar */}
        <div className="flex items-center justify-start sm:justify-center overflow-x-auto pb-4 mb-8 gap-2 no-scrollbar">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary shadow-md'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                <span className={`size-5 rounded-md flex items-center justify-center font-mono text-[10px] font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-secondary text-primary'
                }`}>
                  {tab.step}
                </span>
                <Icon className="size-3.5" />
                <span>{tab.title}</span>
              </button>
            );
          })}
        </div>

        {/* Transforming Content Container */}
        <div className="rounded-3xl border border-border bg-card shadow-2xl p-6 sm:p-10 transition-all">
          <AnimatePresence mode="wait">
            
            {/* ─── TAB 1: MEMBERS ─── */}
            {activeTab === 'members' && (
              <motion.div
                key="members"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
              >
                <div className="lg:col-span-5 space-y-4">
                  <Badge variant="outline" className="text-[10px] font-mono text-primary border-primary/20 bg-primary/5">
                    MODULE 01 &bull; CRM &amp; DIRECTORY
                  </Badge>
                  <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    Complete client records with freeze control
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Track every member's emergency contact, active plan, remaining days, and pause histories. When members travel or fall sick, freeze their membership with one click to preserve validity.
                  </p>
                  <div className="space-y-2 text-xs text-muted-foreground pt-2">
                    <div className="flex items-center gap-2">
                      <Check className="size-3.5 text-primary" />
                      <span>One-click pause/unpause with automated remaining-day preservation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="size-3.5 text-primary" />
                      <span>Excel bulk importer with past joining and expiry date retention</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="size-3.5 text-primary" />
                      <span>Automated status classification (Active, Expiring, Frozen, Expired)</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 bg-background rounded-2xl border border-border p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-primary" />
                      <span className="text-xs font-bold text-foreground">Member Registry</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {(['ALL', 'ACTIVE', 'FROZEN'] as const).map(f => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setMemberFilter(f)}
                          className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all ${
                            memberFilter === f
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs text-muted-foreground">
                    <Search className="size-3.5" />
                    <span className="text-[11px]">Searching 142 members across all plans...</span>
                  </div>

                  <div className="space-y-2">
                    {[
                      { name: 'Rahul Sharma', id: 'MEM-1001', plan: 'Annual Strength Pro', status: 'ACTIVE', phone: '+91 98765 43211', badgeColor: 'bg-primary/10 text-primary border-primary/20' },
                      { name: 'Pooja Verma', id: 'MEM-1002', plan: 'Half-Yearly Elite', status: 'ACTIVE', phone: '+91 98765 43212', badgeColor: 'bg-primary/10 text-primary border-primary/20' },
                      { name: 'Amit Patel', id: 'MEM-1003', plan: 'Quarterly Fitness', status: 'FROZEN', phone: '+91 98765 43213', badgeColor: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
                    ]
                    .filter(m => memberFilter === 'ALL' || m.status === memberFilter)
                    .map((m) => (
                      <div key={m.id} className="p-3 rounded-xl bg-card border border-border flex items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-lg bg-primary/10 text-primary font-mono font-bold text-xs flex items-center justify-center">
                            {m.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-bold text-foreground text-xs">{m.name}</p>
                            <p className="text-[10px] font-mono text-muted-foreground">{m.id} &bull; {m.plan}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${m.badgeColor}`}>
                          {m.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ─── TAB 2: PLANS ─── */}
            {activeTab === 'plans' && (
              <motion.div
                key="plans"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
              >
                <div className="lg:col-span-5 space-y-4">
                  <Badge variant="outline" className="text-[10px] font-mono text-primary border-primary/20 bg-primary/5">
                    MODULE 02 &bull; MEMBERSHIP PACKAGES
                  </Badge>
                  <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    Flexible durations with custom pricing rules
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Set up monthly, quarterly, half-yearly, annual, and custom duration plans. Configure one-time admission fees, discount codes, and automatic GST calculation.
                  </p>
                  <div className="space-y-2 text-xs text-muted-foreground pt-2">
                    <div className="flex items-center gap-2">
                      <Check className="size-3.5 text-primary" />
                      <span>Automatic expiration timeline calculation from joining date</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="size-3.5 text-primary" />
                      <span>Personal training add-on bundles and coach allocation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="size-3.5 text-primary" />
                      <span>Seamless upgrade &amp; renewal without duplicate profile creation</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 bg-background rounded-2xl border border-border p-5 shadow-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {[
                      { name: 'Monthly Basic', duration: '30 Days', price: '₹1,500', tag: 'Flexible' },
                      { name: 'Quarterly Strength', duration: '90 Days', price: '₹4,000', tag: 'Popular' },
                      { name: 'Half-Yearly Elite', duration: '180 Days', price: '₹7,500', tag: 'Best Value' },
                      { name: 'Annual Pro', duration: '365 Days', price: '₹14,000', tag: 'VIP' },
                    ].map((p) => (
                      <div key={p.name} className="p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-all flex flex-col justify-between shadow-2xs">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase">{p.duration}</span>
                            <span className="text-[9px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold">{p.tag}</span>
                          </div>
                          <h4 className="text-xs font-bold text-foreground">{p.name}</h4>
                        </div>
                        <div className="mt-4 pt-2.5 border-t border-border flex items-baseline justify-between">
                          <span className="text-base font-display font-bold text-foreground">{p.price}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">+ GST Included</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ─── TAB 3: PAYMENTS ─── */}
            {activeTab === 'payments' && (
              <motion.div
                key="payments"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
              >
                <div className="lg:col-span-5 space-y-4">
                  <Badge variant="outline" className="text-[10px] font-mono text-primary border-primary/20 bg-primary/5">
                    MODULE 03 &bull; BILLING &amp; WHATSAPP
                  </Badge>
                  <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    Multi-mode billing &amp; instant receipts
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Accept UPI, Cash, and Card payments. Track partial token advances, print accountant-ready GST receipts, and dispatch digital WhatsApp receipts with zero third-party messaging costs.
                  </p>
                  <div className="space-y-2 text-xs text-muted-foreground pt-2">
                    <div className="flex items-center gap-2">
                      <Check className="size-3.5 text-primary" />
                      <span>Click-to-chat WhatsApp receipt generation in &lt; 0.5 seconds</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="size-3.5 text-primary" />
                      <span>Partial payment and outstanding due balance tracking</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="size-3.5 text-primary" />
                      <span>Automatic trainer commission split upon payment recording</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 bg-background rounded-2xl border border-border p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-4 text-primary" />
                      <span className="text-xs font-bold text-foreground">Payment Terminal</span>
                    </div>
                    <Badge variant="secondary" className="font-mono text-[10px]">#RCP-2026-0891</Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {(['UPI', 'CASH', 'CARD'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMode(m)}
                        className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
                          paymentMode === m
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                            : 'bg-card text-muted-foreground border-border hover:text-foreground'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  <div className="p-3.5 rounded-xl bg-card border border-border space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Annual Strength Pro</span>
                      <span className="font-semibold text-foreground">₹14,000</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">GST (18%)</span>
                      <span className="font-semibold text-foreground">₹2,520</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-border font-bold text-sm">
                      <span className="text-foreground font-sans">Total Collected</span>
                      <span className="text-primary font-display">₹16,520</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#25D366]/8 border border-[#25D366]/20 flex items-center justify-between gap-3 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="size-4 text-[#25D366]" />
                      <span className="text-foreground text-[11px]">WhatsApp Receipt Link Generated</span>
                    </div>
                    <span className="text-[10px] font-bold text-[#25D366]">1-Tap Send</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ─── TAB 4: ATTENDANCE ─── */}
            {activeTab === 'attendance' && (
              <motion.div
                key="attendance"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
              >
                <div className="lg:col-span-5 space-y-4">
                  <Badge variant="outline" className="text-[10px] font-mono text-primary border-primary/20 bg-primary/5">
                    STEP 04 &bull; QR &amp; DAILY ATTENDANCE
                  </Badge>
                  <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    Instant member check-in with automatic expiry alerts
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Let members scan a QR code at your front desk or enter their phone number. If a member's plan is expired or paused, GymTech alerts your staff immediately to prevent unpaid workouts.
                  </p>
                  <div className="space-y-2 text-xs text-muted-foreground pt-2">
                    <div className="flex items-center gap-2">
                      <Check className="size-3.5 text-primary" />
                      <span>Scan via member phone or quick front-desk search</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="size-3.5 text-primary" />
                      <span>Instant visual alert if membership is expired or frozen</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="size-3.5 text-primary" />
                      <span>See daily peak hours and workout rush times</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 bg-background rounded-2xl border border-border p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <QrCode className="size-4 text-primary" />
                      <span className="text-xs font-bold text-foreground">Front-Desk Check-In Test</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono text-primary border-primary/20 bg-primary/5">
                      Fast Verification
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setKioskStatus('pass')}
                      className={`py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                        kioskStatus === 'pass'
                          ? 'bg-primary/15 text-primary border-primary/40'
                          : 'bg-card text-muted-foreground border-border'
                      }`}
                    >
                      ✓ Active Member (Valid Plan)
                    </button>
                    <button
                      type="button"
                      onClick={() => setKioskStatus('deny')}
                      className={`py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
                        kioskStatus === 'deny'
                          ? 'bg-destructive/15 text-destructive border-destructive/40'
                          : 'bg-card text-muted-foreground border-border'
                      }`}
                    >
                      ✗ Expired Member (Renewal Due)
                    </button>
                  </div>

                  {kioskStatus === 'pass' ? (
                    <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs font-mono">
                          RS
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-foreground">Rahul Sharma</span>
                            <CheckCircle2 className="size-3.5 text-primary" />
                          </div>
                          <p className="text-[10px] font-mono text-muted-foreground">Annual Pro &bull; Valid till Nov 2026</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-primary text-primary-foreground">
                        ENTRY ALLOWED ✓
                      </span>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-destructive text-destructive-foreground flex items-center justify-center font-bold text-xs font-mono">
                          AK
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-foreground">Arun Kumar</span>
                            <XCircle className="size-3.5 text-destructive" />
                          </div>
                          <p className="text-[10px] font-mono text-muted-foreground">Monthly Basic &bull; Expired 2 days ago</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-destructive text-destructive-foreground">
                        PLAN EXPIRED ✗
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ─── TAB 5: DASHBOARD ─── */}
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
              >
                <div className="lg:col-span-5 space-y-4">
                  <Badge variant="outline" className="text-[10px] font-mono text-primary border-primary/20 bg-primary/5">
                    STEP 05 &bull; REPORTS &amp; REVENUE
                  </Badge>
                  <h3 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    Track monthly collections and export reports
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    See total money collected this month, view pending renewal dues, identify inactive members who stopped visiting, and download complete Excel reports for your accountant.
                  </p>
                  <div className="space-y-2 text-xs text-muted-foreground pt-2">
                    <div className="flex items-center gap-2">
                      <Check className="size-3.5 text-primary" />
                      <span>Monthly collection goal progress and daily breakdown</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="size-3.5 text-primary" />
                      <span>Inactive member alerts (absent &gt; 7 days) to follow up</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="size-3.5 text-primary" />
                      <span>1-Click Excel and CSV downloads with GST tax totals</span>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 bg-background rounded-2xl border border-border p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="size-4 text-primary" />
                      <span className="text-xs font-bold text-foreground">Monthly Fee Collection</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono bg-primary/10 text-primary border-primary/20">
                      Target: ₹3,50,000
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="font-bold text-foreground">₹61,520 Collected</span>
                      <span className="text-muted-foreground">₹2,88,480 Remaining</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-primary rounded-full w-[18%]" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3.5 rounded-xl bg-card border border-border">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">Average / Member</span>
                      <p className="text-base font-display font-bold text-foreground mt-0.5">₹430 / month</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-card border border-border flex flex-col justify-between">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">Download Data</span>
                      <p className="text-xs font-semibold text-primary flex items-center gap-1 mt-0.5">
                        <Download className="size-3" /> Excel &amp; CSV Ready
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>
    </section>
  );
};
