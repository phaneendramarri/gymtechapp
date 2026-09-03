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
  const canManage = user?.isOwner;
  const canAddMember =
    user?.isOwner || user?.permissions?.includes('members');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isMigrationOpen, setIsMigrationOpen] = useState(false);

  // Always fetch all members to get the status summary counts.
  const { data: allData } = useQuery({
    queryKey: ['members-summary'],
    queryFn: () => api.getMembers({ limit: 1000 }),
  });

  // Filtered query for the table.
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['members', search, statusFilter],
    queryFn: () =>
      api.getMembers({ search: search || undefined, status: statusFilter, limit: 200 }),
  });

  const members = data?.members || [];
  const all = allData?.members || [];

  // Count summary across all members.
  const now = Math.floor(Date.now() / 1000);
  const sevenDays = now + 7 * 24 * 3600;
  const summary = {
    total: all.length,
    active: all.filter((m: any) => m.membership_status === 'ACTIVE').length,
    expiring: all.filter((m: any) => m.membership_status === 'ACTIVE' && m.membership_end_date && m.membership_end_date <= sevenDays && m.membership_end_date >= now).length,
    frozen: all.filter((m: any) => m.membership_status === 'FROZEN').length,
    blocked: all.filter((m: any) => m.membership_status === 'BLOCKED').length,
    expired: all.filter((m: any) => m.membership_status === 'EXPIRED').length,
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
              className="border-(--line)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Import from Excel
            </Button>
          )}
          {canAddMember && (
            <Button asChild size="sm" className="bg-(--ink) text-(--ink-inverse) hover:bg-ink-2 border-(--ink)">
              <Link to="/members/new">
                <Plus className="h-3.5 w-3.5" /> Add member
              </Link>
            </Button>
          )}
        </>
      }
    >
      <ExcelMigrationDialog open={isMigrationOpen} onOpenChange={setIsMigrationOpen} />

      {/* STATUS SUMMARY — five small tiles, hairline-bordered, no card stack */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-0 border-t border-b border-(--line) mb-8">
        <SummaryCell label="Total" value={summary.total} active={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')} />
        <SummaryCell label="Active" value={summary.active} active={statusFilter === 'ACTIVE'} onClick={() => setStatusFilter('ACTIVE')} tone="ok" />
        <SummaryCell label="Ending soon" value={summary.expiring} active={statusFilter === 'EXPIRING'} onClick={() => setStatusFilter('EXPIRING')} tone="warn" hint="in 7 days" />
        <SummaryCell label="Frozen" value={summary.frozen} active={statusFilter === 'FROZEN'} onClick={() => setStatusFilter('FROZEN')} />
        <SummaryCell label="Expired" value={summary.expired} active={statusFilter === 'EXPIRED'} onClick={() => setStatusFilter('EXPIRED')} tone="danger" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
        <div className="flex items-center gap-1 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-ink-3 mr-1.5 hidden sm:block" />
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className={cn(
                'h-9 px-3 rounded-md text-xs font-medium transition-colors',
                statusFilter === t.key
                  ? 'bg-(--ink) text-(--ink-inverse)'
                  : 'text-ink-2 hover:text-ink hover:bg-(--surface-2)'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, member code…"
            className="gt-input pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded text-ink-3 hover:text-ink hover:bg-(--surface-2) flex items-center justify-center"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between pt-4 mb-3">
        <p className="text-meta">
          <span className="text-ink num font-medium">
            {isLoading ? '—' : members.length}
          </span>{' '}
          {members.length === 1 ? 'member' : 'members'}
          {isFetching && !isLoading && <span className="text-ink-3 ml-2">· syncing</span>}
        </p>
        <p className="text-meta">Sorted by most recent</p>
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
      'text-left py-4 px-5 border-r border-line-2 last:border-r-0 transition-colors',
      active ? 'bg-(--surface-2)' : 'hover:bg-(--surface-2)/50'
    )}
  >
    <p className="text-eyebrow flex items-center gap-1.5">
      {tone === 'ok' && <span className="size-1.5 rounded-full bg-(--positive)" />}
      {tone === 'warn' && <span className="size-1.5 rounded-full bg-(--warning)" />}
      {tone === 'danger' && <span className="size-1.5 rounded-full bg-(--danger)" />}
      {label}
    </p>
    <p className={cn(
      'text-stat-md text-ink num mt-1.5',
      tone === 'warn' && value > 0 && 'text-(--warning)',
      tone === 'danger' && value > 0 && 'text-(--danger)',
    )}>
      {value}
    </p>
    {hint && <p className="text-[10px] text-ink-3 mt-0.5">{hint}</p>}
  </button>
);
