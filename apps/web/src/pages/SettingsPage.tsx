import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Bell,
  CreditCard,
  Save,
  AlertCircle,
  Smartphone,
  MessageCircle,
  ShieldCheck,
  MapPin,
  Mail,
  Phone,
  Receipt,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export const SettingsPage: React.FC<{ defaultTab?: string }> = ({ defaultTab = 'profile' }) => {
  const { toast } = useToast();
  const { gym } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(defaultTab);

  // --- GYM PROFILE DATA & MUTATION ---
  const { data: gymProfile, isLoading: isGymLoading, refetch: refetchGym } = useQuery({
    queryKey: ['gym-profile'],
    queryFn: () => api.getGymProfile(),
  });

  const [gymName, setGymName] = useState('');
  const [gymPhone, setGymPhone] = useState('');
  const [gymEmail, setGymEmail] = useState('');
  const [gymAddress, setGymAddress] = useState('');
  const [gymCity, setGymCity] = useState('');
  const [gymState, setGymState] = useState('');
  const [gymPincode, setGymPincode] = useState('');
  const [gymGst, setGymGst] = useState('');
  const [gymLogoUrl, setGymLogoUrl] = useState('');

  // Populate the form exactly once, when the profile first arrives. Re-running
  // on every refetch would wipe out in-progress user edits (the fetch that
  // resolves after the user starts typing would clobber their input, and the
  // subsequent save would persist stale values).
  const profileSeededRef = useRef(false);
  useEffect(() => {
    if (gymProfile && !profileSeededRef.current) {
      profileSeededRef.current = true;
      setGymName(gymProfile.name || '');
      setGymPhone(gymProfile.phone || '');
      setGymEmail(gymProfile.email || '');
      setGymAddress(gymProfile.address || '');
      setGymCity(gymProfile.city || '');
      setGymState(gymProfile.state || '');
      setGymPincode(gymProfile.pincode || '');
      setGymGst(gymProfile.gstNumber || gymProfile.gst_number || '');
      setGymLogoUrl(gymProfile.logoUrl || gymProfile.logo_url || '');
    }
  }, [gymProfile]);

  const saveProfileMutation = useMutation({
    mutationFn: () =>
      api.updateGymProfile({
        name: gymName,
        phone: gymPhone,
        email: gymEmail,
        address: gymAddress,
        city: gymCity,
        state: gymState,
        pincode: gymPincode,
        gstNumber: gymGst,
        logoUrl: gymLogoUrl,
      }),
    onSuccess: () => {
      toast('success', 'Profile updated', 'Gym details have been successfully saved.');
      refetchGym();
      queryClient.invalidateQueries({ queryKey: ['gym-profile'] });
    },
    onError: (err: any) => {
      toast('error', 'Update failed', err.message || 'Could not update gym profile.');
    },
  });

  // --- NOTIFICATION SETTINGS DATA & MUTATION ---
  const { data: notifData, refetch: refetchNotifs } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: () => api.getNotificationSettings(),
  });

  const [reminderDays, setReminderDays] = useState(7);
  const [welcomeEnabled, setWelcomeEnabled] = useState(true);
  const [receiptEnabled, setReceiptEnabled] = useState(true);
  const [expiryEnabled, setExpiryEnabled] = useState(true);

  // Same once-only seeding as the profile form above: never overwrite
  // in-progress edits when the query refetches after a save.
  const notifSeededRef = useRef(false);
  useEffect(() => {
    if (notifData && !notifSeededRef.current) {
      notifSeededRef.current = true;
      setReminderDays(notifData.reminderDays ?? 7);
      setWelcomeEnabled(notifData.welcomeEnabled ?? true);
      setReceiptEnabled(notifData.receiptEnabled ?? true);
      setExpiryEnabled(notifData.expiryEnabled ?? true);
    }
  }, [notifData]);

  const saveNotifMutation = useMutation({
    mutationFn: () =>
      api.updateNotificationSettings({
        reminderDays,
        welcomeEnabled,
        receiptEnabled,
        expiryEnabled,
      }),
    onSuccess: () => {
      toast('success', 'Notification settings saved', 'Trigger preferences updated.');
      refetchNotifs();
    },
    onError: (err: any) => {
      toast('error', 'Save failed', err.message || 'Could not update notification settings.');
    },
  });

  const smsBal = notifData?.smsBalance || { total: 0, used: 0, remaining: 0 };
  const waBal = notifData?.whatsappBalance || { total: 0, used: 0, remaining: 0 };
  const smsPercent = smsBal.total > 0 ? Math.min(100, Math.round((smsBal.used / smsBal.total) * 100)) : 0;
  const waPercent = waBal.total > 0 ? Math.min(100, Math.round((waBal.used / waBal.total) * 100)) : 0;

  return (
    <AppShell
      title="Settings"
      description="Manage gym profile, brand configuration, automated member notifications, and billing preferences."
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-card border border-border p-1 rounded-xl h-11 flex items-center gap-1 shadow-2xs max-w-md">
          <TabsTrigger value="profile" className="gap-2 text-xs font-medium flex-1 h-9 rounded-lg">
            <Building2 className="size-4 text-primary" /> Gym Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2 text-xs font-medium flex-1 h-9 rounded-lg">
            <Bell className="size-4 text-primary" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2 text-xs font-medium flex-1 h-9 rounded-lg">
            <CreditCard className="size-4 text-primary" /> Invoicing
          </TabsTrigger>
        </TabsList>

        {/* ========================================================================= */}
        {/* TAB 1: GYM PROFILE */}
        {/* ========================================================================= */}
        <TabsContent value="profile" className="space-y-6 animate-in fade-in duration-200">
          <Card className="border-border shadow-xs bg-card">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    <Building2 className="size-4 text-primary" /> Gym Identity & Location
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    This information appears on your member receipts, invoices, and automated communications.
                  </CardDescription>
                </div>
                {gymProfile?.slug && (
                  <Badge variant="outline" className="font-mono text-[11px]">
                    Slug: {gymProfile.slug}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Gym / Facility Name *</label>
                  <input
                    type="text"
                    required
                    value={gymName}
                    onChange={(e) => setGymName(e.target.value)}
                    placeholder="e.g. Iron Forge Fitness"
                    className="w-full px-3 py-2 text-sm bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Official Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={gymPhone}
                    onChange={(e) => setGymPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-2 text-sm font-mono bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Official Email Address</label>
                  <input
                    type="email"
                    value={gymEmail}
                    onChange={(e) => setGymEmail(e.target.value)}
                    placeholder="e.g. hello@ironforge.com"
                    className="w-full px-3 py-2 text-sm font-mono bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">GSTIN / Tax Identification</label>
                  <input
                    type="text"
                    value={gymGst}
                    onChange={(e) => setGymGst(e.target.value)}
                    placeholder="e.g. 36AABCU9603R1ZM"
                    className="w-full px-3 py-2 text-sm font-mono uppercase bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Physical Address</label>
                <input
                  type="text"
                  value={gymAddress}
                  onChange={(e) => setGymAddress(e.target.value)}
                  placeholder="e.g. 2nd Floor, Phoenix Prime Tower, Road No. 36"
                  className="w-full px-3 py-2 text-sm bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">City</label>
                  <input
                    type="text"
                    value={gymCity}
                    onChange={(e) => setGymCity(e.target.value)}
                    placeholder="e.g. Hyderabad"
                    className="w-full px-3 py-2 text-sm bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">State</label>
                  <input
                    type="text"
                    value={gymState}
                    onChange={(e) => setGymState(e.target.value)}
                    placeholder="e.g. Telangana"
                    className="w-full px-3 py-2 text-sm bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Pincode</label>
                  <input
                    type="text"
                    value={gymPincode}
                    onChange={(e) => setGymPincode(e.target.value)}
                    placeholder="e.g. 500033"
                    className="w-full px-3 py-2 text-sm font-mono bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Brand Logo URL</label>
                <div className="flex gap-3 items-center">
                  {gymLogoUrl ? (
                    <div className="size-12 rounded-lg border border-border overflow-hidden bg-card shrink-0 flex items-center justify-center">
                      <img src={gymLogoUrl} alt="Gym logo preview" className="size-full object-cover" />
                    </div>
                  ) : null}
                  <input
                    type="url"
                    value={gymLogoUrl}
                    onChange={(e) => setGymLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-3 py-2 text-sm font-mono bg-secondary/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="border-t border-border p-4 bg-muted/20 flex justify-end">
              <Button
                onClick={() => saveProfileMutation.mutate()}
                disabled={saveProfileMutation.isPending || !gymName.trim()}
                className="text-xs font-bold gap-1.5"
              >
                <Save className="size-3.5" />
                {saveProfileMutation.isPending ? 'Saving…' : 'Save Profile Changes'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 2: NOTIFICATIONS & LIVE QUOTAS */}
        {/* ========================================================================= */}
        <TabsContent value="notifications" className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* SMS Quota Card */}
            <Card className="border-border shadow-xs bg-card">
              <CardContent className="p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Smartphone className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">SMS Credits</p>
                      <p className="text-xs text-muted-foreground">Carrier transactional SMS</p>
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

            {/* WhatsApp Quota Card */}
            <Card className="border-border shadow-xs bg-card">
              <CardContent className="p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <MessageCircle className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">WhatsApp Credits</p>
                      <p className="text-xs text-muted-foreground">Verified WhatsApp alerts</p>
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

          <Card className="border-border shadow-xs bg-card">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Bell className="size-4 text-primary" /> Automated Triggers
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Define when GymTech dispatches automatic alerts to registered gym members.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">Welcome Message</p>
                  <p className="text-xs text-muted-foreground">
                    Automatically send a welcome greeting with member credentials upon new registration.
                  </p>
                </div>
                <Switch checked={welcomeEnabled} onCheckedChange={setWelcomeEnabled} />
              </div>

              <div className="h-px bg-border" />

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">Instant Payment Receipts</p>
                  <p className="text-xs text-muted-foreground">
                    Send a direct digital receipt link to the member's WhatsApp/SMS whenever a payment is collected.
                  </p>
                </div>
                <Switch checked={receiptEnabled} onCheckedChange={setReceiptEnabled} />
              </div>

              <div className="h-px bg-border" />

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">Membership Expiry Reminders</p>
                  <p className="text-xs text-muted-foreground">
                    Alert members before their active membership plan expires to encourage timely renewal.
                  </p>
                </div>
                <Switch checked={expiryEnabled} onCheckedChange={setExpiryEnabled} />
              </div>

              {expiryEnabled && (
                <div className="p-4 rounded-xl bg-secondary/30 border border-border flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-foreground">Notice Period</p>
                    <p className="text-xs text-muted-foreground">Number of days before plan end date to trigger alerts</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={reminderDays}
                      onChange={(e) => setReminderDays(Math.max(1, parseInt(e.target.value || '1', 10)))}
                      className="w-16 px-2.5 py-1.5 text-xs text-center font-mono font-bold bg-card border border-border rounded-md"
                    />
                    <span className="text-xs text-muted-foreground font-mono">days</span>
                  </div>
                </div>
              )}
            </CardContent>

            <CardFooter className="border-t border-border p-4 bg-muted/20 flex justify-end">
              <Button
                onClick={() => saveNotifMutation.mutate()}
                disabled={saveNotifMutation.isPending}
                className="text-xs font-bold gap-1.5"
              >
                <Save className="size-3.5" />
                {saveNotifMutation.isPending ? 'Saving…' : 'Save Notification Triggers'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* ========================================================================= */}
        {/* TAB 3: INVOICING & PAYMENT RULES */}
        {/* ========================================================================= */}
        <TabsContent value="billing" className="space-y-6 animate-in fade-in duration-200">
          <Card className="border-border shadow-xs bg-card">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Receipt className="size-4 text-primary" /> Tax Invoicing & Receipt Preferences
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Configure default accounting rules, tax compliance, and accepted collection channels.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-4 rounded-xl border border-border bg-secondary/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Services SAC Code</span>
                    <Badge variant="outline" className="font-mono text-[10px]">Statutory</Badge>
                  </div>
                  <p className="text-sm font-mono font-bold text-primary">999723</p>
                  <p className="text-[11px] text-muted-foreground">
                    Physical fitness centres, gymnasium services, and health club membership fees.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border bg-secondary/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Receipt Numbering Sequence</span>
                    <Badge variant="outline" className="font-mono text-[10px]">Auto-increment</Badge>
                  </div>
                  <p className="text-sm font-mono font-bold text-foreground">REC-{new Date().getFullYear()}-XXXX</p>
                  <p className="text-[11px] text-muted-foreground">
                    Generated sequentially per gym tenant with unique audit log verification.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground font-mono">
                  Active Payment Modes
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'UPI / QR Code', desc: 'GPay, PhonePe, Paytm', active: true },
                    { label: 'Cash Desk', desc: 'Direct cash collection', active: true },
                    { label: 'Debit / Credit Card', desc: 'POS Terminal Swipes', active: true },
                    { label: 'Bank Transfer', desc: 'NEFT / RTGS / IMPS', active: true },
                  ].map((mode) => (
                    <div
                      key={mode.label}
                      className="p-3 rounded-lg border border-border bg-secondary/30 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground">{mode.label}</span>
                          <CheckCircle2 className="size-3.5 text-emerald-500" />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{mode.desc}</p>
                      </div>
                      <Badge variant="outline" className="w-fit text-[9px] mt-2 text-ok border-ok/30">
                        Enabled
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-ok/10 border border-ok/30 flex items-start gap-3">
                <ShieldCheck className="size-5 text-ok shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5 text-foreground">
                  <span className="font-bold">GST Compliance Ready</span>
                  <p className="text-muted-foreground">
                    Tax invoices automatically compute CGST and SGST splits based on each membership plan's configured tax percentage.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
};
