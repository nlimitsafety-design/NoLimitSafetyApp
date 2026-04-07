'use client';

import { useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useEmployees } from '@/lib/swr';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const ROLES = [
  { value: 'EMPLOYEE', label: 'Medewerker', color: 'bg-gray-100 text-gray-700' },
  { value: 'MANAGER', label: 'Manager', color: 'bg-blue-100 text-blue-700' },
  { value: 'ADMIN', label: 'Admin', color: 'bg-brand-500/20 text-brand-700' },
];

export default function PermissionsPage() {
  const { data: session } = useSession();
  const { data: allEmployees = [], mutate } = useEmployees();
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const currentUserId = (session?.user as any)?.id;
  const isAdmin = session?.user?.role === 'ADMIN';

  const employees = useMemo(() => {
    const list = allEmployees as any[];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((e) => e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q));
  }, [allEmployees, search]);

  async function updateRole(userId: string, newRole: string) {
    setSaving(userId);
    try {
      const res = await fetch(`/api/employees/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error();
      await mutate();
      toast.success('Rol bijgewerkt');
    } catch {
      toast.error('Kon rol niet opslaan');
    } finally {
      setSaving(null);
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Geen toegang
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="page-title">Permissies</h1>
        <p className="page-subtitle">Beheer de rollen en rechten van medewerkers</p>
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-3 mb-6">
        {ROLES.map((r) => (
          <div key={r.value} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${r.color}`}>
            {r.label}
          </div>
        ))}
        <div className="text-sm text-gray-400 self-center ml-2">
          Admin = volledige toegang &nbsp;·&nbsp; Manager = rapportages + planning &nbsp;·&nbsp; Medewerker = eigen rooster
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Medewerkers ({employees.length})</CardTitle>
          <div className="relative w-64">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Zoek op naam of e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Naam</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">E-mail</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Huidige rol</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Rol wijzigen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {employees.map((emp: any) => {
                const currentRole = ROLES.find((r) => r.value === emp.role) || ROLES[0];
                const isSelf = emp.id === currentUserId;
                const isLoading = saving === emp.id;

                return (
                  <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-700 font-semibold text-xs">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{emp.name}</span>
                        {isSelf && <span className="text-xs text-gray-400">(jij)</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-500">{emp.email}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${currentRole.color}`}>
                        {currentRole.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        {ROLES.map((role) => (
                          <button
                            key={role.value}
                            disabled={emp.role === role.value || isSelf || isLoading}
                            onClick={() => updateRole(emp.id, role.value)}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors border
                              ${emp.role === role.value
                                ? `${role.color} border-transparent opacity-70 cursor-default`
                                : 'border-gray-200 text-gray-600 hover:border-brand-500 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed'
                              }`}
                          >
                            {isLoading && emp.role !== role.value ? '...' : role.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400">Geen medewerkers gevonden</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
