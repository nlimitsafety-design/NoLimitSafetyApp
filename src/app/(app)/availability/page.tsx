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
import { formatDate, TIME_SLOTS, WEEKDAYS, getISOWeekday } from '@/lib/utils';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentDuplicateIcon,
  CalendarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { format, startOfWeek, addWeeks, subWeeks, addDays, isSameDay } from 'date-fns';
import { nl } from 'date-fns/locale';
import toast from 'react-hot-toast';

type TabType = 'recurring' | 'exceptions';

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
  const isAdmin = session?.user?.role === 'ADMIN';

  // Recurring data
  const { data: rawRecurring = [], mutate: mutateRecurring } = useRecurringAvailability();
  const recurring = rawRecurring as RecurringItem[];

  // Exceptions data (current view range)
  const [exceptionWeek, setExceptionWeek] = useState(new Date());
  const exWeekStart = startOfWeek(exceptionWeek, { weekStartsOn: 1 });
  const exWeekEnd = addDays(exWeekStart, 6);
  const exStart = format(exWeekStart, 'yyyy-MM-dd');
  const exEnd = format(exWeekEnd, 'yyyy-MM-dd');
  const { data: rawExceptions = [], mutate: mutateExceptions } = useAvailabilityExceptions(exStart, exEnd);
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

  // Group exceptions by date for the week view
  const exceptionDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) days.push(addDays(exWeekStart, i));
    return days;
  }, [exWeekStart]);

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

    // Client-side validation
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
          fromWeekStartDate: exStart,
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

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">
            {isEmployee ? 'Mijn Beschikbaarheid' : 'Beschikbaarheid'}
          </h1>
          <p className="page-subtitle">
            Stel je vaste beschikbaarheid in en beheer uitzonderingen
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-navy-800 rounded-lg p-0.5 mb-6 w-fit">
        <button
          onClick={() => setActiveTab('recurring')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'recurring' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <ClockIcon className="h-4 w-4" />
          Vaste beschikbaarheid
        </button>
        <button
          onClick={() => setActiveTab('exceptions')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'exceptions' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <CalendarIcon className="h-4 w-4" />
          Uitzonderingen
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
                <Card key={day.value} className="min-h-[120px]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{day.short}</p>
                      <p className="text-sm font-bold text-white">{day.label}</p>
                    </div>
                    <button
                      onClick={() => openCreateRecurring(day.value)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-brand-400 hover:bg-brand-500/10 transition-colors"
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
                          className="p-2 bg-green-500/10 border border-green-500/20 rounded-lg text-xs group cursor-pointer hover:bg-green-500/15"
                          onClick={() => openEditRecurring(item)}
                        >
                          <div className="flex items-center justify-between">
                            <Badge variant="success" size="sm">Beschikbaar</Badge>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); openEditRecurring(item); }}
                                className="p-0.5 text-gray-400 hover:text-brand-400"
                              >
                                <PencilSquareIcon className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteRecurring(item.id); }}
                                className="p-0.5 text-gray-400 hover:text-red-400"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-green-400 font-medium mt-1">{item.startTime} – {item.endTime}</p>
                          <p className="text-gray-500 mt-0.5">
                            Vanaf {formatDate(item.validFrom, 'd MMM yyyy')}
                            {item.validTo ? ` t/m ${formatDate(item.validTo, 'd MMM yyyy')}` : ' (doorlopend)'}
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
          {/* Exception week nav + actions */}
          <Card className="mb-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setExceptionWeek(subWeeks(exceptionWeek, 1))}
                  className="p-2 rounded-lg hover:bg-navy-800 text-gray-400 hover:text-white transition-colors"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <h2 className="text-lg font-semibold text-white min-w-[240px] text-center">
                  Week {format(exWeekStart, 'w')} — {format(exWeekStart, 'd MMM', { locale: nl })} t/m {format(exWeekEnd, 'd MMM yyyy', { locale: nl })}
                </h2>
                <button
                  onClick={() => setExceptionWeek(addWeeks(exceptionWeek, 1))}
                  className="p-2 rounded-lg hover:bg-navy-800 text-gray-400 hover:text-white transition-colors"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setCopyModal(true)}>
                  <DocumentDuplicateIcon className="h-4 w-4 mr-1" />
                  Kopieer week
                </Button>
                <Button size="sm" onClick={() => openCreateException()}>
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Uitzondering
                </Button>
              </div>
            </div>
          </Card>

          {/* Week grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {exceptionDays.map((day) => {
              const dayExceptions = exceptions.filter((e) => isSameDay(new Date(e.date), day));
              const isToday = isSameDay(day, new Date());

              return (
                <Card
                  key={day.toISOString()}
                  className={`min-h-[120px] ${isToday ? 'border-brand-500/50 ring-1 ring-brand-500/20' : ''}`}
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
                      className="p-1.5 rounded-lg text-gray-500 hover:text-brand-400 hover:bg-brand-500/10 transition-colors"
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
                            className={`p-2 rounded-lg text-xs group cursor-pointer transition-colors ${
                              isAvailable
                                ? 'bg-green-500/10 border border-green-500/20 hover:bg-green-500/15'
                                : 'bg-red-500/10 border border-red-500/20 hover:bg-red-500/15'
                            }`}
                            onClick={() => openEditException(exc)}
                          >
                            <div className="flex items-center justify-between">
                              <Badge variant={isAvailable ? 'success' : 'danger'} size="sm">
                                {isAvailable ? 'Beschikbaar' : 'Niet beschikbaar'}
                              </Badge>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openEditException(exc); }}
                                  className="p-0.5 text-gray-400 hover:text-brand-400"
                                >
                                  <PencilSquareIcon className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteException(exc.id); }}
                                  className="p-0.5 text-gray-400 hover:text-red-400"
                                >
                                  <TrashIcon className="h-3.5 w-3.5" />
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
        </div>
      )}

      {/* ==================== RECURRING MODAL ==================== */}
      <Modal
        isOpen={recurringModal}
        onClose={() => { setRecurringModal(false); setEditingRecurring(null); }}
        title={editingRecurring ? 'Vaste beschikbaarheid bewerken' : 'Vaste beschikbaarheid toevoegen'}
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
              label="Geldig tot (leeg = doorlopend)"
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
              <strong>Let op:</strong> Datums waar al uitzonderingen bestaan worden overgeslagen (SKIP strategie).
              Vaste beschikbaarheid wordt niet aangepast.
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
    </div>
  );
}
