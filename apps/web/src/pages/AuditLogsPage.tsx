import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Search, RefreshCw, Shield, User, Clock, FileText } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export const AuditLogsPage: React.FC = () => {
  const { gym } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['gym-audit-logs', filterAction],
    queryFn: () => api.getGymAuditLogs({ limit: 100, action: filterAction || undefined }),
  });

  const events = data?.events || [];

  const filteredEvents = events.filter((e) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      (e.action && e.action.toLowerCase().includes(s)) ||
      (e.actor_name && e.actor_name.toLowerCase().includes(s)) ||
      (e.actor_email && e.actor_email.toLowerCase().includes(s)) ||
      (e.entity_type && e.entity_type.toLowerCase().includes(s))
    );
  });

  return (
    <AppShell
      title="Audit Trail & System Activity"
      description={`Append-only immutable record of operational actions performed at ${gym?.name || 'your gym'}.`}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="gap-1.5 text-xs font-semibold"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      }
    >
      <div className="space-y-6">
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <History className="size-4 text-primary" />
                  Activity Stream ({filteredEvents.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Read-only chronological ledger tracking all logins, member edits, payments, and staff actions.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Filter by action or actor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 text-xs h-8"
                  />
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border bg-secondary/20">
                  <TableHead className="text-xs font-semibold">Timestamp</TableHead>
                  <TableHead className="text-xs font-semibold">Actor</TableHead>
                  <TableHead className="text-xs font-semibold">Action</TableHead>
                  <TableHead className="text-xs font-semibold">Target Entity</TableHead>
                  <TableHead className="text-xs font-semibold">Change Details</TableHead>
                  <TableHead className="text-xs font-semibold text-right">IP &amp; Device</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-xs font-mono">
                      Loading audit logs...
                    </TableCell>
                  </TableRow>
                ) : filteredEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-xs">
                      No matching audit records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvents.map((evt) => {
                    let beforeObj: any = null;
                    let afterObj: any = null;
                    try {
                      if (evt.before_state) beforeObj = JSON.parse(evt.before_state);
                      if (evt.after_state) afterObj = JSON.parse(evt.after_state);
                    } catch {
                      // ignore json error
                    }

                    const dateStr = new Date(evt.created_at * 1000).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });

                    return (
                      <TableRow key={evt.id} className="border-b border-border/60 hover:bg-muted/30">
                        <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {dateStr}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-xs text-foreground">
                              {evt.actor_name || 'System / Platform'}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {evt.actor_role ? (
                                <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">
                                  {evt.actor_role}
                                </Badge>
                              ) : (
                                evt.actor_email || '—'
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            {evt.action}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {evt.entity_type} {evt.entity_id ? `#${evt.entity_id}` : ''}
                        </TableCell>
                        <TableCell className="text-xs max-w-xs truncate">
                          {afterObj ? (
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {JSON.stringify(afterObj).slice(0, 80)}
                            </span>
                          ) : evt.metadata ? (
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {evt.metadata.slice(0, 80)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {evt.ip || '127.0.0.1'}
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
    </AppShell>
  );
};
