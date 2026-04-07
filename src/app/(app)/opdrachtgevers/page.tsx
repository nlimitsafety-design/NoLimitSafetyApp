'use client';

import { useState } from 'react';
import { useOpdrachtgevers } from '@/lib/swr';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import {
  PlusIcon,
  PencilIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Opdrachtgever {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
}

const emptyForm = {
  name: '',
  contactPerson: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
};

export default function OpdrachtgeversPage() {
  const { data: opdrachtgevers = [], mutate } = useOpdrachtgevers(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Opdrachtgever | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setSelected(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(og: Opdrachtgever) {
    setSelected(og);
    setForm({
      name: og.name,
      contactPerson: og.contactPerson || '',
      email: og.email || '',
      phone: og.phone || '',
      address: og.address || '',
      notes: og.notes || '',
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const url = selected ? `/api/opdrachtgevers/${selected.id}` : '/api/opdrachtgevers';
      const method = selected ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Fout bij opslaan');
        return;
      }
      toast.success(selected ? 'Opdrachtgever bijgewerkt' : 'Opdrachtgever toegevoegd');
      setModalOpen(false);
      mutate();
    } catch {
      toast.error('Fout bij opslaan');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(og: Opdrachtgever) {
    try {
      const res = await fetch(`/api/opdrachtgevers/${og.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !og.active }),
      });
      if (res.ok) {
        mutate();
        toast.success(og.active ? 'Opdrachtgever gedeactiveerd' : 'Opdrachtgever geactiveerd');
      }
    } catch {
      toast.error('Fout bij bijwerken');
    }
  }

  const active = opdrachtgevers.filter((og: Opdrachtgever) => og.active);
  const inactive = opdrachtgevers.filter((og: Opdrachtgever) => !og.active);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Opdrachtgevers</h1>
          <p className="page-subtitle">Beheer klanten en opdrachtgevers</p>
        </div>
        <Button onClick={openCreate}>
          <PlusIcon className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Toevoegen</span>
        </Button>
      </div>

      {opdrachtgevers.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-500">
            <BuildingOfficeIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>Nog geen opdrachtgevers</p>
            <p className="text-sm mt-1">Klik op &quot;Toevoegen&quot; om te beginnen</p>
          </div>
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {active.map((og: Opdrachtgever) => (
                <Card key={og.id} className="hover:border-brand-500/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-brand-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <BuildingOfficeIcon className="h-5 w-5 text-brand-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{og.name}</h3>
                        {og.contactPerson && <p className="text-sm text-gray-500">{og.contactPerson}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => openEdit(og)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                  </div>
                  {(og.email || og.phone || og.address) && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                      {og.email && <p className="text-xs text-gray-500">{og.email}</p>}
                      {og.phone && <p className="text-xs text-gray-500">{og.phone}</p>}
                      {og.address && <p className="text-xs text-gray-500">{og.address}</p>}
                    </div>
                  )}
                  {og.notes && (
                    <p className="mt-2 text-xs text-gray-400 italic">{og.notes}</p>
                  )}
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => handleToggleActive(og)}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Deactiveren
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {inactive.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-3">Inactief</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {inactive.map((og: Opdrachtgever) => (
                  <Card key={og.id} className="opacity-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <BuildingOfficeIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-700">{og.name}</h3>
                          {og.contactPerson && <p className="text-sm text-gray-400">{og.contactPerson}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleActive(og)}
                        className="text-xs text-brand-500 hover:text-brand-600 transition-colors"
                      >
                        Activeren
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selected ? 'Opdrachtgever bewerken' : 'Opdrachtgever toevoegen'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Bedrijfsnaam"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Bijv. Shell Nederland"
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Contactpersoon"
              value={form.contactPerson}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              placeholder="Voornaam Achternaam"
            />
            <Input
              label="E-mailadres"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="info@bedrijf.nl"
            />
            <Input
              label="Telefoonnummer"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+31 6 12345678"
            />
            <Input
              label="Adres"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Straat 1, Amsterdam"
            />
          </div>
          <Textarea
            label="Extra informatie"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Extra informatie die zichtbaar is op dienstdetails..."
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Annuleren
            </Button>
            <Button type="submit" loading={saving}>
              {selected ? 'Opslaan' : 'Toevoegen'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
