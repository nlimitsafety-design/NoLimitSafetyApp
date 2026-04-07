'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useShifts, useFuncties, useOpdrachtgevers, fetcher } from '@/lib/swr';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import {
  formatDate,
  getWeekDays,
  calculateHours,
  SHIFT_STATUSES,
  TIME_SLOTS,
} from '@/lib/utils';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  ListBulletIcon,
  CheckCircleIcon,
  XCircleIcon,
  MinusCircleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { addWeeks, subWeeks, addMonths, subMonths, format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { nl } from 'date-fns/locale';
import toast from 'react-hot-toast';
import ShiftRequestModal from '@/components/ShiftRequestModal';

type EmployeeStatusType = 'INGEVULD' | 'NIET_INGEVULD' | 'NIET_BESCHIKBAAR';
type StatusFilter = 'ALL' | 'INGEVULD' | 'NIET_INGEVULD' | 'NIET_BESCHIKBAAR';

interface EmployeeStatus {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  status: EmployeeStatusType;
  reason: string;
}

interface Shift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  type: string;
  note: string | null;
  status: string;
  shiftUsers: { id: string; userId: string; user: { id: string; name: string; email: string } }[];
  _count?: { shiftRequests: number };
  opdrachtgeverId: string | null;
  opdrachtgever?: { id: string; name: string } | null;
}

export default function PlanningPage() {
  const { data: session } = useSession();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'month'>('week');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [employeeStatuses, setEmployeeStatuses] = useState<EmployeeStatus[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [opdrachtgeverFilter, setOpdrachtgeverFilter] = useState<string>('ALL');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ empId: string; empName: string; status: EmployeeStatusType; reason: string } | null>(null);
  const [requestModalShift, setRequestModalShift] = useState<Shift | null>(null);

  const isAdmin = session?.user?.role === 'ADMIN';
  const userId = (session?.user as any)?.id;

  // Compute date range based on view
  const { start, end } = useMemo(() => {
    if (view === 'week') {
      const days = getWeekDays(currentDate);
      return { start: format(days[0], 'yyyy-MM-dd'), end: format(days[6], 'yyyy-MM-dd') };
    }
    return { start: format(startOfMonth(currentDate), 'yyyy-MM-dd'), end: format(endOfMonth(currentDate), 'yyyy-MM-dd') };
  }, [currentDate, view]);

  // SWR - cached & deduplicated
  const { data: rawShifts = [], mutate: mutateShifts } = useShifts(start, end);
  const shifts = rawShifts as Shift[];
  const { data: functies = [] } = useFuncties();
  const { data: opdrachtgevers = [] } = useOpdrachtgevers();

  // Form state
  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '08:00',
    endTime: '17:00',
    location: '',
    type: '',
    note: '',
    status: 'CONCEPT',
    employeeIds: [] as string[],
    opdrachtgeverId: null as string | null,
  });
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatUntil, setRepeatUntil] = useState('');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  function openCreateShift(dateStr?: string) {
    setSelectedShift(null);
    setRepeatEnabled(false);
    setRepeatUntil('');
    setRepeatDays([]);
    setForm({
      date: dateStr || format(new Date(), 'yyyy-MM-dd'),
      startTime: '08:00',
      endTime: '17:00',
      location: '',
      type: functies[0]?.name || 'TOEZICHT',
      note: '',
      status: 'CONCEPT',
      employeeIds: [],
      opdrachtgeverId: null,
    });
    setModalOpen(true);
  }

  function openEditShift(shift: Shift) {
    setSelectedShift(shift);
    setForm({
      date: format(new Date(shift.date), 'yyyy-MM-dd'),
      startTime: shift.startTime,
      endTime: shift.endTime,
      location: shift.location,
      type: shift.type,
      note: shift.note || '',
      status: shift.status,
      employeeIds: shift.shiftUsers.map((su) => su.userId),
      opdrachtgeverId: (shift as any).opdrachtgeverId || null,
    });
    setModalOpen(true);
  }

  // Debounced employee status fetch
  const statusTimer = useRef<NodeJS.Timeout | null>(null);
  const fetchEmployeeStatuses = useCallback(() => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(async () => {
      if (!form.date || !form.startTime || !form.endTime || !isAdmin) {
        setEmployeeStatuses([]);
        return;
      }
      setLoadingStatuses(true);
      try {
        const params = new URLSearchParams({
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          ...(selectedShift ? { shiftId: selectedShift.id } : {}),
        });
        const data = await fetcher(`/api/employee-status?${params}`);
        setEmployeeStatuses(data);
      } catch {
        setEmployeeStatuses([]);
      } finally {
        setLoadingStatuses(false);
      }
    }, 300);
  }, [form.date, form.startTime, form.endTime, selectedShift, isAdmin]);

  useEffect(() => {
    if (modalOpen) fetchEmployeeStatuses();
    return () => { if (statusTimer.current) clearTimeout(statusTimer.current); };
  }, [form.date, form.startTime, form.endTime, modalOpen, fetchEmployeeStatuses]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);

    try {
      const url = selectedShift ? `/api/shifts/${selectedShift.id}` : '/api/shifts';
      const method = selectedShift ? 'PUT' : 'POST';

      const payload = !selectedShift && repeatEnabled && repeatUntil && repeatDays.length > 0
        ? { ...form, repeatUntil, repeatDays }
        : form;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Fout bij opslaan');
        return;
      }

      const bulkCount = !selectedShift && repeatEnabled ? 'Diensten aangemaakt' : undefined;
      toast.success(selectedShift ? 'Dienst bijgewerkt' : (bulkCount || 'Dienst aangemaakt'));
      setModalOpen(false);
      mutateShifts();
    } catch {
      toast.error('Fout bij opslaan');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedShift || !confirm('Weet je zeker dat je deze dienst wilt verwijderen?')) return;
    try {
      const res = await fetch(`/api/shifts/${selectedShift.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Dienst verwijderd');
        setModalOpen(false);
        mutateShifts();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Kon dienst niet verwijderen');
      }
    } catch {
      toast.error('Fout bij verwijderen');
    }
  }

  function toggleEmployee(empId: string) {
    const alreadySelected = form.employeeIds.includes(empId);
    if (alreadySelected) {
      // Deselect - always allowed
      setForm(prev => ({ ...prev, employeeIds: prev.employeeIds.filter(id => id !== empId) }));
      return;
    }

    // Selecting - check status
    const empStatus = employeeStatuses.find(s => s.employeeId === empId);
    if (empStatus && empStatus.status !== 'INGEVULD') {
      // Show confirmation modal
      setConfirmModal({
        empId,
        empName: empStatus.employeeName,
        status: empStatus.status,
        reason: empStatus.reason,
      });
      return;
    }

    setForm(prev => ({ ...prev, employeeIds: [...prev.employeeIds, empId] }));
  }

  function confirmOverrideSelection() {
    if (!confirmModal) return;
    setForm(prev => ({ ...prev, employeeIds: [...prev.employeeIds, confirmModal.empId] }));
    toast(`Override: ${confirmModal.empName} toegevoegd (${confirmModal.status === 'NIET_INGEVULD' ? 'niet ingevuld' : 'niet beschikbaar'})`, { icon: '\u26A0\uFE0F' });
    setConfirmModal(null);
  }

  // Filtered & searched employee statuses
  const filteredEmployeeStatuses = useMemo(() => {
    let list = employeeStatuses;
    if (statusFilter !== 'ALL') {
      list = list.filter(e => e.status === statusFilter);
    }
    if (employeeSearch.trim()) {
      const q = employeeSearch.toLowerCase();
      list = list.filter(e => e.employeeName.toLowerCase().includes(q) || e.employeeEmail.toLowerCase().includes(q));
    }
    return list;
  }, [employeeStatuses, statusFilter, employeeSearch]);

  // Status counts for filter badges
  const statusCounts = useMemo(() => {
    const counts = { ALL: employeeStatuses.length, INGEVULD: 0, NIET_INGEVULD: 0, NIET_BESCHIKBAAR: 0 };
    for (const e of employeeStatuses) {
      counts[e.status]++;
    }
    return counts;
  }, [employeeStatuses]);

  const statusBadge = (status: string, requestCount?: number) => {
    switch (status) {
      case 'CONCEPT': return <Badge variant="warning">Concept</Badge>;
      case 'OPEN': return (
        <span className="inline-flex items-center gap-1">
          <Badge variant="info" className="!bg-purple-500/20 !text-purple-400 !border-purple-500/30">Open</Badge>
          {requestCount !== undefined && requestCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-purple-500 text-gray-900 rounded-full">{requestCount}</span>
          )}
        </span>
      );
      case 'TOEGEWEZEN': return <Badge variant="info" className="!bg-cyan-500/20 !text-cyan-400 !border-cyan-500/30">Toegewezen</Badge>;
      case 'BEVESTIGD': return <Badge variant="success">Bevestigd</Badge>;
      case 'AFGEROND': return <Badge variant="info">Afgerond</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const typeBadge = (type: string) => {
    const f = functies.find((ft: any) => ft.name === type);
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
        style={f ? { backgroundColor: f.color + '33', color: f.color, border: `1px solid ${f.color}55` } : {}}
      >
        {type}
      </span>
    );
  };

  // Filter shifts for employees (non-admin only see their own assigned shifts, not OPEN)
  const baseShifts = isAdmin
    ? shifts
    : shifts.filter((s) => s.status !== 'OPEN' && s.shiftUsers.some((su) => su.userId === userId));

  const visibleShifts = opdrachtgeverFilter === 'ALL'
    ? baseShifts
    : baseShifts.filter((s) => s.opdrachtgeverId === opdrachtgeverFilter);

  const getVisibleShiftsForDay = (day: Date) => {
    return visibleShifts.filter((s) => isSameDay(new Date(s.date), day));
  };

  // Week view
  const weekDays = getWeekDays(currentDate);

  // Month view
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);
  const paddingDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  return (
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="page-title">{isAdmin ? 'Planning' : 'Mijn Rooster'}</h1>
            <p className="page-subtitle">
              {isAdmin
                ? `${view === 'week' ? 'Weekoverzicht' : 'Maandoverzicht'} van alle diensten`
                : `${view === 'week' ? 'Weekoverzicht' : 'Maandoverzicht'} van jouw diensten`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setView('week')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === 'week' ? 'bg-brand-500 text-gray-900' : 'text-gray-400 hover:text-gray-900'
                }`}
              >
                <CalendarIcon className="h-4 w-4 inline mr-1" />
                Week
              </button>
              <button
                onClick={() => setView('month')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === 'month' ? 'bg-brand-500 text-gray-900' : 'text-gray-400 hover:text-gray-900'
                }`}
              >
                <ListBulletIcon className="h-4 w-4 inline mr-1" />
                Maand
              </button>
            </div>
            {isAdmin && (
              <Button onClick={() => openCreateShift()}>
                <PlusIcon className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Nieuwe dienst</span>
              </Button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <Card className="mb-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() =>
                view === 'week'
                  ? setCurrentDate(subWeeks(currentDate, 1))
                  : setCurrentDate(subMonths(currentDate, 1))
              }
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">
              {view === 'week'
                ? `Week ${format(weekDays[0], 'w')} - ${format(weekDays[0], 'd MMM', { locale: nl })} t/m ${format(weekDays[6], 'd MMM yyyy', { locale: nl })}`
                : format(currentDate, 'MMMM yyyy', { locale: nl })}
            </h2>
            <button
              onClick={() =>
                view === 'week'
                  ? setCurrentDate(addWeeks(currentDate, 1))
                  : setCurrentDate(addMonths(currentDate, 1))
              }
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </Card>

        {/* Opdrachtgever filter */}
        {opdrachtgevers.length > 0 && (
          <div className="mb-4 flex items-center gap-2">
            <FunnelIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <select
              value={opdrachtgeverFilter}
              onChange={(e) => setOpdrachtgeverFilter(e.target.value)}
              className="text-sm rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="ALL">Alle opdrachtgevers</option>
              {opdrachtgevers.map((og: any) => (
                <option key={og.id} value={og.id}>{og.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Week View */}
        {view === 'week' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {weekDays.map((day) => {
              const dayShifts = getVisibleShiftsForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <Card
                  key={day.toISOString()}
                  className={`min-h-[140px] ${isToday ? 'border-brand-500/50 ring-1 ring-brand-500/20' : ''}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className={`text-xs font-medium uppercase tracking-wider ${isToday ? 'text-brand-500' : 'text-gray-500'}`}>
                        {format(day, 'EEE', { locale: nl })}
                      </p>
                      <p className={`text-lg font-bold ${isToday ? 'text-brand-500' : 'text-gray-900'}`}>
                        {format(day, 'd')}
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => openCreateShift(format(day, 'yyyy-MM-dd'))}
                        className="p-2 rounded text-gray-500 hover:text-brand-500 hover:bg-brand-500/10 active:bg-brand-500/20 transition-colors"
                      >
                        <PlusIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  {dayShifts.length > 0 ? (
                    <div className="space-y-2">
                      {dayShifts.map((shift) => (
                        <div
                          key={shift.id}
                          onClick={() => isAdmin ? openEditShift(shift) : (() => { setSelectedShift(shift); setDetailModalOpen(true); })()}
                          className={`p-2 rounded-lg text-xs border-l-2 ${
                            shift.status === 'OPEN'
                              ? 'border-l-purple-500 bg-purple-500/5'
                              : shift.status === 'TOEGEWEZEN'
                              ? 'border-l-cyan-500 bg-cyan-500/5'
                              : shift.status === 'BEVESTIGD'
                              ? 'border-l-green-500 bg-green-500/5'
                              : shift.status === 'AFGEROND'
                              ? 'border-l-blue-500 bg-blue-500/5'
                              : 'border-l-yellow-500 bg-yellow-500/5'
                          } cursor-pointer hover:bg-gray-50 transition-colors`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-medium text-gray-900 truncate">{shift.location}</p>
                            {shift.status === 'OPEN' && shift._count && shift._count.shiftRequests > 0 && (
                              <span className="flex-shrink-0 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-purple-500 text-gray-900 rounded-full">{shift._count.shiftRequests}</span>
                            )}
                          </div>
                          <p className="text-gray-400 mt-0.5">{shift.startTime} - {shift.endTime}</p>
                          {shift.opdrachtgever && (
                            <p className="text-[10px] text-brand-400 font-medium truncate mt-0.5">{shift.opdrachtgever.name}</p>
                          )}
                          {shift.status === 'OPEN' ? (
                            <p className="text-purple-400 mt-0.5 font-medium">Open dienst</p>
                          ) : (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {shift.shiftUsers.slice(0, 2).map((su) => (
                                <span key={su.id} className="text-gray-500">{su.user.name.split(' ')[0]}</span>
                              ))}
                              {shift.shiftUsers.length > 2 && (
                                <span className="text-gray-600">+{shift.shiftUsers.length - 2}</span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-700 italic">Geen diensten</p>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Month View */}
        {view === 'month' && (
          <Card padding={false}>
            {/* Desktop: calendar grid */}
            <div className="hidden sm:block">
              <div className="grid grid-cols-7 border-b border-gray-200">
                {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((d) => (
                  <div key={d} className="p-2 text-center text-xs font-medium text-gray-500 uppercase">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {/* Padding for days before month start */}
                {Array.from({ length: paddingDays }).map((_, i) => (
                  <div key={`pad-${i}`} className="p-2 min-h-[80px] border-b border-r border-gray-100" />
                ))}
                {monthDays.map((day) => {
                  const dayShifts = getVisibleShiftsForDay(day);
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => isAdmin && dayShifts.length === 0 ? openCreateShift(format(day, 'yyyy-MM-dd')) : undefined}
                      className={`p-2 min-h-[80px] border-b border-r border-gray-100 ${
                        isToday ? 'bg-brand-500/5' : ''
                      } ${isAdmin && dayShifts.length === 0 ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                    >
                      <p className={`text-sm font-medium ${isToday ? 'text-brand-500' : 'text-gray-400'}`}>
                        {format(day, 'd')}
                      </p>
                      <div className="mt-1 space-y-1">
                        {dayShifts.slice(0, 2).map((shift) => (
                          <div
                            key={shift.id}
                            onClick={(e) => { e.stopPropagation(); if (isAdmin) { openEditShift(shift); } else { setSelectedShift(shift); setDetailModalOpen(true); } }}
                            className={`px-1.5 py-0.5 rounded text-[10px] truncate cursor-pointer ${
                              shift.status === 'OPEN'
                                ? 'bg-purple-500/20 text-purple-400'
                                : shift.status === 'TOEGEWEZEN'
                                ? 'bg-cyan-500/20 text-cyan-400'
                                : shift.status === 'BEVESTIGD'
                                ? 'bg-green-500/20 text-green-400'
                                : shift.status === 'AFGEROND'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}
                          >
                            {shift.opdrachtgever ? shift.opdrachtgever.name : shift.location} {shift.startTime}
                          </div>
                        ))}
                        {dayShifts.length > 2 && (
                          <p className="text-[10px] text-gray-500">+{dayShifts.length - 2} meer</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile: vertical list of days */}
            <div className="sm:hidden divide-y divide-gray-100">
              {monthDays.map((day) => {
                const dayShifts = getVisibleShiftsForDay(day);
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={day.toISOString()}
                    className={`p-3 ${isToday ? 'bg-brand-500/5' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium uppercase ${isToday ? 'text-brand-500' : 'text-gray-500'}`}>
                          {format(day, 'EEE', { locale: nl })}
                        </span>
                        <span className={`text-sm font-bold ${isToday ? 'text-brand-500' : 'text-gray-900'}`}>
                          {format(day, 'd MMM', { locale: nl })}
                        </span>
                        {dayShifts.length === 0 && (
                          <span className="text-xs text-gray-400 italic">Geen diensten</span>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => openCreateShift(format(day, 'yyyy-MM-dd'))}
                          className="p-2 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-brand-500/10 transition-colors"
                        >
                          <PlusIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                    {dayShifts.length > 0 && (
                      <div className="space-y-2 pl-1">
                        {dayShifts.map((shift) => (
                          <div
                            key={shift.id}
                            onClick={() => isAdmin ? openEditShift(shift) : (() => { setSelectedShift(shift); setDetailModalOpen(true); })()}
                            className={`p-2.5 rounded-lg text-sm border-l-2 cursor-pointer active:bg-gray-100 transition-colors ${
                              shift.status === 'OPEN'
                                ? 'border-l-purple-500 bg-purple-500/5'
                                : shift.status === 'TOEGEWEZEN'
                                ? 'border-l-cyan-500 bg-cyan-500/5'
                                : shift.status === 'BEVESTIGD'
                                ? 'border-l-green-500 bg-green-500/5'
                                : shift.status === 'AFGEROND'
                                ? 'border-l-blue-500 bg-blue-500/5'
                                : 'border-l-yellow-500 bg-yellow-500/5'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-gray-900">{shift.location}</p>
                              <p className="text-gray-500">{shift.startTime} - {shift.endTime}</p>
                            </div>
                            {shift.status === 'OPEN' ? (
                              <p className="text-purple-400 text-xs mt-1 font-medium">Open dienst</p>
                            ) : (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {shift.shiftUsers.map((su) => (
                                  <span key={su.id} className="text-xs text-gray-500">{su.user.name.split(' ')[0]}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Shift Detail Modal (Employee read-only) */}
        {!isAdmin && selectedShift && (
          <Modal
            isOpen={detailModalOpen}
            onClose={() => setDetailModalOpen(false)}
            title="Dienstdetails"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Datum</p>
                  <p className="text-sm text-gray-900">{formatDate(selectedShift.date, 'EEEE d MMMM yyyy')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Locatie</p>
                  <p className="text-sm text-gray-900">{selectedShift.location}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Tijd</p>
                  <p className="text-sm text-gray-900">{selectedShift.startTime} - {selectedShift.endTime}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Uren</p>
                  <p className="text-sm text-gray-900">{calculateHours(selectedShift.startTime, selectedShift.endTime)} uur</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Type</p>
                  {typeBadge(selectedShift.type)}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  {statusBadge(selectedShift.status)}
                </div>
              </div>
              {selectedShift.note && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Opmerkingen</p>
                  <p className="text-sm text-gray-600">{selectedShift.note}</p>
                </div>
              )}
              {selectedShift.shiftUsers.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Collega&apos;s op deze dienst</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedShift.shiftUsers.map((su) => (
                      <span key={su.id} className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                        {su.user.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <Button variant="ghost" onClick={() => setDetailModalOpen(false)}>Sluiten</Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Shift Create/Edit Modal */}
        {isAdmin && (
          <Modal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            title={selectedShift ? 'Dienst Bewerken' : 'Nieuwe Dienst'}
            size="lg"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Datum"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
                <Input
                  label="Locatie"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Bijv. Shell Pernis"
                  required
                />
                <Select
                  label="Starttijd"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  options={TIME_SLOTS.map(t => ({ value: t, label: t }))}
                />
                <Select
                  label="Eindtijd"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  options={TIME_SLOTS.map(t => ({ value: t, label: t }))}
                />
                <Select
                  label="Functie"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  options={functies.map((f: any) => ({ value: f.name, label: f.name }))}
                />
                <Select
                  label="Status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  options={SHIFT_STATUSES.map(s => ({ value: s.value, label: s.label }))}
                />
              </div>

              {/* Opdrachtgever buttons */}
              {opdrachtgevers.length > 0 && (
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-2">Opdrachtgever</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, opdrachtgeverId: null })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        !form.opdrachtgeverId
                          ? 'bg-brand-500 text-gray-900 border-brand-500'
                          : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      Geen
                    </button>
                    {opdrachtgevers.map((og: any) => (
                      <button
                        key={og.id}
                        type="button"
                        onClick={() => setForm({ ...form, opdrachtgeverId: og.id })}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          form.opdrachtgeverId === og.id
                            ? 'bg-brand-500 text-gray-900 border-brand-500'
                            : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        {og.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Textarea
                label="Opmerkingen"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Extra informatie over deze dienst..."
              />

              {/* Bulk planning */}
              {!selectedShift && (
                <div className="border border-gray-700 rounded-lg p-3 space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={repeatEnabled}
                      onChange={(e) => setRepeatEnabled(e.target.checked)}
                      className="rounded border-gray-600 bg-gray-800 text-primary-500 focus:ring-primary-500"
                    />
                    Herhalen (weekplanning)
                  </label>
                  {repeatEnabled && (
                    <>
                      <Input
                        label="Herhalen tot en met"
                        type="date"
                        value={repeatUntil}
                        onChange={(e) => setRepeatUntil(e.target.value)}
                        min={form.date}
                        required={repeatEnabled}
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-300 block mb-1.5">Dagen</span>
                        <div className="flex flex-wrap gap-2">
                          {['Zo','Ma','Di','Wo','Do','Vr','Za'].map((label, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setRepeatDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx])}
                              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                repeatDays.includes(idx)
                                  ? 'bg-primary-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* OPEN shift info or Employee selection */}
              {form.status === 'OPEN' ? (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                  <p className="text-sm text-purple-400 font-medium mb-1">Open dienst</p>
                  <p className="text-xs text-gray-400">
                    Deze dienst wordt gepubliceerd als open dienst. Medewerkers kunnen een aanvraag indienen.
                    Je hoeft geen medewerkers toe te wijzen.
                  </p>
                  {selectedShift && selectedShift.status === 'OPEN' && (
                    <Button
                      type="button"
                      size="sm"
                      className="mt-3"
                      onClick={() => { setModalOpen(false); setRequestModalShift(selectedShift); }}
                    >
                      Aanvragen bekijken
                    </Button>
                  )}
                </div>
              ) : (
              /* Employee selection with 3-status system */
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Medewerkers toewijzen
                </label>

                {/* Status filter tabs */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {([
                    { key: 'ALL' as StatusFilter, label: 'Alle', color: 'bg-gray-200 text-gray-600' },
                    { key: 'INGEVULD' as StatusFilter, label: 'Ingevuld', color: 'bg-green-500/20 text-green-400' },
                    { key: 'NIET_INGEVULD' as StatusFilter, label: 'Niet ingevuld', color: 'bg-gray-500/20 text-gray-400' },
                    { key: 'NIET_BESCHIKBAAR' as StatusFilter, label: 'Niet beschikbaar', color: 'bg-red-500/20 text-red-400' },
                  ]).map(f => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setStatusFilter(f.key)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                        statusFilter === f.key
                          ? `${f.color} ring-1 ring-current`
                          : 'bg-gray-100 text-gray-500 hover:text-gray-600'
                      }`}
                    >
                      {f.label} ({statusCounts[f.key]})
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative mb-3">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Zoek medewerker..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                {/* Employee list */}
                {loadingStatuses ? (
                  <div className="p-4 text-center text-gray-500 text-sm">Statussen laden...</div>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto p-1 bg-gray-50 rounded-lg border border-gray-200">
                    {filteredEmployeeStatuses.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">Geen medewerkers gevonden</p>
                    ) : (
                      filteredEmployeeStatuses.map((emp) => {
                        const isSelected = form.employeeIds.includes(emp.employeeId);
                        const statusConfig = emp.status === 'INGEVULD'
                          ? { icon: CheckCircleIcon, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', badge: 'success' as const, label: 'INGEVULD' }
                          : emp.status === 'NIET_INGEVULD'
                          ? { icon: MinusCircleIcon, color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30', badge: 'default' as const, label: 'NIET INGEVULD' }
                          : { icon: XCircleIcon, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', badge: 'danger' as const, label: 'NIET BESCHIKBAAR' };

                        const StatusIcon = statusConfig.icon;

                        return (
                          <div
                            key={emp.employeeId}
                            className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
                              isSelected
                                ? `${statusConfig.bg} border ${statusConfig.border} ring-1 ring-current/20`
                                : 'hover:bg-gray-100 border border-transparent'
                            }`}
                            onClick={() => toggleEmployee(emp.employeeId)}
                          >
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 rounded border-gray-300 bg-gray-100 text-brand-500 focus:ring-brand-500 flex-shrink-0"
                            />

                            {/* Status icon */}
                            <StatusIcon className={`h-5 w-5 flex-shrink-0 ${statusConfig.color}`} />

                            {/* Employee info - responsive: card on mobile, row on desktop */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-2">
                                <p className="text-sm font-medium text-gray-900 truncate">{emp.employeeName}</p>
                                <Badge variant={statusConfig.badge} size="sm">{statusConfig.label}</Badge>
                              </div>
                              <p className="text-xs text-gray-500 truncate mt-0.5">{emp.reason}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Selected count */}
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-500">
                    {form.employeeIds.length === 0
                      ? 'Selecteer minimaal één medewerker'
                      : `${form.employeeIds.length} medewerker${form.employeeIds.length !== 1 ? 's' : ''} geselecteerd`}
                  </p>
                  {form.employeeIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, employeeIds: [] }))}
                      className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                    >
                      Alles deselecteren
                    </button>
                  )}
                </div>
              </div>
              )}

              <div className="flex justify-between pt-4 border-t border-gray-200">
                <div>
                  {selectedShift && (
                    <Button type="button" variant="danger" onClick={handleDelete}>
                      Verwijderen
                    </Button>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                    Annuleren
                  </Button>
                  <Button type="submit" loading={saving} disabled={form.status !== 'OPEN' && form.employeeIds.length === 0}>
                    {selectedShift ? 'Opslaan' : 'Aanmaken'}
                  </Button>
                </div>
              </div>
            </form>
          </Modal>
        )}

        {/* Override Confirmation Modal */}
        {confirmModal && (
          <Modal
            isOpen={!!confirmModal}
            onClose={() => setConfirmModal(null)}
            title="Bevestig selectie"
            size="sm"
          >
            <div className="space-y-4">
              <div className={`p-3 rounded-lg ${confirmModal.status === 'NIET_INGEVULD' ? 'bg-gray-500/10 border border-gray-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {confirmModal.status === 'NIET_INGEVULD' ? (
                    <MinusCircleIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <XCircleIcon className="h-5 w-5 text-red-400" />
                  )}
                  <span className="font-medium text-gray-900">{confirmModal.empName}</span>
                </div>
                <p className="text-sm text-gray-600">
                  Status: <span className={confirmModal.status === 'NIET_INGEVULD' ? 'text-gray-400' : 'text-red-400'}>
                    {confirmModal.status === 'NIET_INGEVULD' ? 'Niet ingevuld' : 'Niet beschikbaar'}
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-1">{confirmModal.reason}</p>
              </div>
              <p className="text-sm text-yellow-400">
                <ExclamationTriangleIcon className="h-4 w-4 inline mr-1" />
                Weet je zeker? Dit kan problemen geven.
              </p>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
                <Button type="button" variant="ghost" onClick={() => setConfirmModal(null)}>
                  Annuleren
                </Button>
                <Button type="button" variant="danger" onClick={confirmOverrideSelection}>
                  Toch toewijzen
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Shift Request Management Modal (Admin) */}
        {isAdmin && requestModalShift && (
          <ShiftRequestModal
            isOpen={!!requestModalShift}
            onClose={() => setRequestModalShift(null)}
            shift={requestModalShift}
            onAction={() => mutateShifts()}
          />
        )}
      </div>
  );
}
