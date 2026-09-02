import React, { useState } from 'react';
import { Mail, Server, Shield, Send, CheckCircle2, AlertCircle, Eye, EyeOff, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SmtpSettings } from '@gymtech/shared';
import { api } from '@/lib/api';

interface SmtpConfigBlockProps {
  smtp: SmtpSettings;
  onChange: (updated: SmtpSettings) => void;
  userEmail?: string;
  gymName?: string;
  onTest?: (payload: { smtp: SmtpSettings; testRecipient: string }) => Promise<{ success: boolean; message: string }>;
}

const PROVIDERS: {
  id: SmtpSettings['provider'];
  name: string;
  badge: string;
  host: string;
  port: number;
  secure: boolean;
  usernameFixed?: string;
  userLabel: string;
  passLabel: string;
  userPlaceholder: string;
  passPlaceholder: string;
  instructions: string;
}[] = [
  {
    id: 'GMAIL',
    name: 'Gmail / Google Workspace',
    badge: 'Most Popular',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    userLabel: 'Your Gmail / Workspace Email',
    passLabel: 'Google 16-Letter App Password',
    userPlaceholder: 'yourname@gmail.com or info@yourgym.com',
    passPlaceholder: 'xxxx xxxx xxxx xxxx',
    instructions: 'Go to Google Account → Security → 2-Step Verification → App passwords. Generate a password for "Mail" and paste it here.',
  },
  {
    id: 'RESEND',
    name: 'Resend',
    badge: 'Modern & Free Tier',
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    usernameFixed: 'resend',
    userLabel: 'Sender Email (Verified in Resend)',
    passLabel: 'Resend API Key',
    userPlaceholder: 'notifications@yourdomain.com',
    passPlaceholder: 're_123456789abcdef...',
    instructions: 'Create an API key in your Resend.com dashboard and paste it here.',
  },
  {
    id: 'SENDGRID',
    name: 'SendGrid',
    badge: 'Transactional',
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    usernameFixed: 'apikey',
    userLabel: 'Sender Email Address',
    passLabel: 'SendGrid API Key',
    userPlaceholder: 'notifications@yourgym.com',
    passPlaceholder: 'SG.xxxxxxxxxxxxxxxxxxxxxx',
    instructions: 'In SendGrid, generate an API key with Full Access and paste it here.',
  },
  {
    id: 'BREVO',
    name: 'Brevo (Sendinblue)',
    badge: '300 Free/Day',
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    userLabel: 'Brevo Login Email',
    passLabel: 'Brevo SMTP Key',
    userPlaceholder: 'account@yourdomain.com',
    passPlaceholder: 'xsmtpsib-xxxxxxxxxxxxxxxx',
    instructions: 'Copy your SMTP key from Brevo → Transactional → Settings → Configuration.',
  },
  {
    id: 'AWS_SES',
    name: 'Amazon SES',
    badge: 'High Volume',
    host: 'email-smtp.us-east-1.amazonaws.com',
    port: 587,
    secure: false,
    userLabel: 'SES SMTP Username',
    passLabel: 'SES SMTP Password',
    userPlaceholder: 'AKIAxxxxxxxxxxxxxxxx',
    passPlaceholder: 'BKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    instructions: 'Generate dedicated SMTP credentials in the AWS SES Console.',
  },
  {
    id: 'CUSTOM',
    name: 'Custom SMTP Server',
    badge: 'Any Provider',
    host: '',
    port: 587,
    secure: false,
    userLabel: 'SMTP Username / Account',
    passLabel: 'SMTP Password',
    userPlaceholder: 'smtp_user',
    passPlaceholder: '••••••••••••••••',
    instructions: 'Connect any self-hosted mail server (cPanel, Postfix, Zimbra, Exchange).',
  },
];

export const SmtpConfigBlock: React.FC<SmtpConfigBlockProps> = ({
  smtp,
  onChange,
  userEmail,
  gymName,
  onTest,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(smtp.provider === 'CUSTOM');
  const [testRecipient, setTestRecipient] = useState(userEmail || '');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const activeProvider = PROVIDERS.find((p) => p.id === smtp.provider) || PROVIDERS[0];

  const handleProviderSelect = (provider: typeof PROVIDERS[number]) => {
    onChange({
      ...smtp,
      provider: provider.id,
      host: provider.host || smtp.host,
      port: provider.port,
      secure: provider.secure,
      username: provider.usernameFixed || smtp.username,
    });
    if (provider.id === 'CUSTOM') {
      setShowAdvanced(true);
    }
  };

  const handleTestEmail = async () => {
    if (!testRecipient.trim()) {
      setTestResult({ success: false, message: 'Please enter a test recipient email address.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const testFn = onTest || ((p: any) => api.testAdminSmtp(p));
      const res = await testFn({
        smtp,
        testRecipient: testRecipient.trim(),
      });
      setTestResult({ success: true, message: res.message });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to dispatch test email. Please check your credentials.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="border-border shadow-xs overflow-hidden">
      {/* Header with Enable Switch */}
      <CardHeader className="pb-4 border-b border-border/80 bg-secondary/20">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Server className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold text-foreground">
                  Email Delivery &amp; Sender Account
                </CardTitle>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono font-bold ${
                    smtp.enabled
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground'
                  }`}
                >
                  {smtp.enabled ? 'YOUR EMAIL SENDER ACTIVE' : 'FREE DEFAULT ENGINE ACTIVE'}
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Send receipts, membership reminders, and alerts directly from your own gym email
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={smtp.enabled}
              onCheckedChange={(enabled) => onChange({ ...smtp, enabled })}
              aria-label="Toggle custom email sender"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-5">
        {/* Simple 1-Click Provider Selection */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span>Step 1: Choose Your Email Service</span>
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PROVIDERS.map((provider) => {
              const isSelected = (smtp.provider || 'GMAIL') === provider.id;
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => handleProviderSelect(provider)}
                  className={`p-3 rounded-xl border text-left transition-all relative ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-foreground font-semibold shadow-xs ring-1 ring-primary/20'
                      : 'border-border bg-card hover:bg-secondary/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground truncate">{provider.name.split(' / ')[0]}</span>
                    {isSelected && <CheckCircle2 className="size-3.5 text-primary shrink-0" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 block font-mono">
                    {provider.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Dead-Simple Credentials (2 Inputs Only) */}
        <div className="p-4 rounded-xl bg-secondary/30 border border-border/80 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-primary" />
              <span className="text-xs font-bold text-foreground">
                Step 2: Enter {activeProvider.name.split(' ')[0]} Login
              </span>
            </div>
            <span className="text-[10px] font-mono text-primary font-semibold">
              Host: {activeProvider.host || 'Custom'} &bull; Port: {activeProvider.port}
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {activeProvider.instructions}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Username / Email */}
            <div className="space-y-1.5">
              <Label htmlFor="smtpUser" className="text-xs font-semibold text-foreground">
                {activeProvider.userLabel}
              </Label>
              <Input
                id="smtpUser"
                placeholder={activeProvider.userPlaceholder}
                value={smtp.username}
                onChange={(e) => onChange({ ...smtp, username: e.target.value })}
                className="text-xs rounded-lg h-9 bg-card font-sans"
              />
            </div>

            {/* Password / API Key */}
            <div className="space-y-1.5">
              <Label htmlFor="smtpPassword" className="text-xs font-semibold text-foreground">
                {activeProvider.passLabel}
              </Label>
              <div className="relative">
                <Input
                  id="smtpPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={activeProvider.passPlaceholder}
                  value={smtp.password}
                  onChange={(e) => onChange({ ...smtp, password: e.target.value })}
                  className="text-xs rounded-lg h-9 bg-card font-mono pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </div>

            {/* Sender Name */}
            <div className="space-y-1.5">
              <Label htmlFor="smtpFromName" className="text-xs font-semibold text-foreground">
                Gym Sender Name (What members see)
              </Label>
              <Input
                id="smtpFromName"
                placeholder={gymName || 'Iron House Fitness'}
                value={smtp.fromName}
                onChange={(e) => onChange({ ...smtp, fromName: e.target.value })}
                className="text-xs rounded-lg h-9 bg-card font-sans"
              />
            </div>

            {/* Sender From Email */}
            <div className="space-y-1.5">
              <Label htmlFor="smtpFromEmail" className="text-xs font-semibold text-foreground">
                From Email Address
              </Label>
              <Input
                id="smtpFromEmail"
                type="email"
                placeholder={smtp.username || 'info@yourgym.com'}
                value={smtp.fromEmail}
                onChange={(e) => onChange({ ...smtp, fromEmail: e.target.value })}
                className="text-xs rounded-lg h-9 bg-card font-sans"
              />
            </div>
          </div>
        </div>

        {/* Collapsible Advanced Server Details (Host, Port, SSL) */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-muted-foreground hover:text-foreground font-semibold inline-flex items-center gap-1.5 transition-colors py-1"
          >
            <span>Advanced Server Settings (Host, Port, Encryption)</span>
            {showAdvanced ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>

          {showAdvanced && (
            <div className="mt-3 p-4 rounded-xl bg-secondary/20 border border-border space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-8 space-y-1.5">
                  <Label htmlFor="smtpHost" className="text-xs font-semibold text-foreground">
                    SMTP Host Server
                  </Label>
                  <Input
                    id="smtpHost"
                    placeholder="e.g. smtp.gmail.com"
                    value={smtp.host}
                    onChange={(e) => onChange({ ...smtp, host: e.target.value })}
                    className="text-xs rounded-lg h-9 bg-card font-mono"
                  />
                </div>

                <div className="sm:col-span-4 space-y-1.5">
                  <Label htmlFor="smtpPort" className="text-xs font-semibold text-foreground">
                    Port
                  </Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    placeholder="587"
                    value={smtp.port || 587}
                    onChange={(e) => onChange({ ...smtp, port: parseInt(e.target.value, 10) || 587 })}
                    className="text-xs rounded-lg h-9 bg-card font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-card border border-border">
                <div className="flex items-center gap-2">
                  <Shield className="size-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">SSL / TLS Encryption</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {smtp.secure ? 'SSL (Port 465)' : 'STARTTLS (Port 587)'}
                  </span>
                  <Switch
                    checked={smtp.secure}
                    onCheckedChange={(secure) =>
                      onChange({ ...smtp, secure, port: secure ? 465 : 587 })
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Test Email Delivery Button */}
        <div className="pt-3 border-t border-border/80 bg-secondary/15 -mx-6 -mb-6 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="size-3.5 text-primary" />
              <span className="text-xs font-bold text-foreground">Step 3: Test Your Email Setup</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">Instant Verification</span>
          </div>

          {testResult && (
            <Alert
              variant={testResult.success ? 'default' : 'destructive'}
              className={`rounded-lg py-2.5 ${
                testResult.success
                  ? 'border-ok/30 bg-ok/10 text-ok'
                  : 'border-destructive/30 bg-destructive/10 text-destructive'
              }`}
            >
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="size-4 shrink-0" />
                ) : (
                  <AlertCircle className="size-4 shrink-0" />
                )}
                <AlertDescription className="text-xs">{testResult.message}</AlertDescription>
              </div>
            </Alert>
          )}

          <div className="flex items-center gap-2.5">
            <Input
              type="email"
              placeholder="Enter your email to receive test message"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              className="text-xs rounded-lg h-9 bg-card flex-1 font-sans"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isTesting || !testRecipient.trim()}
              onClick={handleTestEmail}
              className="h-9 px-4 text-xs font-semibold border-border hover:bg-card gap-1.5 shrink-0"
            >
              <Mail className="size-3.5" />
              <span>{isTesting ? 'Sending Test...' : 'Send Test Email'}</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
