import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Lock,
  Unlock,
  Key,
  Plus,
  Search,
  User,
  Calendar,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';
import type { Locker, LockerAllocation } from '@gymtech/shared';

export const LockersPage: React.FC = () => {
  const { gym } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchNumber, setSearchNumber] = useState<string>('');

  // Add Locker Modal
  const [isAddLockerOpen, setIsAddLockerOpen] = useState(false);
  const [newLockerNumber, setNewLockerNumber] = useState('');
  const [newLockerZone, setNewLockerZone] = useState("Men's Locker Room");

  // Allocation Modal
  const [allocatingLocker, setAllocatingLocker] = useState<Locker | null>(null);
  const [memberCodeInput, setMemberCodeInput] = useState('');
  const [allocStartDate, setAllocStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [allocEndDate, setAllocEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [allocDepositRupees, setAllocDepositRupees] = useState<number | ''>(500);
  const [allocRentRupees, setAllocRentRupees] = useState<number | ''>(300);

  // Queries
  const { data: lockersData, isLoading: loadingLockers } = useQuery({
    queryKey: ['lockers', gym?.id],
    queryFn: () => api.getLockers(gym?.id),
  });

  const { data: allocationsData, refetch: refetchAllocations } = useQuery({
    queryKey: ['lockerAllocations', gym?.id],
    queryFn: () => api.getLockerAllocations('ACTIVE', gym?.id),
  });

  const { data: membersData } = useQuery({
    queryKey: ['members-list-lockers', gym?.id],
    queryFn: () => api.getMembers({ limit: 100 }),
  });

  // Mutations
  const createLockerMutation = useMutation({
    mutationFn: (data: any) => api.createLocker(data, gym?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lockers'] });
      setIsAddLockerOpen(false);
      setNewLockerNumber('');
      toast('success', 'Locker unit created');
    },
    onError: (err: any) => toast('error', err.message || 'Failed to create locker'),
  });

  const allocateMutation = useMutation({
    mutationFn: (data: any) => api.allocateLocker(data, gym?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lockers'] });
      qc.invalidateQueries({ queryKey: ['lockerAllocations'] });
      setAllocatingLocker(null);
      setMemberCodeInput('');
      toast('success', 'Locker allocated to member!');
    },
    onError: (err: any) => toast('error', err.message || 'Allocation failed'),
  });

  const releaseMutation = useMutation({
    mutationFn: (allocationId: number) => api.releaseLocker(allocationId, gym?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lockers'] });
      qc.invalidateQueries({ queryKey: ['lockerAllocations'] });
      toast('success', 'Locker released successfully');
    },
    onError: (err: any) => toast('error', err.message || 'Failed to release locker'),
  });

  const handleCreateLocker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLockerNumber.trim()) return;
    createLockerMutation.mutate({
      lockerNumber: newLockerNumber.trim(),
      zone: newLockerZone,
    });
  };

  const handleAllocate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocatingLocker || !memberCodeInput.trim()) return;

    const foundMember = membersData?.members?.find(
      (m: any) =>
        m.memberCode?.toLowerCase() === memberCodeInput.trim().toLowerCase() ||
        String(m.id) === memberCodeInput.trim()
    );

    if (!foundMember) {
      toast('error', 'Member not found with code: ' + memberCodeInput);
      return;
    }

    allocateMutation.mutate({
      lockerId: allocatingLocker.id,
      memberId: foundMember.id,
      startDate: allocStartDate,
      endDate: allocEndDate,
      depositPaise: Math.round(Number(allocDepositRupees || 0) * 100),
      rentPaise: Math.round(Number(allocRentRupees || 0) * 100),
    });
  };

  const lockers = lockersData?.lockers || [];
  const allocations = allocationsData?.allocations || [];

  // Derived stats
  const totalCount = lockers.length;
  const occupiedCount = lockers.filter((l) => l.status === 'OCCUPIED').length;
  const availableCount = lockers.filter((l) => l.status === 'AVAILABLE').length;
  const maintenanceCount = lockers.filter((l) => l.status === 'MAINTENANCE').length;

  const zones = ['ALL', ...Array.from(new Set(lockers.map((l) => l.zone).filter(Boolean) as string[]))];

  const filteredLockers = lockers.filter((l) => {
    const matchesZone = selectedZone === 'ALL' || l.zone === selectedZone;
    const matchesStatus = selectedStatus === 'ALL' || l.status === selectedStatus;
    const matchesSearch = !searchNumber.trim() || l.lockerNumber.toLowerCase().includes(searchNumber.toLowerCase());
    return matchesZone && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-(--ink)">Locker Management</h1>
          <p className="text-sm text-(--ink-3)">
            Assign visual locker units to members, track security deposits, rental terms, and key handovers.
          </p>
        </div>
        <Button
          onClick={() => setIsAddLockerOpen(true)}
          className="bg-(--iron) text-(--white) hover:bg-(--iron-hover) flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Locker Unit
        </Button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-(--border) bg-(--surface) shadow-xs">
          <span className="text-xs text-(--ink-3)">Total Lockers</span>
          <h3 className="text-2xl font-bold text-(--ink) mt-1">{totalCount}</h3>
        </div>
        <div className="p-4 rounded-xl border border-(--border) bg-(--surface) shadow-xs">
          <span className="text-xs text-emerald-500 font-medium">Available</span>
          <h3 className="text-2xl font-bold text-emerald-500 mt-1">{availableCount}</h3>
        </div>
        <div className="p-4 rounded-xl border border-(--border) bg-(--surface) shadow-xs">
          <span className="text-xs text-amber-500 font-medium">Occupied</span>
          <h3 className="text-2xl font-bold text-amber-500 mt-1">{occupiedCount}</h3>
        </div>
        <div className="p-4 rounded-xl border border-(--border) bg-(--surface) shadow-xs">
          <span className="text-xs text-(--ink-3)">Maintenance</span>
          <h3 className="text-2xl font-bold text-(--ink-3) mt-1">{maintenanceCount}</h3>
        </div>
      </div>

      {/* Filter and Zone Switcher Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-(--surface) border border-(--border) rounded-xl">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--ink-3)" />
          <Input
            placeholder="Search locker number (e.g. L-10)..."
            value={searchNumber}
            onChange={(e) => setSearchNumber(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {zones.map((zone) => (
            <button
              key={zone}
              onClick={() => setSelectedZone(zone)}
              className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedZone === zone
                  ? 'bg-(--iron) text-(--white)'
                  : 'bg-(--bg) text-(--ink-2) hover:text-(--ink)'
              }`}
            >
              {zone}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {['ALL', 'AVAILABLE', 'OCCUPIED'].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                selectedStatus === status
                  ? 'bg-(--surface-hover) text-(--ink) border border-(--border)'
                  : 'text-(--ink-3) hover:text-(--ink)'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Locker Grid */}
      {loadingLockers ? (
        <div className="p-12 text-center text-(--ink-3) bg-(--surface) rounded-xl border border-(--border)">
          Loading locker cabinets...
        </div>
      ) : filteredLockers.length === 0 ? (
        <div className="p-12 text-center bg-(--surface) rounded-xl border border-(--border) space-y-3">
          <Lock className="w-10 h-10 mx-auto text-(--ink-4)" />
          <p className="text-sm text-(--ink-2) font-medium">No lockers match criteria</p>
          <Button size="sm" variant="outline" onClick={() => setIsAddLockerOpen(true)}>
            Add New Locker
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {filteredLockers.map((locker) => {
            const isAvailable = locker.status === 'AVAILABLE';
            const isOccupied = locker.status === 'OCCUPIED';
            const currentAlloc = allocations.find((a) => a.lockerId === locker.id);

            return (
              <div
                key={locker.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between h-36 ${
                  isAvailable
                    ? 'border-(--border) bg-(--surface) hover:border-(--iron)'
                    : isOccupied
                    ? 'border-amber-500/20 bg-amber-500/5'
                    : 'border-zinc-500/20 bg-zinc-500/5 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-(--ink)">{locker.lockerNumber}</span>
                    {isAvailable ? (
                      <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-amber-500" />
                    )}
                  </div>
                  <p className="text-[10px] text-(--ink-3) truncate mt-0.5">{locker.zone || 'General'}</p>
                </div>

                <div>
                  {isOccupied && currentAlloc ? (
                    <div className="text-[11px] space-y-0.5">
                      <p className="font-semibold text-(--ink) truncate">
                        {currentAlloc.memberName || 'Member'}
                      </p>
                      <p className="text-[10px] text-(--ink-3)">Until {currentAlloc.endDate}</p>
                    </div>
                  ) : isAvailable ? (
                    <p className="text-[11px] text-emerald-500 font-medium">Vacant</p>
                  ) : (
                    <p className="text-[11px] text-(--ink-3)">Under Maintenance</p>
                  )}

                  <div className="mt-2 pt-2 border-t border-(--border)/60 flex justify-end">
                    {isAvailable ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAllocatingLocker(locker)}
                        className="w-full text-[11px] h-7"
                      >
                        Allocate
                      </Button>
                    ) : isOccupied && currentAlloc ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => releaseMutation.mutate(currentAlloc.id)}
                        className="w-full text-[11px] h-7 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                      >
                        Release
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ALLOCATE MODAL */}
      {allocatingLocker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-(--surface) border border-(--border) rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-(--ink)">
                  Allocate Locker #{allocatingLocker.lockerNumber}
                </h3>
                <p className="text-xs text-(--ink-3)">Zone: {allocatingLocker.zone || 'General'}</p>
              </div>
              <button
                onClick={() => setAllocatingLocker(null)}
                className="text-(--ink-3) hover:text-(--ink)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAllocate} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-(--ink-2)">Member Code *</label>
                <Input
                  required
                  placeholder="Enter Member Code (e.g. M-1001)..."
                  value={memberCodeInput}
                  onChange={(e) => setMemberCodeInput(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-(--ink-2)">Start Date *</label>
                  <Input
                    type="date"
                    required
                    value={allocStartDate}
                    onChange={(e) => setAllocStartDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-(--ink-2)">End Date *</label>
                  <Input
                    type="date"
                    required
                    value={allocEndDate}
                    onChange={(e) => setAllocEndDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-(--ink-2)">Security Deposit (₹)</label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="e.g. 500"
                    value={allocDepositRupees}
                    onChange={(e) => setAllocDepositRupees(e.target.value ? Number(e.target.value) : '')}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-(--ink-2)">Rental Fee (₹)</label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="e.g. 300"
                    value={allocRentRupees}
                    onChange={(e) => setAllocRentRupees(e.target.value ? Number(e.target.value) : '')}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-(--border)">
                <Button type="button" variant="outline" onClick={() => setAllocatingLocker(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={allocateMutation.isPending}>
                  {allocateMutation.isPending ? 'Assigning...' : 'Confirm Allocation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD LOCKER UNIT MODAL */}
      {isAddLockerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-(--surface) border border-(--border) rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-semibold text-(--ink)">Add Locker Unit</h3>
            <form onSubmit={handleCreateLocker} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-(--ink-2)">Locker Number / ID *</label>
                <Input
                  required
                  placeholder="e.g. L-101, B-12"
                  value={newLockerNumber}
                  onChange={(e) => setNewLockerNumber(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-(--ink-2)">Locker Room / Zone</label>
                <select
                  value={newLockerZone}
                  onChange={(e) => setNewLockerZone(e.target.value)}
                  className="w-full mt-1 p-2 rounded-lg border border-(--border) bg-(--bg) text-sm text-(--ink) focus:outline-hidden"
                >
                  <option value="Men's Locker Room">Men's Locker Room</option>
                  <option value="Women's Locker Room">Women's Locker Room</option>
                  <option value="VIP Suite">VIP Suite</option>
                  <option value="Main Floor">Main Floor</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-(--border)">
                <Button type="button" variant="outline" onClick={() => setIsAddLockerOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createLockerMutation.isPending}>
                  {createLockerMutation.isPending ? 'Saving...' : 'Add Locker'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
