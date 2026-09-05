import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TurnstileWidget, type TurnstileWidgetRef } from '@/components/shared/TurnstileWidget';
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
  Shield,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Logo } from '@/components/shared/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { api } from '@/lib/api';

type LoginMode = 'STAFF' | 'MEMBER';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

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
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  // Forgot password dialog state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotDevUrl, setForgotDevUrl] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

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
        await api.memberLogin({
          gymSlug: gymSlug.trim(),
          identifier: memberIdentifier.trim(),
          codeOrPin: memberCode.trim(),
          turnstileToken: turnstileToken || undefined,
        });
        setFailedAttempts(0);
        navigate('/portal');
      } catch (err: any) {
        setFailedAttempts((prev) => prev + 1);
        turnstileRef.current?.reset();
        setTurnstileToken('');
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
        turnstileToken: turnstileToken || undefined,
      });
      setFailedAttempts(0);
      // Server has set the session + CSRF cookies. The role is in res.user.
      if (res?.user?.role === 'PLATFORM_ADMIN') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setFailedAttempts((prev) => prev + 1);
      turnstileRef.current?.reset();
      setTurnstileToken('');
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
    <div className="min-h-screen flex flex-col bg-bg text-ink selection:bg-iron-soft selection:text-ink">
      {/* Top bar */}
      <header className="px-6 lg:px-10 py-5 flex items-center justify-between">
        <a href="/" className="inline-flex items-center">
          <Logo size="md" />
        </a>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href="/"
            className="text-xs text-ink-3 hover:text-ink transition-colors px-3 py-2"
          >
            ← Back to site
          </a>
        </div>
      </header>

      {/* Body — split layout on desktop */}
      <main className="flex-1 grid lg:grid-cols-2 min-h-0">
        {/* LEFT — quiet marketing panel */}
        <aside className="hidden lg:flex flex-col justify-between p-12 xl:p-16 border-r border-(--line) bg-(--surface)">
          <div className="max-w-md">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Built for Indian gyms</p>
            <h1 className="text-display-serif text-(--ink) mt-4">
              Run your gym <span className="text-italic-accent">without</span> the spreadsheets.
            </h1>
            <p className="text-body text-ink-2 mt-5 leading-relaxed">
              Member records, payments, attendance, PT commissions, GST invoices — in one place your staff will actually use.
            </p>
          </div>

          <ul className="flex flex-col gap-5 max-w-md">
            {[
              { icon: <Dumbbell className="h-4 w-4" />, text: 'Members check themselves in by face ID, QR, or PIN — no paper.' },
              { icon: <Sparkles className="h-4 w-4" />, text: 'WhatsApp renewals and receipts with one tap.' },
              { icon: <Shield className="h-4 w-4" />, text: 'Every payment, every freeze, every change — fully audited.' },
            ].map((p, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="size-7 rounded-md bg-iron-soft text-iron flex items-center justify-center shrink-0 mt-0.5">
                  {p.icon}
                </span>
                <span className="text-sm text-ink-2 leading-relaxed">{p.text}</span>
              </li>
            ))}
          </ul>

          <p className="text-[11px] text-ink-3 mt-12 max-w-md">
            Trusted by independent gyms across India. © {new Date().getFullYear()} GymTech.
          </p>
        </aside>

        {/* RIGHT — the form */}
        <section className="flex flex-col justify-center px-6 sm:px-10 lg:px-16 py-12">
          <div className="max-w-sm w-full mx-auto">
            {/* Mode switcher Tabs */}
            <Tabs
              value={mode}
              onValueChange={(val) => {
                const newMode = val as LoginMode;
                setMode(newMode);
                setError(null);
                setFailedAttempts(0);
                setTurnstileToken('');
                setGymSlug('');
                setMemberIdentifier('');
                setMemberCode('');
                turnstileRef.current?.reset();
              }}
              className="mb-8"
            >
              <TabsList className="h-9 p-1">
                <TabsTrigger value="STAFF" className="text-xs px-3 gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Gym staff
                </TabsTrigger>
                <TabsTrigger value="MEMBER" className="text-xs px-3 gap-1.5">
                  <User className="h-3.5 w-3.5" /> Member pass
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {mode === 'STAFF' ? 'Owner / manager / staff' : 'Self-service'}
              </p>
              <h2 className="text-h1 text-ink mt-2.5">
                {mode === 'STAFF' ? 'Sign in to your console' : 'Open your member pass'}
              </h2>
              <p className="text-meta mt-2 max-w-xs">
                {mode === 'STAFF'
                  ? 'Manage members, payments, and renewals from one place.'
                  : 'View your plan, payment history, and digital pass.'}
              </p>
            </motion.div>

            {error && (
              <div className="mt-6 flex items-start gap-2 rounded-md border border-(--danger) bg-danger-soft px-3 py-2.5">
                <AlertCircle className="h-3.5 w-3.5 text-(--danger) shrink-0 mt-0.5" />
                <p className="text-xs text-(--danger) leading-snug">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              {mode === 'STAFF' ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email" className="text-xs font-medium text-ink-2">Work email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-3" />
                      <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@yourgym.com"
                        className="pl-9 h-10 bg-(--surface) border-(--line) focus-visible:ring-1 focus-visible:ring-(--iron) focus-visible:border-(--iron) font-sans"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-xs font-medium text-ink-2">Password</Label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotOpen(true);
                          setForgotMessage(null);
                          setForgotDevUrl(null);
                          setForgotError(null);
                          setForgotEmail(email);
                        }}
                        className="text-[11px] text-(--iron) hover:underline font-medium"
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
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-9 pr-10 h-10 bg-(--surface) border-(--line) focus-visible:ring-1 focus-visible:ring-(--iron) focus-visible:border-(--iron)"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2 transition-colors p-1"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="gymSlug" className="text-xs font-medium text-ink-2">Gym name</Label>
                    <Input
                      id="gymSlug"
                      required
                      value={gymSlug}
                      onChange={(e) => setGymSlug(e.target.value)}
                      placeholder="fitpro-gym"
                      className="h-10 bg-(--surface) border-(--line) focus-visible:ring-1 focus-visible:ring-(--iron) focus-visible:border-(--iron)"
                    />
                    <p className="text-[11px] text-ink-3 mt-0.5">
                      Ask your gym for their web address (e.g. fitpro-gym).
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="memberIdentifier" className="text-xs font-medium text-ink-2">Registered phone or email</Label>
                    <Input
                      id="memberIdentifier"
                      required
                      value={memberIdentifier}
                      onChange={(e) => setMemberIdentifier(e.target.value)}
                      placeholder="9876543210 or rahul@gmail.com"
                      className="h-10 bg-(--surface) border-(--line) focus-visible:ring-1 focus-visible:ring-(--iron) focus-visible:border-(--iron)"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="memberCode" className="text-xs font-medium text-ink-2">Member code</Label>
                    <Input
                      id="memberCode"
                      required
                      value={memberCode}
                      onChange={(e) => setMemberCode(e.target.value)}
                      placeholder="MEM-1001"
                      className="h-10 bg-(--surface) border-(--line) focus-visible:ring-1 focus-visible:ring-(--iron) focus-visible:border-(--iron) font-mono uppercase"
                    />
                    <p className="text-[11px] text-ink-3 mt-0.5">
                      On your WhatsApp receipt or digital pass.
                    </p>
                  </div>
                </>
              )}

              {/* Progressive verification: Runs invisibly in the background for normal users; reveals challenge only if repeated failed attempts occur */}
              {failedAttempts >= 2 ? (
                <div className="flex flex-col gap-2 p-3 rounded-lg bg-(--surface-2) border border-(--line) my-1">
                  <p className="text-xs text-ink-2 font-medium flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-ink" /> Please complete the security check:
                  </p>
                  <TurnstileWidget
                    key={`visible-${mode}-${failedAttempts}`}
                    ref={turnstileRef}
                    action={mode === 'STAFF' ? 'login' : 'member_login'}
                    onVerify={(token) => setTurnstileToken(token)}
                    onExpire={() => setTurnstileToken('')}
                  />
                </div>
              ) : (
                <div className="hidden" aria-hidden="true">
                  <TurnstileWidget
                    key={`silent-${mode}`}
                    ref={turnstileRef}
                    action={mode === 'STAFF' ? 'login' : 'member_login'}
                    onVerify={(token) => setTurnstileToken(token)}
                    onExpire={() => setTurnstileToken('')}
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-(--ink) text-(--ink-inverse) hover:bg-ink-2 border-(--ink) font-medium h-10 mt-2 gap-2"
              >
                {isLoading ? 'Signing in…' : mode === 'STAFF' ? 'Sign in' : 'Open my pass'}
                {!isLoading && <ArrowRight className="h-3.5 w-3.5" />}
              </Button>
            </form>

            <p className="text-[11px] text-ink-3 mt-6 leading-relaxed">
              By continuing you agree to GymTech's <a href="/" className="underline underline-offset-2 hover:text-ink-2">Terms</a> and <a href="/" className="underline underline-offset-2 hover:text-ink-2">Privacy</a>.
            </p>
          </div>
        </section>
      </main>

      {/* Forgot password Dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              We'll email you a link to choose a new password.
            </DialogDescription>
          </DialogHeader>

          {forgotMessage && (
            <div className="flex items-start gap-2 rounded-md border border-(--positive) bg-(--positive-soft) px-3 py-2.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-(--positive) shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-(--positive) leading-snug">{forgotMessage}</p>
                {forgotDevUrl && (
                  <p className="text-[11px] text-ink-2 mt-2 break-all font-mono">
                    <span className="text-ink-3">Dev reset URL: </span>
                    <a href={forgotDevUrl} className="text-(--iron) underline">{forgotDevUrl}</a>
                  </p>
                )}
              </div>
            </div>
          )}
          {forgotError && (
            <div className="flex items-start gap-2 rounded-md border border-(--danger) bg-danger-soft px-3 py-2.5">
              <AlertCircle className="h-3.5 w-3.5 text-(--danger) shrink-0 mt-0.5" />
              <p className="text-xs text-(--danger) leading-snug">{forgotError}</p>
            </div>
          )}

          <form onSubmit={handleForgotSubmit} className="flex flex-col gap-3 mt-1">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="forgotEmail" className="text-xs font-medium text-ink-2">Work email</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-3" />
                <Input
                  id="forgotEmail"
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@yourgym.com"
                  className="pl-9 h-10"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={forgotLoading}
              className="w-full h-10 font-medium mt-1"
            >
              {forgotLoading ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
