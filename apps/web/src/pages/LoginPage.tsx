import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  User,
  Lock,
  Mail,
  Building2,
  Eye,
  EyeOff,
  KeyRound,
  Dumbbell,
  Loader2,
  Shield,
  Sparkles,
  Zap,
  Flame,
  Trophy,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/shared/Logo';
import { GymBarbellAnimation } from '@/components/shared/GymBarbellAnimation';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';

type LoginMode = 'STAFF' | 'MEMBER';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, memberLogin } = useAuth();

  const [mode, setMode] = useState<LoginMode>('STAFF');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Member Portal state
  const [gymSlug, setGymSlug] = useState('');
  const [memberIdentifier, setMemberIdentifier] = useState('');
  const [memberCode, setMemberCode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password dialog state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotDevUrl, setForgotDevUrl] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  React.useEffect(() => {
    document.title = mode === 'MEMBER' ? 'Member Portal Sign In — GymTech' : 'Staff Sign In — GymTech';
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Member Portal Login
    if (mode === 'MEMBER') {
      if (!gymSlug.trim() || !memberIdentifier.trim() || !memberCode.trim()) {
        setError('Please enter your gym name, registered phone/email, and member code.');
        return;
      }

      setIsLoading(true);
      try {
        // Server sets the session + CSRF cookies in the response. The
        // member info is fetched on demand via the portal route.
        await memberLogin({
          gymSlug: gymSlug.trim(),
          identifier: memberIdentifier.trim(),
          codeOrPin: memberCode.trim(),
        });
        navigate('/portal');
      } catch (err: any) {
        setError(err.message || 'Invalid member credentials. Check your phone number and member code.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // 2. Staff / Admin Login (Auto-routes by role)
    setIsLoading(true);
    try {
      const res = await login({
        email,
        password,
      });
      // Server has set the session + CSRF cookies. The role is in res.user.
      // Return to the deep link the guard stored (or the pre-expiry page),
      // falling back to the role home. Only same-origin app paths allowed.
      const storedReturn =
        (location.state as any)?.from ??
        (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('gymtech_return_to') : null);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('gymtech_return_to');
      }
      const safeReturn =
        typeof storedReturn === 'string' &&
        storedReturn.startsWith('/') &&
        !storedReturn.startsWith('//') &&
        !storedReturn.startsWith('/login') &&
        !storedReturn.startsWith('/reset-password')
          ? storedReturn
          : null;
      if (res?.user?.role === 'PLATFORM_ADMIN') {
        navigate(safeReturn && safeReturn.startsWith('/admin') ? safeReturn : '/admin');
      } else if (res?.user?.role === 'MEMBER') {
        navigate('/portal');
      } else {
        navigate(safeReturn ?? '/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please verify your email and password.');
    } finally {
      setIsLoading(false);
    }
  };


  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setForgotLoading(true);
    setForgotError(null);
    setForgotMessage(null);
    setForgotDevUrl(null);

    try {
      const res = await api.forgotPassword(forgotEmail.trim());
      setForgotMessage(res.message);
      if (res.devResetUrl) {
        setForgotDevUrl(res.devResetUrl);
      }
    } catch (err: any) {
      setForgotError(err.message || 'Failed to send password reset email.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-bg text-ink selection:bg-iron-soft selection:text-ink">
      {/* Top bar */}
      <header className="px-6 lg:px-8 py-2.5 flex items-center justify-between border-b border-line backdrop-blur-sm shrink-0">
        <a href="/" className="inline-flex items-center">
          <Logo size="md" animated showPulse />
        </a>
        <div className="flex items-center gap-3">
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-iron-soft border border-iron/20 text-[10px] font-mono font-semibold text-iron">
            <span className="size-1.5 rounded-full bg-iron animate-pulse" />
            LIVE GYM OS
          </div>
          <ThemeToggle />
          <Link
            to="/"
            className="text-xs text-ink-3 hover:text-ink transition-colors px-2 py-1 font-medium"
          >
            ← Back to site
          </Link>
        </div>
      </header>

      {/* Body — split layout on desktop */}
      <main className="flex-1 grid lg:grid-cols-2 min-h-0 overflow-hidden">
        {/* LEFT — High-Energy Gym Operations Stage */}
        <aside className="hidden lg:flex flex-col justify-center items-center p-6 xl:p-10 border-r border-(--line) bg-(--surface) text-(--ink) relative overflow-hidden">
          <div className="w-full max-w-md xl:max-w-lg mx-auto my-auto flex flex-col justify-center gap-5 relative z-10">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-iron-soft border border-iron/30 text-[10px] font-mono font-bold text-iron">
                <Zap className="size-3 fill-iron" />
                <span>THE IRON DISCIPLINE OS</span>
              </div>
              <h1 className="text-2xl xl:text-3xl font-extrabold tracking-tight text-ink mt-2 leading-snug font-display">
                Heavy Iron. <br />
                <span className="text-iron">
                  Zero Spreadsheets.
                </span>
              </h1>
              <p className="text-xs text-ink-2 mt-1.5 leading-relaxed">
                Biometric check-ins, personal training session quotas, live workout ledgers, and automated GST receipts.
              </p>
            </div>

            {/* Center Gym Barbell Animation */}
            <div className="w-full">
              <GymBarbellAnimation interactive={true} variant="full" />
            </div>

            {/* Bottom Gym Accents */}
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-(--line) text-ink-2">
              <div className="flex flex-col">
                <span className="text-[9px] font-mono text-iron font-bold uppercase flex items-center gap-1">
                  <Zap className="size-2.5" /> Turnstile
                </span>
                <span className="text-xs font-semibold text-ink mt-0.5">0.8s Check-in</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-mono text-iron font-bold uppercase flex items-center gap-1">
                  <Dumbbell className="size-2.5" /> Workout Reps
                </span>
                <span className="text-xs font-semibold text-ink mt-0.5">Live PT Logging</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-mono text-iron font-bold uppercase flex items-center gap-1">
                  <Shield className="size-2.5" /> Iron-Clad
                </span>
                <span className="text-xs font-semibold text-ink mt-0.5">Zero Leakage</span>
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT — the form */}
        <section className="flex flex-col justify-center items-center px-6 sm:px-10 lg:px-12 py-4 lg:py-6 bg-(--bg) text-(--ink) relative overflow-y-auto">
          <div className="max-w-sm xl:max-w-md w-full mx-auto my-auto flex flex-col justify-center">

            {/* Mode switcher — perfectly centered 50/50 tabs */}
            <div className="grid grid-cols-2 p-1 bg-(--surface-2) rounded-xl mb-4 border border-(--line) w-full shadow-2xs" role="tablist">
              <button
                type="button"
                onClick={() => { setMode('STAFF'); setError(null); setGymSlug(''); setMemberIdentifier(''); setMemberCode(''); }}
                className={`h-8 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  mode === 'STAFF'
                    ? 'bg-(--surface) text-(--ink) shadow-xs border border-(--line)'
                    : 'text-(--ink-3) hover:text-(--ink)'
                }`}
                role="tab"
                aria-selected={mode === 'STAFF'}
              >
                <Dumbbell className="h-3.5 w-3.5 text-(--iron)" />
                <span>Gym Staff</span>
              </button>
              <button
                type="button"
                onClick={() => { setMode('MEMBER'); setError(null); setGymSlug(''); }}
                className={`h-8 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  mode === 'MEMBER'
                    ? 'bg-(--surface) text-(--ink) shadow-xs border border-(--line)'
                    : 'text-(--ink-3) hover:text-(--ink)'
                }`}
                role="tab"
                aria-selected={mode === 'MEMBER'}
              >
                <User className="h-3.5 w-3.5 text-(--iron)" />
                <span>Member Pass</span>
              </button>
            </div>

            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {mode === 'STAFF' ? 'Owner / Trainer / Front Desk' : 'Self-service Athlete Hub'}
              </p>
              <h2 className="text-xl font-bold text-ink mt-0.5 font-display">
                {mode === 'STAFF' ? 'Sign in to Console' : 'Open Athlete Pass'}
              </h2>
              <p className="text-xs text-meta mt-0.5 max-w-xs">
                {mode === 'STAFF'
                  ? 'Manage members, payments, workouts, and renewals.'
                  : 'View workout logs, active plan, and digital entry pass.'}
              </p>
            </motion.div>

            {error && (
              <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs text-destructive leading-snug">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2.5">
              {mode === 'STAFF' ? (
                <>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="email" className="text-[11px] font-medium text-ink-2">Work email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-3" />
                      <Input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@yourgym.com"
                        className="pl-9 h-9 text-xs bg-(--surface) border-(--line) focus-visible:ring-1 focus-visible:ring-(--iron) focus-visible:border-(--iron) font-sans"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-[11px] font-medium text-ink-2">Password</Label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotOpen(true);
                          setForgotMessage(null);
                          setForgotDevUrl(null);
                          setForgotError(null);
                          setForgotEmail(email);
                        }}
                        className="text-[10px] text-(--iron) hover:underline font-medium"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-3" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-9 pr-10 h-9 text-xs bg-(--surface) border-(--line) focus-visible:ring-1 focus-visible:ring-(--iron) focus-visible:border-(--iron)"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2 transition-colors p-1 rounded-md focus-visible:ring-1 focus-visible:ring-(--iron) focus-visible:outline-none"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="gymSlug" className="text-[11px] font-medium text-ink-2">Gym name</Label>
                    <Input
                      id="gymSlug"
                      required
                      autoComplete="off"
                      value={gymSlug}
                      onChange={(e) => setGymSlug(e.target.value)}
                      placeholder="fitpro-gym"
                      className="h-9 text-xs bg-(--surface) border-(--line) focus-visible:ring-1 focus-visible:ring-(--iron) focus-visible:border-(--iron)"
                    />
                    <p className="text-[10px] text-ink-3">
                      Ask your gym for their web address (e.g. fitpro-gym).
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="memberIdentifier" className="text-[11px] font-medium text-ink-2">Registered phone or email</Label>
                    <Input
                      id="memberIdentifier"
                      required
                      autoComplete="username"
                      value={memberIdentifier}
                      onChange={(e) => setMemberIdentifier(e.target.value)}
                      placeholder="9876543210 or rahul@gmail.com"
                      className="h-9 text-xs bg-(--surface) border-(--line) focus-visible:ring-1 focus-visible:ring-(--iron) focus-visible:border-(--iron)"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="memberCode" className="text-[11px] font-medium text-ink-2">Member code</Label>
                    <Input
                      id="memberCode"
                      required
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      value={memberCode}
                      onChange={(e) => setMemberCode(e.target.value)}
                      placeholder="MEM-1001"
                      className="h-9 text-xs bg-(--surface) border-(--line) focus-visible:ring-1 focus-visible:ring-(--iron) focus-visible:border-(--iron) font-mono uppercase"
                    />
                    <p className="text-[10px] text-ink-3">
                      On your WhatsApp receipt or digital pass.
                    </p>
                  </div>
                </>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                aria-busy={isLoading}
                className="w-full bg-(--ink) text-(--ink-inverse) hover:bg-ink-2 border-(--ink) font-medium h-9 text-xs mt-1 gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Signing in…
                  </>
                ) : (
                  <>
                    {mode === 'STAFF' ? 'Sign in' : 'Open my pass'}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </>
                )}
              </Button>
            </form>

            <p className="text-[10px] text-ink-3 mt-3 leading-relaxed text-center">
              By continuing you agree to GymTech's <Link to="/terms" className="underline underline-offset-2 hover:text-ink-2">Terms</Link> and <Link to="/privacy" className="underline underline-offset-2 hover:text-ink-2">Privacy</Link>.
            </p>

            <div className="mt-3 pt-2 border-t border-line text-center text-[11px] text-ink-3">
              Looking to register a new gym?{' '}
              <Link to="/contact" className="text-iron hover:underline font-medium">
                Start free trial &rarr;
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Forgot password dialog — Radix Dialog for focus trap, Escape-to-close,
          and screen-reader announcements. */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="text-left">
            <DialogTitle className="text-h3 text-ink">Reset your password</DialogTitle>
            <DialogDescription className="text-meta">
              We'll email you a link to choose a new password.
            </DialogDescription>
          </DialogHeader>

          {forgotMessage && (
            <div role="status" className="flex items-start gap-2 rounded-md border border-(--positive) bg-(--positive-soft) px-3 py-2.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-(--positive) shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-xs text-(--positive) leading-snug">{forgotMessage}</p>
                {forgotDevUrl && (
                  <p className="text-[11px] text-ink-2 mt-2 break-all font-mono">
                    <span className="text-ink-3">Dev reset URL: </span>
                    {(() => {
                      // The dev reset URL comes from our own API (non-prod
                      // only), but never render an unvalidated href — a
                      // javascript: URL here would execute on click.
                      const u = forgotDevUrl.startsWith('/')
                        ? forgotDevUrl
                        : (() => {
                            try {
                              const parsed = new URL(forgotDevUrl, window.location.origin);
                              return parsed.origin === window.location.origin
                                ? `${parsed.pathname}${parsed.search}${parsed.hash}`
                                : null;
                            } catch {
                              return null;
                            }
                          })();
                      return u ? (
                        <a href={u} className="text-(--iron) underline">{forgotDevUrl}</a>
                      ) : (
                        <span>{forgotDevUrl}</span>
                      );
                    })()}
                  </p>
                )}
              </div>
            </div>
          )}
          {forgotError && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-(--danger) bg-danger-soft px-3 py-2.5">
              <AlertCircle className="h-3.5 w-3.5 text-(--danger) shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-(--danger) leading-snug">{forgotError}</p>
            </div>
          )}

          <form onSubmit={handleForgotSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="forgotEmail" className="text-xs font-medium text-ink-2">Work email</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-3" aria-hidden="true" />
                <Input
                  id="forgotEmail"
                  type="email"
                  required
                  autoComplete="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@yourgym.com"
                  className="pl-9 h-10 bg-(--surface) border-(--line) focus-visible:ring-1 focus-visible:ring-(--iron) focus-visible:border-(--iron)"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={forgotLoading}
              aria-busy={forgotLoading}
              className="w-full bg-(--ink) text-(--ink-inverse) hover:bg-ink-2 border-(--ink) h-10 font-medium gap-2"
            >
              {forgotLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {forgotLoading ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
