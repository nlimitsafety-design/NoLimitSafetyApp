'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useKwalificaties } from '@/lib/swr';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import {
  TagIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function KwalificatiesPage() {
  const { data: session } = useSession();
  const { data: kwalificaties = [], mutate } = useKwalificaties(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = (session?.user as any)?.role === 'ADMIN';

  async function handleCreate() {
    if (!newName.trim()) {
      toast.error('Vul een naam in');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/kwalificaties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        toast.success('Kwalificatie aangemaakt');
        setNewName('');
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
      const res = await fetch(`/api/kwalificaties/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (res.ok) {
        toast.success('Kwalificatie bijgewerkt');
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
      const res = await fetch(`/api/kwalificaties/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        if (data.deactivated) {
          toast.success(data.message);
        } else {
          toast.success('Kwalificatie verwijderd');
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

  async function handleToggleActive(id: string, currentActive: boolean, name: string) {
    try {
      const res = await fetch(`/api/kwalificaties/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, active: !currentActive }),
      });
      if (res.ok) {
        toast.success(currentActive ? 'Kwalificatie gedeactiveerd' : 'Kwalificatie geactiveerd');
        mutate();
      } else {
        toast.error('Bijwerken mislukt');
      }
    } catch {
      toast.error('Er ging iets mis');
    }
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Je hebt geen toegang tot deze pagina.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Kwalificaties</h1>
          <p className="page-subtitle">Beheer de kwalificaties voor medewerkers</p>
        </div>
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Nieuwe kwalificatie
          </Button>
        )}
      </div>

      {creating && (
        <Card className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3">
            <div className="flex-1">
              <Input
                label="Naam"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Bijv. EHBO, BHV, Portofoon..."
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="flex gap-2 pb-0.5">
              <Button onClick={handleCreate} loading={saving} size="sm">
                <CheckIcon className="h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={() => { setCreating(false); setNewName(''); }} size="sm">
                <XMarkIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {kwalificaties.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <TagIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nog geen kwalificaties aangemaakt</p>
              <p className="text-sm text-gray-400 mt-1">Klik op &quot;Nieuwe kwalificatie&quot; om te beginnen</p>
            </div>
          </Card>
        ) : (
          kwalificaties.map((kwal: any) => (
            <Card key={kwal.id}>
              <div className="flex items-center justify-between">
                {editingId === kwal.id ? (
                  <div className="flex items-center gap-3 flex-1 mr-4">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdate(kwal.id)}
                    />
                    <Button onClick={() => handleUpdate(kwal.id)} loading={saving} size="sm">
                      <CheckIcon className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" onClick={() => setEditingId(null)} size="sm">
                      <XMarkIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center font-medium rounded-full px-3 py-1 text-sm border bg-blue-50 text-blue-600 border-blue-200">
                        {kwal.name}
                      </span>
                      {!kwal.active && (
                        <Badge variant="danger">Inactief</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleActive(kwal.id, kwal.active, kwal.name)}
                        className={`p-1.5 rounded-lg transition-colors ${kwal.active ? 'text-gray-400 hover:text-yellow-600 hover:bg-yellow-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                        title={kwal.active ? 'Deactiveren' : 'Activeren'}
                      >
                        {kwal.active ? (
                          <XMarkIcon className="h-4 w-4" />
                        ) : (
                          <CheckIcon className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => { setEditingId(kwal.id); setEditName(kwal.name); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-brand-500/10 transition-colors"
                        title="Bewerken"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(kwal.id, kwal.name)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Verwijderen"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
