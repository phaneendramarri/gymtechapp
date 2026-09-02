import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Member Portal Login
    if (mode === 'MEMBER') {
      if (!memberIdentifier.trim() || !memberCode.trim()) {
        setError('Please enter both your registered phone number/email and member code.');
        return;
      }

      setIsLoading(true);
      try {
        // Server sets the session + CSRF cookies in the response. The
        // member info is fetched on demand via the portal route.
        await api.memberLogin({
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
      const res = await api.login({ email, password });
      // Server has set the session + CSRF cookies. The role is in res.user.
      if (res.user.role === 'PLATFORM_ADMIN') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
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
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)] selection:bg-[var(--iron-soft)] selection:text-[var(--ink)]">
      {/* Top bar */}
      <header className="px-6 lg:px-10 py-5 flex items-center justify-between">
        <a href="#/" className="inline-flex items-center">
          <Logo size="md" />
        </a>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href="#/"
            className="text-xs text-ink-3 hover:text-ink transition-colors px-3 py-2"
          >
            ← Back to site
          </a>
        </div>
      </header>

      {/* Body — split layout on desktop */}
      <main className="flex-1 grid lg:grid-cols-2 min-h-0">
        {/* LEFT — quiet marketing panel */}
        <aside className="hidden lg:flex flex-col justify-between p-12 xl:p-16 border-r border-[var(--line)] bg-[var(--surface)]">
          <div className="max-w-md">
            <p className="gt-kicker">Built for Indian gyms</p>
            <h1 className="text-display-serif text-[var(--ink)] mt-4">
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
                <span className="size-7 rounded-md bg-[var(--iron-soft)] text-[var(--iron)] flex items-center justify-center shrink-0 mt-0.5">
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
            {/* Mode switcher */}
            <div className="inline-flex p-1 bg-[var(--surface-2)] rounded-lg mb-8" role="tablist">
              <button
                type="button"
                onClick={() => { setMode('STAFF'); setError(null); }}
                className={`px-3 h-8 text-xs font-medium rounded-md transition-colors ${mode === 'STAFF' ? 'bg-[var(--surface)] text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'}`}
                role="tab"
                aria-selected={mode === 'STAFF'}
              >
                <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Gym staff</span>
              </button>
              <button
                type="button"
                onClick={() => { setMode('MEMBER'); setError(null); }}
                className={`px-3 h-8 text-xs font-medium rounded-md transition-colors ${mode === 'MEMBER' ? 'bg-[var(--surface)] text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2'}`}
                role="tab"
                aria-selected={mode === 'MEMBER'}
              >
                <span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Member</span>
              </button>
            </div>

            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="gt-kicker">
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
              <div className="mt-6 flex items-start gap-2 rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2.5">
                <AlertCircle className="h-3.5 w-3.5 text-[var(--danger)] shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--danger)] leading-snug">{error}</p>
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
                        className="pl-9 h-10 bg-[var(--surface)] border-[var(--line)] focus-visible:ring-1 focus-visible:ring-[var(--iron)] focus-visible:border-[var(--iron)] font-sans"
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
                        className="text-[11px] text-[var(--iron)] hover:underline font-medium"
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
                        className="pl-9 pr-10 h-10 bg-[var(--surface)] border-[var(--line)] focus-visible:ring-1 focus-visible:ring-[var(--iron)] focus-visible:border-[var(--iron)]"
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
                    <Label htmlFor="memberIdentifier" className="text-xs font-medium text-ink-2">Registered phone or email</Label>
                    <Input
                      id="memberIdentifier"
                      required
                      value={memberIdentifier}
                      onChange={(e) => setMemberIdentifier(e.target.value)}
                      placeholder="9876543210 or rahul@gmail.com"
                      className="h-10 bg-[var(--surface)] border-[var(--line)] focus-visible:ring-1 focus-visible:ring-[var(--iron)] focus-visible:border-[var(--iron)]"
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
                      className="h-10 bg-[var(--surface)] border-[var(--line)] focus-visible:ring-1 focus-visible:ring-[var(--iron)] focus-visible:border-[var(--iron)] font-mono uppercase"
                    />
                    <p className="text-[11px] text-ink-3 mt-0.5">
                      On your WhatsApp receipt or digital pass.
                    </p>
                  </div>
                </>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[var(--ink)] text-[var(--ink-inverse)] hover:bg-[var(--ink-2)] border-[var(--ink)] font-medium h-10 mt-2 gap-2"
              >
                {isLoading ? 'Signing in…' : mode === 'STAFF' ? 'Sign in' : 'Open my pass'}
                {!isLoading && <ArrowRight className="h-3.5 w-3.5" />}
              </Button>
            </form>

            <p className="text-[11px] text-ink-3 mt-6 leading-relaxed">
              By continuing you agree to GymTech's <a href="#/" className="underline underline-offset-2 hover:text-ink-2">Terms</a> and <a href="#/" className="underline underline-offset-2 hover:text-ink-2">Privacy</a>.
            </p>
          </div>
        </section>
      </main>

      {/* Forgot password dialog — kept simple, no glassmorphism */}
      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40"
          onClick={() => setForgotOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-[var(--surface)] border border-[var(--line)] rounded-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <h3 className="text-h3 text-ink">Reset your password</h3>
              <button
                onClick={() => setForgotOpen(false)}
                aria-label="Close"
                className="text-ink-3 hover:text-ink h-7 w-7 rounded-md hover:bg-[var(--surface-2)] flex items-center justify-center -mt-1 -mr-1"
              >
                ×
              </button>
            </div>
            <p className="text-meta mb-4">
              We'll email you a link to choose a new password.
            </p>

            {forgotMessage && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-[var(--positive)] bg-[var(--positive-soft)] px-3 py-2.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--positive)] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-[var(--positive)] leading-snug">{forgotMessage}</p>
                  {forgotDevUrl && (
                    <p className="text-[11px] text-ink-2 mt-2 break-all font-mono">
                      <span className="text-ink-3">Dev reset URL: </span>
                      <a href={forgotDevUrl} className="text-[var(--iron)] underline">{forgotDevUrl}</a>
                    </p>
                  )}
                </div>
              </div>
            )}
            {forgotError && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2.5">
                <AlertCircle className="h-3.5 w-3.5 text-[var(--danger)] shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--danger)] leading-snug">{forgotError}</p>
              </div>
            )}

            <form onSubmit={handleForgotSubmit} className="flex flex-col gap-3">
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
                    className="pl-9 h-10 bg-[var(--surface)] border-[var(--line)] focus-visible:ring-1 focus-visible:ring-[var(--iron)] focus-visible:border-[var(--iron)]"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={forgotLoading}
                className="w-full bg-[var(--ink)] text-[var(--ink-inverse)] hover:bg-[var(--ink-2)] border-[var(--ink)] h-10 font-medium"
              >
                {forgotLoading ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
