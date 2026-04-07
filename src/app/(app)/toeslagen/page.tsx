'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useToeslagen } from '@/lib/swr';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import {
  CurrencyEuroIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const TYPE_OPTIONS = [
  { value: 'TIME_BASED', label: 'Tijdgebaseerd (bijv. avond/nacht)' },
  { value: 'DAY_BASED', label: 'Daggebaseerd (bijv. weekend)' },
];

const DAY_OPTIONS = [
  { value: 1, label: 'Maandag' },
  { value: 2, label: 'Dinsdag' },
  { value: 3, label: 'Woensdag' },
  { value: 4, label: 'Donderdag' },
  { value: 5, label: 'Vrijdag' },
  { value: 6, label: 'Zaterdag' },
  { value: 7, label: 'Zondag' },
];

interface Toeslag {
  id: string;
  name: string;
  type: 'TIME_BASED' | 'DAY_BASED';
  startTime: string | null;
  endTime: string | null;
  days: string | null;
  percentage: number;
  active: boolean;
  sortOrder: number;
}

export default function ToeslagenPage() {
  const { data: session } = useSession();
  const { data: toeslagen = [], mutate } = useToeslagen(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'TIME_BASED' | 'DAY_BASED'>('TIME_BASED');
  const [newStartTime, setNewStartTime] = useState('20:00');
  const [newEndTime, setNewEndTime] = useState('00:00');
  const [newDays, setNewDays] = useState<number[]>([6]); // Saturday
  const [newPercentage, setNewPercentage] = useState(130);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<'TIME_BASED' | 'DAY_BASED'>('TIME_BASED');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editDays, setEditDays] = useState<number[]>([]);
  const [editPercentage, setEditPercentage] = useState(130);

  const isAdmin = (session?.user as any)?.role === 'ADMIN';

  function resetCreateForm() {
    setNewName('');
    setNewType('TIME_BASED');
    setNewStartTime('20:00');
    setNewEndTime('00:00');
    setNewDays([6]);
    setNewPercentage(130);
    setCreating(false);
  }

  function startEdit(t: Toeslag) {
    setEditingId(t.id);
    setEditName(t.name);
    setEditType(t.type);
    setEditStartTime(t.startTime || '20:00');
    setEditEndTime(t.endTime || '00:00');
    setEditDays(t.days ? t.days.split(',').map(Number) : []);
    setEditPercentage(t.percentage);
  }

  async function handleCreate() {
    if (!newName.trim()) {
      toast.error('Vul een naam in');
      return;
    }
    if (newPercentage <= 100) {
      toast.error('Percentage moet groter dan 100 zijn');
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        name: newName.trim(),
        type: newType,
        percentage: newPercentage,
      };
      if (newType === 'TIME_BASED') {
        body.startTime = newStartTime;
        body.endTime = newEndTime;
      } else {
        body.days = newDays.join(',');
      }

      const res = await fetch('/api/toeslagen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success('Toeslag aangemaakt');
        resetCreateForm();
        mutate();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Aanmaken mislukt');
      }
    } catch {
      toast.error('Er ging iets mis');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) {
      toast.error('Vul een naam in');
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        name: editName.trim(),
        type: editType,
        percentage: editPercentage,
      };
      if (editType === 'TIME_BASED') {
        body.startTime = editStartTime;
        body.endTime = editEndTime;
      } else {
        body.days = editDays.join(',');
      }

      const res = await fetch(`/api/toeslagen/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success('Toeslag bijgewerkt');
        setEditingId(null);
        mutate();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Bijwerken mislukt');
      }
    } catch {
      toast.error('Er ging iets mis');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Weet je zeker dat je "${name}" wilt verwijderen?`)) return;
    try {
      const res = await fetch(`/api/toeslagen/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Toeslag verwijderd');
        mutate();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Verwijderen mislukt');
      }
    } catch {
      toast.error('Er ging iets mis');
    }
  }

  async function handleToggleActive(t: Toeslag) {
    try {
      const res = await fetch(`/api/toeslagen/${t.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: t.name, type: t.type, percentage: t.percentage, active: !t.active, ...(t.type === 'TIME_BASED' ? { startTime: t.startTime, endTime: t.endTime } : { days: t.days }) }),
      });
      if (res.ok) {
        toast.success(t.active ? 'Toeslag gedeactiveerd' : 'Toeslag geactiveerd');
        mutate();
      }
    } catch {
      toast.error('Er ging iets mis');
    }
  }

  function formatToeslagInfo(t: Toeslag): string {
    if (t.type === 'TIME_BASED') {
      return `${t.startTime} - ${t.endTime}`;
    }
    if (t.days) {
      const dayNames = t.days.split(',').map(Number).map(d => {
        const day = DAY_OPTIONS.find(o => o.value === d);
        return day?.label || `Dag ${d}`;
      });
      return dayNames.join(', ');
    }
    return '';
  }

  function toggleDay(day: number, current: number[], setter: (d: number[]) => void) {
    if (current.includes(day)) {
      setter(current.filter(d => d !== day));
    } else {
      setter([...current, day].sort());
    }
  }

  if (!isAdmin) {
    return (
      <div className="animate-fade-in">
        <h1 className="page-title">Toeslagen</h1>
        <Card><p className="text-gray-400 text-center py-8">Alleen admins kunnen toeslagen beheren.</p></Card>
      </div>
    );
  }

  const activeToeslagen = toeslagen.filter((t: Toeslag) => t.active);
  const inactiveToeslagen = toeslagen.filter((t: Toeslag) => !t.active);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Toeslagen</h1>
          <p className="page-subtitle">Beheer de toeslagen voor avond, nacht en weekenddiensten</p>
        </div>
        {!creating && (
          <Button onClick={() => setCreating(true)} size="sm">
            <PlusIcon className="h-4 w-4 mr-1" />
            Nieuwe Toeslag
          </Button>
        )}
      </div>

      {/* Info card */}
      <Card className="mb-4 border border-gray-200">
        <div className="flex gap-3">
          <CurrencyEuroIcon className="h-5 w-5 text-brand-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-400">
            <p className="text-gray-600 font-medium mb-1">Hoe werken toeslagen?</p>
            <p>Toeslagen worden automatisch berekend in rapportages. Een percentage van 130% betekent dat het uurtarief met 30% verhoogd wordt voor uren die onder deze toeslag vallen.</p>
            <p className="mt-1"><strong className="text-gray-600">Tijdgebaseerd:</strong> Geldt voor uren binnen een bepaald tijdvenster (bijv. 20:00 - 06:00 voor nacht).</p>
            <p><strong className="text-gray-600">Daggebaseerd:</strong> Geldt voor alle uren op bepaalde dagen (bijv. zaterdag, zondag).</p>
            <p className="mt-1 text-yellow-500/80">Let op: Toeslagen kunnen stapelen. Een nachtdienst op zondag krijgt zowel de nacht- als zondagtoeslag.</p>
          </div>
        </div>
      </Card>

      {/* Create form */}
      {creating && (
        <Card className="mb-4 border border-brand-500/30">
          <CardHeader>
            <CardTitle>Nieuwe Toeslag</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Naam"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Bijv. Avondtoeslag, Nachttoeslag..."
                autoFocus
              />
              <Input
                label="Percentage (%)"
                type="number"
                min={101}
                max={500}
                value={newPercentage}
                onChange={(e) => setNewPercentage(Number(e.target.value))}
              />
            </div>
            <Select
              label="Type"
              value={newType}
              onChange={(e) => setNewType(e.target.value as 'TIME_BASED' | 'DAY_BASED')}
              options={TYPE_OPTIONS}
            />
            {newType === 'TIME_BASED' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Input
                  label="Starttijd"
                  type="time"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                />
                <Input
                  label="Eindtijd"
                  type="time"
                  value={newEndTime}
                  onChange={(e) => setNewEndTime(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Dagen</label>
                <div className="flex flex-wrap gap-2">
                  {DAY_OPTIONS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleDay(d.value, newDays, setNewDays)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        newDays.includes(d.value)
                          ? 'bg-brand-500/20 text-brand-500 border border-brand-500/40'
                          : 'bg-gray-100 text-gray-400 border border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-400">
                Voorbeeld: Bij een uurtarief van €15,00 en percentage van {newPercentage}% wordt het tarief{' '}
                <span className="text-brand-500 font-semibold">
                  €{(15 * newPercentage / 100).toFixed(2)}
                </span>{' '}
                ({newPercentage - 100}% extra = €{(15 * (newPercentage - 100) / 100).toFixed(2)} toeslag per uur)
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreate} loading={saving} size="sm">
                <CheckIcon className="h-4 w-4 mr-1" />
                Opslaan
              </Button>
              <Button variant="secondary" onClick={resetCreateForm} size="sm">
                <XMarkIcon className="h-4 w-4 mr-1" />
                Annuleren
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Active toeslagen */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Actieve Toeslagen ({activeToeslagen.length})</CardTitle>
        </CardHeader>
        {activeToeslagen.length === 0 ? (
          <div className="text-center py-8">
            <CurrencyEuroIcon className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Nog geen toeslagen aangemaakt</p>
            <p className="text-sm text-gray-600 mt-1">Klik op &quot;Nieuwe Toeslag&quot; om te beginnen</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeToeslagen.map((t: Toeslag) => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                {editingId === t.id ? (
                  /* Edit mode */
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Naam"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                      <Input
                        label="Percentage (%)"
                        type="number"
                        min={101}
                        max={500}
                        value={editPercentage}
                        onChange={(e) => setEditPercentage(Number(e.target.value))}
                      />
                    </div>
                    <Select
                      label="Type"
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as 'TIME_BASED' | 'DAY_BASED')}
                      options={TYPE_OPTIONS}
                    />
                    {editType === 'TIME_BASED' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Starttijd"
                          type="time"
                          value={editStartTime}
                          onChange={(e) => setEditStartTime(e.target.value)}
                        />
                        <Input
                          label="Eindtijd"
                          type="time"
                          value={editEndTime}
                          onChange={(e) => setEditEndTime(e.target.value)}
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">Dagen</label>
                        <div className="flex flex-wrap gap-2">
                          {DAY_OPTIONS.map((d) => (
                            <button
                              key={d.value}
                              type="button"
                              onClick={() => toggleDay(d.value, editDays, setEditDays)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                editDays.includes(d.value)
                                  ? 'bg-brand-500/20 text-brand-500 border border-brand-500/40'
                                  : 'bg-gray-100 text-gray-400 border border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button onClick={() => handleUpdate(t.id)} loading={saving} size="sm">
                        <CheckIcon className="h-4 w-4 mr-1" />
                        Opslaan
                      </Button>
                      <Button variant="secondary" onClick={() => setEditingId(null)} size="sm">
                        <XMarkIcon className="h-4 w-4 mr-1" />
                        Annuleren
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Display mode */
                  <>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        t.type === 'TIME_BASED' ? 'bg-purple-500/15' : 'bg-cyan-500/15'
                      }`}>
                        {t.type === 'TIME_BASED' ? (
                          <ClockIcon className="h-5 w-5 text-purple-400" />
                        ) : (
                          <CalendarDaysIcon className="h-5 w-5 text-cyan-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-gray-900">{t.name}</p>
                          <Badge variant={t.type === 'TIME_BASED' ? 'info' : 'warning'}>
                            {t.percentage}%
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500">{formatToeslagInfo(t)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(t)}
                        className="p-2 text-gray-500 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-200"
                        title="Bewerken"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(t)}
                        className="p-2 text-gray-500 hover:text-yellow-400 transition-colors rounded-lg hover:bg-gray-200"
                        title="Deactiveren"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id, t.name)}
                        className="p-2 text-gray-500 hover:text-red-400 transition-colors rounded-lg hover:bg-gray-200"
                        title="Verwijderen"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Inactive toeslagen */}
      {inactiveToeslagen.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Inactieve Toeslagen ({inactiveToeslagen.length})</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {inactiveToeslagen.map((t: Toeslag) => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 opacity-60 hover:opacity-100 transition-all">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-gray-800/50 flex-shrink-0">
                    {t.type === 'TIME_BASED' ? (
                      <ClockIcon className="h-5 w-5 text-gray-600" />
                    ) : (
                      <CalendarDaysIcon className="h-5 w-5 text-gray-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-400">{t.name}</p>
                      <Badge variant="default">{t.percentage}%</Badge>
                    </div>
                    <p className="text-sm text-gray-600">{formatToeslagInfo(t)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleActive(t)}
                    className="p-2 text-gray-500 hover:text-green-400 transition-colors rounded-lg hover:bg-gray-200"
                    title="Activeren"
                  >
                    <CheckIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id, t.name)}
                    className="p-2 text-gray-500 hover:text-red-400 transition-colors rounded-lg hover:bg-gray-200"
                    title="Verwijderen"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
