import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, ScanFace, KeySquare, Activity } from 'lucide-react';
import { CheckInPanel } from '@/components/attendance/CheckInPanel';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

function initials(first?: string | null, last?: string | null) {
  return `${(first?.[0] || '').toUpperCase()}${(last?.[0] || '').toUpperCase()}` || '·';
}

function timeAgo(unix: number) {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unix);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(unix * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export const AttendancePage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['attendance'],
    queryFn: () => api.getAttendance(),
    refetchInterval: 10_000,
  });

  const logs: any[] = data?.logs || [];

  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [lastCheckedMember, setLastCheckedMember] = useState<{
    name: string;
    code: string;
    phone?: string;
    plan?: string;
    alreadyCheckedIn?: boolean;
    dueAmountPaise?: number;
    checkInTime?: string;
  } | null>(null);
  const [blockedMember, setBlockedMember] = useState<{ id?: number; name?: string; expiryDate?: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleCheckIn = async (code: string, method: 'MANUAL' | 'QR' | 'FACE_ID' = 'MANUAL') => {
    if (!code.trim()) return;
    setErrorMessage(null);
    setBlockedMember(null);
    setIsCheckingIn(true);

    try {
      const res = await api.checkIn({
        memberIdOrCode: code.trim(),
        method,
      });

      setBlockedMember(null);
      setLastCheckedMember({
        name: res.member?.name || 'Member',
        code: res.member?.memberCode || code,
        alreadyCheckedIn: res.alreadyCheckedIn,
        checkInTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      });

      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err: any) {
      setLastCheckedMember(null);
      if (err.code === 'MEMBERSHIP_EXPIRED' || err.message?.includes('ACCESS DENIED') || err.message?.includes('expired')) {
        setBlockedMember({
          id: err.member?.id,
          name: err.member?.name,
          expiryDate: err.member?.expiryDate,
        });
      } else {
        setBlockedMember(null);
      }
      setErrorMessage(err.message || 'Check-in failed. Please verify member code or phone number.');
    } finally {
      setIsCheckingIn(false);
    }
  };

  // 3 most recent check-ins.
  const recent = logs.slice(0, 3);
  const lastHour = logs.filter((l: any) => Date.now() / 1000 - l.check_in_time < 3600).length;

  return (
    <AppShell
      title="Floor"
      description="Live check-ins. Search a member, scan with Face ID, or verify attendance at the desk."
      actions={
        <>
          <span className="gt-live-pill">
            {logs.length} on floor
          </span>
          <Link
            to="/members"
            className="text-xs text-ink-3 hover:text-ink inline-flex items-center gap-1 px-3 py-2"
          >
            Member directory <ArrowRight className="h-3 w-3" />
          </Link>
        </>
      }
    >
      {/* LIVE HERO BAND — one dense row showing what's happening right now. */}
      <motion.section
        {...fadeUp(0)}
        className="grid grid-cols-1 sm:grid-cols-3 gap-0 border-t border-b border-[var(--line)] mb-8"
      >
        <HeroCell
          icon={<Activity className="h-4 w-4" />}
          label="Checked in today"
          value={logs.length}
          live
          hint={now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        />
        <HeroCell
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="In the last hour"
          value={lastHour}
          hint={lastHour === 0 ? 'Quiet right now' : lastHour < 5 ? 'Steady traffic' : 'Peak hour'}
        />
        <HeroCell
          icon={<ScanFace className="h-4 w-4" />}
          label="Last check-in"
          value={logs[0] ? timeAgo(logs[0].check_in_time) : '—'}
          isString
          hint={logs[0] ? `${logs[0].first_name} ${logs[0].last_name || ''}`.trim() : 'Awaiting first arrival'}
        />
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT — Check-in terminal */}
        <div className="lg:col-span-5 flex flex-col gap-6 min-w-0">
          <CheckInPanel
            onCheckIn={handleCheckIn}
            isCheckingIn={isCheckingIn}
            errorMessage={errorMessage}
            blockedMember={blockedMember}
            lastCheckedMember={lastCheckedMember}
          />

          <div className="flex items-center gap-2 text-[11px] text-ink-3 font-mono">
            <span className="gt-dot gt-dot-info h-1.5 w-1.5" />
            Auto-refreshes every 10s · {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>

        {/* RIGHT — Live feed */}
        <div className="lg:col-span-7 flex flex-col min-w-0">
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="gt-kicker">Live feed</p>
              <h2 className="text-h2 text-ink mt-1.5 flex items-center gap-2">
                Today on the floor
                <span className="text-h3 text-ink-3 num">{logs.length}</span>
              </h2>
            </div>
            <p className="text-[11px] text-ink-3">Newest first</p>
          </div>

          {isLoading ? (
            <ul className="flex flex-col">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="gt-skel h-14 my-1" />
              ))}
            </ul>
          ) : logs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--line)] px-6 py-12 text-center">
              <p className="text-h3 text-ink">The floor is empty.</p>
              <p className="text-meta mt-1.5 max-w-md mx-auto">
                When members arrive, they'll appear here in real time.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col border-t border-[var(--line)]">
              {logs.map((log: any) => (
                <motion.li
                  key={log.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-3.5 py-3 border-b border-[var(--line-2)] last:border-b-0"
                >
                  {log.photo_url ? (
                    <img src={log.photo_url} alt="" className="size-9 rounded-full object-cover border border-[var(--line)]" />
                  ) : (
                    <span className="gt-avatar" data-size="md">
                      {initials(log.first_name, log.last_name)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink truncate">
                      <span className="font-medium">{log.first_name} {log.last_name || ''}</span>
                      <span className="text-ink-3 font-mono text-[11px] ml-2">{log.member_code}</span>
                    </p>
                    <p className="text-[11px] text-ink-3 mt-0.5">
                      {timeAgo(log.check_in_time)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'gt-tag',
                      log.method === 'FACE_ID' && 'data-[tone="iron"]',
                      log.method === 'QR' && 'data-[tone="ok"]',
                    )}
                    data-tone={log.method === 'FACE_ID' ? 'iron' : log.method === 'QR' ? 'ok' : 'muted'}
                  >
                    {log.method === 'FACE_ID' ? <ScanFace className="h-3 w-3" /> : log.method === 'QR' ? <KeySquare className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                    {log.method === 'FACE_ID' ? 'Face ID' : log.method === 'QR' ? 'QR' : 'Desk'}
                  </span>
                  <Link
                    to={`/members/${log.member_id}`}
                    className="text-ink-3 hover:text-ink p-1"
                    aria-label="View profile"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
};

const HeroCell: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  isString?: boolean;
  live?: boolean;
  hint?: string;
}> = ({ icon, label, value, isString, live, hint }) => (
  <div className="px-6 py-5 border-r border-[var(--line-2)] last:border-r-0">
    <p className="text-eyebrow flex items-center gap-1.5">
      {icon}
      {label}
      {live && <span className="size-1.5 rounded-full bg-[var(--positive)] gt-live ml-1" />}
    </p>
    <p className={cn('mt-2 text-ink', isString ? 'text-h2' : 'text-stat-xl num')}>
      {value}
    </p>
    {hint && <p className="text-[11px] text-ink-3 mt-1">{hint}</p>}
  </div>
);
