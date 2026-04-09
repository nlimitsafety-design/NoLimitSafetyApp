'use client';

import { useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRecurringAvailability, useAvailabilityExceptions, useAvailability, useEmployees } from '@/lib/swr';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import { formatDate, TIME_SLOTS, WEEKDAYS } from '@/lib/utils';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentDuplicateIcon,
  CalendarDaysIcon,
  Squares2X2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import {
  format,
  startOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  isSameDay,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  eachDayOfInterval,
  getDay,
  isWeekend,
  isBefore,
} from 'date-fns';
import { nl } from 'date-fns/locale';
import toast from 'react-hot-toast';

type CalendarView = 'week' | 'month';

interface RecurringItem {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  validFrom: string;
  validTo: string | null;
  note: string | null;
}

interface ExceptionItem {
  id: string;
  userId: string;
  date: string;
  type: string;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  user?: { id: string; name: string };
}

export default function AvailabilityPage() {
  const { data: session } = useSession();
  const isEmployee = session?.user?.role === 'EMPLOYEE';
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'MANAGER';

  // Admin: employee selector
  const { data: employeeList = [] } = useEmployees();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  // Recurring data
  const { data: rawRecurring = [], mutate: mutateRecurring } = useRecurringAvailability();
  const recurring = rawRecurring as RecurringItem[];

  // Calendar view mode
  const [calendarView, setCalendarView] = useState<CalendarView>('month');

  // Week state
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);

  // Month state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  // Compute date range based on view
  const viewStart = calendarView === 'week' ? format(weekStart, 'yyyy-MM-dd') : format(monthStart, 'yyyy-MM-dd');
  const viewEnd = calendarView === 'week' ? format(weekEnd, 'yyyy-MM-dd') : format(monthEnd, 'yyyy-MM-dd');

  const { data: rawExceptions = [], mutate: mutateExceptions } = useAvailabilityExceptions(
    viewStart, viewEnd, isAdmin && selectedEmployeeId ? selectedEmployeeId : undefined
  );
  const exceptions = rawExceptions as ExceptionItem[];

  // Recurring section expanded
  const [recurringOpen, setRecurringOpen] = useState(false);

  // Recurring modal
  const [recurringModal, setRecurringModal] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringItem | null>(null);
  const [recurringForm, setRecurringForm] = useState({
    weekday: 1,
    startTime: '08:00',
    endTime: '17:00',
    validFrom: format(new Date(), 'yyyy-MM-dd'),
    validTo: '' as string,
    note: '',
  });

  // Exception modal (now called "Beschikbaarheid" modal)
  const [planModal, setPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ExceptionItem | null>(null);
  const [planForm, setPlanForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'AVAILABLE' as 'AVAILABLE' | 'UNAVAILABLE' | 'PARTIAL',
    startTime: '08:00',
    endTime: '17:00',
    note: '',
    targetUserId: '',
  });

  // Copy week modal
  const [copyModal, setCopyModal] = useState(false);
  const [copyTarget, setCopyTarget] = useState(format(addWeeks(weekStart, 1), 'yyyy-MM-dd'));
  const [copying, setCopying] = useState(false);

  // Fill month modal
  const [fillMonthModal, setFillMonthModal] = useState(false);
  const [fillMonthForm, setFillMonthForm] = useState({
    type: 'AVAILABLE' as 'AVAILABLE' | 'UNAVAILABLE',
    startTime: '08:00',
    endTime: '17:00',
    includeWeekends: false,
    note: '',
  });
  const [filling, setFilling] = useState(false);

  const [saving, setSaving] = useState(false);

  // Group recurring by weekday
  const recurringByDay = useMemo(() => {
    const grouped: Record<number, RecurringItem[]> = {};
    for (const day of WEEKDAYS) grouped[day.value] = [];
    for (const item of recurring) {
      if (grouped[item.weekday]) grouped[item.weekday].push(item);
    }
    return grouped;
  }, [recurring]);

  // Week days for week view
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i));
    return days;
  }, [weekStart]);

  // Month calendar grid
  const monthCalendarDays = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const firstDayOfWeek = getDay(monthStart);
    const mondayOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const prefix: (Date | null)[] = Array(mondayOffset).fill(null);
    return [...prefix, ...days];
  }, [monthStart, monthEnd]);

  // Lookup: date string â†’ exceptions
  const exceptionsByDate = useMemo(() => {
    const map: Record<string, ExceptionItem[]> = {};
    for (const exc of exceptions) {
      const key = exc.date.split('T')[0];
      if (!map[key]) map[key] = [];
      map[key].push(exc);
    }
    return map;
  }, [exceptions]);

  // === RECURRING HANDLERS ===
  function openCreateRecurring(weekday?: number) {
    setEditingRecurring(null);
    setRecurringForm({
      weekday: weekday ?? 1,
      startTime: '08:00',
      endTime: '17:00',
      validFrom: format(new Date(), 'yyyy-MM-dd'),
      validTo: '',
      note: '',
    });
    setRecurringModal(true);
  }

  function openEditRecurring(item: RecurringItem) {
    setEditingRecurring(item);
    setRecurringForm({
      weekday: item.weekday,
      startTime: item.startTime,
      endTime: item.endTime,
      validFrom: format(new Date(item.validFrom), 'yyyy-MM-dd'),
      validTo: item.validTo ? format(new Date(item.validTo), 'yyyy-MM-dd') : '',
      note: item.note || '',
    });
    setRecurringModal(true);
  }

  async function handleRecurringSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!recurringForm.validFrom) {
      toast.error('Geldig vanaf is verplicht');
      return;
    }
    if (recurringForm.startTime >= recurringForm.endTime) {
      toast.error('Starttijd moet voor eindtijd liggen');
      return;
    }

    setSaving(true);
    try {
      const isEdit = !!editingRecurring;
      const payload = {
        ...(isEdit ? { id: editingRecurring!.id } : {}),
        weekday: recurringForm.weekday,
        startTime: recurringForm.startTime,
        endTime: recurringForm.endTime,
        validFrom: recurringForm.validFrom,
        validTo: recurringForm.validTo || null,
        note: recurringForm.note || undefined,
      };

      const res = await fetch('/api/recurring-availability', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = 'Fout bij opslaan';
        try { const data = await res.json(); msg = data.error || msg; } catch {}
        toast.error(msg);
        return;
      }

      toast.success(isEdit ? 'Vaste tijd bijgewerkt' : 'Vaste tijd opgeslagen');
      setRecurringModal(false);
      setEditingRecurring(null);
      mutateRecurring();
    } catch (err) {
      console.error('Recurring save error:', err);
      toast.error('Fout bij opslaan');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRecurring(id: string) {
    if (!confirm('Weet je zeker dat je dit wilt verwijderen?')) return;
    try {
      const res = await fetch(`/api/recurring-availability?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Verwijderd');
        mutateRecurring();
      }
    } catch (err) {
      console.error('Recurring delete error:', err);
      toast.error('Fout bij verwijderen');
    }
  }

  // === PLAN (EXCEPTION) HANDLERS ===
  function openCreatePlan(date?: Date) {
    setEditingPlan(null);
    setPlanForm({
      date: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      type: 'AVAILABLE',
      startTime: '08:00',
      endTime: '17:00',
      note: '',
      targetUserId: selectedEmployeeId || '',
    });
    setPlanModal(true);
  }

  function openEditPlan(item: ExceptionItem) {
    setEditingPlan(item);
    setPlanForm({
      date: format(new Date(item.date), 'yyyy-MM-dd'),
      type: item.type as 'AVAILABLE' | 'UNAVAILABLE' | 'PARTIAL',
      startTime: item.startTime || '08:00',
      endTime: item.endTime || '17:00',
      note: item.note || '',
      targetUserId: item.userId || '',
    });
    setPlanModal(true);
  }

  async function handlePlanSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const isEdit = !!editingPlan;
      const payload = {
        ...(isEdit ? { id: editingPlan!.id } : {}),
        date: planForm.date,
        type: planForm.type,
        startTime: planForm.type === 'PARTIAL' ? planForm.startTime : null,
        endTime: planForm.type === 'PARTIAL' ? planForm.endTime : null,
        note: planForm.note || undefined,
        ...(isAdmin && planForm.targetUserId ? { targetUserId: planForm.targetUserId } : {}),
      };

      const res = await fetch('/api/availability-exceptions', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = 'Fout bij opslaan';
        try { const data = await res.json(); msg = data.error || msg; } catch {}
        toast.error(msg);
        return;
      }

      toast.success(isEdit ? 'Beschikbaarheid bijgewerkt' : 'Beschikbaarheid opgeslagen');
      setPlanModal(false);
      setEditingPlan(null);
      mutateExceptions();
    } catch (err) {
      console.error('Plan save error:', err);
      toast.error('Fout bij opslaan');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePlan(id: string) {
    if (!confirm('Weet je zeker dat je dit wilt verwijderen?')) return;
    try {
      const res = await fetch(`/api/availability-exceptions?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Verwijderd');
        mutateExceptions();
      }
    } catch (err) {
      console.error('Plan delete error:', err);
      toast.error('Fout bij verwijderen');
    }
  }

  // === COPY WEEK HANDLER ===
  async function handleCopyWeek() {
    setCopying(true);
    try {
      const res = await fetch('/api/availability-exceptions/copy-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromWeekStartDate: format(weekStart, 'yyyy-MM-dd'),
          toWeekStartDate: copyTarget,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Fout bij kopiëren');
        return;
      }

      const msg = `${data.createdCount} dag(en) gekopieerd${
        data.skippedDates?.length > 0 ? `, ${data.skippedDates.length} overgeslagen` : ''
      }`;
      toast.success(msg);
      setCopyModal(false);
      mutateExceptions();
    } catch (err) {
      console.error('Copy week error:', err);
      toast.error('Fout bij kopiëren');
    } finally {
      setCopying(false);
    }
  }

  // === FILL MONTH HANDLER ===
  async function handleFillMonth() {
    setFilling(true);
    try {
      const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const targetDays = fillMonthForm.includeWeekends
        ? allDays
        : allDays.filter((d) => !isWeekend(d));

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const futureDays = targetDays.filter((d) => !isBefore(d, today));

      if (futureDays.length === 0) {
        toast.error('Geen beschikbare datums gevonden');
        setFilling(false);
        return;
      }

      const dates = futureDays.map((d) => format(d, 'yyyy-MM-dd'));

      const res = await fetch('/api/availability-exceptions/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dates,
          type: fillMonthForm.type,
          startTime: fillMonthForm.type === 'AVAILABLE' ? fillMonthForm.startTime : null,
          endTime: fillMonthForm.type === 'AVAILABLE' ? fillMonthForm.endTime : null,
          note: fillMonthForm.note || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Fout bij invullen');
        return;
      }

      toast.success(`${data.created} dag(en) ingevuld${data.skipped > 0 ? `, ${data.skipped} overgeslagen` : ''}`);
      setFillMonthModal(false);
      mutateExceptions();
    } catch (err) {
      console.error('Fill month error:', err);
      toast.error('Fout bij invullen');
    } finally {
      setFilling(false);
    }
  }

  // Count recurring items
  const recurringCount = recurring.length;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="page-title">
            {isEmployee ? 'Mijn Beschikbaarheid' : 'Beschikbaarheid'}
          </h1>
          <p className="page-subtitle">
            Plan je beschikbaarheid in per dag of voor een hele maand
          </p>
        </div>
      </div>

      {/* ==================== CALENDAR TOOLBAR ==================== */}
      <Card className="mb-4">
        <div className="flex flex-col gap-3">
          {/* Top row: view toggle + actions */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* View toggle */}
            <div className="flex bg-white rounded-lg p-0.5">
              <button
                onClick={() => setCalendarView('month')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  calendarView === 'month' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:text-gray-600'
                }`}
              >
                <CalendarDaysIcon className="h-3.5 w-3.5" />
                Maand
              </button>
              <button
                onClick={() => setCalendarView('week')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  calendarView === 'week' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:text-gray-600'
                }`}
              >
                <Squares2X2Icon className="h-3.5 w-3.5" />
                Week
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {calendarView === 'month' && (
                <Button size="sm" variant="ghost" onClick={() => {
                  setFillMonthForm({
                    type: 'AVAILABLE',
                    startTime: '08:00',
                    endTime: '17:00',
                    includeWeekends: false,
                    note: '',
                  });
                  setFillMonthModal(true);
                }}>
                  <CalendarDaysIcon className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Hele maand invullen</span>
                  <span className="sm:hidden">Maand</span>
                </Button>
              )}
              {calendarView === 'week' && (
                <Button size="sm" variant="ghost" onClick={() => setCopyModal(true)}>
                  <DocumentDuplicateIcon className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Kopieer week</span>
                  <span className="sm:hidden">Kopieer</span>
                </Button>
              )}
              <Button size="sm" onClick={() => openCreatePlan()}>
                <PlusIcon className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Dag inplannen</span>
                <span className="sm:hidden">Nieuw</span>
              </Button>
            </div>
          </div>

          {/* Navigation row */}
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            <button
              onClick={() => calendarView === 'week'
                ? setCurrentWeek(subWeeks(currentWeek, 1))
                : setCurrentMonth(subMonths(currentMonth, 1))
              }
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors active:bg-gray-200"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <h2 className="text-sm sm:text-lg font-semibold text-gray-900 text-center min-w-0 flex-1 sm:flex-initial sm:min-w-[240px]">
              {calendarView === 'week' ? (
                <>
                  <span className="sm:hidden">Wk {format(weekStart, 'w')} - {format(weekStart, 'd MMM', { locale: nl })} - {format(weekEnd, 'd MMM', { locale: nl })}</span>
                  <span className="hidden sm:inline">Week {format(weekStart, 'w')} - {format(weekStart, 'd MMM', { locale: nl })} t/m {format(weekEnd, 'd MMM', { locale: nl })}</span>
                </>
              ) : (
                <span className="capitalize">{format(monthStart, 'MMMM yyyy', { locale: nl })}</span>
              )}
            </h2>
            <button
              onClick={() => calendarView === 'week'
                ? setCurrentWeek(addWeeks(currentWeek, 1))
                : setCurrentMonth(addMonths(currentMonth, 1))
              }
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors active:bg-gray-200"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </Card>

      {/* ==================== MONTH VIEW ==================== */}
      {calendarView === 'month' && (
        <div className="mb-6">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((d) => (
              <div key={d} className="text-center text-[10px] sm:text-xs font-medium text-gray-500 py-1.5">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7 gap-1">
            {monthCalendarDays.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="min-h-[56px] sm:min-h-[80px]" />;
              }

              const dateStr = format(day, 'yyyy-MM-dd');
              const dayItems = exceptionsByDate[dateStr] || [];
              const isToday = isSameDay(day, new Date());
              const isPast = isBefore(day, new Date()) && !isToday;
              const weekend = isWeekend(day);

              const hasAvailable = dayItems.some((e) => e.type === 'AVAILABLE');
              const hasUnavailable = dayItems.some((e) => e.type === 'UNAVAILABLE');
              const hasPartial = dayItems.some((e) => e.type === 'PARTIAL');

              return (
                <div
                  key={dateStr}
                  onClick={() => dayItems.length === 1 ? openEditPlan(dayItems[0]) : openCreatePlan(day)}
                  className={`min-h-[56px] sm:min-h-[80px] rounded-lg border p-1 sm:p-2 cursor-pointer transition-all active:scale-[0.97] select-none ${
                    isToday
                      ? 'border-brand-500/50 bg-brand-500/5'
                      : isPast
                        ? 'border-gray-200 bg-gray-50 opacity-50'
                        : weekend
                          ? 'border-gray-200 bg-gray-50'
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300 active:border-navy-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className={`text-xs sm:text-sm font-semibold leading-none ${
                      isToday ? 'text-brand-500' : isPast ? 'text-gray-600' : weekend ? 'text-gray-500' : 'text-gray-900'
                    }`}>
                      {format(day, 'd')}
                    </span>
                    {dayItems.length > 1 && (
                      <span className="text-[9px] sm:text-[10px] bg-gray-300 text-gray-600 rounded-full px-1 leading-relaxed">
                        {dayItems.length}
                      </span>
                    )}
                  </div>

                  {dayItems.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {hasAvailable && (
                        <div className="flex items-center gap-0.5 sm:gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                          <span className="text-[9px] sm:text-xs text-green-400 truncate leading-tight">
                            {dayItems.find((e) => e.type === 'AVAILABLE')?.startTime || ''}
                            {dayItems.find((e) => e.type === 'AVAILABLE')?.endTime
                              ? `-${dayItems.find((e) => e.type === 'AVAILABLE')?.endTime}`
                              : ''}
                          </span>
                        </div>
                      )}
                      {hasPartial && (
                        <div className="flex items-center gap-0.5 sm:gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                          <span className="text-[9px] sm:text-xs text-orange-400 truncate leading-tight">
                            {dayItems.find((e) => e.type === 'PARTIAL')?.startTime || ''}
                            {dayItems.find((e) => e.type === 'PARTIAL')?.endTime
                              ? `-${dayItems.find((e) => e.type === 'PARTIAL')?.endTime}`
                              : ''}
                          </span>
                        </div>
                      )}
                      {hasUnavailable && (
                        <div className="flex items-center gap-0.5 sm:gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                          <span className="text-[9px] sm:text-xs text-red-400 truncate leading-tight">Vrij</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-3 text-[10px] sm:text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              Beschikbaar
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              Gedeeltelijk
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              Niet beschikbaar
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-gray-300" />
              Niet ingevuld
            </div>
          </div>
        </div>
      )}

      {/* ==================== WEEK VIEW ==================== */}
      {calendarView === 'week' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 mb-6">
          {weekDays.map((day) => {
            const dayItems = exceptions.filter((e) => isSameDay(new Date(e.date), day));
            const isToday = isSameDay(day, new Date());

            return (
              <Card
                key={day.toISOString()}
                className={`min-h-[100px] ${isToday ? 'border-brand-500/50 ring-1 ring-brand-500/20' : ''}`}
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
                  <button
                    onClick={() => openCreatePlan(day)}
                    className="p-2 rounded-lg text-gray-500 hover:text-brand-500 hover:bg-brand-500/10 transition-colors active:bg-brand-500/20"
                    title="Beschikbaarheid toevoegen"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>

                {dayItems.length > 0 ? (
                  <div className="space-y-2">
                    {dayItems.map((item) => {
                      return (
                        <div
                          key={item.id}
                          className={`p-2.5 rounded-lg text-xs cursor-pointer transition-colors ${
                            item.type === 'AVAILABLE'
                              ? 'bg-green-500/10 border border-green-500/20 hover:bg-green-500/15 active:bg-green-500/20'
                              : item.type === 'PARTIAL'
                                ? 'bg-orange-400/10 border border-orange-400/20 hover:bg-orange-400/15 active:bg-orange-400/20'
                                : 'bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 active:bg-red-500/20'
                          }`}
                          onClick={() => openEditPlan(item)}
                        >
                          <div className="flex items-center justify-between">
                            <Badge variant={item.type === 'AVAILABLE' ? 'success' : item.type === 'PARTIAL' ? 'warning' : 'danger'} size="sm">
                              {item.type === 'AVAILABLE' ? 'Beschikbaar' : item.type === 'PARTIAL' ? 'Gedeeltelijk' : 'Niet beschikbaar'}
                            </Badge>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); openEditPlan(item); }}
                                className="p-1.5 text-gray-400 hover:text-brand-500 active:text-brand-300 rounded"
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeletePlan(item.id); }}
                                className="p-1.5 text-gray-400 hover:text-red-400 active:text-red-300 rounded"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          {item.startTime && item.endTime ? (
                            <p className={`mt-1 font-medium ${item.type === 'AVAILABLE' ? 'text-green-400' : item.type === 'PARTIAL' ? 'text-orange-400' : 'text-red-400'}`}>
                              {item.startTime} - {item.endTime}
                            </p>
                          ) : (
                            <p className="text-red-400 mt-1 font-medium">Hele dag</p>
                          )}
                          {item.note && <p className="text-gray-500 mt-0.5 italic">{item.note}</p>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 italic">Niet ingevuld</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ==================== VASTE TIJDEN (COLLAPSIBLE) ==================== */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setRecurringOpen(!recurringOpen)}
          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors active:bg-gray-200"
        >
          <div className="flex items-center gap-3">
            <ClockIcon className="h-5 w-5 text-brand-500" />
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">Vaste beschikbaarheid</p>
              <p className="text-xs text-gray-400">
                {recurringCount > 0
                  ? `${recurringCount} vaste tijdslot${recurringCount !== 1 ? 'en' : ''} ingesteld`
                  : 'Stel wekelijks terugkerende tijden in'
                }
              </p>
            </div>
          </div>
          {recurringOpen
            ? <ChevronUpIcon className="h-5 w-5 text-gray-400" />
            : <ChevronDownIcon className="h-5 w-5 text-gray-400" />
          }
        </button>

        {recurringOpen && (
          <div className="p-4 border-t border-gray-200">
            <div className="flex justify-end mb-4">
              <Button size="sm" onClick={() => openCreateRecurring()}>
                <PlusIcon className="h-4 w-4 mr-1" />
                Vaste tijd toevoegen
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
              {WEEKDAYS.map((day) => {
                const items = recurringByDay[day.value] || [];
                return (
                  <div key={day.value} className="bg-gray-50 border border-gray-200 rounded-lg p-3 min-h-[80px]">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">{day.short}</p>
                        <p className="text-xs font-bold text-gray-900">{day.label}</p>
                      </div>
                      <button
                        onClick={() => openCreateRecurring(day.value)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-brand-500 hover:bg-brand-500/10 transition-colors active:bg-brand-500/20"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {items.length > 0 ? (
                      <div className="space-y-1.5">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="p-2 bg-green-500/10 border border-green-500/20 rounded-lg text-xs cursor-pointer hover:bg-green-500/15 active:bg-green-500/20"
                            onClick={() => openEditRecurring(item)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-green-400 font-medium">{item.startTime} - {item.endTime}</span>
                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openEditRecurring(item); }}
                                  className="p-1 text-gray-400 hover:text-brand-500 active:text-brand-300"
                                >
                                  <PencilSquareIcon className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteRecurring(item.id); }}
                                  className="p-1 text-gray-400 hover:text-red-400 active:text-red-300"
                                >
                                  <TrashIcon className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                            <p className="text-gray-500 mt-0.5 text-[10px]">
                              Vanaf {formatDate(item.validFrom, 'd MMM yyyy')}
                              {item.validTo ? ` t/m ${formatDate(item.validTo, 'd MMM yyyy')}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-600 italic">-</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ==================== PLAN MODAL (beschikbaarheid inplannen) ==================== */}
      <Modal
        isOpen={planModal}
        onClose={() => { setPlanModal(false); setEditingPlan(null); }}
        title={editingPlan ? 'Beschikbaarheid bewerken' : 'Beschikbaarheid inplannen'}
      >
        <form onSubmit={handlePlanSubmit} noValidate className="space-y-4">
          <Input
            label="Datum"
            type="date"
            value={planForm.date}
            onChange={(e) => setPlanForm({ ...planForm, date: e.target.value })}
            required
          />

          {/* Quick status buttons */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Status</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPlanForm({ ...planForm, type: 'AVAILABLE' })}
                className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl border-2 font-semibold text-xs transition-all ${
                  planForm.type === 'AVAILABLE'
                    ? 'border-green-500 bg-green-500/10 text-green-600'
                    : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-green-300 hover:text-green-500'
                }`}
              >
                <span className="text-xl">🟢</span>
                <span>Beschikbaar</span>
              </button>
              <button
                type="button"
                onClick={() => setPlanForm({ ...planForm, type: 'PARTIAL' })}
                className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl border-2 font-semibold text-xs transition-all ${
                  planForm.type === 'PARTIAL'
                    ? 'border-orange-400 bg-orange-400/10 text-orange-600'
                    : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-orange-300 hover:text-orange-500'
                }`}
              >
                <span className="text-xl">🟠</span>
                <span>Gedeeltelijk</span>
              </button>
              <button
                type="button"
                onClick={() => setPlanForm({ ...planForm, type: 'UNAVAILABLE' })}
                className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl border-2 font-semibold text-xs transition-all ${
                  planForm.type === 'UNAVAILABLE'
                    ? 'border-red-500 bg-red-500/10 text-red-600'
                    : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-red-300 hover:text-red-500'
                }`}
              >
                <span className="text-xl">🔴</span>
                <span>Niet beschikbaar</span>
              </button>
            </div>
          </div>

          {planForm.type === 'AVAILABLE' && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <p className="text-sm text-green-600 font-medium">Hele dag beschikbaar</p>
            </div>
          )}
          {/* Time inputs only for PARTIAL */}
          {planForm.type === 'PARTIAL' && (
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Van"
                value={planForm.startTime}
                onChange={(e) => setPlanForm({ ...planForm, startTime: e.target.value })}
                options={TIME_SLOTS.map(t => ({ value: t, label: t }))}
              />
              <Select
                label="Tot"
                value={planForm.endTime}
                onChange={(e) => setPlanForm({ ...planForm, endTime: e.target.value })}
                options={TIME_SLOTS.map(t => ({ value: t, label: t }))}
              />
            </div>
          )}
          {planForm.type === 'UNAVAILABLE' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-sm text-red-500 font-medium">Hele dag niet beschikbaar</p>
            </div>
          )}

          <Textarea
            label="Opmerking (optioneel)"
            value={planForm.note}
            onChange={(e) => setPlanForm({ ...planForm, note: e.target.value })}
            placeholder="Bijv. vakantie, afspraak..."
          />
          <div className="flex justify-between pt-4 border-t border-gray-200">
            <div>
              {editingPlan && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => { handleDeletePlan(editingPlan.id); setPlanModal(false); setEditingPlan(null); }}
                >
                  Verwijderen
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={() => { setPlanModal(false); setEditingPlan(null); }}>
                Annuleren
              </Button>
              <Button type="submit" loading={saving}>
                {editingPlan ? 'Bijwerken' : 'Opslaan'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ==================== RECURRING MODAL ==================== */}
      <Modal
        isOpen={recurringModal}
        onClose={() => { setRecurringModal(false); setEditingRecurring(null); }}
        title={editingRecurring ? 'Vaste tijd bewerken' : 'Vaste tijd toevoegen'}
      >
        <form onSubmit={handleRecurringSubmit} noValidate className="space-y-4">
          <Select
            label="Weekdag"
            value={String(recurringForm.weekday)}
            onChange={(e) => setRecurringForm({ ...recurringForm, weekday: Number(e.target.value) })}
            options={WEEKDAYS.map(d => ({ value: String(d.value), label: d.label }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Van"
              value={recurringForm.startTime}
              onChange={(e) => setRecurringForm({ ...recurringForm, startTime: e.target.value })}
              options={TIME_SLOTS.map(t => ({ value: t, label: t }))}
            />
            <Select
              label="Tot"
              value={recurringForm.endTime}
              onChange={(e) => setRecurringForm({ ...recurringForm, endTime: e.target.value })}
              options={TIME_SLOTS.map(t => ({ value: t, label: t }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Geldig vanaf"
              type="date"
              value={recurringForm.validFrom}
              onChange={(e) => setRecurringForm({ ...recurringForm, validFrom: e.target.value })}
              required
            />
            <Input
              label="Geldig tot (optioneel)"
              type="date"
              value={recurringForm.validTo}
              onChange={(e) => setRecurringForm({ ...recurringForm, validTo: e.target.value })}
            />
          </div>
          <Textarea
            label="Opmerking (optioneel)"
            value={recurringForm.note}
            onChange={(e) => setRecurringForm({ ...recurringForm, note: e.target.value })}
            placeholder="Bijv. alleen voor locatie X..."
          />
          <div className="flex justify-between pt-4 border-t border-gray-200">
            <div>
              {editingRecurring && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => { handleDeleteRecurring(editingRecurring.id); setRecurringModal(false); setEditingRecurring(null); }}
                >
                  Verwijderen
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={() => { setRecurringModal(false); setEditingRecurring(null); }}>
                Annuleren
              </Button>
              <Button type="submit" loading={saving}>
                {editingRecurring ? 'Bijwerken' : 'Opslaan'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ==================== COPY WEEK MODAL ==================== */}
      <Modal
        isOpen={copyModal}
        onClose={() => setCopyModal(false)}
        title="Kopieer week"
        size="sm"
      >
        <div className="space-y-4">
          <div className="bg-gray-100 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Bron</p>
            <p className="text-sm text-gray-900 font-medium">
              Week {format(weekStart, 'w')} - {format(weekStart, 'd MMM', { locale: nl })} t/m {format(weekEnd, 'd MMM yyyy', { locale: nl })}
            </p>
            <p className="text-xs text-gray-400 mt-1">{exceptions.length} dag(en) in deze week</p>
          </div>

          <Input
            label="Kopieer naar (maandag van doelweek)"
            type="date"
            value={copyTarget}
            onChange={(e) => setCopyTarget(e.target.value)}
            required
          />

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
            <p className="text-xs text-yellow-400">
              <strong>Let op:</strong> Dagen die al ingevuld zijn worden overgeslagen.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="ghost" onClick={() => setCopyModal(false)}>Annuleren</Button>
            <Button onClick={handleCopyWeek} loading={copying} disabled={exceptions.length === 0}>
              <DocumentDuplicateIcon className="h-4 w-4 mr-1" />
              Kopiëren
            </Button>
          </div>
        </div>
      </Modal>

      {/* ==================== ADMIN: MEDEWERKER OVERZICHT ==================== */}
      {isAdmin && allAvailability.length > 0 && (
        <Card className="mt-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Medewerker beschikbaarheid</h2>
          <div className="space-y-2">
            {Object.entries(
              (allAvailability as any[]).reduce((acc: Record<string, any[]>, a: any) => {
                const key = a.date?.split('T')[0] ?? a.date;
                if (!acc[key]) acc[key] = [];
                acc[key].push(a);
                return acc;
              }, {})
            )
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, entries]) => (
                <div key={date} className="border border-gray-100 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    {new Date(date + 'T00:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(entries as any[]).map((a) => (
                      <div key={a.id} className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                        a.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' :
                        a.status === 'UNAVAILABLE' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        <span>{a.user?.name}</span>
                        {a.startTime && <span className="opacity-70">{a.startTime}–{a.endTime}</span>}
                        {a.note && <span className="opacity-60 italic">· {a.note}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* ==================== FILL MONTH MODAL ==================== */}
      <Modal
        isOpen={fillMonthModal}
        onClose={() => setFillMonthModal(false)}
        title={`Hele maand invullen`}
        size="sm"
      >
        <div className="space-y-4">
          <div className="bg-brand-500/10 border border-brand-500/20 rounded-lg p-3">
            <p className="text-sm text-brand-300">
              Vul in één keer je beschikbaarheid in voor{' '}
              {fillMonthForm.includeWeekends ? 'alle dagen' : 'alle werkdagen'} van{' '}
              <strong className="capitalize">{format(monthStart, 'MMMM yyyy', { locale: nl })}</strong>.
            </p>
            <p className="text-xs text-gray-400 mt-1">Dagen die al ingevuld zijn worden overgeslagen.</p>
          </div>

          <Select
            label="Status"
            value={fillMonthForm.type}
            onChange={(e) => setFillMonthForm({ ...fillMonthForm, type: e.target.value as 'AVAILABLE' | 'UNAVAILABLE' })}
            options={[
              { value: 'AVAILABLE', label: 'Beschikbaar' },
              { value: 'UNAVAILABLE', label: 'Niet beschikbaar (hele dag vrij)' },
            ]}
          />

          {fillMonthForm.type === 'AVAILABLE' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Select
                label="Van"
                value={fillMonthForm.startTime}
                onChange={(e) => setFillMonthForm({ ...fillMonthForm, startTime: e.target.value })}
                options={TIME_SLOTS.map(t => ({ value: t, label: t }))}
              />
              <Select
                label="Tot"
                value={fillMonthForm.endTime}
                onChange={(e) => setFillMonthForm({ ...fillMonthForm, endTime: e.target.value })}
                options={TIME_SLOTS.map(t => ({ value: t, label: t }))}
              />
            </div>
          )}

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={fillMonthForm.includeWeekends}
              onChange={(e) => setFillMonthForm({ ...fillMonthForm, includeWeekends: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 bg-gray-100 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm text-gray-600">Inclusief weekenden</span>
          </label>

          <Textarea
            label="Opmerking (optioneel)"
            value={fillMonthForm.note}
            onChange={(e) => setFillMonthForm({ ...fillMonthForm, note: e.target.value })}
            placeholder="Bijv. standaard beschikbaar..."
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button variant="ghost" onClick={() => setFillMonthModal(false)}>Annuleren</Button>
            <Button onClick={handleFillMonth} loading={filling}>
              <CalendarDaysIcon className="h-4 w-4 mr-1" />
              Invullen
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
