import React, { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MessageCircle, Mail, AlertCircle, Save, Smartphone, ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export const SettingsNotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data, refetch } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: () => api.getNotificationSettings(),
  });

  const [reminderDays, setReminderDays] = useState(7);
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [receiptEnabled, setReceiptEnabled] = useState(true);
  const [expiryEnabled, setExpiryEnabled] = useState(true);

  useEffect(() => {
    if (!data) return;
    setReminderDays(data.reminderDays);
    setWelcomeEnabled(data.welcomeEnabled);
    setReceiptEnabled(data.receiptEnabled);
    setExpiryEnabled(data.expiryEnabled);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.updateNotificationSettings({
        reminderDays,
        welcomeEnabled,
        receiptEnabled,
        expiryEnabled,
      }),
    onSuccess: () => {
      toast('success', 'Saved', 'Notification trigger settings updated.');
      refetch();
    },
    onError: (e: any) => toast('error', 'Save failed', e.message),
  });

  const smsBal = data?.smsBalance || { total: 0, used: 0, remaining: 0 };
  const waBal = data?.whatsappBalance || { total: 0, used: 0, remaining: 0 };
  const smsPercent = smsBal.total > 0 ? Math.min(100, Math.round((smsBal.used / smsBal.total) * 100)) : 0;
  const waPercent = waBal.total > 0 ? Math.min(100, Math.round((waBal.used / waBal.total) * 100)) : 0;

  return (
    <AppShell
      title="Notifications & Message Balances"
      description="Automate member alerts, renewal reminders, and track your live SMS & WhatsApp message balances."
      actions={
        <Button
          size="sm"
          className="gt-btn-primary"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          <Save className="h-3.5 w-3.5" />
          {saveMutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      }
    >
      {saveMutation.isError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {(saveMutation.error as Error)?.message || 'Save failed.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-10 gap-y-10">
        <div className="lg:col-span-2 flex flex-col gap-10 min-w-0">

          {/* Section 1: Message Credits & Balances */}
          <section>
            <SectionHeader
              eyebrow="Message Balances"
              title="SMS & WhatsApp Quotas"
              subtitle="Message credits are managed by the platform. Sending an automated or manual alert decrements your balance."
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {/* SMS Balance Card */}
              <div className="rounded-xl border border-(--line) bg-(--surface) p-4 flex flex-col justify-between shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Smartphone className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-ink">SMS Balance</p>
                      <p className="text-[11px] text-ink-3">Carrier standard SMS</p>
                    </div>
                  </div>
                  <span className={cn(
                    "text-xs font-mono font-bold px-2 py-0.5 rounded-md",
                    smsBal.remaining > 50 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                    smsBal.remaining > 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                    "bg-red-500/10 text-red-600 dark:text-red-400"
                  )}>
                    {smsBal.remaining} Left
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-[11px] text-ink-3 font-mono mb-1">
                    <span>{smsBal.used} used</span>
                    <span>{smsBal.total} total quota</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-(--surface-2) overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        smsPercent > 90 ? "bg-red-500" : smsPercent > 75 ? "bg-amber-500" : "bg-blue-500"
                      )}
                      style={{ width: `${smsPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* WhatsApp Balance Card */}
              <div className="rounded-xl border border-(--line) bg-(--surface) p-4 flex flex-col justify-between shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <MessageCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-ink">WhatsApp Balance</p>
                      <p className="text-[11px] text-ink-3">Interactive rich alerts</p>
                    </div>
                  </div>
                  <span className={cn(
                    "text-xs font-mono font-bold px-2 py-0.5 rounded-md",
                    waBal.remaining > 50 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                    waBal.remaining > 0 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                    "bg-red-500/10 text-red-600 dark:text-red-400"
                  )}>
                    {waBal.remaining} Left
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-[11px] text-ink-3 font-mono mb-1">
                    <span>{waBal.used} used</span>
                    <span>{waBal.total} total quota</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-(--surface-2) overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-300",
                        waPercent > 90 ? "bg-red-500" : waPercent > 75 ? "bg-amber-500" : "bg-emerald-500"
                      )}
                      style={{ width: `${waPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-ink-2 leading-relaxed">
                <strong>Platform-Managed Gateways:</strong> SMTP mail servers, SMS telco gateways, and WhatsApp Business APIs are securely managed by your GymTech Platform Super Admin. To top up message credits or adjust delivery channels, contact platform administration.
              </p>
            </div>
          </section>

          {/* Section 2: Delivery Channels */}
          <section>
            <SectionHeader eyebrow="Channels" title="Delivery Status" />
            <ul className="flex flex-col">
              <ChannelRow
                icon={<MessageCircle className="h-4 w-4" />}
                name="WhatsApp Messaging"
                desc="Direct member nudges with pre-formatted receipts and digital member pass links."
                on={data?.whatsappServiceStatus === 'ACTIVE' ? (
                  <span className="gt-chip gt-chip-ok">Active Relay</span>
                ) : (
                  <span className="gt-chip gt-chip-muted">Super Admin Configured</span>
                )}
                locked
              />
              <ChannelRow
                icon={<Smartphone className="h-4 w-4" />}
                name="SMS Dispatch"
                desc="High-priority instant SMS text messages delivered straight to mobile numbers."
                on={data?.smsServiceStatus === 'ACTIVE' ? (
                  <span className="gt-chip gt-chip-ok">Active Relay</span>
                ) : (
                  <span className="gt-chip gt-chip-muted">Super Admin Configured</span>
                )}
              />
              <ChannelRow
                icon={<Mail className="h-4 w-4" />}
                name="Automated Email"
                desc="Formal GST tax invoices, membership contracts, and welcome documentation."
                on={data?.emailServiceStatus === 'ACTIVE' ? (
                  <span className="gt-chip gt-chip-ok">Active Relay</span>
                ) : (
                  <span className="gt-chip gt-chip-muted">Super Admin Configured</span>
                )}
              />
            </ul>
          </section>

          {/* Section 3: Triggers */}
          <section>
            <SectionHeader eyebrow="Triggers" title="When messages go out" />
            <ul className="flex flex-col">
              <TriggerRow
                title="Membership expiry reminders"
                desc="Reach out before members lapse — keep renewals predictable."
                enabled={expiryEnabled}
                onToggle={setExpiryEnabled}
                footer={
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-ink-3">Send when</span>
                    {[3, 5, 7, 10].map((d) => (
                      <button
                        key={d}
                        onClick={() => setReminderDays(d)}
                        className={cn(
                          'h-6 px-2 rounded text-[11px] font-mono transition-colors',
                          reminderDays === d
                            ? 'bg-(--ink) text-(--ink-inverse)'
                            : 'text-ink-3 hover:text-ink'
                        )}
                      >
                        {d}d before
                      </button>
                    ))}
                  </div>
                }
              />
              <TriggerRow
                title="Welcome message"
                desc="Send a welcome message with the member's pass code right after enrollment."
                enabled={welcomeEnabled}
                onToggle={setWelcomeEnabled}
              />
              <TriggerRow
                title="Payment receipt"
                desc="Generate and dispatch an instant receipt the moment a payment is settled."
                enabled={receiptEnabled}
                onToggle={setReceiptEnabled}
              />
            </ul>
          </section>
        </div>

        {/* RIGHT — preview */}
        <aside className="flex flex-col gap-6 min-w-0">
          <div className="sticky top-6 flex flex-col gap-6">
            <p className="text-eyebrow">Preview</p>
            <p className="text-meta">How messages read on a member's phone.</p>
            <PreviewChat
              label="Receipt"
              tone="ok"
              body={`Hi Rahul, we received ₹1,500 via UPI at your gym. Receipt No: RCP-2026-0012. Thank you!`}
            />
            <PreviewChat
              label="Renewal reminder"
              tone="info"
              body={`Hi Rahul, your membership is expiring on 30 Aug. Renew to keep your routine uninterrupted.`}
            />
            <PreviewChat
              label="Welcome"
              tone="muted"
              body={`Hi Rahul! Welcome to your gym. Your Member Code is MEM-1042. See you on the floor.`}
            />
          </div>
        </aside>
      </div>
    </AppShell>
  );
};

const SectionHeader: React.FC<{ eyebrow: string; title: string; subtitle?: string }> = ({ eyebrow, title, subtitle }) => (
  <div className="mb-2">
    <p className="text-eyebrow">{eyebrow}</p>
    <h2 className="text-h2 text-ink mt-1.5">{title}</h2>
    {subtitle && <p className="text-xs text-ink-3 mt-1 leading-relaxed">{subtitle}</p>}
  </div>
);

const ChannelRow: React.FC<{
  icon: React.ReactNode;
  name: string;
  desc: string;
  on: React.ReactNode;
  locked?: boolean;
}> = ({ icon, name, desc, on, locked }) => (
  <li className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-4 border-t border-line-2 first:border-t-0">
    <div className="h-8 w-8 rounded-md bg-(--surface-2) text-ink-2 flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div>
      <p className="text-sm text-ink font-medium">{name}</p>
      <p className="text-[11px] text-ink-3 mt-0.5">{desc}</p>
    </div>
    <div className="flex items-center gap-2">
      {on}
      {locked && <span className="text-[10px] text-ink-3 font-mono">always on</span>}
    </div>
  </li>
);

const TriggerRow: React.FC<{
  title: string;
  desc: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  footer?: React.ReactNode;
}> = ({ title, desc, enabled, onToggle, footer }) => (
  <li className="py-4 border-t border-line-2 first:border-t-0">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-ink font-medium">{title}</p>
        <p className="text-[11px] text-ink-3 mt-0.5">{desc}</p>
        {footer && <div className="mt-3">{footer}</div>}
      </div>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
  </li>
);

const PreviewChat: React.FC<{ label: string; tone: 'ok' | 'info' | 'muted'; body: string }> = ({ label, tone, body }) => (
  <div className="rounded-md border border-(--line) bg-(--surface) p-3">
    <p
      className={cn(
        'text-[10px] uppercase tracking-wider font-semibold mb-2',
        tone === 'ok' && 'text-(--positive)',
        tone === 'info' && 'text-info',
        tone === 'muted' && 'text-ink-3'
      )}
    >
      {label}
    </p>
    <p className="text-[13px] text-ink leading-relaxed">{body}</p>
  </div>
);
