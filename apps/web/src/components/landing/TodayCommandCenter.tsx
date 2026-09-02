import React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Users,
  CalendarCheck,
  CreditCard,
  QrCode,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Sparkles,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AnimatedCounter } from '@/components/shared/AnimatedCounter';

const HOURLY_TRAFFIC = [
  { time: '6 AM', count: 12, height: '40%' },
  { time: '7 AM', count: 24, height: '80%' },
  { time: '8 AM', count: 28, height: '95%' },
  { time: '9 AM', count: 18, height: '60%' },
  { time: '10 AM', count: 8, height: '28%' },
  { time: '11 AM', count: 6, height: '20%' },
  { time: '4 PM', count: 14, height: '48%' },
  { time: '5 PM', count: 22, height: '75%' },
  { time: '6 PM', count: 30, height: '100%', peak: true },
  { time: '7 PM', count: 26, height: '88%' },
  { time: '8 PM', count: 16, height: '54%' },
  { time: '9 PM', count: 7, height: '24%' },
];

export const TodayCommandCenter: React.FC = () => {
  return (
    <section id="command-center" className="py-20 sm:py-28 bg-secondary/20 border-t border-border/40 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-[10px] font-mono font-bold tracking-wider uppercase mb-4">
            <Activity className="size-3 text-primary animate-pulse" />
            REAL-TIME OPERATIONAL PULSE
          </div>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground mb-4 leading-tight">
            Today at your gym
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            A live pulse of check-ins, upcoming renewals, dispatched receipts, and peak hour floor load — all updating automatically.
          </p>
        </div>

        {/* Command Center Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Main Column 1: Live Activity Stream (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* Top Metrics Row */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3.5 rounded-xl border border-border bg-card shadow-xs">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">
                  Members in Gym
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-display font-bold text-foreground">
                    <AnimatedCounter value={28} />
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">active right now</span>
                </div>
                <span className="text-[9px] font-mono text-primary font-semibold mt-1 block">Normal workout rush</span>
              </Card>

              <Card className="p-3.5 rounded-xl border border-border bg-card shadow-xs">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">
                  Today's Fees
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl font-display font-bold text-foreground">
                    <AnimatedCounter value={24500} prefix="₹" />
                  </span>
                </div>
                <span className="text-[9px] font-mono text-primary font-semibold mt-1 block">2 renewals &bull; 1 new</span>
              </Card>

              <Card className="p-3.5 rounded-xl border border-border bg-card shadow-xs">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block mb-1">
                  WhatsApp Bills
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl sm:text-2xl font-display font-bold text-foreground">
                    <AnimatedCounter value={18} />
                  </span>
                  <span className="text-[10px] font-mono text-primary font-semibold">100%</span>
                </div>
                <span className="text-[9px] font-mono text-muted-foreground mt-1 block">Sent to members</span>
              </Card>
            </div>

            {/* Peak Hour Heatmap Bar Visual */}
            <Card className="p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between mb-4 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-primary" />
                  <h3 className="text-xs font-bold text-foreground">Daily Rush Hours</h3>
                </div>
                <Badge variant="outline" className="text-[9px] font-mono border-primary/20 text-primary bg-primary/5">
                  Evening Rush: 6:00 PM - 7:00 PM
                </Badge>
              </div>

              {/* Bar Chart Bars */}
              <div className="flex items-end justify-between gap-1.5 h-28 pt-4">
                {HOURLY_TRAFFIC.map((bar) => (
                  <div key={bar.time} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                    <div
                      className={`w-full rounded-t-sm transition-all ${
                        bar.peak ? 'bg-primary' : 'bg-primary/30 group-hover:bg-primary/60'
                      }`}
                      style={{ height: bar.height }}
                    />
                    <span className="text-[8px] sm:text-[9px] font-mono text-muted-foreground">
                      {bar.time.split(' ')[0]}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Live Attendance Feed */}
            <Card className="p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between mb-3 border-b border-border/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary animate-pulse" />
                  <h3 className="text-xs font-bold text-foreground">Front-Desk Live Check-Ins</h3>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">Instant Verification</span>
              </div>

              <div className="space-y-2">
                {[
                  { name: 'Rahul Sharma', id: 'MEM-1001', plan: 'Annual Pro', time: '2 mins ago', status: 'VALID ENTRY', speed: '0.18s' },
                  { name: 'Deepika Rao', id: 'MEM-1019', plan: 'Quarterly Elite', time: '7 mins ago', status: 'VALID ENTRY', speed: '0.14s' },
                  { name: 'Karan Patel', id: 'MEM-1033', plan: 'Monthly Strength', time: '14 mins ago', status: 'VALID ENTRY', speed: '0.21s' },
                ].map((log) => (
                  <div key={log.id} className="p-2.5 rounded-lg bg-secondary/30 border border-border/70 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="size-7 rounded-md bg-primary/10 text-primary font-mono font-bold text-[10px] flex items-center justify-center">
                        {log.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-[11px]">{log.name}</p>
                        <p className="text-[9px] font-mono text-muted-foreground">{log.id} &bull; {log.plan}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="text-muted-foreground hidden sm:inline">{log.time}</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/20">
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Column: Alerts, Renewals & Trainer Splits (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            
            {/* Attention Watchlist Card */}
            <Card className="p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between mb-3 border-b border-border/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-4 text-amber-500" />
                  <h3 className="text-xs font-bold text-foreground">Action Watchlist</h3>
                </div>
                <Badge variant="outline" className="text-[9px] font-mono text-amber-500 border-amber-500/20 bg-amber-500/5">
                  3 Need Attention
                </Badge>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-foreground">Aakash Nair &bull; MEM-1014</span>
                    <span className="font-mono text-amber-600 dark:text-amber-400 font-bold text-[10px]">Expires in 2 days</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Quarterly Strength &bull; 1-click renewal link ready</p>
                </div>

                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-foreground">Sneha Rao &bull; MEM-1022</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400 font-bold text-[10px]">Paused (Travel)</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Plan frozen since Aug 15 &bull; 44 days remaining</p>
                </div>

                <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-foreground">Vikram Singh &bull; MEM-1008</span>
                    <span className="font-mono text-destructive font-bold text-[10px]">₹1,500 Balance Due</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Half-Yearly Elite &bull; Reminder scheduled</p>
                </div>
              </div>
            </Card>

            {/* Trainer Session & Settlement Card */}
            <Card className="p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between mb-3 border-b border-border/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  <h3 className="text-xs font-bold text-foreground">Trainer Desk Allocations</h3>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">Auto-Split</span>
              </div>

              <div className="space-y-2">
                {[
                  { trainer: 'Arjun Singh', clients: '8 active PT clients', commission: '₹18,400 earned' },
                  { trainer: 'Neha Verma', clients: '5 active PT clients', commission: '₹12,500 earned' },
                ].map((t) => (
                  <div key={t.trainer} className="p-2.5 rounded-lg bg-secondary/30 border border-border flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-foreground text-[11px]">{t.trainer}</p>
                      <p className="text-[9px] font-mono text-muted-foreground">{t.clients}</p>
                    </div>
                    <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {t.commission}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

          </div>
        </div>
      </div>
    </section>
  );
};
