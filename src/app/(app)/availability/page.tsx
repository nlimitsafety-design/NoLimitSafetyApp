'use client';

import { useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRecurringAvailability, useAvailabilityExceptions } from '@/lib/swr';
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
  CalendarIcon,
  ClockIcon,
  CalendarDaysIcon,
  Squares2X2Icon,
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

type TabType = 'recurring' | 'exceptions';
type ExceptionView = 'week' | 'month';

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
  date: string;
  type: string;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
}

export default function AvailabilityPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<TabType>('recurring');
  const isEmployee = session?.user?.role === 'EMPLOYEE';

  // Recurring data
  const { data: rawRecurring = [], mutate: mutateRecurring } = useRecurringAvailability();
  const recurring = rawRecurring as RecurringItem[];

  // Exception view mode
  const [exceptionView, setExceptionView] = useState<ExceptionView>('month');

  // Week state
  const [exceptionWeek, setExceptionWeek] = useState(new Date());
  const exWeekStart = startOfWeek(exceptionWeek, { weekStartsOn: 1 });
  const exWeekEnd = addDays(exWeekStart, 6);

  // Month state
  const [exceptionMonth, setExceptionMonth] = useState(new Date());
  const monthStart = startOfMonth(exceptionMonth);
  const monthEnd = endOfMonth(exceptionMonth);

  // Compute date range based on view
  const viewStart = exceptionView === 'week' ? format(exWeekStart, 'yyyy-MM-dd') : format(monthStart, 'yyyy-MM-dd');
  const viewEnd = exceptionView === 'week' ? format(exWeekEnd, 'yyyy-MM-dd') : format(monthEnd, 'yyyy-MM-dd');

  const { data: rawExceptions = [], mutate: mutateExceptions } = useAvailabilityExceptions(viewStart, viewEnd);
  const exceptions = rawExceptions as ExceptionItem[];

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

  // Exception modal
  const [exceptionModal, setExceptionModal] = useState(false);
  const [editingException, setEditingException] = useState<ExceptionItem | null>(null);
  const [exceptionForm, setExceptionForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'AVAILABLE' as 'AVAILABLE' | 'UNAVAILABLE',
    startTime: '08:00',
    endTime: '17:00',
    note: '',
  });

  // Copy week modal
  const [copyModal, setCopyModal] = useState(false);
  const [copyTarget, setCopyTarget] = useState(format(addWeeks(exWeekStart, 1), 'yyyy-MM-dd'));
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
  const exceptionDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) days.push(addDays(exWeekStart, i));
    return days;
  }, [exWeekStart]);

  // Month calendar grid
  const monthCalendarDays = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const firstDayOfWeek = getDay(monthStart); // 0=Sun, 1=Mon
    const mondayOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const prefix: (Date | null)[] = Array(mondayOffset).fill(null);
    return [...prefix, ...days];
  }, [monthStart, monthEnd]);

  // Lookup: date string → exceptions
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

      toast.success(isEdit ? 'Vaste beschikbaarheid bijgewerkt' : 'Vaste beschikbaarheid opgeslagen');
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

  // === EXCEPTION HANDLERS ===
  function openCreateException(date?: Date) {
    setEditingException(null);
    setExceptionForm({
      date: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      type: 'AVAILABLE',
      startTime: '08:00',
      endTime: '17:00',
      note: '',
    });
    setExceptionModal(true);
  }

  function openEditException(item: ExceptionItem) {
    setEditingException(item);
    setExceptionForm({
      date: format(new Date(item.date), 'yyyy-MM-dd'),
      type: item.type as 'AVAILABLE' | 'UNAVAILABLE',
      startTime: item.startTime || '08:00',
      endTime: item.endTime || '17:00',
      note: item.note || '',
    });
    setExceptionModal(true);
  }

  async function handleExceptionSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const isEdit = !!editingException;
      const payload = {
        ...(isEdit ? { id: editingException!.id } : {}),
        date: exceptionForm.date,
        type: exceptionForm.type,
        startTime: exceptionForm.type === 'UNAVAILABLE' ? null : exceptionForm.startTime,
        endTime: exceptionForm.type === 'UNAVAILABLE' ? null : exceptionForm.endTime,
        note: exceptionForm.note || undefined,
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

      toast.success(isEdit ? 'Uitzondering bijgewerkt' : 'Uitzondering opgeslagen');
      setExceptionModal(false);
      setEditingException(null);
      mutateExceptions();
    } catch (err) {
      console.error('Exception save error:', err);
      toast.error('Fout bij opslaan');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteException(id: string) {
    if (!confirm('Weet je zeker dat je deze uitzondering wilt verwijderen?')) return;
    try {
      const res = await fetch(`/api/availability-exceptions?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Verwijderd');
        mutateExceptions();
      }
    } catch (err) {
      console.error('Exception delete error:', err);
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
          fromWeekStartDate: format(exWeekStart, 'yyyy-MM-dd'),
          toWeekStartDate: copyTarget,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Fout bij kopiëren');
        return;
      }

      const msg = `${data.createdCount} uitzondering(en) gekopieerd${
        data.skippedDates?.length > 0 ? `, ${data.skippedDates.length} datum(s) overgeslagen` : ''
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

      toast.success(`${data.created} dag(en) ingevuld${data.skipped > 0 ? `, ${data.skipped} overgeslagen (al ingevuld)` : ''}`);
      setFillMonthModal(false);
      mutateExceptions();
    } catch (err) {
      console.error('Fill month error:', err);
      toast.error('Fout bij invullen');
    } finally {
      setFilling(false);
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title">
            {isEmployee ? 'Mijn Beschikbaarheid' : 'Beschikbaarheid'}
          </h1>
          <p className="page-subtitle">
            Stel je beschikbaarheid in en beheer uitzonderingen
          </p>
        </div>
      </div>

      {/* Tabs — full width on mobile */}
      <div className="flex bg-navy-800 rounded-lg p-0.5 mb-6 w-full sm:w-fit">
        <button
          onClick={() => setActiveTab('recurring')}
          className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'recurring' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <ClockIcon className="h-4 w-4" />
          <span>Vast</span>
        </button>
        <button
          onClick={() => setActiveTab('exceptions')}
          className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'exceptions' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <CalendarIcon className="h-4 w-4" />
          <span>Uitzonderingen</span>
        </button>
      </div>

      {/* ==================== TAB 1: VASTE BESCHIKBAARHEID ==================== */}
      {activeTab === 'recurring' && (
        <div>
          <div className="flex justify-end mb-4">
            <Button onClick={() => openCreateRecurring()}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Tijdslot toevoegen
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {WEEKDAYS.map((day) => {
              const items = recurringByDay[day.value] || [];
              return (
                <Card key={day.value} className="min-h-[100px]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{day.short}</p>
                      <p className="text-sm font-bold text-white">{day.label}</p>
                    </div>
                    <button
                      onClick={() => openCreateRecurring(day.value)}
                      className="p-2 rounded-lg text-gray-500 hover:text-brand-400 hover:bg-brand-500/10 transition-colors active:bg-brand-500/20"
                      title="Tijdslot toevoegen"
                    >
                      <PlusIcon className="h-4 w-4" />
                    </button>
                  </div>

                  {items.length > 0 ? (
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="p-2.5 bg-green-500/10 border border-green-500/20 rounded-lg text-xs cursor-pointer hover:bg-green-500/15 active:bg-green-500/20"
                          onClick={() => openEditRecurring(item)}
                        >
                          <div className="flex items-center justify-between">
                            <Badge variant="success" size="sm">Beschikbaar</Badge>
                            {/* Always visible on mobile */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); openEditRecurring(item); }}
                                className="p-1.5 text-gray-400 hover:text-brand-400 active:text-brand-300 rounded"
                              >
                                <PencilSquareIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteRecurring(item.id); }}
                                className="p-1.5 text-gray-400 hover:text-red-400 active:text-red-300 rounded"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <p className="text-green-400 font-medium mt-1">{item.startTime} – {item.endTime}</p>
                          <p className="text-gray-500 mt-0.5">
                            Vanaf {formatDate(item.validFrom, 'd MMM yyyy')}
                            {item.validTo ? ` t/m ${formatDate(item.validTo, 'd MMM yyyy')}` : ''}
                          </p>
                          {item.note && <p className="text-gray-600 mt-0.5 italic">{item.note}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600 italic">Geen tijdsloten</p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== TAB 2: UITZONDERINGEN ==================== */}
      {activeTab === 'exceptions' && (
        <div>
          {/* View toggle + actions */}
          <Card className="mb-4">
            <div className="flex flex-col gap-3">
              {/* Top row: view toggle + fill month */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* View toggle */}
                <div className="flex bg-navy-900 rounded-lg p-0.5">
                  <button
                    onClick={() => setExceptionView('week')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      exceptionView === 'week' ? 'bg-navy-700 text-white' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <Squares2X2Icon className="h-3.5 w-3.5" />
                    Week
                  </button>
                  <button
                    onClick={() => setExceptionView('month')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      exceptionView === 'month' ? 'bg-navy-700 text-white' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <CalendarDaysIcon className="h-3.5 w-3.5" />
                    Maand
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {exceptionView === 'month' && (
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
                      <span className="hidden sm:inline">Vul maand in</span>
                      <span className="sm:hidden">Invullen</span>
                    </Button>
                  )}
                  {exceptionView === 'week' && (
                    <Button size="sm" variant="ghost" onClick={() => setCopyModal(true)}>
                      <DocumentDuplicateIcon className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Kopieer week</span>
                      <span className="sm:hidden">Kopieer</span>
                    </Button>
                  )}
                  <Button size="sm" onClick={() => openCreateException()}>
                    <PlusIcon className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Uitzondering</span>
                    <span className="sm:hidden">Nieuw</span>
                  </Button>
                </div>
              </div>

              {/* Navigation row */}
              <div className="flex items-center justify-center gap-1 sm:gap-2">
                <button
                  onClick={() => exceptionView === 'week'
                    ? setExceptionWeek(subWeeks(exceptionWeek, 1))
                    : setExceptionMonth(subMonths(exceptionMonth, 1))
                  }
                  className="p-2 rounded-lg hover:bg-navy-800 text-gray-400 hover:text-white transition-colors active:bg-navy-700"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <h2 className="text-sm sm:text-lg font-semibold text-white text-center min-w-0 flex-1 sm:flex-initial sm:min-w-[240px]">
                  {exceptionView === 'week' ? (
                    <>
                      <span className="sm:hidden">Wk {format(exWeekStart, 'w')} — {format(exWeekStart, 'd MMM', { locale: nl })} - {format(exWeekEnd, 'd MMM', { locale: nl })}</span>
                      <span className="hidden sm:inline">Week {format(exWeekStart, 'w')} — {format(exWeekStart, 'd MMM', { locale: nl })} t/m {format(exWeekEnd, 'd MMM', { locale: nl })}</span>
                    </>
                  ) : (
                    <span className="capitalize">{format(monthStart, 'MMMM yyyy', { locale: nl })}</span>
                  )}
                </h2>
                <button
                  onClick={() => exceptionView === 'week'
                    ? setExceptionWeek(addWeeks(exceptionWeek, 1))
                    : setExceptionMonth(addMonths(exceptionMonth, 1))
                  }
                  className="p-2 rounded-lg hover:bg-navy-800 text-gray-400 hover:text-white transition-colors active:bg-navy-700"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </Card>

          {/* WEEK VIEW */}
          {exceptionView === 'week' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
              {exceptionDays.map((day) => {
                const dayExceptions = exceptions.filter((e) => isSameDay(new Date(e.date), day));
                const isToday = isSameDay(day, new Date());

                return (
                  <Card
                    key={day.toISOString()}
                    className={`min-h-[100px] ${isToday ? 'border-brand-500/50 ring-1 ring-brand-500/20' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className={`text-xs font-medium uppercase tracking-wider ${isToday ? 'text-brand-400' : 'text-gray-500'}`}>
                          {format(day, 'EEE', { locale: nl })}
                        </p>
                        <p className={`text-lg font-bold ${isToday ? 'text-brand-400' : 'text-white'}`}>
                          {format(day, 'd')}
                        </p>
                      </div>
                      <button
                        onClick={() => openCreateException(day)}
                        className="p-2 rounded-lg text-gray-500 hover:text-brand-400 hover:bg-brand-500/10 transition-colors active:bg-brand-500/20"
                        title="Uitzondering toevoegen"
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </div>

                    {dayExceptions.length > 0 ? (
                      <div className="space-y-2">
                        {dayExceptions.map((exc) => {
                          const isAvailable = exc.type === 'AVAILABLE';
                          return (
                            <div
                              key={exc.id}
                              className={`p-2.5 rounded-lg text-xs cursor-pointer transition-colors ${
                                isAvailable
                                  ? 'bg-green-500/10 border border-green-500/20 hover:bg-green-500/15 active:bg-green-500/20'
                                  : 'bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 active:bg-red-500/20'
                              }`}
                              onClick={() => openEditException(exc)}
                            >
                              <div className="flex items-center justify-between">
                                <Badge variant={isAvailable ? 'success' : 'danger'} size="sm">
                                  {isAvailable ? 'Beschikbaar' : 'Niet beschikbaar'}
                                </Badge>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openEditException(exc); }}
                                    className="p-1.5 text-gray-400 hover:text-brand-400 active:text-brand-300 rounded"
                                  >
                                    <PencilSquareIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteException(exc.id); }}
                                    className="p-1.5 text-gray-400 hover:text-red-400 active:text-red-300 rounded"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                              {exc.startTime && exc.endTime ? (
                                <p className={`mt-1 font-medium ${isAvailable ? 'text-green-400' : 'text-red-400'}`}>
                                  {exc.startTime} – {exc.endTime}
                                </p>
                              ) : (
                                <p className="text-red-400 mt-1 font-medium">Hele dag</p>
                              )}
                              {exc.note && <p className="text-gray-500 mt-0.5 italic">{exc.note}</p>}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-600 italic">Geen uitzonderingen</p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* MONTH VIEW — Calendar grid */}
          {exceptionView === 'month' && (
            <div>
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
                  const dayExceptions = exceptionsByDate[dateStr] || [];
                  const isToday = isSameDay(day, new Date());
                  const isPast = isBefore(day, new Date()) && !isToday;
                  const weekend = isWeekend(day);

                  const hasAvailable = dayExceptions.some((e) => e.type === 'AVAILABLE');
                  const hasUnavailable = dayExceptions.some((e) => e.type === 'UNAVAILABLE');

                  return (
                    <div
                      key={dateStr}
                      onClick={() => dayExceptions.length === 1 ? openEditException(dayExceptions[0]) : openCreateException(day)}
                      className={`min-h-[56px] sm:min-h-[80px] rounded-lg border p-1 sm:p-2 cursor-pointer transition-all active:scale-[0.97] select-none ${
                        isToday
                          ? 'border-brand-500/50 bg-brand-500/5'
                          : isPast
                            ? 'border-navy-700/50 bg-navy-900/30 opacity-50'
                            : weekend
                              ? 'border-navy-700/50 bg-navy-800/30'
                              : 'border-navy-700 bg-navy-800/50 hover:border-navy-600 active:border-navy-500'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className={`text-xs sm:text-sm font-semibold leading-none ${
                          isToday ? 'text-brand-400' : isPast ? 'text-gray-600' : weekend ? 'text-gray-500' : 'text-white'
                        }`}>
                          {format(day, 'd')}
                        </span>
                        {dayExceptions.length > 1 && (
                          <span className="text-[9px] sm:text-[10px] bg-navy-600 text-gray-300 rounded-full px-1 leading-relaxed">
                            {dayExceptions.length}
                          </span>
                        )}
                      </div>

                      {/* Status indicators */}
                      {dayExceptions.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {hasAvailable && (
                            <div className="flex items-center gap-0.5 sm:gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                              <span className="text-[9px] sm:text-xs text-green-400 truncate leading-tight">
                                {dayExceptions.find((e) => e.type === 'AVAILABLE')?.startTime || ''}
                                {dayExceptions.find((e) => e.type === 'AVAILABLE')?.endTime
                                  ? `–${dayExceptions.find((e) => e.type === 'AVAILABLE')?.endTime}`
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
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  Niet beschikbaar
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-navy-600" />
                  Niet ingevuld
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== RECURRING MODAL ==================== */}
      <Modal
        isOpen={recurringModal}
        onClose={() => { setRecurringModal(false); setEditingRecurring(null); }}
        title={editingRecurring ? 'Beschikbaarheid bewerken' : 'Beschikbaarheid toevoegen'}
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
              label="Starttijd"
              value={recurringForm.startTime}
              onChange={(e) => setRecurringForm({ ...recurringForm, startTime: e.target.value })}
              options={TIME_SLOTS.map(t => ({ value: t, label: t }))}
            />
            <Select
              label="Eindtijd"
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
            placeholder="Bijv. alleen beschikbaar voor locatie X..."
          />
          <div className="flex justify-between pt-4 border-t border-navy-700">
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

      {/* ==================== EXCEPTION MODAL ==================== */}
      <Modal
        isOpen={exceptionModal}
        onClose={() => { setExceptionModal(false); setEditingException(null); }}
        title={editingException ? 'Uitzondering bewerken' : 'Uitzondering toevoegen'}
      >
        <form onSubmit={handleExceptionSubmit} noValidate className="space-y-4">
          <Input
            label="Datum"
            type="date"
            value={exceptionForm.date}
            onChange={(e) => setExceptionForm({ ...exceptionForm, date: e.target.value })}
            required
          />
          <Select
            label="Type"
            value={exceptionForm.type}
            onChange={(e) => setExceptionForm({ ...exceptionForm, type: e.target.value as 'AVAILABLE' | 'UNAVAILABLE' })}
            options={[
              { value: 'AVAILABLE', label: 'Beschikbaar (met tijden)' },
              { value: 'UNAVAILABLE', label: 'Niet beschikbaar (hele dag)' },
            ]}
          />
          {exceptionForm.type === 'AVAILABLE' && (
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Starttijd"
                value={exceptionForm.startTime}
                onChange={(e) => setExceptionForm({ ...exceptionForm, startTime: e.target.value })}
                options={TIME_SLOTS.map(t => ({ value: t, label: t }))}
              />
              <Select
                label="Eindtijd"
                value={exceptionForm.endTime}
                onChange={(e) => setExceptionForm({ ...exceptionForm, endTime: e.target.value })}
                options={TIME_SLOTS.map(t => ({ value: t, label: t }))}
              />
            </div>
          )}
          {exceptionForm.type === 'UNAVAILABLE' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-sm text-red-400">Hele dag niet beschikbaar — er worden geen tijden opgeslagen.</p>
            </div>
          )}
          <Textarea
            label="Opmerking (optioneel)"
            value={exceptionForm.note}
            onChange={(e) => setExceptionForm({ ...exceptionForm, note: e.target.value })}
            placeholder="Bijv. vakantie, ziekenhuisafspraak..."
          />
          <div className="flex justify-between pt-4 border-t border-navy-700">
            <div>
              {editingException && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => { handleDeleteException(editingException.id); setExceptionModal(false); setEditingException(null); }}
                >
                  Verwijderen
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={() => { setExceptionModal(false); setEditingException(null); }}>
                Annuleren
              </Button>
              <Button type="submit" loading={saving}>
                {editingException ? 'Bijwerken' : 'Opslaan'}
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
          <div className="bg-navy-800 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Bron</p>
            <p className="text-sm text-white font-medium">
              Week {format(exWeekStart, 'w')} — {format(exWeekStart, 'd MMM', { locale: nl })} t/m {format(exWeekEnd, 'd MMM yyyy', { locale: nl })}
            </p>
            <p className="text-xs text-gray-400 mt-1">{exceptions.length} uitzondering(en) in deze week</p>
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
              <strong>Let op:</strong> Datums waar al uitzonderingen bestaan worden overgeslagen.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-navy-700">
            <Button variant="ghost" onClick={() => setCopyModal(false)}>Annuleren</Button>
            <Button onClick={handleCopyWeek} loading={copying} disabled={exceptions.length === 0}>
              <DocumentDuplicateIcon className="h-4 w-4 mr-1" />
              Kopiëren
            </Button>
          </div>
        </div>
      </Modal>

      {/* ==================== FILL MONTH MODAL ==================== */}
      <Modal
        isOpen={fillMonthModal}
        onClose={() => setFillMonthModal(false)}
        title={`Maand invullen — ${format(monthStart, 'MMMM yyyy', { locale: nl })}`}
        size="sm"
      >
        <div className="space-y-4">
          <div className="bg-brand-500/10 border border-brand-500/20 rounded-lg p-3">
            <p className="text-sm text-brand-300">
              Vul in één keer je beschikbaarheid in voor alle{' '}
              {fillMonthForm.includeWeekends ? 'dagen' : 'werkdagen'} van{' '}
              <strong className="capitalize">{format(monthStart, 'MMMM yyyy', { locale: nl })}</strong>.
            </p>
            <p className="text-xs text-gray-400 mt-1">Dagen die al ingevuld zijn worden overgeslagen.</p>
          </div>

          <Select
            label="Type"
            value={fillMonthForm.type}
            onChange={(e) => setFillMonthForm({ ...fillMonthForm, type: e.target.value as 'AVAILABLE' | 'UNAVAILABLE' })}
            options={[
              { value: 'AVAILABLE', label: 'Beschikbaar (met tijden)' },
              { value: 'UNAVAILABLE', label: 'Niet beschikbaar (hele dag)' },
            ]}
          />

          {fillMonthForm.type === 'AVAILABLE' && (
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Starttijd"
                value={fillMonthForm.startTime}
                onChange={(e) => setFillMonthForm({ ...fillMonthForm, startTime: e.target.value })}
                options={TIME_SLOTS.map(t => ({ value: t, label: t }))}
              />
              <Select
                label="Eindtijd"
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
              className="w-4 h-4 rounded border-navy-600 bg-navy-800 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm text-gray-300">Inclusief weekenden</span>
          </label>

          <Textarea
            label="Opmerking (optioneel)"
            value={fillMonthForm.note}
            onChange={(e) => setFillMonthForm({ ...fillMonthForm, note: e.target.value })}
            placeholder="Bijv. standaard beschikbaar deze maand..."
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-navy-700">
            <Button variant="ghost" onClick={() => setFillMonthModal(false)}>Annuleren</Button>
            <Button onClick={handleFillMonth} loading={filling}>
              <CalendarDaysIcon className="h-4 w-4 mr-1" />
              Maand invullen
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
