'use client';

import { useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useCertificaten, useAllCertificaten, useEmployees } from '@/lib/swr';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
  DocumentCheckIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { format, differenceInDays, isPast, isWithinInterval, addMonths } from 'date-fns';
import { nl } from 'date-fns/locale';

const CERT_TYPES = [
  { value: 'VCA', label: 'VCA' },
  { value: 'VCA_VOL', label: 'VCA VOL' },
  { value: 'MANGATWACHT', label: 'Mangatwacht' },
  { value: 'GASMETEN', label: 'Gasmeten' },
  { value: 'BHV', label: 'BHV' },
  { value: 'EHBO', label: 'EHBO' },
  { value: 'RESCUE', label: 'Rescue' },
  { value: 'ANDERS', label: 'Anders' },
] as const;

type CertType = (typeof CERT_TYPES)[number]['value'];

interface CertFormState {
  type: CertType;
  customName: string;
  expiryDate: string;
  userId?: string;
}

const EMPTY_FORM: CertFormState = { type: 'VCA', customName: '', expiryDate: '' };

function certLabel(type: string, customName?: string | null): string {
  const found = CERT_TYPES.find((c) => c.value === type);
  if (type === 'ANDERS' && customName) return customName;
  return found?.label ?? type;
}

function getStatus(expiryDate: string) {
  const date = new Date(expiryDate);
  const now = new Date();
  if (isPast(date)) return 'expired';
  if (isWithinInterval(now, { start: now, end: addMonths(date, 0) }) && differenceInDays(date, now) <= 90)
    return 'soon';
  return 'valid';
}

function StatusBadge({ expiryDate }: { expiryDate: string }) {
  const status = getStatus(expiryDate);
  const date = new Date(expiryDate);
  const daysLeft = differenceInDays(date, new Date());
  const dateStr = format(date, 'd MMM yyyy', { locale: nl });

  if (status === 'expired') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
        <ExclamationTriangleIcon className="h-3.5 w-3.5" />
        Verlopen {dateStr}
      </span>
    );
  }
  if (status === 'soon') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
        <ClockIcon className="h-3.5 w-3.5" />
        Verloopt {dateStr} ({daysLeft}d)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
      <CheckIcon className="h-3.5 w-3.5" />
      Geldig t/m {dateStr}
    </span>
  );
}

function CertForm({
  initial,
  onSave,
  onCancel,
  saving,
  showUserSelect,
  employees,
}: {
  initial: CertFormState;
  onSave: (form: CertFormState) => void;
  onCancel: () => void;
  saving: boolean;
  showUserSelect?: boolean;
  employees?: any[];
}) {
  const [form, setForm] = useState<CertFormState>(initial);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
      {showUserSelect && employees && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Medewerker</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={form.userId ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
          >
            <option value="">Kies medewerker…</option>
            {employees.map((e: any) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Certificaattype</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CertType }))}
        >
          {CERT_TYPES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {form.type === 'ANDERS' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Naam certificaat</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Bijv. Hoogwerker..."
            value={form.customName}
            onChange={(e) => setForm((f) => ({ ...f, customName: e.target.value }))}
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Vervaldatum</label>
        <input
          type="date"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={form.expiryDate}
          onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={() => onSave(form)} loading={saving} size="sm">
          <CheckIcon className="h-4 w-4 mr-1" />
          Opslaan
        </Button>
        <Button variant="ghost" onClick={onCancel} size="sm">
          <XMarkIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Employee view ─────────────────────────────────────────────────────────────

function MyCertificaten() {
  const { data: certificaten = [], mutate } = useCertificaten();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd(form: CertFormState) {
    if (!form.expiryDate) { toast.error('Vul een vervaldatum in'); return; }
    if (form.type === 'ANDERS' && !form.customName.trim()) { toast.error('Vul een naam in'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/certificaten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: form.type, customName: form.customName, expiryDate: form.expiryDate }),
      });
      if (res.ok) {
        toast.success('Certificaat toegevoegd');
        setAdding(false);
        mutate();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Aanmaken mislukt');
      }
    } catch { toast.error('Er ging iets mis'); }
    finally { setSaving(false); }
  }

  async function handleEdit(id: string, form: CertFormState) {
    if (!form.expiryDate) { toast.error('Vul een vervaldatum in'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/certificaten/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: form.type, customName: form.customName, expiryDate: form.expiryDate }),
      });
      if (res.ok) {
        toast.success('Certificaat bijgewerkt');
        setEditingId(null);
        mutate();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Bijwerken mislukt');
      }
    } catch { toast.error('Er ging iets mis'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Verwijder certificaat "${label}"?`)) return;
    try {
      const res = await fetch(`/api/certificaten/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Certificaat verwijderd'); mutate(); }
      else { const d = await res.json(); toast.error(d.error || 'Verwijderen mislukt'); }
    } catch { toast.error('Er ging iets mis'); }
  }

  const expiredCount = certificaten.filter((c: any) => getStatus(c.expiryDate) === 'expired').length;
  const soonCount = certificaten.filter((c: any) => getStatus(c.expiryDate) === 'soon').length;

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Mijn Certificaten</h1>
          <p className="page-subtitle">Beheer je certificaten en vervaldatums</p>
        </div>
        {!adding && (
          <Button onClick={() => setAdding(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Certificaat toevoegen
          </Button>
        )}
      </div>

      {(expiredCount > 0 || soonCount > 0) && (
        <div className="flex flex-wrap gap-3 mb-6">
          {expiredCount > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm font-medium">
              <ExclamationTriangleIcon className="h-4 w-4" />
              {expiredCount} verlopen certificaat{expiredCount > 1 ? 'en' : ''}
            </div>
          )}
          {soonCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-2.5 text-sm font-medium">
              <ClockIcon className="h-4 w-4" />
              {soonCount} certificaat{soonCount > 1 ? 'en verlopen' : ' verloopt'} binnenkort
            </div>
          )}
        </div>
      )}

      {adding && (
        <Card className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Nieuw certificaat</p>
          <CertForm
            initial={EMPTY_FORM}
            onSave={handleAdd}
            onCancel={() => setAdding(false)}
            saving={saving}
          />
        </Card>
      )}

      {certificaten.length === 0 && !adding ? (
        <Card>
          <div className="text-center py-10">
            <DocumentCheckIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nog geen certificaten toegevoegd</p>
            <p className="text-sm text-gray-400 mt-1">Klik op &ldquo;Certificaat toevoegen&rdquo; om te beginnen</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {certificaten.map((cert: any) => (
            <Card key={cert.id}>
              {editingId === cert.id ? (
                <CertForm
                  initial={{
                    type: cert.type as CertType,
                    customName: cert.customName ?? '',
                    expiryDate: cert.expiryDate.split('T')[0],
                  }}
                  onSave={(form) => handleEdit(cert.id, form)}
                  onCancel={() => setEditingId(null)}
                  saving={saving}
                />
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <span className="font-semibold text-gray-800 min-w-[120px]">
                      {certLabel(cert.type, cert.customName)}
                    </span>
                    <StatusBadge expiryDate={cert.expiryDate} />
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setEditingId(cert.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-brand-500/10 transition-colors"
                      title="Bewerken"
                    >
                      <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(cert.id, certLabel(cert.type, cert.customName))}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Verwijderen"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Admin view ────────────────────────────────────────────────────────────────

function AdminCertificaten() {
  const { data: allCerts = [], mutate } = useAllCertificaten();
  const { data: employees = [] } = useEmployees();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [filterUserId, setFilterUserId] = useState('');

  async function handleAdd(form: CertFormState) {
    if (!form.expiryDate) { toast.error('Vul een vervaldatum in'); return; }
    if (!form.userId) { toast.error('Selecteer een medewerker'); return; }
    if (form.type === 'ANDERS' && !form.customName.trim()) { toast.error('Vul een naam in'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/certificaten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: form.type, customName: form.customName, expiryDate: form.expiryDate, userId: form.userId }),
      });
      if (res.ok) { toast.success('Certificaat toegevoegd'); setAdding(false); mutate(); }
      else { const d = await res.json(); toast.error(d.error || 'Aanmaken mislukt'); }
    } catch { toast.error('Er ging iets mis'); }
    finally { setSaving(false); }
  }

  async function handleEdit(id: string, form: CertFormState) {
    if (!form.expiryDate) { toast.error('Vul een vervaldatum in'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/certificaten/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: form.type, customName: form.customName, expiryDate: form.expiryDate }),
      });
      if (res.ok) { toast.success('Certificaat bijgewerkt'); setEditingId(null); mutate(); }
      else { const d = await res.json(); toast.error(d.error || 'Bijwerken mislukt'); }
    } catch { toast.error('Er ging iets mis'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Verwijder certificaat "${label}"?`)) return;
    try {
      const res = await fetch(`/api/certificaten/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Certificaat verwijderd'); mutate(); }
      else { const d = await res.json(); toast.error(d.error || 'Verwijderen mislukt'); }
    } catch { toast.error('Er ging iets mis'); }
  }

  async function handleCheckExpiry() {
    setChecking(true);
    try {
      const res = await fetch('/api/certificaten/check-expiry');
      if (res.ok) {
        const d = await res.json();
        toast.success(`Controle klaar — ${d.notifiedSoon} bijna-verlopen, ${d.notifiedExpired} verlopen meldingen verstuurd`);
        mutate();
      } else {
        toast.error('Controle mislukt');
      }
    } catch { toast.error('Er ging iets mis'); }
    finally { setChecking(false); }
  }

  const filtered = filterUserId ? allCerts.filter((c: any) => c.userId === filterUserId) : allCerts;

  // Group by employee for overview
  const byEmployee = useMemo(() => {
    const map = new Map<string, { user: any; certs: any[] }>();
    for (const cert of filtered) {
      if (!map.has(cert.userId)) {
        map.set(cert.userId, { user: cert.user, certs: [] });
      }
      map.get(cert.userId)!.certs.push(cert);
    }
    return Array.from(map.values()).sort((a, b) => a.user.name.localeCompare(b.user.name));
  }, [filtered]);

  const expiredCount = allCerts.filter((c: any) => getStatus(c.expiryDate) === 'expired').length;
  const soonCount = allCerts.filter((c: any) => getStatus(c.expiryDate) === 'soon').length;

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Certificaten</h1>
          <p className="page-subtitle">Overzicht van alle certificaten per medewerker</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleCheckExpiry} loading={checking}>
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Verloop controleren
          </Button>
          {!adding && (
            <Button onClick={() => setAdding(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Toevoegen
            </Button>
          )}
        </div>
      </div>

      {(expiredCount > 0 || soonCount > 0) && (
        <div className="flex flex-wrap gap-3 mb-6">
          {expiredCount > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm font-medium">
              <ExclamationTriangleIcon className="h-4 w-4" />
              {expiredCount} verlopen certificaat{expiredCount > 1 ? 'en' : ''}
            </div>
          )}
          {soonCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-2.5 text-sm font-medium">
              <ClockIcon className="h-4 w-4" />
              {soonCount} certificaat{soonCount > 1 ? 'en verlopen' : ' verloopt'} binnenkort
            </div>
          )}
        </div>
      )}

      {adding && (
        <Card className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Certificaat toevoegen voor medewerker</p>
          <CertForm
            initial={{ ...EMPTY_FORM, userId: '' }}
            onSave={handleAdd}
            onCancel={() => setAdding(false)}
            saving={saving}
            showUserSelect
            employees={employees}
          />
        </Card>
      )}

      {/* Filter */}
      <Card className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Filter op medewerker:</label>
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
          >
            <option value="">Alle medewerkers</option>
            {employees.map((e: any) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {byEmployee.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <DocumentCheckIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nog geen certificaten gevonden</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {byEmployee.map(({ user, certs }) => (
            <Card key={user.id}>
              <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100">
                <div className="w-8 h-8 bg-brand-500/10 rounded-full flex items-center justify-center text-sm font-semibold text-brand-600">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-semibold text-gray-800">{user.name}</span>
                <span className="text-xs text-gray-400">{user.email}</span>
              </div>
              <div className="space-y-2">
                {certs.map((cert: any) => (
                  <div key={cert.id}>
                    {editingId === cert.id ? (
                      <CertForm
                        initial={{
                          type: cert.type as CertType,
                          customName: cert.customName ?? '',
                          expiryDate: cert.expiryDate.split('T')[0],
                        }}
                        onSave={(form) => handleEdit(cert.id, form)}
                        onCancel={() => setEditingId(null)}
                        saving={saving}
                      />
                    ) : (
                      <div className="flex items-center justify-between gap-4 py-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                          <span className="text-sm font-medium text-gray-700 min-w-[120px]">
                            {certLabel(cert.type, cert.customName)}
                          </span>
                          <StatusBadge expiryDate={cert.expiryDate} />
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => setEditingId(cert.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-brand-500/10 transition-colors"
                            title="Bewerken"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(cert.id, certLabel(cert.type, cert.customName))}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Verwijderen"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function CertificatenPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;
  const isAdminOrManager = role === 'ADMIN' || role === 'MANAGER';

  if (isAdminOrManager) return <AdminCertificaten />;
  return <MyCertificaten />;
}
