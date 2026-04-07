'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useFuncties } from '@/lib/swr';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
  TagIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const PRESET_COLORS = [
  '#f97316', // orange
  '#3b82f6', // blue
  '#22c55e', // green
  '#ef4444', // red
  '#a855f7', // purple
  '#06b6d4', // cyan
  '#eab308', // yellow
  '#ec4899', // pink
];

export default function FunctiesPage() {
  const { data: session } = useSession();
  const { data: functies = [], mutate } = useFuncties(true); // all=true to show inactive too
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#f97316');
  const [newHourlyRate, setNewHourlyRate] = useState('');
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editHourlyRate, setEditHourlyRate] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = (session?.user as any)?.role === 'ADMIN';

  async function handleCreate() {
    if (!newName.trim()) {
      toast.error('Vul een naam in');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/functies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), color: newColor, hourlyRate: parseFloat(newHourlyRate) || 0 }),
      });
      if (res.ok) {
        toast.success('Functie aangemaakt');
        setNewName('');
        setNewColor('#f97316');
        setNewHourlyRate('');
        setCreating(false);
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
      const res = await fetch(`/api/functies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), color: editColor, hourlyRate: parseFloat(editHourlyRate) || 0 }),
      });
      if (res.ok) {
        toast.success('Functie bijgewerkt');
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
      const res = await fetch(`/api/functies/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        if (data.deactivated) {
          toast.success(data.message);
        } else {
          toast.success('Functie verwijderd');
        }
        mutate();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Verwijderen mislukt');
      }
    } catch {
      toast.error('Er ging iets mis');
    }
  }

  async function handleToggleActive(id: string, name: string, currentActive: boolean) {
    try {
      const res = await fetch(`/api/functies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, active: !currentActive }),
      });
      if (res.ok) {
        toast.success(currentActive ? 'Functie gedeactiveerd' : 'Functie geactiveerd');
        mutate();
      }
    } catch {
      toast.error('Er ging iets mis');
    }
  }

  if (!isAdmin) {
    return (
      <div className="animate-fade-in">
        <h1 className="page-title">Functies</h1>
        <Card><p className="text-gray-400 text-center py-8">Alleen admins kunnen functies beheren.</p></Card>
      </div>
    );
  }

  const activeFuncties = functies.filter((f: any) => f.active);
  const inactiveFuncties = functies.filter((f: any) => !f.active);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Functies</h1>
          <p className="page-subtitle">Beheer de functies die aan diensten gekoppeld kunnen worden</p>
        </div>
        {!creating && (
          <Button onClick={() => setCreating(true)} size="sm">
            <PlusIcon className="h-4 w-4 mr-1" />
            Nieuwe Functie
          </Button>
        )}
      </div>

      {/* Create new functie */}
      {creating && (
        <Card className="mb-4 border border-orange-500/30">
          <CardHeader>
            <CardTitle>Nieuwe Functie</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <Input
              label="Naam"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Bijv. Beveiliging, Receptie, Toezicht..."
              autoFocus
            />
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Kleur</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      newColor === c ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Voorbeeld:</span>
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-gray-900"
                style={{ backgroundColor: newColor + '33', color: newColor, border: `1px solid ${newColor}55` }}
              >
                {newName || 'Functienaam'}
              </span>
            </div>
            <Input
              label="Uurtarief (€)"
              type="number"
              min="0"
              step="0.01"
              value={newHourlyRate}
              onChange={(e) => setNewHourlyRate(e.target.value)}
              placeholder="Bijv. 25.00"
            />
            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreate} loading={saving} size="sm">
                <CheckIcon className="h-4 w-4 mr-1" />
                Opslaan
              </Button>
              <Button variant="secondary" onClick={() => { setCreating(false); setNewName(''); }} size="sm">
                <XMarkIcon className="h-4 w-4 mr-1" />
                Annuleren
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Active functies */}
      <Card>
        <CardHeader>
          <CardTitle>Actieve Functies ({activeFuncties.length})</CardTitle>
        </CardHeader>
        {activeFuncties.length === 0 ? (
          <div className="text-center py-8">
            <TagIcon className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Nog geen functies aangemaakt</p>
            <p className="text-sm text-gray-600 mt-1">Klik op &quot;Nieuwe Functie&quot; om te beginnen</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeFuncties.map((f: any) => (
              <div key={f.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                {editingId === f.id ? (
                  <div className="flex-1 flex items-center gap-3 flex-wrap">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 min-w-[120px] bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
                      autoFocus
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editHourlyRate}
                      onChange={(e) => setEditHourlyRate(e.target.value)}
                      className="w-24 bg-white border border-gray-300 rounded px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
                      placeholder="€/uur"
                    />
                    <div className="flex gap-1">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditColor(c)}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${
                            editColor === c ? 'border-white scale-110' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <Button size="sm" onClick={() => handleUpdate(f.id)} loading={saving}>
                      <CheckIcon className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                      <XMarkIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: f.color + '33', color: f.color, border: `1px solid ${f.color}55` }}
                      >
                        {f.name}
                      </span>
                      {f.hourlyRate > 0 && (
                        <span className="text-sm text-gray-500">€{Number(f.hourlyRate).toFixed(2)}/u</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingId(f.id); setEditName(f.name); setEditColor(f.color); setEditHourlyRate(String(f.hourlyRate || '')); }}
                        className="p-1.5 text-gray-500 hover:text-gray-900 transition-colors rounded"
                        title="Bewerken"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(f.id, f.name)}
                        className="p-1.5 text-gray-500 hover:text-red-400 transition-colors rounded"
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

      {/* Inactive functies */}
      {inactiveFuncties.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Inactieve Functies ({inactiveFuncties.length})</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {inactiveFuncties.map((f: any) => (
              <div key={f.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 opacity-60 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium line-through"
                    style={{ backgroundColor: f.color + '33', color: f.color, border: `1px solid ${f.color}55` }}
                  >
                    {f.name}
                  </span>
                  <span className="text-xs text-gray-600">Inactief</span>
                </div>
                <button
                  onClick={() => handleToggleActive(f.id, f.name, f.active)}
                  className="text-xs text-green-400 hover:text-green-300 transition-colors"
                >
                  Heractiveren
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
