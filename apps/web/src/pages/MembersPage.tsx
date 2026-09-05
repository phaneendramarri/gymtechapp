import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, FileSpreadsheet, Search, X, Filter } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { ExcelMigrationDialog } from '@/components/members/ExcelMigrationDialog';
import { MemberTable } from '@/components/members/MemberTable';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'EXPIRING', label: 'Ending soon' },
  { key: 'FROZEN', label: 'Frozen' },
  { key: 'EXPIRED', label: 'Expired' },
  { key: 'BLOCKED', label: 'Blocked' },
];

export const MembersPage: React.FC = () => {
  const { user } = useAuth();
  const canManage = user?.permissions?.includes('members');
  const canAddMember = user?.permissions?.includes('members');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isMigrationOpen, setIsMigrationOpen] = useState(false);

  // Always fetch all members to get the status summary counts.
  const { data: summaryData } = useQuery({
    queryKey: ['members-summary'],
    queryFn: () => api.getMembersSummary(),
  });

  // Filtered query for the table.
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['members', search, statusFilter],
    queryFn: () =>
      api.getMembers({ search: search || undefined, status: statusFilter, limit: 200 }),
  });

  const members = data?.members || [];
  const summary = summaryData?.counts ?? {
    total: 0, active: 0, expiring: 0, frozen: 0, blocked: 0, expired: 0,
  };

  return (
    <AppShell
      title="Members"
      description="Everyone enrolled at your gym. Search, filter, or take action on any record."
      actions={
        <>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMigrationOpen(true)}
              className="border-border gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Import Excel</span>
            </Button>
          )}
          {canAddMember && (
            <Button asChild size="sm" className="gap-1.5 font-semibold">
              <Link to="/members/new">
                <Plus className="h-3.5 w-3.5" />
                <span>Add member</span>
              </Link>
            </Button>
          )}
        </>
      }
    >
      <ExcelMigrationDialog open={isMigrationOpen} onOpenChange={setIsMigrationOpen} />

      {/* STATUS SUMMARY — five small tiles, hairline-bordered */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-0 border border-border rounded-xl bg-card overflow-hidden shadow-2xs mb-6">
        <SummaryCell label="Total" value={summary.total} active={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')} />
        <SummaryCell label="Active" value={summary.active} active={statusFilter === 'ACTIVE'} onClick={() => setStatusFilter('ACTIVE')} tone="ok" />
        <SummaryCell label="Ending soon" value={summary.expiring} active={statusFilter === 'EXPIRING'} onClick={() => setStatusFilter('EXPIRING')} tone="warn" hint="in 7 days" />
        <SummaryCell label="Frozen" value={summary.frozen} active={statusFilter === 'FROZEN'} onClick={() => setStatusFilter('FROZEN')} />
        <SummaryCell label="Expired" value={summary.expired} active={statusFilter === 'EXPIRED'} onClick={() => setStatusFilter('EXPIRED')} tone="danger" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-auto">
          <TabsList className="h-9 p-1 bg-muted/60">
            {STATUS_TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="text-xs px-3 h-7">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, code…"
            className="pl-9 pr-9 h-9 text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between pt-2 mb-3">
        <p className="text-xs text-muted-foreground font-mono">
          <span className="text-foreground font-semibold">
            {isLoading ? '—' : members.length}
          </span>{' '}
          {members.length === 1 ? 'member' : 'members'}
          {isFetching && !isLoading && <span className="text-muted-foreground ml-2">· syncing</span>}
        </p>
        <p className="text-xs text-muted-foreground">Sorted by most recent</p>
      </div>

      {/* Table */}
      <MemberTable members={members} isLoading={isLoading} />
    </AppShell>
  );
};

const SummaryCell: React.FC<{
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
  tone?: 'ok' | 'warn' | 'danger';
  hint?: string;
}> = ({ label, value, active, onClick, tone, hint }) => (
  <button
    onClick={onClick}
    className={cn(
      'text-left py-3.5 px-4 border-r border-border last:border-r-0 transition-colors select-none',
      active ? 'bg-accent/80' : 'hover:bg-accent/40'
    )}
  >
    <p className="text-[11px] uppercase tracking-wider font-mono text-muted-foreground flex items-center gap-1.5">
      {tone === 'ok' && <span className="size-1.5 rounded-full bg-emerald-500" />}
      {tone === 'warn' && <span className="size-1.5 rounded-full bg-amber-500" />}
      {tone === 'danger' && <span className="size-1.5 rounded-full bg-red-500" />}
      <span>{label}</span>
    </p>
    <p className={cn(
      'text-xl font-bold font-mono tracking-tight text-foreground mt-1',
      tone === 'warn' && value > 0 && 'text-amber-600 dark:text-amber-400',
      tone === 'danger' && value > 0 && 'text-red-600 dark:text-red-400',
      active && 'text-primary'
    )}>
      {value}
    </p>
    {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
  </button>
);
