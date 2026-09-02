import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Dumbbell,
  LogOut,
  AlertCircle,
  QrCode,
  ShieldCheck,
  Phone,
  Receipt,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { MemberQrCode } from '@/components/ui/MemberQrCode';
import { Logo } from '@/components/shared/Logo';

export const MemberPortalPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['member-portal'],
    queryFn: () => api.getMemberPortalData(),
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const member = data?.member;
  const activeMembership = data?.activeMembership;
  const payments = data?.payments || [];
  const attendance = data?.attendance || [];
  const gym = data?.gym;

  const nowSec = Math.floor(Date.now() / 1000);
  const isExpired = activeMembership ? activeMembership.end_date < nowSec : true;
  const daysRemaining = activeMembership
    ? Math.max(0, Math.ceil((activeMembership.end_date - nowSec) / 86400))
    : 0;

  const formatDate = (timestamp?: number | null) => {
    if (!timestamp) return '—';
    return new Date(timestamp * 1000).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs font-mono text-muted-foreground">Loading member portal...</p>
        </div>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-6 text-center border-border">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive mx-auto flex items-center justify-center mb-3">
            <AlertCircle className="size-6" />
          </div>
          <h3 className="font-display text-lg font-bold text-foreground">Session Error</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-5">
            {(error as any)?.message || 'Unable to retrieve member session. Please log in again.'}
          </p>
          <Button onClick={handleLogout} className="w-full bg-primary text-primary-foreground font-bold text-xs h-9">
            Sign In Again
          </Button>
        </Card>
      </div>
    );
  }

  const initials = `${member.first_name?.[0] || 'M'}${member.last_name?.[0] || ''}`.toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-card/85 backdrop-blur-md px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-sm bg-primary flex items-center justify-center text-primary-foreground shadow-xs">
            <Dumbbell className="size-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-sm font-bold tracking-tight text-foreground">
              {gym?.name || 'Member Portal'}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">Self-Service Access</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="text-xs h-8 gap-1.5 border-border hover:bg-secondary text-foreground"
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* Status Alert Banner if Expired */}
        {isExpired && (
          <div className="p-4 rounded-sm border border-destructive/40 bg-destructive/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-destructive shadow-xs">
            <div className="flex items-center gap-3">
              <AlertCircle className="size-5 shrink-0" />
              <div>
                <p className="font-bold text-xs">Membership Inactive / Expired</p>
                <p className="text-[11px] text-destructive/90 mt-0.5">
                  Your membership ended on {formatDate(activeMembership?.end_date)}. Check-in is frozen. Please renew at the front desk.
                </p>
              </div>
            </div>
            {gym?.phone && (
              <Button asChild size="sm" variant="outline" className="text-xs border-destructive/40 text-destructive hover:bg-destructive/20 h-8 self-start sm:self-auto">
                <a href={`tel:${gym.phone}`}>Contact Desk</a>
              </Button>
            )}
          </div>
        )}

        {/* Digital Member Card & QR Check-In Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Digital Member Card (5 cols) */}
          <div className="md:col-span-6 flex flex-col gap-4">
            <div className="relative rounded-xl p-6 bg-gradient-to-br from-card to-secondary border-2 border-border shadow-lg overflow-hidden flex flex-col justify-between min-h-[220px]">
              <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                <Dumbbell className="size-32 text-foreground" />
              </div>

              {/* Card Header */}
              <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-2.5">
                  <Logo size="sm" showText={false} />
                  <span className="font-display font-bold text-xs text-foreground tracking-wider uppercase">
                    {gym?.name || 'GYM PASS'}
                  </span>
                </div>
                <StatusBadge status={isExpired ? 'EXPIRED' : member.status} />
              </div>

              {/* Card Body / Member Info */}
              <div className="flex items-center gap-4 my-4 z-10">
                <div className="size-16 rounded-lg bg-primary/10 text-primary border border-primary/30 flex items-center justify-center font-display text-xl font-bold shrink-0 overflow-hidden shadow-xs">
                  {member.photo_url ? (
                    <img src={member.photo_url} alt={member.first_name} className="size-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>

                <div className="flex flex-col min-w-0">
                  <h2 className="font-display text-lg font-bold text-foreground truncate">
                    {member.first_name} {member.last_name || ''}
                  </h2>
                  <span className="font-mono text-xs font-semibold text-primary">
                    {member.member_code}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {member.phone}
                  </span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="flex items-center justify-between border-t border-border/80 pt-3 z-10 text-[10px] font-mono text-muted-foreground">
                <div>
                  <span className="block text-[9px] uppercase">Plan</span>
                  <span className="font-semibold text-foreground">{activeMembership?.plan_name || 'No Active Plan'}</span>
                </div>
                <div className="text-right">
                  <span className="block text-[9px] uppercase">Valid Until</span>
                  <span className={`font-semibold ${isExpired ? 'text-destructive font-bold' : 'text-foreground'}`}>
                    {formatDate(activeMembership?.end_date)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stats Strip */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3 border-border bg-card shadow-xs">
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Validity Days</span>
                <p className={`font-display text-xl font-bold mt-0.5 ${isExpired ? 'text-destructive' : 'text-ok'}`}>
                  {isExpired ? '0 Days' : `${daysRemaining} Days`}
                </p>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {isExpired ? 'Membership Expired' : 'Remaining on term'}
                </span>
              </Card>

              <Card className="p-3 border-border bg-card shadow-xs">
                <span className="text-[10px] font-mono uppercase text-muted-foreground">Outstanding Dues</span>
                <p className={`font-display text-xl font-bold mt-0.5 ${activeMembership?.due_amount_paise > 0 ? 'text-destructive' : 'text-foreground'}`}>
                  {formatCurrency(activeMembership?.due_amount_paise || 0)}
                </p>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {activeMembership?.due_amount_paise > 0 ? 'Payment pending' : 'Zero balance'}
                </span>
              </Card>
            </div>
          </div>

          {/* QR Code Check-In Box (6 cols) */}
          <div className="md:col-span-6">
            <Card className="border-border bg-card p-6 flex flex-col items-center justify-center text-center h-full shadow-xs">
              <div className="flex items-center gap-2 mb-2">
                <QrCode className="size-4 text-primary" />
                <span className="font-display font-bold text-sm text-foreground">Digital Check-In QR Pass</span>
              </div>
              <p className="text-xs text-muted-foreground max-w-xs mb-4">
                Scan this dynamic pass at the reception desk scanner or tablet kiosk for instant automated check-in.
              </p>

              <MemberQrCode
                value={member.member_code}
                memberCode={member.member_code}
                size={175}
              />

              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono mt-4">
                <ShieldCheck className="size-3.5 text-ok" />
                <span>Verified against {gym?.name || 'Iron House'} Database</span>
              </div>
            </Card>
          </div>
        </div>

        {/* Tabbed History: Attendance & Payments */}
        <Tabs defaultValue="attendance" className="w-full">
          <TabsList className="bg-secondary border border-border p-1">
            <TabsTrigger value="attendance" className="text-xs font-semibold">Check-In History</TabsTrigger>
            <TabsTrigger value="payments" className="text-xs font-semibold">Payment Receipts</TabsTrigger>
            <TabsTrigger value="profile" className="text-xs font-semibold">My Details</TabsTrigger>
          </TabsList>

          {/* TAB 1: ATTENDANCE HISTORY */}
          <TabsContent value="attendance" className="mt-4">
            <Card className="border-border shadow-xs overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                    <TableHead className="font-mono text-[10px] uppercase">Date</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase">Check-in Time</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase text-right">Method</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-xs text-muted-foreground font-mono">
                        No check-ins recorded yet. Present your QR code at the desk!
                      </TableCell>
                    </TableRow>
                  ) : (
                    attendance.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs font-mono font-semibold text-foreground">
                          {a.date_key}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {new Date(a.check_in_time * 1000).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-mono bg-secondary border border-border text-foreground">
                            {a.method}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* TAB 2: PAYMENT RECEIPTS */}
          <TabsContent value="payments" className="mt-4">
            <Card className="border-border shadow-xs overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                    <TableHead className="font-mono text-[10px] uppercase">Receipt No</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase">Date</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase">Mode</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase text-right">Amount</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-xs text-muted-foreground font-mono">
                        No recorded fee payments found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono font-bold text-xs text-foreground">
                          {p.receipt_number}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {formatDate(p.payment_date)}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{p.payment_mode}</TableCell>
                        <TableCell className="text-right text-xs font-mono font-bold text-foreground">
                          {formatCurrency(p.amount_paise)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-ok/10 text-ok">
                            {p.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* TAB 3: MEMBER PROFILE DETAILS */}
          <TabsContent value="profile" className="mt-4">
            <Card className="border-border shadow-xs p-6 bg-card">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">Full Name</span>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{member.first_name} {member.last_name || ''}</p>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">Registered Phone</span>
                  <p className="text-sm font-mono text-foreground mt-0.5">{member.phone}</p>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">Email Address</span>
                  <p className="text-sm font-mono text-foreground mt-0.5">{member.email || 'Not provided'}</p>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">Joined Date</span>
                  <p className="text-sm font-mono text-foreground mt-0.5">{formatDate(member.joined_date)}</p>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">Residential Address</span>
                  <p className="text-xs text-foreground mt-0.5">{member.address || 'Not specified'}</p>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">Emergency Contact</span>
                  <p className="text-xs text-foreground mt-0.5">
                    {member.emergency_contact_name || '—'} {member.emergency_contact_phone ? `(${member.emergency_contact_phone})` : ''}
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};
