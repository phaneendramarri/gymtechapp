import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { KeyRound, ArrowRight, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
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

  // Extract token from query params (works for both browser router and hash router search)
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Password reset token is missing from the URL. Please use the exact link sent to your email.');
      return;
    }

    if (newPassword.length < 6) {
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
      setError(err.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-background text-foreground relative selection:bg-primary selection:text-primary-foreground overflow-hidden">
      {/* Subtle Ambient Glass Glows */}
      <div className="absolute -top-32 -left-32 size-96 rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 size-96 rounded-full bg-primary/8 blur-[100px] pointer-events-none" />

      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md flex flex-col gap-5 z-10">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="size-10 rounded-sm bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25">
            <KeyRound className="size-5" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Set New Password
          </h1>
          <p className="text-xs text-muted-foreground">
            Choose a strong password to secure your GymTech account
          </p>
        </div>

        <Card className="glass-card shadow-2xl relative overflow-hidden border border-border rounded-sm">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-90" />

          <CardHeader className="pb-3 pt-5">
            <CardTitle className="text-base font-semibold">Security Credential Update</CardTitle>
            <CardDescription className="text-xs">
              Enter and confirm your new account password below
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4 rounded-sm">
                <AlertCircle className="size-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {isSuccess ? (
              <div className="py-4 flex flex-col gap-4 text-center">
                <div className="size-12 rounded-full bg-ok/10 text-ok flex items-center justify-center mx-auto">
                  <CheckCircle2 className="size-6" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-display text-base font-bold text-foreground">
                    Password Successfully Updated
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Your password has been changed. You can now sign in with your new credentials.
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full bg-primary text-primary-foreground font-bold text-xs h-10 mt-2"
                >
                  Proceed to Sign In
                  <ArrowRight className="ml-1.5 size-4" />
                </Button>
              </div>
            ) : !token ? (
              <div className="py-4 flex flex-col gap-4 text-center">
                <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
                  <AlertCircle className="size-6" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-display text-base font-bold text-foreground">
                    Invalid Reset Link
                  </span>
                  <p className="text-xs text-muted-foreground">
                    No reset token was found in your URL. Please click the reset link directly from your email.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="text-xs h-9"
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
                      placeholder="Min 6 characters"
                      className="font-mono text-xs rounded-sm h-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
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
                      placeholder="Re-type password"
                      className="font-mono text-xs rounded-sm h-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !newPassword}
                  className="w-full bg-primary text-primary-foreground font-bold text-xs h-10 mt-2 rounded-sm"
                >
                  {isLoading ? 'Updating Password...' : 'Save & Update Password'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <a href="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors font-mono">
            ← Back to Login
          </a>
        </div>
      </div>
    </div>
  );
};
