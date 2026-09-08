import React, { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MessageCircle, Mail, AlertCircle, Save, Smartphone, ShieldCheck, Bell } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

export const SettingsNotificationsPage: React.FC = () => {
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
      description="Automate member alerts, renewal reminders, and monitor your live SMS & WhatsApp quotas."
      actions={
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="h-8 text-xs font-semibold gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
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

      <div className="space-y-6">
        {/* Section 1: Quota Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* SMS Balance Card */}
          <Card className="border-border shadow-xs">
            <CardContent className="p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">SMS Credits</p>
                    <p className="text-xs text-muted-foreground">Carrier standard SMS</p>
                  </div>
                </div>
                <Badge
                  variant={smsBal.remaining > 50 ? 'secondary' : smsBal.remaining > 0 ? 'outline' : 'destructive'}
                  className="font-mono text-xs"
                >
                  {smsBal.remaining} Left
                </Badge>
              </div>

              <div className="mt-5 space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground font-mono">
                  <span>{smsBal.used} used</span>
                  <span>{smsBal.total} total quota</span>
                </div>
                <Progress value={smsPercent} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* WhatsApp Balance Card */}
          <Card className="border-border shadow-xs">
            <CardContent className="p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <MessageCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">WhatsApp Credits</p>
                    <p className="text-xs text-muted-foreground">Interactive rich receipts</p>
                  </div>
                </div>
                <Badge
                  variant={waBal.remaining > 50 ? 'secondary' : waBal.remaining > 0 ? 'outline' : 'destructive'}
                  className="font-mono text-xs"
                >
                  {waBal.remaining} Left
                </Badge>
              </div>

              <div className="mt-5 space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground font-mono">
                  <span>{waBal.used} used</span>
                  <span>{waBal.total} total quota</span>
                </div>
                <Progress value={waPercent} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-3">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Platform-Managed Relays:</strong> SMTP mail servers, SMS telco gateways, and WhatsApp Business APIs are securely managed by your GymTech Platform Super Admin.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 cols: Delivery Channels & Automated Triggers */}
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Channels */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" /> Delivery Channels
                </CardTitle>
                <CardDescription className="text-xs">
                  Active delivery pipelines configured for this gym location.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  <li className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <MessageCircle className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">WhatsApp Messaging</p>
                        <p className="text-xs text-muted-foreground">Digital pass links and instant receipt cards</p>
                      </div>
                    </div>
                    <Badge variant="default" className="text-[10px]">Active Relay</Badge>
                  </li>

                  <li className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Smartphone className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">SMS Gateway</p>
                        <p className="text-xs text-muted-foreground">High-priority instant text alerts for renewals & dues</p>
                      </div>
                    </div>
                    <Badge variant="default" className="text-[10px]">Active Relay</Badge>
                  </li>

                  <li className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Automated Email</p>
                        <p className="text-xs text-muted-foreground">GST invoices, contracts, and onboarding guides</p>
                      </div>
                    </div>
                    <Badge variant="default" className="text-[10px]">Active Relay</Badge>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Triggers */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Save className="h-4 w-4 text-primary" /> Automated Triggers
                </CardTitle>
                <CardDescription className="text-xs">
                  Choose when the platform automatically reaches out to your members.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  <li className="p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Membership Expiry Reminders</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Reach out automatically before member packages lapse.</p>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">Send when:</span>
                        {[3, 5, 7, 10].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setReminderDays(d)}
                            className={cn(
                              'h-6 px-2.5 rounded text-xs font-mono transition-colors border',
                              reminderDays === d
                                ? 'bg-primary text-primary-foreground border-primary font-bold'
                                : 'bg-muted/60 text-muted-foreground border-border hover:text-foreground'
                            )}
                          >
                            {d}d before
                          </button>
                        ))}
                      </div>
                    </div>
                    <Switch checked={expiryEnabled} onCheckedChange={setExpiryEnabled} />
                  </li>

                  <li className="p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Welcome Message</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Send a greeting with the member pass code right after enrollment.</p>
                    </div>
                    <Switch checked={welcomeEnabled} onCheckedChange={setWelcomeEnabled} />
                  </li>

                  <li className="p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Payment Receipt Notification</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Generate and dispatch a verified receipt the moment a payment settles.</p>
                    </div>
                    <Switch checked={receiptEnabled} onCheckedChange={setReceiptEnabled} />
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Right 1 col: Previews */}
          <div className="space-y-4">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">Live Member Preview</p>
            <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-3">
              <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">Payment Receipt</Badge>
              <p className="text-xs text-foreground leading-relaxed">
                Hi Rahul, we received ₹1,500 via UPI at Iron Gym. Receipt No: RCP-2026-0012. Thank you!
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-3">
              <Badge variant="outline" className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">Renewal Reminder</Badge>
              <p className="text-xs text-foreground leading-relaxed">
                Hi Rahul, your Quarterly Plan is expiring on 30 Aug. Renew today to keep your workouts uninterrupted.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-3">
              <Badge variant="outline" className="text-[10px] text-muted-foreground font-mono">Welcome Pass</Badge>
              <p className="text-xs text-foreground leading-relaxed">
                Hi Rahul! Welcome to Iron Gym. Your Member Code is MEM-1042. See you on the floor!
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};
