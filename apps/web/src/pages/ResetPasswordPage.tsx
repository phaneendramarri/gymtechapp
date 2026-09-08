import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { KeyRound, ArrowRight, CheckCircle2, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { api } from '@/lib/api';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Extract reset token from standard query params (?token=...)
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordLengthOk = newPassword.length >= 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Password reset token is missing from the URL. Please click the reset link directly from your email.');
      return;
    }

    if (!passwordLengthOk) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);

    try {
      await api.resetPassword({ token, newPassword });
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. The link may have expired or is invalid.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-background text-foreground relative selection:bg-primary selection:text-primary-foreground overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute -top-32 -left-32 size-96 rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 size-96 rounded-full bg-primary/8 blur-[100px] pointer-events-none" />

      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md flex flex-col gap-5 z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="size-11 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-lg shadow-primary/10">
            <KeyRound className="size-5" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Set New Password
          </h1>
          <p className="text-xs text-muted-foreground max-w-xs">
            Enter a secure new password for your GymTech account
          </p>
        </div>

        <Card className="shadow-2xl relative overflow-hidden border border-border bg-card/95 backdrop-blur-md rounded-xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-90" />

          <CardHeader className="pb-3 pt-6 px-6">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              Security Credential Update
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Your new password must be at least 6 characters long
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-6">
            {error && (
              <Alert variant="destructive" className="mb-4 rounded-lg">
                <AlertCircle className="size-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {isSuccess ? (
              <div className="py-4 flex flex-col gap-4 text-center">
                <div className="size-14 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="size-7" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="font-display text-base font-bold text-foreground">
                    Password Successfully Updated
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Your password has been changed. You can now sign in with your new credentials.
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full bg-primary text-primary-foreground font-semibold text-xs h-10 mt-3 rounded-lg shadow-md hover:brightness-110 transition-all"
                >
                  Proceed to Sign In
                  <ArrowRight className="ml-1.5 size-4" />
                </Button>
              </div>
            ) : !token ? (
              <div className="py-4 flex flex-col gap-4 text-center">
                <div className="size-14 rounded-full bg-destructive/10 text-destructive border border-destructive/20 flex items-center justify-center mx-auto">
                  <AlertCircle className="size-7" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="font-display text-base font-bold text-foreground">
                    Invalid or Missing Token
                  </span>
                  <p className="text-xs text-muted-foreground">
                    No valid password reset token was found in your URL. Please click the reset link directly from the email you received.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="text-xs h-10 rounded-lg mt-2"
                >
                  Return to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="newPassword" className="text-xs font-semibold">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="font-mono text-xs rounded-lg h-10 pr-10"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {newPassword.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className={`h-1 flex-1 rounded-full ${newPassword.length >= 8 ? 'bg-emerald-500' : newPassword.length >= 6 ? 'bg-amber-500' : 'bg-destructive'}`} />
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {newPassword.length >= 8 ? 'Strong' : newPassword.length >= 6 ? 'Good' : 'Too short'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs font-semibold">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-type new password"
                      className="font-mono text-xs rounded-lg h-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <span className={`text-[10px] font-mono ${passwordsMatch ? 'text-emerald-500' : 'text-destructive'}`}>
                      {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
                    </span>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !newPassword || !confirmPassword || !passwordsMatch || !passwordLengthOk}
                  className="w-full bg-primary text-primary-foreground font-semibold text-xs h-10 mt-2 rounded-lg shadow-md hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Updating Password...' : 'Save & Update Password'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors font-mono">
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};
