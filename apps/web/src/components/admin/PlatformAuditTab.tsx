import React from 'react';
import { ShieldCheck, Search, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';

interface PlatformAuditTabProps {
  auditSearch: string;
  onSearchChange: (search: string) => void;
  onRefresh: () => void;
  isRefetching: boolean;
  loading: boolean;
  events: any[];
}

export const PlatformAuditTab: React.FC<PlatformAuditTabProps> = ({
  auditSearch,
  onSearchChange,
  onRefresh,
  isRefetching,
  loading,
  events,
}) => {
  return (
    <Card className="border border-border shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              SaaS Cross-Tenant Audit Trail
            </CardTitle>
            <CardDescription className="text-xs">
              Tamper-evident system ledger tracking every administrative operation across all gyms.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search action, admin, gym..."
                value={auditSearch}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefetching}
              className="h-8 gap-1 text-xs"
            >
              <RefreshCw className={`h-3 w-3 ${isRefetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border bg-secondary/20">
              <TableHead className="text-xs font-semibold">Timestamp</TableHead>
              <TableHead className="text-xs font-semibold">Admin</TableHead>
              <TableHead className="text-xs font-semibold">Action</TableHead>
              <TableHead className="text-xs font-semibold">Target Gym</TableHead>
              <TableHead className="text-xs font-semibold">Change Details</TableHead>
              <TableHead className="text-xs font-semibold text-right">IP &amp; Device</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-xs font-mono">
                  Loading platform audit logs...
                </TableCell>
              </TableRow>
            ) : events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-xs">
                  No audit events found.
                </TableCell>
              </TableRow>
            ) : (
              events.map((evt: any) => (
                <TableRow key={evt.id} className="border-b border-border/60 hover:bg-muted/30">
                  <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(evt.created_at * 1000).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-xs text-foreground">{evt.admin_name || 'Platform Admin'}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{evt.admin_email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                      {evt.action}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-xs">
                    {evt.affected_gym_name || (evt.affected_gym_id ? `Gym #${evt.affected_gym_id}` : 'Platform Global')}
                  </TableCell>
                  <TableCell className="text-xs max-w-xs truncate font-mono text-[11px] text-muted-foreground">
                    {evt.after_state || evt.metadata || '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {evt.ip || '127.0.0.1'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
