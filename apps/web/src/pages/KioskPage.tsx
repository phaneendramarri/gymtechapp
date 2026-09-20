import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Delete,
  QrCode,
  Sparkles,
  Clock,
  ShieldCheck,
  Flame,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/Logo';

export const KioskPage: React.FC = () => {
  const navigate = useNavigate();
  const { gym } = useAuth();

  const [inputCode, setInputCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [checkInResult, setCheckInResult] = useState<{
    status: 'SUCCESS' | 'WARNING' | 'ERROR';
    member?: any;
    message?: string;
  } | null>(null);

  // Keep clock updated
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-reset check-in card back to keypad after 4 seconds
  useEffect(() => {
    if (checkInResult) {
      const timeout = setTimeout(() => {
        setCheckInResult(null);
        setInputCode('');
      }, 4000);
      return () => clearTimeout(timeout);
    }
  }, [checkInResult]);

  const handleKeyPress = (char: string) => {
    if (inputCode.length < 10) {
      setInputCode((prev) => prev + char);
    }
  };

  const handleDelete = () => {
    setInputCode((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setInputCode('');
  };

  const submitCheckIn = async (codeToUse?: string) => {
    const code = (codeToUse || inputCode).trim();
    if (!code) return;

    setLoading(true);
    try {
      // Look up member
      const res = await api.checkIn({
        memberIdOrCode: code,
        method: 'KIOSK',
      });

      if (res && res.member) {
        const memStatus = res.member.membershipStatus || res.member.status || 'ACTIVE';
        const isOk = memStatus === 'ACTIVE';
        setCheckInResult({
          status: isOk ? 'SUCCESS' : 'WARNING',
          member: res.member,
          message: isOk
            ? 'Check-in confirmed! Enjoy your workout.'
            : `Membership is ${memStatus}. Please speak to front desk.`,
        });
      } else {
        setCheckInResult({
          status: 'ERROR',
          message: res?.message || 'Check-in failed. Please try again or ask front desk.',
        });
      }
    } catch (err: any) {
      setCheckInResult({
        status: 'ERROR',
        message: err.message || 'Invalid member code or barcode.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-(--bg) text-(--ink) flex flex-col justify-between p-6 sm:p-10 select-none">
      {/* Kiosk Top Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-(--border) pb-6">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Logo className="h-8 shrink-0" />
          <div className="border-l border-(--border) pl-2 sm:pl-3 min-w-0 flex-1">
            <h2 className="font-bold text-sm sm:text-lg leading-tight truncate">{gym?.name || 'GymTech'}</h2>
            <span className="text-xs text-(--ink-3) flex items-center gap-1 font-medium truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> <span className="truncate">Self Check-In Kiosk</span>
            </span>
          </div>
        </div>

        {/* Live Clock */}
        <div className="text-right shrink-0">
          <div className="text-lg sm:text-3xl font-bold tracking-tight text-(--ink) tabular-nums whitespace-nowrap">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="hidden min-[480px]:block text-xs text-(--ink-3) font-medium">
            {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Center Check-in Interface */}
      <div className="flex-1 flex items-center justify-center my-6">
        <AnimatePresence mode="wait">
          {checkInResult ? (
            /* Result Greeting Card */
            <motion.div
              key="result"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-(--surface) border border-(--border) rounded-2xl p-8 max-w-md w-full text-center shadow-2xl space-y-6"
            >
              <div className="relative mx-auto w-24 h-24">
                {checkInResult.status === 'SUCCESS' ? (
                  <div className="w-24 h-24 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center animate-bounce">
                    <CheckCircle2 className="w-14 h-14" />
                  </div>
                ) : checkInResult.status === 'WARNING' ? (
                  <div className="w-24 h-24 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <AlertTriangle className="w-14 h-14" />
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
                    <AlertTriangle className="w-14 h-14" />
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-2xl font-bold text-(--ink)">
                  {checkInResult.member?.firstName || checkInResult.member?.name
                    ? `Welcome, ${checkInResult.member.firstName || checkInResult.member.name}!`
                    : checkInResult.status === 'SUCCESS'
                    ? 'Welcome to the Gym!'
                    : 'Notice'}
                </h3>
                <p className="text-sm text-(--ink-2) mt-2 font-medium">
                  {checkInResult.message}
                </p>
              </div>

              {checkInResult.member && (
                <div className="p-4 bg-(--bg) rounded-xl space-y-1 text-xs text-left">
                  <div className="flex justify-between">
                    <span className="text-(--ink-3)">Member Code:</span>
                    <span className="font-semibold text-(--ink)">{checkInResult.member.memberCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-(--ink-3)">Plan:</span>
                    <span className="font-semibold text-(--ink)">{checkInResult.member.planName || 'Active'}</span>
                  </div>
                </div>
              )}

              <div className="text-[11px] text-(--ink-3) flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Screen will reset automatically...</span>
              </div>
            </motion.div>
          ) : (
            /* Keypad & Input */
            <motion.div
              key="keypad"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-(--surface) border border-(--border) rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl space-y-6"
            >
              <div className="text-center space-y-1">
                <h3 className="text-xl font-bold text-(--ink)">Enter Member ID or Code</h3>
                <p className="text-xs text-(--ink-3)">
                  Key in your gym membership number to check in
                </p>
              </div>

              {/* Code Display Screen */}
              <div className="h-14 bg-(--bg) border border-(--border) rounded-xl flex items-center justify-center text-2xl font-mono tracking-widest text-(--ink) font-bold">
                {inputCode || <span className="text-(--ink-4) text-base tracking-normal">e.g. 1001</span>}
              </div>

              {/* Large Touch Keypad (3x4) */}
              <div className="grid grid-cols-3 gap-3">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    onClick={() => handleKeyPress(digit)}
                    className="h-14 text-xl font-semibold rounded-xl bg-(--bg) hover:bg-(--surface-hover) border border-(--border) text-(--ink) active:scale-95 transition-all shadow-xs"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  onClick={handleClear}
                  className="h-14 text-xs font-semibold rounded-xl bg-(--bg) hover:bg-(--surface-hover) border border-(--border) text-(--ink-3) active:scale-95 transition-all"
                >
                  CLEAR
                </button>
                <button
                  onClick={() => handleKeyPress('0')}
                  className="h-14 text-xl font-semibold rounded-xl bg-(--bg) hover:bg-(--surface-hover) border border-(--border) text-(--ink) active:scale-95 transition-all shadow-xs"
                >
                  0
                </button>
                <button
                  onClick={handleDelete}
                  className="h-14 flex items-center justify-center rounded-xl bg-(--bg) hover:bg-(--surface-hover) border border-(--border) text-(--ink-3) active:scale-95 transition-all"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>

              {/* Check-in Submit Button */}
              <Button
                onClick={() => submitCheckIn()}
                disabled={!inputCode.trim() || loading}
                className="w-full h-12 text-base font-bold bg-(--iron) text-(--white) hover:bg-(--iron-hover) rounded-xl shadow-md"
              >
                {loading ? 'Checking in...' : 'Check In Now'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer / Exit Kiosk */}
      <div className="flex items-center justify-between border-t border-(--border) pt-4 text-xs text-(--ink-3)">
        <span>GymTech Kiosk v2.0 • Touch or scan barcode</span>
        <button
          onClick={() => navigate('/attendance')}
          className="flex items-center gap-1.5 hover:text-(--ink) transition-colors p-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit Kiosk Mode</span>
        </button>
      </div>
    </div>
  );
};
