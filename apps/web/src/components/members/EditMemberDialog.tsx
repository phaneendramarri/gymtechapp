import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UserCheck, RefreshCw, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PhotoCaptureUpload } from '@/components/ui/PhotoCaptureUpload';
import { api } from '@/lib/api';
import { Member, UpdateMemberRequest } from '@gymtech/shared';
import { extractSignatureFromUrl, serializeFaceSignature } from '@/lib/face-matcher';

interface EditMemberDialogProps {
  member: Member;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const EditMemberDialog: React.FC<EditMemberDialogProps> = ({
  member,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState(member.firstName || '');
  const [lastName, setLastName] = useState(member.lastName || '');
  const [phone, setPhone] = useState(member.phone || '');
  const [email, setEmail] = useState(member.email || '');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>((member.gender as any) || 'MALE');
  const [status, setStatus] = useState<NonNullable<typeof member.status>>(member.status || 'ACTIVE');
  const [dateOfBirth, setDateOfBirth] = useState<string>(member.dateOfBirth ? new Date(member.dateOfBirth * 1000).toISOString().split('T')[0] : '');
  const [address, setAddress] = useState(member.address || '');
  const [emergencyContactName, setEmergencyContactName] = useState(member.emergencyContactName || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(member.emergencyContactPhone || '');
  const [healthNotes, setHealthNotes] = useState(member.healthNotes || '');
  const [photoUrl, setPhotoUrl] = useState(member.photoUrl || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state whenever member prop changes
  useEffect(() => {
    setFirstName(member.firstName || '');
    setLastName(member.lastName || '');
    setPhone(member.phone || '');
    setEmail(member.email || '');
    setGender((member.gender as any) || 'MALE');
    setStatus(member.status || 'ACTIVE');
    setDateOfBirth(member.dateOfBirth ? new Date(member.dateOfBirth * 1000).toISOString().split('T')[0] : '');
    setAddress(member.address || '');
    setEmergencyContactName(member.emergencyContactName || '');
    setEmergencyContactPhone(member.emergencyContactPhone || '');
    setHealthNotes(member.healthNotes || '');
    setPhotoUrl(member.photoUrl || '');
    setError(null);
  }, [member, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length < 10) {
      setError('Please provide a valid 10-digit mobile phone number.');
      return;
    }

    setIsSubmitting(true);

    let faceEmbedding: string | undefined = undefined;
    if (photoUrl && photoUrl !== member.photoUrl) {
      try {
        const sig = await extractSignatureFromUrl(photoUrl);
        if (sig) faceEmbedding = serializeFaceSignature(sig);
      } catch (err) {
        console.warn('Face embedding generation skipped:', err);
      }
    }

    const payload: UpdateMemberRequest = {
      firstName: firstName.trim(),
      lastName: lastName.trim() || undefined,
      phone: cleanPhone,
      email: email.trim() || undefined,
      gender,
      status: status as any,
      dateOfBirth: dateOfBirth || undefined,
      address: address.trim() || undefined,
      emergencyContactName: emergencyContactName.trim() || undefined,
      emergencyContactPhone: emergencyContactPhone.trim() || undefined,
      healthNotes: healthNotes.trim() || undefined,
      photoUrl: photoUrl || undefined,
      faceEmbedding: faceEmbedding || (photoUrl === member.photoUrl ? member.faceEmbedding || undefined : undefined),
    };

    try {
      await api.updateMember(member.id, payload);
      queryClient.invalidateQueries({ queryKey: ['member', member.id] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update member information.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-6 rounded-md bg-card border-border shadow-2xl overflow-hidden">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-sm bg-primary/10 text-primary flex items-center justify-center">
              <UserCheck className="size-5" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-bold text-foreground">
                Edit Member Details
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Update personal, contact, and account status for {member.memberCode}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="rounded-sm my-2">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-3 flex flex-col gap-4">
          {/* Member Photo */}
          <PhotoCaptureUpload
            value={photoUrl}
            onChange={setPhotoUrl}
            label="Profile Photo / Fast Check-in Avatar"
          />

          {/* Core Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editFirstName" className="text-xs font-semibold gt-label-required">First Name</Label>
              <Input
                id="editFirstName"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editLastName" className="text-xs font-semibold">Last Name</Label>
              <Input
                id="editLastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editPhone" className="text-xs font-semibold gt-label-required">Mobile Phone (10 Digits)</Label>
              <Input
                id="editPhone"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="text-xs h-9 font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editEmail" className="text-xs font-semibold">Email Address</Label>
              <Input
                id="editEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-xs h-9 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editStatus" className="text-xs font-semibold">Membership Status</Label>
              <select
                id="editStatus"
                value={status}
                onChange={(e: any) => setStatus(e.target.value)}
                className="h-9 px-3 rounded-xs bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="FROZEN">FROZEN</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editGender" className="text-xs font-semibold">Gender</Label>
              <select
                id="editGender"
                value={gender}
                onChange={(e: any) => setGender(e.target.value)}
                className="h-9 px-3 rounded-xs bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editDob" className="text-xs font-semibold">Date of Birth</Label>
              <Input
                id="editDob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="text-xs h-9"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editAddress" className="text-xs font-semibold">Residential Address</Label>
            <Input
              id="editAddress"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 14B Green Park, HSR Layout"
              className="text-xs h-9"
            />
          </div>

          {/* Emergency Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editEmergName" className="text-xs font-semibold">Emergency Contact Name</Label>
              <Input
                id="editEmergName"
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                placeholder="Parent / Spouse"
                className="text-xs h-9"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editEmergPhone" className="text-xs font-semibold">Emergency Contact Phone</Label>
              <Input
                id="editEmergPhone"
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                placeholder="10-digit number"
                className="text-xs h-9 font-mono"
              />
            </div>
          </div>

          {/* Health Notes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editHealthNotes" className="text-xs font-semibold">Health / Medical Notes</Label>
            <Input
              id="editHealthNotes"
              value={healthNotes}
              onChange={(e) => setHealthNotes(e.target.value)}
              placeholder="e.g. Lower back surgery 2024, asthma"
              className="text-xs h-9"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-border flex items-center justify-between mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-9"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting || !firstName.trim()}
              className="bg-primary text-primary-foreground font-bold text-xs h-9 px-5 shadow-sm hover:shadow"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
