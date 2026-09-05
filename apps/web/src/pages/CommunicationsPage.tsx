import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, RefreshCw, Search, Filter, Clock, User, Phone } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';

const CHANNEL_COLORS: Record<string, string> = {
  SMS: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  WHATSAPP: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  EMAIL: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

function formatTimestamp(ts: number): string {
  try {
    return format(new Date(ts * 1000), 'dd MMM yyyy, HH:mm');
  } catch {
    return String(ts);
  }
}

export const CommunicationsPage: React.FC = () => {
  const { gym } = useAuth();
  const [channel, setChannel] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['communications', channel],
    queryFn: () =>
      api.getCommunicationLogs({
        channel: channel || undefined,
        limit: 100,
      }),
  });

  const logs = data?.logs || [];

  const filtered = logs.filter((log) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (log.recipientPhone && log.recipientPhone.includes(s)) ||
      (log.recipientName && log.recipientName.toLowerCase().includes(s)) ||
      (log.messageType && log.messageType.toLowerCase().includes(s))
    );
  });

  return (
    <AppShell
      title="Communications Log"
      description={`SMS, WhatsApp and email history for ${gym?.name || 'your gym'}.`}
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
                  <MessageSquare className="size-4 text-primary" />
                  Message History ({filtered.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Credits consumed, remaining balance and delivery status for every dispatched message.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue placeholder="All channels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SMS">SMS</SelectItem>
                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                    <SelectItem value="EMAIL">Email</SelectItem>
                  </SelectContent>
                </Select>

                <div className="relative w-full sm:w-52">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search recipient..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 text-xs h-8"
                  />
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold">Channel</TableHead>
                    <TableHead className="text-xs font-semibold">Recipient</TableHead>
                    <TableHead className="text-xs font-semibold">Message Type</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Credits Used</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Balance After</TableHead>
                    <TableHead className="text-xs font-semibold">Sent At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableSkeleton columns={6} rows={6} />
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-16 text-center text-xs text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
                          <p className="font-medium text-ink">No communication records found</p>
                          <p className="text-xs text-muted-foreground">Dispatched SMS and WhatsApp receipts will appear here.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((log) => (
                      <TableRow key={log.id} className="text-xs">
                        <TableCell>
                          <Badge className={`${CHANNEL_COLORS[log.channel] ?? 'bg-gray-100 text-gray-800'} font-mono text-[10px] px-1.5 py-0.5`}>
                            {log.channel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{log.recipientName ?? '—'}</span>
                            {log.recipientPhone && (
                              <span className="text-muted-foreground font-mono text-[10px]">{log.recipientPhone}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{log.messageType}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono tabular-nums">{log.creditsDeducted}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono tabular-nums text-muted-foreground">{log.remainingBalance}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatTimestamp(log.createdAt)}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};
