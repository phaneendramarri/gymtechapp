import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Users, Send, Snowflake, UserMinus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { DataTable, type DataTableColumn, type DataTableBulkAction, type DataTableRowAction } from '@/components/ui/data-table';
import { EmptyMembersIllustration } from '@/components/shared/illustrations';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/api';

interface MemberTableProps {
  members: any[];
  isLoading?: boolean;
}

export const MemberTable: React.FC<MemberTableProps> = ({ members, isLoading }) => {
  const navigate = useNavigate();
  const { toast } = useToast()
  const [pendingDelete, setPendingDelete] = React.useState<any | null>(null)
  const [pendingFreeze, setPendingFreeze] = React.useState<any | null>(null)


  if (members.length === 0 && !isLoading) {
    return (
      <Card className="border-border shadow-xs bg-card">
        <CardContent className="p-0">
          <EmptyState
            illustration={<EmptyMembersIllustration className="w-full h-auto" />}
            title="No members yet"
            description="Add your first member to start tracking attendance, plans, and payments."
            action={
              <Button asChild className="font-semibold">
                <Link to="/members/new">Add your first member</Link>
              </Button>
            }
            onboardingSteps={[
              { n: 1, label: 'Add member' },
              { n: 2, label: 'Assign a plan' },
              { n: 3, label: 'Track attendance' },
            ]}
          />
        </CardContent>
      </Card>
    )
  }

  const nowSec = Math.floor(Date.now() / 1000)

  const columns: DataTableColumn<any>[] = [
    {
      id: 'name',
      header: 'Member',
      sortAccessor: (m) => `${m.firstName} ${m.lastName || ''}`.toLowerCase(),
      cell: (m) => {
        const initials = `${m.firstName?.[0] || 'M'}${m.lastName?.[0] || ''}`.toUpperCase()
        return (
          <div className="flex items-center gap-3 min-w-0">
            <span className="gt-avatar" data-size="sm">
              {m.photoUrl ? (
                <img src={m.photoUrl} alt={m.firstName} className="size-full object-cover" />
              ) : (
                initials
              )}
            </span>
            <div className="flex flex-col min-w-0">
              <Link
                to={`/members/${m.id}`}
                className="text-sm font-medium text-ink hover:text-(--iron) transition-colors truncate"
              >
                {m.firstName} {m.lastName || ''}
              </Link>
              <span className="text-[10px] font-mono text-ink-3">{m.memberCode}</span>
            </div>
          </div>
        )
      },
      widthClass: 'min-w-[200px]',
    },
    {
      id: 'contact',
      header: 'Contact',
      cell: (m) => (
        <div className="flex flex-col text-xs font-mono">
          <span className="text-ink">{m.phone}</span>
          {m.email && <span className="text-meta truncate">{m.email}</span>}
        </div>
      ),
    },
    {
      id: 'plan',
      header: 'Current Plan',
      sortAccessor: (m) => m.planName || '',
      cell: (m) => {
        if (!m.membershipEndDate) {
          return <span className="text-xs text-meta">{m.planName || 'No plan'}</span>
        }
        const isExpired = m.membershipEndDate < nowSec
        const daysRemaining = Math.ceil((m.membershipEndDate - nowSec) / 86400)
        return (
          <div className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-ink">{m.planName || 'No Plan'}</span>
            <span className="text-[10px] font-mono text-ink-3">
              {m.membershipStartDate ? new Date(m.membershipStartDate * 1000).toLocaleDateString('en-IN') : '—'} → {new Date(m.membershipEndDate * 1000).toLocaleDateString('en-IN')}
            </span>
            {isExpired ? (
              <span className="gt-chip" data-tone="danger">EXPIRED</span>
            ) : daysRemaining <= 7 ? (
              <span className="gt-chip" data-tone="warn">Expiring {daysRemaining}d</span>
            ) : (
              <span className="gt-chip" data-tone="ok">Active {daysRemaining}d</span>
            )}
          </div>
        )
      },
    },
    {
      id: 'status',
      header: 'Status',
      sortAccessor: (m) => m.status,
      cell: (m) => {
        const isExpired = m.membership_end_date ? m.membership_end_date < nowSec : false
        const effectiveStatus = isExpired || m.status === 'EXPIRED' ? 'EXPIRED' : m.status
        return <StatusBadge status={effectiveStatus} size="sm" />
      },
    },
    {
      id: 'dues',
      header: 'Dues',
      sortAccessor: (m) => m.membership_due_amount_paise || 0,
      numeric: true,
      cell: (m) =>
        m.membership_due_amount_paise > 0 ? (
          <span className="text-sm font-semibold text-(--danger)">
            {formatCurrency(m.membership_due_amount_paise)}
          </span>
        ) : (
          <span className="text-meta">₹0</span>
        ),
    },
    {
      id: 'joined',
      header: 'Joined',
      sortAccessor: (m) => m.created_at || 0,
      cell: (m) =>
        m.created_at ? (
          <span className="text-[11px] font-mono text-muted-foreground">
            {new Date(m.created_at * 1000).toLocaleDateString('en-IN')}
          </span>
        ) : (
          <span className="text-muted-foreground text-[11px]">—</span>
        ),
    },
  ]

  const bulkActions: DataTableBulkAction<any>[] = [
    {
      id: 'whatsapp',
      label: 'Send renewal',
      icon: Send,
      onClick: async (rows) => {
        let sent = 0;
        let lastRemaining = 0;
        try {
          for (const m of rows) {
            const res = await api.dispatchNotification({
              recipientPhone: m.phone,
              recipientName: m.firstName,
              channel: 'WHATSAPP',
              type: 'EXPIRY_REMINDER',
              params: { memberCode: m.memberCode, expiryDate: 'upcoming renewal' },
            });
            sent++;
            lastRemaining = res.remainingCredits;
          }
          toast(
            'success',
            `Renewal sent to ${sent} member${sent === 1 ? '' : 's'}`,
            `${sent} credit${sent === 1 ? '' : 's'} deducted. (${lastRemaining} left)`
          );
        } catch (err: any) {
          toast(
            'error',
            sent > 0 ? `Sent to ${sent} members, then stopped` : 'Cannot send renewals',
            err.message || 'Check your WhatsApp message credits or contact Super Admin.'
          );
        }
      },
      disabled: (rows) => rows.length === 0,
    },
    {
      id: 'freeze',
      label: 'Freeze plan',
      icon: Snowflake,
      onClick: (rows) =>
        toast(
          'info',
          `Plans frozen for ${rows.length} member${rows.length === 1 ? '' : 's'}`,
          'Memberships are paused until you unfreeze.'
        ),
    },
  ]

  const rowActions: DataTableRowAction<any>[] = [
    { id: 'freeze', label: 'Freeze plan', icon: Snowflake, onClick: (row) => setPendingFreeze(row) },
    { id: 'archive', label: 'Archive member', icon: UserMinus, onClick: (row) => setPendingDelete(row), destructive: true },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={members}
        rowKey={(m) => m.id}
        selectable
        bulkActions={bulkActions}
        rowActions={rowActions}
        onView={(m) => { navigate(`/members/${m.id}`); }}
        onEdit={(m) => { navigate(`/members/${m.id}`); }}
        isLoading={isLoading}
        defaultSort={{ id: 'name', direction: 'asc' }}
        pageSize={25}
        emptyState={
          <EmptyState
            icon={Users}
            title="No matches"
            description="Try adjusting your search or status filter."
          />
        }
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Archive ${pendingDelete?.firstName ?? 'member'}?`}
        description="This deactivates the member and moves them to the archive. All past payments, invoices, attendance, and membership history will be permanently preserved."
        confirmLabel="Archive member"
        destructive
        onConfirm={async () => {
          if (!pendingDelete?.id) return;
          try {
            await api.archiveMember(pendingDelete.id);
            toast('success', 'Member archived', `${pendingDelete.firstName} was archived. Historical records preserved.`);
            window.location.reload();
          } catch (err: any) {
            toast('error', 'Archive failed', err.message);
          }
        }}
      />

      <ConfirmDialog
        open={!!pendingFreeze}
        onOpenChange={(o) => !o && setPendingFreeze(null)}
        title={`Freeze ${pendingFreeze?.firstName ?? 'plan'}?`}
        description="The member's plan is paused until you unfreeze it. They will not be billed during the freeze period."
        confirmLabel="Freeze plan"
        onConfirm={() => {
          toast('info', 'Plan frozen', 'You can unfreeze from the member detail page.')
        }}
      />
    </>
  )
}
