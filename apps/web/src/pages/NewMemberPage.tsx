import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MessageCircle, AlertCircle, Sparkles, User, CreditCard, ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PhotoCaptureUpload } from '@/components/members/PhotoCaptureUpload';
import { api } from '@/lib/api';
import { CreateMemberRequestSchema, CreateMemberResponse } from '@gymtech/shared';
import { extractSignatureFromUrl, serializeFaceSignature } from '@/lib/face-matcher';
import { formatCurrency } from '@/lib/utils';

export const NewMemberPage: React.FC = () => {
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.getPlans(),
  });

  const plans = plansData?.plans || [];

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [joinedDate, setJoinedDate] = useState(new Date().toISOString().split('T')[0]);
  const [address, setAddress] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

  const [planId, setPlanId] = useState<number | undefined>(undefined);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [initialPaymentAmount, setInitialPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'OTHER'>('UPI');
  const [referenceId, setReferenceId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<CreateMemberResponse | null>(null);

  // Auto-set default plan when loaded
  React.useEffect(() => {
    if (plans.length > 0 && planId === undefined) {
      setPlanId(plans[0].id);
      setInitialPaymentAmount(plans[0].pricePaise / 100);
    }
  }, [plans, planId]);

  const selectedPlan = plans.find((p) => p.id === planId);
  const planPrice = selectedPlan ? selectedPlan.pricePaise / 100 : 0;
  const netPayable = Math.max(0, planPrice - (Number(discountAmount) || 0));
  const balanceDue = Math.max(0, netPayable - (Number(initialPaymentAmount) || 0));

  const handlePlanChange = (selectedId: string) => {
    const numericId = parseInt(selectedId, 10);
    setPlanId(numericId);
    const plan = plans.find((p) => p.id === numericId);
    if (plan) {
      const discounted = Math.max(0, (plan.pricePaise / 100) - (Number(discountAmount) || 0));
      setInitialPaymentAmount(discounted);
    }
  };

  const handleDiscountChange = (val: number) => {
    setDiscountAmount(val);
    if (selectedPlan) {
      const discounted = Math.max(0, (selectedPlan.pricePaise / 100) - (val || 0));
      setInitialPaymentAmount(discounted);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // M-9: Validate form data against Zod schema before sending to API.
      const parsed = CreateMemberRequestSchema.safeParse({
        firstName,
        lastName: lastName || undefined,
        phone,
        email: email || undefined,
        gender,
        dateOfBirth: dateOfBirth || undefined,
        joinedDate,
        photoUrl: photoUrl || undefined,
        faceEmbedding: undefined,
        address: address || undefined,
        emergencyContactName: emergencyContactName || undefined,
        emergencyContactPhone: emergencyContactPhone || undefined,
        planId: planId!,
        discountPaise: Math.round((Number(discountAmount) || 0) * 100),
        initialPaymentPaise: Math.round((Number(initialPaymentAmount) || 0) * 100),
        paymentMode,
        referenceId: referenceId || undefined,
      });
      if (!parsed.success) {
        setError(parsed.error.errors.map((e) => e.message).join(', '));
        setIsSubmitting(false);
        return;
      }

      let faceEmbedding: string | undefined = undefined;
      if (photoUrl) {
        try {
          const sig = await extractSignatureFromUrl(photoUrl);
          if (sig) faceEmbedding = serializeFaceSignature(sig);
        } catch (err) {
          console.warn('Face embedding generation skipped:', err);
        }
      }

      const res = await api.createMember({
        firstName,
        lastName: lastName || undefined,
        phone,
        email: email || undefined,
        gender,
        dateOfBirth: dateOfBirth || undefined,
        joinedDate,
        photoUrl: photoUrl || undefined,
        faceEmbedding,
        address: address || undefined,
        emergencyContactName: emergencyContactName || undefined,
        emergencyContactPhone: emergencyContactPhone || undefined,
        planId: planId!,
        discountPaise: Math.round((Number(discountAmount) || 0) * 100),
        initialPaymentPaise: Math.round((Number(initialPaymentAmount) || 0) * 100),
        paymentMode,
        referenceId: referenceId || undefined,
      });

      setCreatedResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to register member');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell title="Enroll New Member" breadcrumb="Members">
      <div className="max-w-4xl mx-auto w-full flex flex-col gap-8 pb-12">
        {/* Header with Navigation */}
        <div className="flex flex-col gap-2">
          <Link
            to="/members"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-3 hover:text-ink transition-colors w-fit"
          >
            <ArrowLeft className="size-4" /> Back to Member Directory
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                New Member Registration
              </h1>
              <p className="text-sm text-ink-3 mt-1">
                Capture personal details, assign a membership plan, and log the initial fee
              </p>
            </div>
            <Badge variant="secondary" className="self-start sm:self-auto">
              <Sparkles className="size-3.5 mr-1" /> Quick Enrollment
            </Badge>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-sm font-medium">{error}</AlertDescription>
          </Alert>
        )}

        {createdResult ? (
          <Card className="border-(--line) bg-surface shadow-md p-8 sm:p-12 text-center flex flex-col items-center gap-6">
            <div className="size-16 rounded-full bg-(--positive-soft) text-(--positive) flex items-center justify-center">
              <CheckCircle2 className="size-9" />
            </div>
            <div className="flex flex-col gap-2 max-w-md">
              <h2 className="font-display text-2xl font-bold text-ink">
                Member Enrolled Successfully
              </h2>
              <p className="text-sm text-ink-2">
                {createdResult.member.firstName} {createdResult.member.lastName || ''} has been added to your gym roster with active status.
              </p>
              <div className="mt-4 p-4 rounded-lg bg-(--surface-2) border border-(--line) flex flex-col gap-2 text-left">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-ink-3">Member ID Code:</span>
                  <span className="font-mono font-bold text-ink bg-(--surface) px-2 py-0.5 rounded border border-(--line)">
                    {createdResult.member.memberCode}
                  </span>
                </div>
                {createdResult.receiptNumber && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-ink-3">Payment Receipt:</span>
                    <span className="font-mono text-ink">{createdResult.receiptNumber}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-ink-3">Registered Mobile:</span>
                  <span className="font-mono text-ink">+91 {createdResult.member.phone}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full max-w-md">
              {createdResult.whatsappUrl && (
                <Button asChild className="flex-1 bg-[#25D366] hover:bg-[#20BA5A] text-white font-semibold text-sm h-11 shadow-sm">
                  <a href={createdResult.whatsappUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-4 mr-2 fill-current" /> Send WhatsApp Welcome
                  </a>
                </Button>
              )}
              <Button asChild variant="outline" className="flex-1 h-11 text-sm font-semibold">
                <Link to={`/members/${createdResult.member.id}`}>View Profile</Link>
              </Button>
              <Button asChild variant="ghost" className="h-11 text-sm text-ink-3 hover:text-ink">
                <Link to="/members">Directory</Link>
              </Button>
            </div>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            {/* Section 1: Personal Information */}
            <Card className="border-(--line) shadow-xs overflow-hidden">
              <CardHeader className="p-6 pb-4 border-b border-(--line) bg-(--surface-2)/50">
                <div className="flex items-center gap-3">
                  <span className="size-7 rounded-lg bg-ink text-(--ink-inverse) font-mono font-bold text-sm flex items-center justify-center">
                    1
                  </span>
                  <div>
                    <CardTitle className="text-base sm:text-lg font-semibold text-ink">Personal Information</CardTitle>
                    <p className="text-xs text-ink-3 mt-0.5">Primary member identification and contact info</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 flex flex-col gap-6">
                <PhotoCaptureUpload
                  value={photoUrl}
                  onChange={setPhotoUrl}
                  label="Member Photo (for Face ID & Digital Member Pass)"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="firstName" className="text-sm font-medium text-ink gt-label-required">First Name</Label>
                    <Input
                      id="firstName"
                      required
                      placeholder="e.g. Rahul"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="h-11 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="lastName" className="text-sm font-medium text-ink">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="e.g. Sharma"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="h-11 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="phone" className="text-sm font-medium text-ink gt-label-required">Mobile Phone (10 Digits)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      required
                      pattern="[0-9]{10}"
                      placeholder="9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="h-11 text-sm font-mono tracking-wide"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="email" className="text-sm font-medium text-ink">Email Address (Optional)</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="rahul@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="flex flex-col gap-2">
                    <Label id="gender-label" className="text-sm font-medium text-ink">Gender</Label>
                    <Select value={gender} onValueChange={(val: any) => setGender(val)}>
                      <SelectTrigger className="h-11 text-sm" aria-labelledby="gender-label">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MALE">Male</SelectItem>
                        <SelectItem value="FEMALE">Female</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="dateOfBirth" className="text-sm font-medium text-ink">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="h-11 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="joinedDate" className="text-sm font-medium text-ink">Joining Date</Label>
                    <Input
                      id="joinedDate"
                      type="date"
                      value={joinedDate}
                      onChange={(e) => setJoinedDate(e.target.value)}
                      className="h-11 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-(--line)">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="emergencyContactName" className="text-sm font-medium text-ink">Emergency Contact Person</Label>
                    <Input
                      id="emergencyContactName"
                      placeholder="e.g. Father / Spouse"
                      value={emergencyContactName}
                      onChange={(e) => setEmergencyContactName(e.target.value)}
                      className="h-11 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="emergencyContactPhone" className="text-sm font-medium text-ink">Emergency Contact Phone</Label>
                    <Input
                      id="emergencyContactPhone"
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={emergencyContactPhone}
                      onChange={(e) => setEmergencyContactPhone(e.target.value)}
                      className="h-11 text-sm font-mono"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Membership Package & Initial Payment */}
            <Card className="border-(--line) shadow-xs overflow-hidden">
              <CardHeader className="p-6 pb-4 border-b border-(--line) bg-(--surface-2)/50">
                <div className="flex items-center gap-3">
                  <span className="size-7 rounded-lg bg-ink text-(--ink-inverse) font-mono font-bold text-sm flex items-center justify-center">
                    2
                  </span>
                  <div>
                    <CardTitle className="text-base sm:text-lg font-semibold text-ink">Membership Package &amp; Initial Payment</CardTitle>
                    <p className="text-xs text-ink-3 mt-0.5">Select plan, apply discount, and record initial collection</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="planId" className="text-sm font-medium text-ink gt-label-required">Select Membership Package</Label>
                  <Select value={planId?.toString() ?? ''} onValueChange={handlePlanChange}>
                    <SelectTrigger id="planId" className="h-11 text-sm">
                      <SelectValue placeholder={plansLoading ? 'Loading plans...' : 'Choose package'} />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          {p.name} ({p.durationMonths} mo) — ₹{(p.pricePaise / 100).toLocaleString('en-IN')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="discount" className="text-sm font-medium text-ink">Discount (₹)</Label>
                    <Input
                      id="discount"
                      type="number"
                      min="0"
                      value={discountAmount || ''}
                      placeholder="0"
                      onChange={(e) => handleDiscountChange(Number(e.target.value))}
                      className="h-11 text-sm font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="initialPayment" className="text-sm font-medium text-ink gt-label-required">
                      Initial Payment Collected (₹)
                    </Label>
                    <Input
                      id="initialPayment"
                      type="number"
                      min="0"
                      required
                      value={initialPaymentAmount || ''}
                      placeholder="0"
                      onChange={(e) => setInitialPaymentAmount(Number(e.target.value))}
                      className="h-11 text-sm font-mono font-bold text-ink"
                    />
                  </div>
                </div>

                {/* Calculation Summary Box */}
                <div className="rounded-xl border border-(--line) bg-(--surface-2)/60 p-5 flex flex-col sm:flex-row justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-xs text-ink-3">Package Fee</span>
                    <span className="text-base font-semibold text-ink font-mono">{formatCurrency(planPrice)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-ink-3">Discount</span>
                    <span className="text-base font-semibold text-ink-3 font-mono">- {formatCurrency(Number(discountAmount) || 0)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-ink-3">Net Fee</span>
                    <span className="text-base font-semibold text-ink font-mono">{formatCurrency(netPayable)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-ink-3">Paid Now</span>
                    <span className="text-base font-semibold text-(--positive) font-mono">{formatCurrency(Number(initialPaymentAmount) || 0)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-ink-3">Outstanding Dues</span>
                    <span className={`text-base font-bold font-mono ${balanceDue > 0 ? 'text-(--warn)' : 'text-(--positive)'}`}>
                      {balanceDue > 0 ? formatCurrency(balanceDue) : '₹0 (Paid in Full)'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="paymentMode" className="text-sm font-medium text-ink">Payment Mode</Label>
                    <Select value={paymentMode} onValueChange={(val: any) => setPaymentMode(val)}>
                      <SelectTrigger id="paymentMode" className="h-11 text-sm">
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UPI">UPI / QR Code</SelectItem>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="CARD">Debit / Credit Card</SelectItem>
                        <SelectItem value="BANK_TRANSFER">Net Banking / Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="referenceId" className="text-sm font-medium text-ink">Reference ID / Transaction Notes</Label>
                    <Input
                      id="referenceId"
                      placeholder="e.g. UPI/2026/XXXX or Desk Cash"
                      value={referenceId}
                      onChange={(e) => setReferenceId(e.target.value)}
                      className="h-11 text-sm font-mono"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Form Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button asChild variant="ghost" className="text-sm text-ink-3 hover:text-ink">
                <Link to="/members">Cancel</Link>
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-ink text-(--ink-inverse) hover:bg-ink-2 font-bold text-sm h-11 px-8 shadow-sm"
              >
                {isSubmitting ? 'Registering Member...' : 'Complete Member Registration'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
};
