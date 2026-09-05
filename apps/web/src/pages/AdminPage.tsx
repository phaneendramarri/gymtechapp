import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
import {
  Building2,
  Users,
  Shield,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  Plus,
  Radio,
  Coins,
  Smartphone,
  MessageCircle,
  Save,
  Eye,
  EyeOff,
  Sliders,
  UserCog,
  History,
} from 'lucide-react';
import { AdminShell } from '@/components/layout/AdminShell';
import { StatCard } from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SmtpConfigBlock } from '@/components/settings/SmtpConfigBlock';
import { FeaturePermissionsDialog } from '@/components/admin/FeaturePermissionsDialog';
import { LicenseLimitsDialog } from '@/components/admin/LicenseLimitsDialog';
import { GymUsersDialog } from '@/components/admin/GymUsersDialog';
import { TopUpCreditsDialog } from '@/components/admin/TopUpCreditsDialog';
import { PlatformAuditTab } from '@/components/admin/PlatformAuditTab';
import { GymCrudTab } from '@/components/admin/GymCrudTab';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { PlatformCommunicationsConfig, SmtpSettings } from '@gymtech/shared';

const DEFAULT_SMTP: SmtpSettings = {
  enabled: false,
  provider: 'CUSTOM',
  host: '',
  port: 587,
  secure: false,
  username: '',
  password: '',
  fromName: 'GymTech Platform',
  fromEmail: 'notifications@gymtech.app',
};

const DEFAULT_GATEWAYS: PlatformCommunicationsConfig = {
  smtp: DEFAULT_SMTP,
  smsGateway: {
    enabled: false,
    provider: 'FAST2SMS',
    apiKey: '',
    senderId: 'GYMTC',
  },
  whatsappGateway: {
    enabled: false,
    provider: 'META_CLOUD_API',
    accessToken: '',
    phoneNumberId: '',
    businessAccountId: '',
  },
};

export const AdminPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<string>('tenants');

  const { data: metricsData } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => api.getAdminMetrics(),
  });

  const { data: gymsData, isLoading: gymsLoading } = useQuery({
    queryKey: ['admin-gyms'],
    queryFn: () => api.getAdminGyms(),
  });

  const { data: commsData, isLoading: commsLoading } = useQuery({
    queryKey: ['admin-communications'],
    queryFn: () => api.getAdminCommunications(),
  });

  const gyms = gymsData?.gyms || [];
  const metrics = metricsData || { totalGyms: 0, activeGyms: 0, totalMembers: 0, platformRevenue: 0 };

  // Communications Config State
  const [commsConfig, setCommsConfig] = useState<PlatformCommunicationsConfig>(DEFAULT_GATEWAYS);
  const [showSmsKey, setShowSmsKey] = useState(false);
  const [showWaToken, setShowWaToken] = useState(false);

  useEffect(() => {
    if (commsData?.config) {
      setCommsConfig({
        smtp: commsData.config.smtp || DEFAULT_SMTP,
        smsGateway: commsData.config.smsGateway || DEFAULT_GATEWAYS.smsGateway,
        whatsappGateway: commsData.config.whatsappGateway || DEFAULT_GATEWAYS.whatsappGateway,
      });
    }
  }, [commsData]);

  const saveCommsMutation = useMutation({
    mutationFn: () => api.updateAdminCommunications(commsConfig),
    onSuccess: () => {
      toast('success', 'Saved', 'Platform communication gateways updated.');
      queryClient.invalidateQueries({ queryKey: ['admin-communications'] });
    },
    onError: (err: any) => toast('error', 'Save failed', err.message),
  });

  // Credit Top-Up Modal State
  const [topUpModal, setTopUpModal] = useState<{
    open: boolean;
    gym: any | null;
    channel: 'sms' | 'whatsapp';
    credits: number;
  }>({
    open: false,
    gym: null,
    channel: 'sms',
    credits: 500,
  });

  const topUpMutation = useMutation({
    mutationFn: () =>
      api.topUpGymCredits(topUpModal.gym.id, {
        channel: topUpModal.channel,
        credits: topUpModal.credits,
      }),
    onSuccess: () => {
      toast(
        'success',
        'Credits Added',
        `Added ${topUpModal.credits} ${topUpModal.channel.toUpperCase()} credits to ${topUpModal.gym.name}.`
      );
      queryClient.invalidateQueries({ queryKey: ['admin-gyms'] });
      setTopUpModal({ open: false, gym: null, channel: 'sms', credits: 500 });
    },
    onError: (err: any) => toast('error', 'Top-up failed', err.message),
  });

  const FEATURE_LIST = [
    { key: 'dashboard', label: 'Dashboard & Metrics', desc: 'Main operations overview and daily footfall KPIs' },
    { key: 'members', label: 'Members Management', desc: 'Member roster, registration, profile, face ID and history' },
    { key: 'attendance', label: 'Attendance / Floor Desk', desc: 'Check-in scanning, manual lookup and daily logs' },
    { key: 'payments', label: 'Billing & Payments', desc: 'Fee collections, GST receipts, invoices and dues' },
    { key: 'pt_collections', label: 'PT Collections & Trainers', desc: 'Personal training packages, sessions and trainer commission' },
    { key: 'plans', label: 'Membership Plans Catalog', desc: 'Configurable membership tiers, durations and admissions' },
    { key: 'staff', label: 'Staff & Team Management', desc: 'Staff accounts, role assignments and access permissions' },
    { key: 'reports', label: 'Financial & Business Reports', desc: 'Gross revenue analytics, trends and CSV ledger exports' },
    { key: 'settings', label: 'Communications & Settings', desc: 'SMS/WhatsApp balance usage, notification toggles and alerts' },
  ];

  // Feature Permissions Modal State
  const [featureModal, setFeatureModal] = useState<{
    open: boolean;
    gym: any | null;
    features: Record<string, boolean>;
    loading: boolean;
    saving: boolean;
  }>({
    open: false,
    gym: null,
    features: {},
    loading: false,
    saving: false,
  });

  const handleOpenFeatures = async (g: any) => {
    setFeatureModal({ open: true, gym: g, features: {}, loading: true, saving: false });
    try {
      const res = await api.getGymFeatures(g.id);
      setFeatureModal((prev) => ({ ...prev, features: res.features || {}, loading: false }));
    } catch (err: any) {
      toast('error', 'Failed to load features', err.message);
      setFeatureModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleSaveFeatures = async () => {
    if (!featureModal.gym) return;
    setFeatureModal((prev) => ({ ...prev, saving: true }));
    try {
      await api.updateGymFeatures(featureModal.gym.id, featureModal.features);
      toast('success', 'Permissions updated', `Feature access rules for ${featureModal.gym.name} saved.`);
      queryClient.invalidateQueries({ queryKey: ['admin-gyms'] });
      setFeatureModal((prev) => ({ ...prev, open: false, saving: false }));
    } catch (err: any) {
      toast('error', 'Update failed', err.message);
      setFeatureModal((prev) => ({ ...prev, saving: false }));
    }
  };

  // License Limits Modal State
  const [limitsModal, setLimitsModal] = useState<{
    open: boolean;
    gym: any | null;
    maxMembers: number;
    maxStaffTotal: number;
    maxManagers: number;
    maxOwners: number;
    expiresAtStr: string;
    saving: boolean;
  }>({
    open: false,
    gym: null,
    maxMembers: 200,
    maxStaffTotal: 10,
    maxManagers: 2,
    maxOwners: 1,
    expiresAtStr: '',
    saving: false,
  });

  const handleOpenLimits = (g: any) => {
    const exp = g.license_expires_at ? new Date(g.license_expires_at * 1000).toISOString().split('T')[0] : '';
    setLimitsModal({
      open: true,
      gym: g,
      maxMembers: g.license_max_members ?? 200,
      maxStaffTotal: g.license_max_staff_total ?? 10,
      maxManagers: g.license_max_managers ?? 2,
      maxOwners: g.license_max_owners ?? 1,
      expiresAtStr: exp,
      saving: false,
    });
  };

  const handleSaveLimits = async () => {
    if (!limitsModal.gym) return;
    setLimitsModal((prev) => ({ ...prev, saving: true }));
    try {
      const expiresAt = limitsModal.expiresAtStr ? Math.floor(new Date(limitsModal.expiresAtStr).getTime() / 1000) : undefined;
      await api.updateLicenseLimits(limitsModal.gym.id, {
        maxMembers: Number(limitsModal.maxMembers),
        maxStaffTotal: Number(limitsModal.maxStaffTotal),
        maxManagers: Number(limitsModal.maxManagers),
        maxOwners: Number(limitsModal.maxOwners),
        expiresAt,
      });
      toast('success', 'License limits updated', `Caps and quotas for ${limitsModal.gym.name} updated.`);
      queryClient.invalidateQueries({ queryKey: ['admin-gyms'] });
      setLimitsModal((prev) => ({ ...prev, open: false, saving: false }));
    } catch (err: any) {
      toast('error', 'Failed to update limits', err.message);
      setLimitsModal((prev) => ({ ...prev, saving: false }));
    }
  };

  // Gym Users Modal State
  const [usersModal, setUsersModal] = useState<{
    open: boolean;
    gym: any | null;
    users: any[];
    loading: boolean;
    editingUser?: any;
    name: string;
    email: string;
    phone: string;
    role: string;
    status: string;
    passwordPlain: string;
    showPassword?: boolean;
    saving: boolean;
  }>({
    open: false,
    gym: null,
    users: [],
    loading: false,
    name: '',
    email: '',
    phone: '',
    role: 'MANAGER',
    status: 'ACTIVE',
    passwordPlain: '',
    showPassword: false,
    saving: false,
  });

  const handleOpenUsers = async (g: any) => {
    setUsersModal({
      open: true,
      gym: g,
      users: [],
      loading: true,
      name: '',
      email: '',
      phone: '',
      role: 'MANAGER',
      status: 'ACTIVE',
      passwordPlain: '',
      showPassword: false,
      saving: false,
    });
    try {
      const res = await api.getGymUsers(g.id);
      setUsersModal((prev) => ({ ...prev, users: res.users || [], loading: false }));
    } catch (err: any) {
      toast('error', 'Failed to load users', err.message);
      setUsersModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleSaveUser = async () => {
    if (!usersModal.editingUser) return;
    setUsersModal((prev) => ({ ...prev, saving: true }));
    try {
      const patch: any = {
        name: usersModal.name,
        email: usersModal.email,
        phone: usersModal.phone,
        role: usersModal.role,
        status: usersModal.status,
      };
      if (usersModal.passwordPlain) {
        patch.password = usersModal.passwordPlain;
      }
      await api.updateAdminUser(usersModal.editingUser.id, patch);
      toast('success', 'User updated', 'User details and credentials successfully modified.');
      const res = await api.getGymUsers(usersModal.gym.id);
      setUsersModal((prev) => ({
        ...prev,
        users: res.users || [],
        editingUser: undefined,
        passwordPlain: '',
        saving: false,
      }));
    } catch (err: any) {
      toast('error', 'User update failed', err.message);
      setUsersModal((prev) => ({ ...prev, saving: false }));
    }
  };

  // Platform Audit Logs State
  const [auditSearch, setAuditSearch] = useState('');
  const { data: auditData, isLoading: auditLoading, refetch: refetchAudit, isRefetching: isRefetchingAudit } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => api.getAdminAuditLogs({ limit: 100 }),
    enabled: activeTab === 'audit',
  });
  const auditEvents = auditData?.events || [];
  const filteredAuditEvents = auditEvents.filter((e) => {
    if (!auditSearch) return true;
    const s = auditSearch.toLowerCase();
    return (
      (e.action && e.action.toLowerCase().includes(s)) ||
      (e.admin_name && e.admin_name.toLowerCase().includes(s)) ||
      (e.admin_email && e.admin_email.toLowerCase().includes(s)) ||
      (e.affected_gym_name && e.affected_gym_name.toLowerCase().includes(s))
    );
  });

  // Onboard Gym Form State
  const [gymName, setGymName] = useState('');
  const [slug, setSlug] = useState('');
  const [city, setCity] = useState('');
  const [gymPhone, setGymPhone] = useState('');
  const [licenseName, setLicenseName] = useState('Professional');
  const [licenseCode, setLicenseCode] = useState('PRO');
  const [pricePaise, setPricePaise] = useState<number>(99900);
  const [billingPeriod, setBillingPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [maxMembers, setMaxMembers] = useState<number>(500);
  const [maxOwners, setMaxOwners] = useState<number>(1);
  const [maxManagers, setMaxManagers] = useState<number>(2);
  const [maxStaffTotal, setMaxStaffTotal] = useState<number>(5);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [provisionedCredentials, setProvisionedCredentials] = useState<{ email: string; password: string } | null>(null);

  // Pending status-toggle action
  const [pendingToggle, setPendingToggle] = useState<{ id: number; currentStatus: string; name: string } | null>(null);

  const handleCreateGym = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    const effectivePassword =
      ownerPassword || `Gtq${Math.random().toString(36).slice(2, 10)}!${Math.floor(Math.random() * 90 + 10)}`;

    try {
      await api.createGym({
        gymName,
        slug,
        gymPhone,
        city,
        ownerName,
        ownerEmail,
        ownerPhone,
        ownerPassword: effectivePassword,
        licenseName,
        licenseCode,
        pricePaise,
        billingPeriod,
        maxMembers,
        maxOwners,
        maxManagers,
        maxStaffTotal,
        features: '{}',
        durationDays,
      });

      setProvisionedCredentials({ email: ownerEmail, password: effectivePassword });
      setSuccess(true);
      setGymName('');
      setSlug('');
      setCity('');
      setGymPhone('');
      setOwnerName('');
      setOwnerEmail('');
      setOwnerPhone('');
      setOwnerPassword('');

      queryClient.invalidateQueries({ queryKey: ['admin-gyms'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
    } catch (err: any) {
      setError(err.message || 'Failed to provision gym tenant.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!pendingToggle) return;
    const { id: gymId, currentStatus, name } = pendingToggle;
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.toggleGymStatus(gymId, nextStatus);
      queryClient.invalidateQueries({ queryKey: ['admin-gyms'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
      toast(
        'success',
        nextStatus === 'SUSPENDED' ? 'Gym suspended' : 'Gym reactivated',
        `${name} is now ${nextStatus === 'SUSPENDED' ? 'suspended' : 'active'}.`
      );
    } catch (err: any) {
      toast('error', 'Status update failed', err.message || 'Please try again.');
    } finally {
      setPendingToggle(null);
    }
  };

  return (
    <AdminShell title="Platform Management & Centralized Gateways">
      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-secondary/40 p-1 border border-border/60 rounded-xl">
          <TabsTrigger value="tenants" className="gap-2 text-xs font-semibold">
            <Building2 className="h-4 w-4" />
            Tenants &amp; Subscriptions
          </TabsTrigger>
          <TabsTrigger value="gateways" className="gap-2 text-xs font-semibold">
            <Radio className="h-4 w-4 text-primary" />
            Gateways &amp; Messaging (Super Admin Only)
          </TabsTrigger>
          <TabsTrigger value="gym-ops" className="gap-2 text-xs font-semibold">
            <UserCog className="h-4 w-4 text-primary" />
            Gym Operations
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2 text-xs font-semibold">
            <History className="h-4 w-4 text-primary" />
            Platform Audit Logs
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Tenants & Subscriptions */}
        <TabsContent value="tenants" className="space-y-6">
          {/* Platform KPI Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Gyms"
              value={metrics.totalGyms}
              subtitle={`${metrics.activeGyms} Active Tenants`}
              variant="accent"
              icon={<Building2 className="size-4" />}
            />
            <StatCard
              title="Active Gyms"
              value={metrics.activeGyms}
              subtitle="Subscribed & operational"
              variant="ok"
              icon={<CheckCircle2 className="size-4" />}
            />
            <StatCard
              title="Platform Members"
              value={metrics.totalMembers}
              subtitle="Across all studios"
              variant="default"
              icon={<Users className="size-4" />}
            />
            <StatCard
              title="Platform Collections"
              value={formatCurrency(metrics.platformRevenue)}
              subtitle="Gross transaction volume"
              variant="default"
              icon={<IndianRupee className="size-4" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left Column: Tenant Directory (3 cols) */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              <Card className="border-border shadow-xs overflow-hidden">
                <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="font-display text-base">Subscribed Gyms</CardTitle>
                    <CardDescription className="text-xs">
                      All gym tenants, plan quotas &amp; live message balances
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {gyms.length} Tenants
                  </Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-surface-2 hover:bg-surface-2">
                        <TableHead className="font-mono text-[10px] uppercase">Gym Name &amp; City</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase">Plan</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase">Message Balance</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase">Status</TableHead>
                        <TableHead className="font-mono text-[10px] uppercase text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gymsLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-32 text-center text-xs text-muted-foreground">
                            Loading tenant directory...
                          </TableCell>
                        </TableRow>
                      ) : gyms.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-32 text-center text-xs text-muted-foreground">
                            No gym tenants found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        gyms.map((g: any) => {
                          const remainingSms = Math.max(0, (g.license_max_sms ?? 0) - (g.license_sms_used ?? 0));
                          const remainingWa = Math.max(0, (g.license_max_whatsapp ?? 0) - (g.license_whatsapp_used ?? 0));

                          return (
                            <TableRow key={g.id} className="hover:bg-secondary/40">
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-semibold text-xs text-foreground">{g.name}</span>
                                  <span className="text-[10px] font-mono text-muted-foreground">
                                    {g.city || 'India'} • {g.phone}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="font-mono text-xs font-medium px-2 py-0.5 rounded bg-secondary text-foreground">
                                  {g.license_name || 'Standard'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1 text-[11px] font-mono">
                                  <div className="flex items-center gap-1.5">
                                    <Smartphone className="h-3 w-3 text-blue-500" />
                                    <span className={remainingSms > 0 ? "text-ink font-semibold" : "text-destructive font-semibold"}>
                                      {remainingSms} SMS
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <MessageCircle className="h-3 w-3 text-emerald-500" />
                                    <span className={remainingWa > 0 ? "text-ink font-semibold" : "text-destructive font-semibold"}>
                                      {remainingWa} WA
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold ${
                                    g.status === 'ACTIVE'
                                      ? 'bg-ok/10 text-ok'
                                      : 'bg-destructive/10 text-destructive'
                                  }`}
                                >
                                  {g.status}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenFeatures(g)}
                                    className="h-7 text-xs font-medium border-border hover:bg-secondary gap-1"
                                    title="Control Menu & Feature Access"
                                  >
                                    <Sliders className="h-3 w-3 text-primary" />
                                    Features
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenLimits(g)}
                                    className="h-7 text-xs font-medium border-border hover:bg-secondary gap-1"
                                    title="Adjust License Caps"
                                  >
                                    <Shield className="h-3 w-3 text-muted-foreground" />
                                    Limits
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenUsers(g)}
                                    className="h-7 text-xs font-medium border-border hover:bg-secondary gap-1"
                                    title="Manage Owners & Staff"
                                  >
                                    <UserCog className="h-3 w-3 text-muted-foreground" />
                                    Users
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setTopUpModal({
                                        open: true,
                                        gym: g,
                                        channel: 'sms',
                                        credits: 500,
                                      })
                                    }
                                    className="h-7 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10 gap-1"
                                    title="Add SMS or WhatsApp credits"
                                  >
                                    <Coins className="h-3 w-3" />
                                    Top Up
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setPendingToggle({ id: g.id, currentStatus: g.status, name: g.name })
                                    }
                                    className={`h-7 text-xs font-mono font-medium ${
                                      g.status === 'ACTIVE'
                                        ? 'text-destructive border-destructive/30 hover:bg-destructive/10'
                                        : 'text-ok border-ok/30 hover:bg-ok/10'
                                    }`}
                                  >
                                    {g.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Onboard Gym Form (2 cols) */}
            <div className="lg:col-span-2">
              <Card className="border-border shadow-xs">
                <CardHeader className="pb-3 border-b border-border">
                  <CardTitle className="font-display text-base flex items-center gap-2">
                    <Plus className="size-4 text-primary" />
                    Provision New Gym
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Create a new multi-tenant instance &amp; assign primary owner
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {error && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="size-4" />
                      <AlertDescription className="text-xs">{error}</AlertDescription>
                    </Alert>
                  )}

                  {success && provisionedCredentials && (
                    <Alert className="mb-4 border-ok/30 bg-ok/10 text-ok">
                      <CheckCircle2 className="size-4" />
                      <AlertDescription className="text-xs">
                        <p className="font-bold">Tenant provisioned successfully!</p>
                        <p className="font-mono text-[11px] mt-1">Email: {provisionedCredentials.email}</p>
                        <p className="font-mono text-[11px]">Temporary Password: {provisionedCredentials.password}</p>
                      </AlertDescription>
                    </Alert>
                  )}

                  <form onSubmit={handleCreateGym} className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="gName" className="text-xs font-semibold gt-label-required">Gym Name</Label>
                        <Input
                          id="gName"
                          required
                          placeholder="e.g. Iron Forge Fitness"
                          value={gymName}
                          onChange={(e) => setGymName(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="gSlug" className="text-xs font-semibold gt-label-required">Subdomain Slug</Label>
                        <Input
                          id="gSlug"
                          required
                          placeholder="ironforge"
                          value={slug}
                          onChange={(e) => setSlug(e.target.value)}
                          className="text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="gCity" className="text-xs font-semibold gt-label-required">City</Label>
                        <Input
                          id="gCity"
                          required
                          placeholder="Mumbai"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="text-xs"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="gPhone" className="text-xs font-semibold gt-label-required">Gym Phone</Label>
                        <Input
                          id="gPhone"
                          required
                          placeholder="9876543210"
                          value={gymPhone}
                          onChange={(e) => setGymPhone(e.target.value)}
                          className="text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border flex flex-col gap-2.5">
                      <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-bold">
                        Primary Owner Credentials
                      </p>

                      <div className="flex flex-col gap-1">
                        <Label htmlFor="oName" className="text-xs font-semibold gt-label-required">Owner Name</Label>
                        <Input
                          id="oName"
                          required
                          placeholder="e.g. Vikram Singh"
                          value={ownerName}
                          onChange={(e) => setOwnerName(e.target.value)}
                          className="text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="oEmail" className="text-xs font-semibold gt-label-required">Owner Email</Label>
                          <Input
                            id="oEmail"
                            type="email"
                            required
                            placeholder="owner@gym.com"
                            value={ownerEmail}
                            onChange={(e) => setOwnerEmail(e.target.value)}
                            className="text-xs font-mono"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="oPhone" className="text-xs font-semibold gt-label-required">Owner Phone</Label>
                          <Input
                            id="oPhone"
                            required
                            placeholder="9876543210"
                            value={ownerPhone}
                            onChange={(e) => setOwnerPhone(e.target.value)}
                            className="text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <Label htmlFor="oPass" className="text-xs font-semibold">
                          Initial Password <span className="text-muted-foreground font-normal">(optional — auto-generated if blank)</span>
                        </Label>
                        <Input
                          id="oPass"
                          type="password"
                          min={6}
                          value={ownerPassword}
                          onChange={(e) => setOwnerPassword(e.target.value)}
                          className="text-xs font-mono"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-primary text-primary-foreground font-bold text-xs h-10 mt-2"
                    >
                      {isSubmitting ? 'Provisioning...' : 'Provision Gym & Owner'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: Super Admin Gateways & Messaging */}
        <TabsContent value="gateways" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Central Communication Gateways</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure platform-wide SMTP email, SMS telco gateways, and WhatsApp Cloud APIs. Tenant gym owners will not configure technical gateways.
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => saveCommsMutation.mutate()}
              disabled={saveCommsMutation.isPending}
            >
              <Save className="h-4 w-4" />
              {saveCommsMutation.isPending ? 'Saving...' : 'Save All Gateways'}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Global SMTP Email Relay */}
            <div className="space-y-4 lg:col-span-2">
              <SmtpConfigBlock
                smtp={commsConfig.smtp || DEFAULT_SMTP}
                onChange={(updated) => setCommsConfig({ ...commsConfig, smtp: updated })}
                userEmail="admin@gymtech.app"
                gymName="GymTech Central Platform"
                onTest={(payload) => api.testAdminSmtp(payload)}
              />
            </div>

            {/* 2. SMS Gateway Configuration */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold">SMS Telco Gateway</CardTitle>
                    <CardDescription className="text-xs">
                      Carrier direct transactional SMS for payment receipts and verification
                    </CardDescription>
                  </div>
                </div>
                <Switch
                  checked={commsConfig.smsGateway?.enabled ?? false}
                  onCheckedChange={(enabled) =>
                    setCommsConfig({
                      ...commsConfig,
                      smsGateway: {
                        ...(commsConfig.smsGateway || { provider: 'FAST2SMS', apiKey: '', senderId: 'GYMTC' }),
                        enabled,
                      },
                    })
                  }
                />
              </CardHeader>
              <CardContent className="pt-4 space-y-3.5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">SMS Provider</Label>
                  <Select
                    value={commsConfig.smsGateway?.provider || 'FAST2SMS'}
                    onValueChange={(val: any) =>
                      setCommsConfig({
                        ...commsConfig,
                        smsGateway: {
                          ...(commsConfig.smsGateway || { apiKey: '', senderId: 'GYMTC', enabled: false }),
                          provider: val,
                        },
                      })
                    }
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FAST2SMS">Fast2SMS (Direct India DLT)</SelectItem>
                      <SelectItem value="TWILIO">Twilio SMS Global</SelectItem>
                      <SelectItem value="MSG91">MSG91 Enterprise</SelectItem>
                      <SelectItem value="CUSTOM">Custom HTTP SMS Gateway</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">API Key / Auth Token</Label>
                  <div className="relative">
                    <Input
                      type={showSmsKey ? 'text' : 'password'}
                      placeholder="Enter SMS Gateway API Key"
                      value={commsConfig.smsGateway?.apiKey || ''}
                      onChange={(e) =>
                        setCommsConfig({
                          ...commsConfig,
                          smsGateway: {
                            ...(commsConfig.smsGateway || { provider: 'FAST2SMS', senderId: 'GYMTC', enabled: false }),
                            apiKey: e.target.value,
                          },
                        })
                      }
                      className="text-xs font-mono pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmsKey(!showSmsKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSmsKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Sender ID / DLT Header</Label>
                  <Input
                    placeholder="e.g. GYMTC"
                    maxLength={6}
                    value={commsConfig.smsGateway?.senderId || ''}
                    onChange={(e) =>
                      setCommsConfig({
                        ...commsConfig,
                        smsGateway: {
                          ...(commsConfig.smsGateway || { provider: 'FAST2SMS', apiKey: '', enabled: false }),
                          senderId: e.target.value.toUpperCase(),
                        },
                      })
                    }
                    className="text-xs font-mono uppercase"
                  />
                  <p className="text-[10px] text-muted-foreground">6-character approved alpha sender ID</p>
                </div>
              </CardContent>
            </Card>

            {/* 3. WhatsApp Business Cloud API */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <MessageCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold">WhatsApp Business Gateway</CardTitle>
                    <CardDescription className="text-xs">
                      Official Meta Cloud API or Business Partner for automated member messages
                    </CardDescription>
                  </div>
                </div>
                <Switch
                  checked={commsConfig.whatsappGateway?.enabled ?? false}
                  onCheckedChange={(enabled) =>
                    setCommsConfig({
                      ...commsConfig,
                      whatsappGateway: {
                        ...(commsConfig.whatsappGateway || { provider: 'META_CLOUD_API', accessToken: '', phoneNumberId: '', businessAccountId: '' }),
                        enabled,
                      },
                    })
                  }
                />
              </CardHeader>
              <CardContent className="pt-4 space-y-3.5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Provider / API Format</Label>
                  <Select
                    value={commsConfig.whatsappGateway?.provider || 'META_CLOUD_API'}
                    onValueChange={(val: any) =>
                      setCommsConfig({
                        ...commsConfig,
                        whatsappGateway: {
                          ...(commsConfig.whatsappGateway || { accessToken: '', phoneNumberId: '', businessAccountId: '', enabled: false }),
                          provider: val,
                        },
                      })
                    }
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="META_CLOUD_API">Meta WhatsApp Cloud API (Direct)</SelectItem>
                      <SelectItem value="TWILIO">Twilio for WhatsApp</SelectItem>
                      <SelectItem value="GUPSHUP">Gupshup Enterprise</SelectItem>
                      <SelectItem value="CUSTOM">Custom Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">System User Access Token</Label>
                  <div className="relative">
                    <Input
                      type={showWaToken ? 'text' : 'password'}
                      placeholder="EAAG..."
                      value={commsConfig.whatsappGateway?.accessToken || ''}
                      onChange={(e) =>
                        setCommsConfig({
                          ...commsConfig,
                          whatsappGateway: {
                            ...(commsConfig.whatsappGateway || { provider: 'META_CLOUD_API', phoneNumberId: '', businessAccountId: '', enabled: false }),
                            accessToken: e.target.value,
                          },
                        })
                      }
                      className="text-xs font-mono pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWaToken(!showWaToken)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showWaToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Phone Number ID</Label>
                    <Input
                      placeholder="1029384756..."
                      value={commsConfig.whatsappGateway?.phoneNumberId || ''}
                      onChange={(e) =>
                        setCommsConfig({
                          ...commsConfig,
                          whatsappGateway: {
                            ...(commsConfig.whatsappGateway || { provider: 'META_CLOUD_API', accessToken: '', businessAccountId: '', enabled: false }),
                            phoneNumberId: e.target.value,
                          },
                        })
                      }
                      className="text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">WABA Account ID</Label>
                    <Input
                      placeholder="987654321..."
                      value={commsConfig.whatsappGateway?.businessAccountId || ''}
                      onChange={(e) =>
                        setCommsConfig({
                          ...commsConfig,
                          whatsappGateway: {
                            ...(commsConfig.whatsappGateway || { provider: 'META_CLOUD_API', accessToken: '', phoneNumberId: '', enabled: false }),
                            businessAccountId: e.target.value,
                          },
                        })
                      }
                      className="text-xs font-mono"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: Platform Audit Logs */}
        <TabsContent value="audit" className="space-y-6">
          <PlatformAuditTab
            auditSearch={auditSearch}
            onSearchChange={setAuditSearch}
            onRefresh={() => refetchAudit()}
            isRefetching={isRefetchingAudit}
            loading={auditLoading}
            events={filteredAuditEvents}
          />
        </TabsContent>

        {/* TAB 4: Gym Operations — Cross-gym CRUD */}
        <TabsContent value="gym-ops" className="space-y-4">
          <GymOpsSelector gyms={gyms} gymsLoading={gymsLoading} />
        </TabsContent>
      </Tabs>

      {/* Feature Permissions Dialog */}
      <FeaturePermissionsDialog
        open={featureModal.open}
        onOpenChange={(open) => !open && setFeatureModal({ ...featureModal, open: false })}
        gymName={featureModal.gym?.name}
        loading={featureModal.loading}
        saving={featureModal.saving}
        features={featureModal.features}
        featureList={FEATURE_LIST}
        onToggleFeature={(key, checked) =>
          setFeatureModal((prev) => ({
            ...prev,
            features: { ...prev.features, [key]: checked },
          }))
        }
        onSave={handleSaveFeatures}
      />

      {/* License Limits Dialog */}
      <LicenseLimitsDialog
        open={limitsModal.open}
        onOpenChange={(open) => !open && setLimitsModal({ ...limitsModal, open: false })}
        gymName={limitsModal.gym?.name}
        maxMembers={limitsModal.maxMembers}
        maxStaffTotal={limitsModal.maxStaffTotal}
        maxManagers={limitsModal.maxManagers}
        maxOwners={limitsModal.maxOwners}
        expiresAtStr={limitsModal.expiresAtStr}
        saving={limitsModal.saving}
        onChangeMaxMembers={(val) => setLimitsModal((prev) => ({ ...prev, maxMembers: val }))}
        onChangeMaxStaffTotal={(val) => setLimitsModal((prev) => ({ ...prev, maxStaffTotal: val }))}
        onChangeMaxManagers={(val) => setLimitsModal((prev) => ({ ...prev, maxManagers: val }))}
        onChangeMaxOwners={(val) => setLimitsModal((prev) => ({ ...prev, maxOwners: val }))}
        onChangeExpiresAtStr={(val) => setLimitsModal((prev) => ({ ...prev, expiresAtStr: val }))}
        onSave={handleSaveLimits}
      />

      {/* Gym Users Dialog */}
      <GymUsersDialog
        open={usersModal.open}
        onOpenChange={(open) => !open && setUsersModal({ ...usersModal, open: false })}
        gymName={usersModal.gym?.name}
        users={usersModal.users}
        loading={usersModal.loading}
        saving={usersModal.saving}
        editingUser={usersModal.editingUser}
        formData={{
          name: usersModal.name,
          email: usersModal.email,
          phone: usersModal.phone,
          role: usersModal.role,
          status: usersModal.status,
          passwordPlain: usersModal.passwordPlain,
          showPassword: usersModal.showPassword,
        }}
        onStartEdit={(u) =>
          setUsersModal({
            ...usersModal,
            editingUser: u,
            name: u.name,
            email: u.email,
            phone: u.phone || '',
            role: u.role,
            status: u.status,
            passwordPlain: '',
          })
        }
        onCancelEdit={() => setUsersModal({ ...usersModal, editingUser: undefined, passwordPlain: '' })}
        onChangeField={(field, value) => setUsersModal((prev) => ({ ...prev, [field]: value }))}
        onSave={handleSaveUser}
      />

      {/* Top-Up Credits Dialog */}
      <TopUpCreditsDialog
        open={topUpModal.open}
        onOpenChange={(open) => !open && setTopUpModal({ ...topUpModal, open: false })}
        gymName={topUpModal.gym?.name}
        channel={topUpModal.channel}
        credits={topUpModal.credits}
        isPending={topUpMutation.isPending}
        onChangeChannel={(channel) => setTopUpModal({ ...topUpModal, channel })}
        onChangeCredits={(credits) => setTopUpModal({ ...topUpModal, credits })}
        onSubmit={() => topUpMutation.mutate()}
      />

      {/* Status-toggle confirmation dialog */}
      <ConfirmDialog
        open={!!pendingToggle}
        onOpenChange={(open) => !open && setPendingToggle(null)}
        title={
          pendingToggle?.currentStatus === 'ACTIVE'
            ? `Suspend ${pendingToggle?.name}?`
            : `Reactivate ${pendingToggle?.name}?`
        }
        description={
          pendingToggle?.currentStatus === 'ACTIVE'
            ? 'Members and staff will lose access immediately. You can re-activate this gym later.'
            : 'The gym and its members will regain access to the platform.'
        }
        confirmLabel={pendingToggle?.currentStatus === 'ACTIVE' ? 'Suspend gym' : 'Reactivate gym'}
        destructive={pendingToggle?.currentStatus === 'ACTIVE'}
        onConfirm={handleToggleStatus}
      />

      {/* Gym Operations Selector */}
      <GymOpsSelector gyms={gyms} gymsLoading={gymsLoading} />
    </AdminShell>
  );
};

// ---------------------------------------------------------------------------
// Gym Operations — gym selector + CRUD tab
// ---------------------------------------------------------------------------
interface GymOpsSelectorProps {
  gyms: any[];
  gymsLoading: boolean;
}

const GymOpsSelector: React.FC<GymOpsSelectorProps> = ({ gyms, gymsLoading }) => {
  const [selectedGym, setSelectedGym] = useState<any>(null);

  if (gymsLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-xs text-muted-foreground">
        Loading gyms...
      </div>
    );
  }

  if (!gyms.length) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-xs text-muted-foreground gap-2">
        <Building2 className="h-6 w-6 opacity-40" />
        <span>No active gyms found.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Building2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Select Gym:</span>
        <Select
          value={selectedGym?.id?.toString() ?? ''}
          onValueChange={(v) => {
            const g = gyms.find((gym) => gym.id.toString() === v);
            setSelectedGym(g || null);
          }}
        >
          <SelectTrigger className="w-64 text-xs">
            <SelectValue placeholder="Choose a gym to manage..." />
          </SelectTrigger>
          <SelectContent>
            {gyms.map((gym) => (
              <SelectItem key={gym.id} value={gym.id.toString()} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{gym.name}</span>
                  <span className="text-muted-foreground font-mono">#{gym.id}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono ml-1 ${
                      gym.status === 'ACTIVE'
                        ? 'border-ok/50 text-ok'
                        : gym.status === 'SUSPENDED'
                        ? 'border-destructive/50 text-destructive'
                        : 'border-muted-foreground/50 text-muted-foreground'
                    }`}
                  >
                    {gym.status}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedGym && <GymCrudTab gymId={selectedGym.id} gymName={selectedGym.name} />}
    </div>
  );
};
