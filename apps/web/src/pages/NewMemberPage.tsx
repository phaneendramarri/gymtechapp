import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, MessageCircle, AlertCircle } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PhotoCaptureUpload } from '@/components/ui/PhotoCaptureUpload';
import { api } from '@/lib/api';
import { CreateMemberResponse } from '@gymtech/shared';
import { extractSignatureFromUrl, serializeFaceSignature } from '@/lib/face-matcher';

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
      setInitialPaymentAmount(plans[0].price_paise / 100);
    }
  }, [plans, planId]);

  const handlePlanChange = (selectedId: string) => {
    const numericId = parseInt(selectedId, 10);
    setPlanId(numericId);
    const selectedPlan = plans.find((p) => p.id === numericId);
    if (selectedPlan) {
      setInitialPaymentAmount(selectedPlan.price_paise / 100);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
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
      <div className="max-w-2xl mx-auto w-full flex flex-col gap-6">
        <div>
          <a
            href="#/members"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Back to Member Directory
          </a>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground">
            New Member Registration
          </h2>
          <p className="text-xs text-muted-foreground">
            Capture personal details, assign a membership plan, and log the initial fee
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {createdResult ? (
          <Card className="border-ok/30 bg-card shadow-md p-8 text-center flex flex-col items-center gap-4">
            <div className="size-14 rounded-full bg-ok/10 text-ok flex items-center justify-center">
              <CheckCircle2 className="size-8" />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-foreground">
                Member Enrolled Successfully
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Assigned Member Code:{' '}
                <strong className="font-mono text-sm text-primary">
                  {createdResult.member.member_code}
                </strong>
              </p>
              {createdResult.receiptNumber && (
                <p className="text-xs font-mono text-muted-foreground mt-0.5">
                  Payment Receipt: {createdResult.receiptNumber}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 mt-4 w-full max-w-sm">
              {createdResult.whatsappUrl && (
                <Button asChild className="flex-1 bg-[#25D366] hover:bg-[#20BA5A] text-white font-bold text-xs h-10">
                  <a href={createdResult.whatsappUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-4 mr-2 fill-current" /> Send WhatsApp
                  </a>
                </Button>
              )}
              <Button asChild variant="outline" className="flex-1 h-10 text-xs font-medium">
                <a href="#/members">View Directory</a>
              </Button>
            </div>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* Section 1: Personal Information */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="size-6 rounded-md bg-primary/10 text-primary font-mono font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <CardTitle className="text-sm font-semibold">Personal Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex flex-col gap-4">
                <PhotoCaptureUpload
                  value={photoUrl}
                  onChange={setPhotoUrl}
                  label="Member Avatar / Photo (Free WebP Compression)"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="firstName" className="text-xs font-semibold">First Name *</Label>
                    <Input
                      id="firstName"
                      required
                      placeholder="e.g. Rahul"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="lastName" className="text-xs font-semibold">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="e.g. Sharma"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="phone" className="text-xs font-semibold">Mobile Phone (10 Digits) *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      required
                      pattern="[0-9]{10}"
                      placeholder="9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="rahul@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="gender" className="text-xs font-semibold">Gender</Label>
                    <Select value={gender} onValueChange={(val: any) => setGender(val)}>
                      <SelectTrigger id="gender" className="text-xs">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MALE">Male</SelectItem>
                        <SelectItem value="FEMALE">Female</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="dateOfBirth" className="text-xs font-semibold">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="joinedDate" className="text-xs font-semibold">Joining Date</Label>
                    <Input
                      id="joinedDate"
                      type="date"
                      value={joinedDate}
                      onChange={(e) => setJoinedDate(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Membership Package & Initial Payment */}
            <Card className="border-border shadow-xs">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="size-6 rounded-md bg-ok/10 text-ok font-mono font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <CardTitle className="text-sm font-semibold">Membership Plan &amp; Initial Payment</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="planId" className="text-xs font-semibold">Select Membership Package *</Label>
                  <Select value={planId?.toString() ?? ''} onValueChange={handlePlanChange}>
                    <SelectTrigger id="planId" className="text-xs">
                      <SelectValue placeholder={plansLoading ? 'Loading plans...' : 'Choose package'} />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>
                          {p.name} ({p.duration_months} mo) — ₹{(p.price_paise / 100).toLocaleString('en-IN')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="discount" className="text-xs font-semibold">Discount (₹)</Label>
                    <Input
                      id="discount"
                      type="number"
                      min="0"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(Number(e.target.value))}
                      className="text-xs font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="initialPayment" className="text-xs font-semibold">
                      Initial Payment Collected (₹) *
                    </Label>
                    <Input
                      id="initialPayment"
                      type="number"
                      min="0"
                      required
                      value={initialPaymentAmount}
                      onChange={(e) => setInitialPaymentAmount(Number(e.target.value))}
                      className="text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="paymentMode" className="text-xs font-semibold">Payment Mode</Label>
                    <Select value={paymentMode} onValueChange={(val: any) => setPaymentMode(val)}>
                      <SelectTrigger id="paymentMode" className="text-xs">
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UPI">UPI / QR Code</SelectItem>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="CARD">Debit / Credit Card</SelectItem>
                        <SelectItem value="BANK_TRANSFER">Net Banking</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="referenceId" className="text-xs font-semibold">Reference ID / Notes</Label>
                    <Input
                      id="referenceId"
                      placeholder="e.g. UPI/2026/XXXX"
                      value={referenceId}
                      onChange={(e) => setReferenceId(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Form Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button asChild variant="ghost" className="text-xs">
                <a href="#/members">Cancel</a>
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary text-primary-foreground font-bold text-xs h-10 px-6"
              >
                {isSubmitting ? 'Registering...' : 'Complete Member Registration'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
};
