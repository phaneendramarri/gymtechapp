import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  CalendarDays,
  MapPin,
  Search,
  ChevronRight,
  UserPlus,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import type { ClassItem, ClassSchedule, ClassBooking } from '@gymtech/shared';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const ClassesPage: React.FC = () => {
  const { gym } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const [isNewClassModalOpen, setIsNewClassModalOpen] = useState(false);
  const [isNewScheduleModalOpen, setIsNewScheduleModalOpen] = useState(false);
  const [selectedScheduleForBooking, setSelectedScheduleForBooking] = useState<ClassSchedule | null>(null);

  // Form states
  const [newClassName, setNewClassName] = useState('');
  const [newClassDescription, setNewClassDescription] = useState('');
  const [newClassDuration, setNewClassDuration] = useState(45);
  const [newClassCapacity, setNewClassCapacity] = useState(20);
  const [newClassColor, setNewClassColor] = useState('#6366f1');

  // Schedule slot form
  const [scheduleClassId, setScheduleClassId] = useState<number | ''>('');
  const [scheduleDay, setScheduleDay] = useState<number>(selectedDay);
  const [scheduleStartTime, setScheduleStartTime] = useState('07:00');
  const [scheduleEndTime, setScheduleEndTime] = useState('07:45');
  const [scheduleRoom, setScheduleRoom] = useState('Studio A');
  const [scheduleCapacity, setScheduleCapacity] = useState(20);

  // Booking form
  const [bookingMemberCode, setBookingMemberCode] = useState('');
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().slice(0, 10));

  // Queries
  const { data: classesData, isLoading: loadingClasses } = useQuery({
    queryKey: ['classes', gym?.id],
    queryFn: () => api.getClasses(gym?.id),
  });

  const { data: schedulesData, isLoading: loadingSchedules } = useQuery({
    queryKey: ['classSchedules', gym?.id, selectedDay],
    queryFn: () => api.getClassSchedules({ dayOfWeek: selectedDay, gymId: gym?.id }),
  });

  const { data: scheduleBookingsData, refetch: refetchBookings } = useQuery({
    queryKey: ['classBookings', selectedScheduleForBooking?.id, bookingDate],
    queryFn: () =>
      selectedScheduleForBooking
        ? api.getClassBookings(selectedScheduleForBooking.id, bookingDate, gym?.id)
        : Promise.resolve({ bookings: [] }),
    enabled: Boolean(selectedScheduleForBooking),
  });

  // Mutations
  const createClassMutation = useMutation({
    mutationFn: (data: any) => api.createClass(data, gym?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classes'] });
      setIsNewClassModalOpen(false);
      setNewClassName('');
      setNewClassDescription('');
      toast('success', 'Class created successfully');
    },
    onError: (err: any) => toast('error', err.message || 'Failed to create class'),
  });

  const createScheduleMutation = useMutation({
    mutationFn: (data: any) => api.createClassSchedule(data, gym?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classSchedules'] });
      setIsNewScheduleModalOpen(false);
      toast('success', 'Schedule slot added');
    },
    onError: (err: any) => toast('error', err.message || 'Failed to add schedule'),
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (id: number) => api.deleteClassSchedule(id, gym?.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classSchedules'] });
      toast('success', 'Schedule removed');
    },
    onError: (err: any) => toast('error', err.message || 'Failed to delete schedule'),
  });

  const bookMemberMutation = useMutation({
    mutationFn: (data: any) => api.bookClass(data, gym?.id),
    onSuccess: (res) => {
      refetchBookings();
      qc.invalidateQueries({ queryKey: ['classSchedules'] });
      setBookingMemberCode('');
      toast('success', res.bookingStatus === 'WAITLIST' ? 'Added to waitlist' : 'Member booked!');
    },
    onError: (err: any) => toast('error', err.message || 'Booking failed'),
  });

  const cancelBookingMutation = useMutation({
    mutationFn: (bookingId: number) => api.cancelClassBooking(bookingId, gym?.id),
    onSuccess: () => {
      refetchBookings();
      toast('success', 'Booking cancelled');
    },
    onError: (err: any) => toast('error', err.message || 'Failed to cancel'),
  });

  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    createClassMutation.mutate({
      name: newClassName.trim(),
      description: newClassDescription.trim() || undefined,
      durationMinutes: newClassDuration,
      capacity: newClassCapacity,
      color: newClassColor,
    });
  };

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleClassId) return;
    createScheduleMutation.mutate({
      classId: Number(scheduleClassId),
      dayOfWeek: scheduleDay,
      startTime: scheduleStartTime,
      endTime: scheduleEndTime,
      room: scheduleRoom || undefined,
      maxCapacity: scheduleCapacity,
    });
  };

  const handleBookMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScheduleForBooking || !bookingMemberCode.trim()) return;

    try {
      const { member: foundMember } = await api.lookupMember(bookingMemberCode.trim(), gym?.id);
      bookMemberMutation.mutate({
        scheduleId: selectedScheduleForBooking.id,
        memberId: foundMember.id,
        bookingDate,
      });
    } catch {
      toast('error', 'Member not found with code: ' + bookingMemberCode);
    }
  };

  const classes = classesData?.classes || [];
  const schedules = schedulesData?.schedules || [];
  const bookings = scheduleBookingsData?.bookings || [];

  return (
    <AppShell
      breadcrumb={[{ label: 'Gym Console', href: '/dashboard' }, { label: 'Classes' }]}
      title="Class Schedules & Timetable"
      description="Manage group classes, weekly timetable slots, member bookings, and waitlists."
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsNewClassModalOpen(true)}
            className="h-8 gap-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Class Type
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setScheduleDay(selectedDay);
              setIsNewScheduleModalOpen(true);
            }}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <Calendar className="w-3.5 h-3.5" />
            Add Timetable Slot
          </Button>
        </div>
      }
    >
      <div className="space-y-6">

      {/* Weekday Switcher Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-(--border)">
        {DAYS.map((dayName, idx) => {
          const isSelected = selectedDay === idx;
          const isToday = new Date().getDay() === idx;
          return (
            <button
              key={dayName}
              onClick={() => setSelectedDay(idx)}
              className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
                isSelected
                  ? 'bg-(--iron) text-(--white)'
                  : 'bg-(--surface) text-(--ink-2) hover:text-(--ink) hover:bg-(--surface-hover)'
              }`}
            >
              <span>{dayName}</span>
              {isToday && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-(--border) text-(--ink-3)'
                  }`}
                >
                  Today
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Grid: Timetable Slots & Classes Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Timetable for selected day */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-(--ink)">
              {DAYS[selectedDay]} Schedule ({schedules.length} slots)
            </h2>
            <div className="flex items-center gap-2 text-xs text-(--ink-3)">
              <Clock className="w-3.5 h-3.5" />
              <span>Times in 24h format</span>
            </div>
          </div>

          {loadingSchedules ? (
            <div className="p-12 text-center text-(--ink-3) bg-(--surface) rounded-xl border border-(--border)">
              Loading schedule slots...
            </div>
          ) : schedules.length === 0 ? (
            <div className="p-12 text-center bg-(--surface) rounded-xl border border-dashed border-(--border) space-y-3">
              <CalendarDays className="w-10 h-10 mx-auto text-(--ink-4)" />
              <p className="text-sm text-(--ink-2) font-medium">No classes scheduled for {DAYS[selectedDay]}</p>
              <p className="text-xs text-(--ink-3)">
                Add a class slot to this day so members can book it.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setScheduleDay(selectedDay);
                  setIsNewScheduleModalOpen(true);
                }}
              >
                Add Slot to {DAYS[selectedDay]}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {schedules.map((slot: any) => {
                const color = slot.classColor || '#6366f1';
                return (
                  <div
                    key={slot.id}
                    className="p-4 rounded-xl border border-(--border) bg-(--surface) hover:border-(--iron) transition-shadow shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <h3 className="font-semibold text-sm text-(--ink)">{slot.className}</h3>
                        </div>
                        <button
                          onClick={() => deleteScheduleMutation.mutate(slot.id)}
                          className="text-(--ink-4) hover:text-red-500 transition-colors p-1"
                          title="Remove Slot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-(--ink-2)">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-(--ink-3)" />
                          <span>
                            {slot.startTime} – {slot.endTime} ({slot.durationMinutes || 45} mins)
                          </span>
                        </div>
                        {slot.room && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-(--ink-3)" />
                            <span>{slot.room}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-(--ink-3)" />
                          <span>Capacity: max {slot.maxCapacity} members</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-(--border) flex items-center justify-between">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedScheduleForBooking(slot)}
                        className="text-xs text-(--iron) hover:text-(--iron-hover) px-2 flex items-center gap-1"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Bookings & Roster
                      </Button>
                      <Badge variant="outline" className="text-[11px]">
                        Active
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 1 Col: Registered Class Categories */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-(--ink)">Class Types ({classes.length})</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsNewClassModalOpen(true)}
              className="text-xs text-(--iron)"
            >
              + Add Type
            </Button>
          </div>

          <div className="space-y-3">
            {loadingClasses ? (
              <div className="p-6 text-center text-xs text-(--ink-3) bg-(--surface) rounded-xl border border-(--border)">
                Loading classes...
              </div>
            ) : classes.length === 0 ? (
              <div className="p-6 text-center bg-(--surface) rounded-xl border border-(--border) text-xs text-(--ink-3)">
                No class types registered yet (e.g. HIIT, Yoga, Spinning, Zumba).
              </div>
            ) : (
              classes.map((cls) => (
                <div
                  key={cls.id}
                  className="p-3.5 rounded-xl border border-(--border) bg-(--surface) flex items-start gap-3"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full mt-0.5 shrink-0"
                    style={{ backgroundColor: cls.color || '#6366f1' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-(--ink) truncate">{cls.name}</h4>
                      <span className="text-[11px] text-(--ink-3)">{cls.durationMinutes}m</span>
                    </div>
                    {cls.description && (
                      <p className="text-xs text-(--ink-3) line-clamp-2 mt-0.5">{cls.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-(--ink-3)">
                      <span>Max {cls.capacity} spots</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: Create New Class Type */}
      {isNewClassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-(--surface) border border-(--border) rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-semibold text-(--ink)">Create Class Type</h3>
            <form onSubmit={handleCreateClass} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-(--ink-2)">Class Name *</label>
                <Input
                  required
                  placeholder="e.g. Power Yoga, Morning HIIT, Spin"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-(--ink-2)">Description</label>
                <textarea
                  className="w-full mt-1 p-2 rounded-lg border border-(--border) bg-(--bg) text-sm text-(--ink) focus:outline-hidden focus:ring-1 focus:ring-(--iron)"
                  rows={2}
                  placeholder="Brief class description or target fitness level..."
                  value={newClassDescription}
                  onChange={(e) => setNewClassDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-(--ink-2)">Duration (minutes)</label>
                  <Input
                    type="number"
                    min={15}
                    max={180}
                    value={newClassDuration}
                    onChange={(e) => setNewClassDuration(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-(--ink-2)">Default Capacity</label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={newClassCapacity}
                    onChange={(e) => setNewClassCapacity(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-(--ink-2)">Badge Color</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={newClassColor}
                    onChange={(e) => setNewClassColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                  />
                  <span className="text-xs text-(--ink-3)">{newClassColor}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-(--border)">
                <Button type="button" variant="outline" onClick={() => setIsNewClassModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createClassMutation.isPending}>
                  {createClassMutation.isPending ? 'Saving...' : 'Create Class'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Timetable Slot */}
      {isNewScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-(--surface) border border-(--border) rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-semibold text-(--ink)">Add Timetable Slot</h3>
            <form onSubmit={handleCreateSchedule} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-(--ink-2)">Select Class *</label>
                <select
                  required
                  value={scheduleClassId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setScheduleClassId(id);
                    const found = classes.find((c) => c.id === id);
                    if (found) setScheduleCapacity(found.maxCapacity ?? 20);
                  }}
                  className="w-full mt-1 p-2 rounded-lg border border-(--border) bg-(--bg) text-sm text-(--ink) focus:outline-hidden"
                >
                  <option value="">-- Choose Class --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.durationMinutes}m)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-(--ink-2)">Day of Week *</label>
                <select
                  value={scheduleDay}
                  onChange={(e) => setScheduleDay(Number(e.target.value))}
                  className="w-full mt-1 p-2 rounded-lg border border-(--border) bg-(--bg) text-sm text-(--ink) focus:outline-hidden"
                >
                  {DAYS.map((name, idx) => (
                    <option key={name} value={idx}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-(--ink-2)">Start Time (24h) *</label>
                  <Input
                    type="time"
                    required
                    value={scheduleStartTime}
                    onChange={(e) => setScheduleStartTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-(--ink-2)">End Time (24h) *</label>
                  <Input
                    type="time"
                    required
                    value={scheduleEndTime}
                    onChange={(e) => setScheduleEndTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-(--ink-2)">Room / Studio</label>
                  <Input
                    placeholder="Studio A, Main Hall..."
                    value={scheduleRoom}
                    onChange={(e) => setScheduleRoom(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-(--ink-2)">Max Capacity</label>
                  <Input
                    type="number"
                    min={1}
                    value={scheduleCapacity}
                    onChange={(e) => setScheduleCapacity(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-(--border)">
                <Button type="button" variant="outline" onClick={() => setIsNewScheduleModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createScheduleMutation.isPending || !scheduleClassId}>
                  {createScheduleMutation.isPending ? 'Saving...' : 'Add Slot'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Slot Bookings Roster & Manual Booking */}
      {selectedScheduleForBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-(--surface) border border-(--border) rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-(--ink)">
                  {selectedScheduleForBooking.className} Roster
                </h3>
                <p className="text-xs text-(--ink-3)">
                  {DAYS[selectedScheduleForBooking.dayOfWeek]} {selectedScheduleForBooking.startTime} –{' '}
                  {selectedScheduleForBooking.endTime} ({selectedScheduleForBooking.room || 'General'})
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedScheduleForBooking(null)}
                className="text-xs"
              >
                Close
              </Button>
            </div>

            {/* Quick Member Booking Form */}
            <form onSubmit={handleBookMember} className="p-3 bg-(--bg) rounded-lg border border-(--border) space-y-2">
              <label className="text-xs font-medium text-(--ink)">Book Member into Slot</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter Member Code (e.g. M-1001)..."
                  value={bookingMemberCode}
                  onChange={(e) => setBookingMemberCode(e.target.value)}
                  className="text-xs"
                  required
                />
                <Button type="submit" size="sm" disabled={bookMemberMutation.isPending}>
                  {bookMemberMutation.isPending ? 'Booking...' : 'Book Spot'}
                </Button>
              </div>
            </form>

            {/* Booked Members List */}
            <div className="flex-1 overflow-y-auto space-y-2 min-h-[160px]">
              <div className="text-xs font-medium text-(--ink-3) flex items-center justify-between">
                <span>Enrolled Members ({bookings.length} / {selectedScheduleForBooking.maxCapacity})</span>
                <span>Status</span>
              </div>

              {bookings.length === 0 ? (
                <div className="p-8 text-center text-xs text-(--ink-3)">
                  No bookings yet for this date.
                </div>
              ) : (
                bookings.map((b: any) => (
                  <div
                    key={b.id}
                    className="p-2.5 rounded-lg border border-(--border) bg-(--surface) flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-medium text-(--ink)">{b.memberName || 'Member'}</div>
                      <div className="text-[11px] text-(--ink-3)">{b.memberCode}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={b.status === 'BOOKED' ? 'default' : 'outline'}
                        className="text-[10px]"
                      >
                        {b.status}
                      </Badge>
                      <button
                        onClick={() => cancelBookingMutation.mutate(b.id)}
                        className="text-(--ink-4) hover:text-red-500 p-1"
                        title="Cancel Booking"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </AppShell>
  );
};
