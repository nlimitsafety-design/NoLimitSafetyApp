'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useProfile } from '@/lib/swr';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { ShieldCheckIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  hourlyRate: number;
}

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  // Profile via SWR
  const { data: profile, isLoading: profileLoading, mutate: mutateProfile } = useProfile();

  // Profile form state
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Sync form when profile loads
  useEffect(() => {
    if (profile) {
      setProfileForm({ name: profile.name, phone: profile.phone || '' });
    }
  }, [profile]);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profileForm.name.trim()) {
      toast.error('Naam is verplicht');
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });
      if (res.ok) {
        const updated = await res.json();
        mutateProfile();
        toast.success('Profiel bijgewerkt');
        // Update session to reflect name change
        await updateSession({ name: updated.name });
      } else {
        const data = await res.json();
        toast.error(data.error || 'Fout bij opslaan');
      }
    } catch {
      toast.error('Er is een fout opgetreden');
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Wachtwoorden komen niet overeen');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Nieuw wachtwoord moet minimaal 6 tekens bevatten');
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res.ok) {
        toast.success('Wachtwoord gewijzigd');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Fout bij wijzigen wachtwoord');
      }
    } catch {
      toast.error('Er is een fout opgetreden');
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
      <div className="animate-fade-in max-w-2xl">
        <h1 className="page-title mb-6">Instellingen</h1>

        {/* App info (admin only) */}
        {isAdmin && (
          <Card className="mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-brand-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/25">
                <ShieldCheckIcon className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">SecureStaff</h2>
                <p className="text-gray-400 text-sm">Planning & Beheer v1.0</p>
                <p className="text-gray-500 text-xs mt-1">Ingelogd als {session?.user?.name} ({session?.user?.role})</p>
              </div>
            </div>
          </Card>
        )}

        {/* Profile section */}
        <Card className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <UserCircleIcon className="h-5 w-5 text-brand-400" />
            <CardTitle>Mijn Profiel</CardTitle>
          </div>
          {profileLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-10 bg-navy-800/50 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <form onSubmit={handleProfileSave} className="space-y-4">
              <Input
                label="Naam"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                required
              />
              <Input
                label="Telefoon"
                type="tel"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                placeholder="+31 6 12345678"
              />
              <div className="pt-2">
                <p className="text-sm text-gray-500 mb-1">
                  <span className="text-gray-400 font-medium">E-mail:</span> {profile?.email}
                </p>
                <p className="text-sm text-gray-500">
                  <span className="text-gray-400 font-medium">Rol:</span>{' '}
                  {profile?.role === 'ADMIN' ? 'Administrator' : profile?.role === 'MANAGER' ? 'Manager' : 'Medewerker'}
                </p>
              </div>
              <Button type="submit" loading={profileSaving}>Profiel opslaan</Button>
            </form>
          )}
        </Card>

        {/* Password change */}
        <Card>
          <CardTitle>Wachtwoord Wijzigen</CardTitle>
          <form onSubmit={handlePasswordChange} className="mt-4 space-y-4">
            <Input
              label="Huidig wachtwoord"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <Input
              label="Nieuw wachtwoord"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <Input
              label="Bevestig nieuw wachtwoord"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <Button type="submit" loading={passwordSaving}>Wachtwoord wijzigen</Button>
          </form>
        </Card>
      </div>
  );
}
