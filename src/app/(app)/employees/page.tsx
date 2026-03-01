'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useEmployees } from '@/lib/swr';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import Table from '@/components/ui/Table';
import { formatCurrency, ROLES } from '@/lib/utils';
import { PlusIcon, MagnifyingGlassIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  hourlyRate: number;
  active: boolean;
  createdAt: string;
}

export default function EmployeesPage() {
  const { data: session } = useSession();
  const { data: employees = [], isLoading: loading, mutate } = useEmployees();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'EMPLOYEE',
    hourlyRate: 25,
    active: true,
    password: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditingEmployee(null);
    setForm({ name: '', email: '', phone: '', role: 'EMPLOYEE', hourlyRate: 25, active: true, password: '' });
    setFormErrors({});
    setModalOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditingEmployee(emp);
    setForm({
      name: emp.name,
      email: emp.email,
      phone: emp.phone || '',
      role: emp.role,
      hourlyRate: emp.hourlyRate,
      active: emp.active,
      password: '',
    });
    setFormErrors({});
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormErrors({});
    setSaving(true);

    try {
      const url = editingEmployee ? `/api/employees/${editingEmployee.id}` : '/api/employees';
      const method = editingEmployee ? 'PUT' : 'POST';

      const body: any = { ...form, hourlyRate: Number(form.hourlyRate) };
      if (!body.password) delete body.password;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.errors) {
          setFormErrors(data.errors);
        } else {
          toast.error(data.error || 'Er is een fout opgetreden');
        }
        return;
      }

      toast.success(editingEmployee ? 'Medewerker bijgewerkt' : 'Medewerker aangemaakt');
      setModalOpen(false);
      mutate();
    } catch {
      toast.error('Er is een fout opgetreden');
    } finally {
      setSaving(false);
    }
  }

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      key: 'name',
      header: 'Naam',
      render: (emp: Employee) => (
        <div>
          <p className="font-medium text-gray-900">{emp.name}</p>
          <p className="text-xs text-gray-500 md:hidden">{emp.email}</p>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'E-mail',
      hideOnMobile: true,
    },
    {
      key: 'phone',
      header: 'Telefoon',
      hideOnMobile: true,
      render: (emp: Employee) => <span>{emp.phone || '-'}</span>,
    },
    {
      key: 'role',
      header: 'Rol',
      render: (emp: Employee) => {
        const roleLabel = ROLES.find(r => r.value === emp.role)?.label || emp.role;
        return <Badge variant={emp.role === 'ADMIN' ? 'orange' : emp.role === 'MANAGER' ? 'info' : 'default'}>{roleLabel}</Badge>;
      },
    },
    {
      key: 'hourlyRate',
      header: 'Tarief',
      hideOnMobile: true,
      render: (emp: Employee) => <span className="text-brand-500 font-medium">{formatCurrency(emp.hourlyRate)}/u</span>,
    },
    {
      key: 'active',
      header: 'Status',
      render: (emp: Employee) => (
        <Badge variant={emp.active ? 'success' : 'danger'}>{emp.active ? 'Actief' : 'Inactief'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (emp: Employee) => (
        <button
          onClick={(e) => { e.stopPropagation(); openEdit(emp); }}
          className="p-1.5 rounded-lg text-gray-400 hover:text-brand-500 hover:bg-brand-500/10 transition-colors"
          title="Bewerken"
        >
          <PencilSquareIcon className="h-4 w-4" />
        </button>
      ),
    },
  ];

  if (session?.user?.role !== 'ADMIN') {
    return (
        <div className="text-center py-20">
          <p className="text-gray-400">Je hebt geen toegang tot deze pagina.</p>
        </div>
    );
  }

  return (
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="page-title">Medewerkers</h1>
            <p className="page-subtitle">{employees.length} medewerkers in het systeem</p>
          </div>
          <Button onClick={openCreate}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Nieuwe medewerker
          </Button>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Zoek op naam of e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
        </Card>

        {/* Table */}
        <Card padding={false}>
          {loading ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-12 bg-gray-50 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <Table
              columns={columns}
              data={filteredEmployees}
              keyExtractor={(emp) => emp.id}
              emptyMessage="Geen medewerkers gevonden"
            />
          )}
        </Card>

        {/* Create/Edit Modal */}
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingEmployee ? 'Medewerker Bewerken' : 'Nieuwe Medewerker'}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Naam"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                error={formErrors.name}
                required
              />
              <Input
                label="E-mailadres"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                error={formErrors.email}
                required
              />
              <Input
                label="Telefoon"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                error={formErrors.phone}
                placeholder="+31 6 12345678"
              />
              <Input
                label="Uurtarief (â‚¬)"
                type="number"
                step="0.50"
                min="0"
                value={form.hourlyRate}
                onChange={(e) => setForm({ ...form, hourlyRate: parseFloat(e.target.value) || 0 })}
                error={formErrors.hourlyRate}
                required
              />
              <Select
                label="Rol"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                options={ROLES.map(r => ({ value: r.value, label: r.label }))}
                error={formErrors.role}
              />
              <Input
                label={editingEmployee ? 'Nieuw wachtwoord (optioneel)' : 'Wachtwoord'}
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                error={formErrors.password}
                required={!editingEmployee}
                placeholder={editingEmployee ? 'Laat leeg om niet te wijzigen' : 'Minimaal 6 tekens'}
              />
            </div>

            {editingEmployee && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 bg-gray-100 text-brand-500 focus:ring-brand-500"
                />
                <span className="text-sm text-gray-600">Actief</span>
              </label>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit" loading={saving}>
                {editingEmployee ? 'Opslaan' : 'Aanmaken'}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
  );
}
