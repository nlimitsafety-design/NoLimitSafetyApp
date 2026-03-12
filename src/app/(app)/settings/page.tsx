'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
import { useProfile } from '@/lib/swr';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { UserCircleIcon, BellIcon, BellSlashIcon } from '@heroicons/react/24/outline';
import { subscribeToPush, unsubscribeFromPush, getPushStatus } from '@/components/PushNotificationManager';
import Image from 'next/image';
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
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', email: '' });

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Notification state
  const [pushStatus, setPushStatus] = useState<'unsupported' | 'denied' | 'prompt' | 'granted'>('prompt');
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);

  const checkPushState = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const status = getPushStatus();
    setPushStatus(status);

    if (status === 'granted' && 'serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setPushSubscribed(!!sub);
    } else {
      setPushSubscribed(false);
    }
  }, []);

  useEffect(() => {
    checkPushState();
  }, [checkPushState]);

  // Sync form when profile loads
  useEffect(() => {
    if (profile) {
      setProfileForm({ name: profile.name, phone: profile.phone || '', email: profile.email || '' });
    }
  }, [profile]);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profileForm.name.trim()) {
      toast.error('Naam is verplicht');
      return;
    }
    if (!profileForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email)) {
      toast.error('Voer een geldig e-mailadres in');
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
              <Image
                src="/logo.png"
                alt="NoLimitSafety"
                width={180}
                height={50}
                className="h-12 w-auto object-contain"
              />
              <div>
                <p className="text-gray-400 text-sm">Planning & Beheer v1.0</p>
                <p className="text-gray-500 text-xs mt-1">Ingelogd als {session?.user?.name} ({session?.user?.role})</p>
              </div>
            </div>
          </Card>
        )}

        {/* Profile section */}
        <Card className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <UserCircleIcon className="h-5 w-5 text-brand-500" />
            <CardTitle>Mijn Profiel</CardTitle>
          </div>
          {profileLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-10 bg-gray-50 rounded animate-pulse" />
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
                label="E-mail"
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
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
        <Card className="mb-6">
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

        {/* Notification settings */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            {pushSubscribed ? (
              <BellIcon className="h-5 w-5 text-brand-500" />
            ) : (
              <BellSlashIcon className="h-5 w-5 text-gray-400" />
            )}
            <CardTitle>Meldingen</CardTitle>
          </div>

          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-900">Push notificaties</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {pushStatus === 'unsupported' && 'Niet ondersteund door deze browser'}
                  {pushStatus === 'denied' && 'Geblokkeerd — sta meldingen toe in je browserinstellingen'}
                  {pushStatus === 'prompt' && 'Nog niet ingeschakeld'}
                  {pushStatus === 'granted' && pushSubscribed && 'Actief — je ontvangt meldingen'}
                  {pushStatus === 'granted' && !pushSubscribed && 'Toestemming gegeven, maar niet actief'}
                </p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                pushSubscribed
                  ? 'bg-green-100 text-green-800'
                  : pushStatus === 'denied'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {pushSubscribed ? 'Aan' : pushStatus === 'denied' ? 'Geblokkeerd' : 'Uit'}
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {pushStatus === 'denied' ? (
                <p className="text-sm text-gray-500">
                  Open je browserinstellingen en sta meldingen toe voor deze site. Ververs daarna de pagina.
                </p>
              ) : !pushSubscribed ? (
                <Button
                  onClick={async () => {
                    setPushLoading(true);
                    const ok = await subscribeToPush();
                    if (ok) {
                      toast.success('Meldingen ingeschakeld');
                    } else {
                      const newStatus = getPushStatus();
                      if (newStatus === 'denied') {
                        toast.error('Meldingen geblokkeerd door je browser');
                      } else {
                        toast.error('Kon meldingen niet inschakelen');
                      }
                    }
                    await checkPushState();
                    setPushLoading(false);
                  }}
                  loading={pushLoading}
                  variant="primary"
                  size="sm"
                >
                  <BellIcon className="h-4 w-4 mr-1.5" />
                  Meldingen inschakelen
                </Button>
              ) : (
                <>
                  <Button
                    onClick={async () => {
                      setPushLoading(true);
                      const ok = await unsubscribeFromPush();
                      if (ok) {
                        toast.success('Meldingen uitgeschakeld');
                      } else {
                        toast.error('Kon meldingen niet uitschakelen');
                      }
                      await checkPushState();
                      setPushLoading(false);
                    }}
                    loading={pushLoading}
                    variant="ghost"
                    size="sm"
                  >
                    <BellSlashIcon className="h-4 w-4 mr-1.5" />
                    Uitschakelen
                  </Button>
                  <Button
                    onClick={async () => {
                      setTestSending(true);
                      try {
                        const res = await fetch('/api/push-test');
                        if (res.ok) {
                          toast.success('Testmelding verstuurd');
                        } else {
                          toast.error('Testmelding mislukt');
                        }
                      } catch {
                        toast.error('Fout bij versturen testmelding');
                      }
                      setTestSending(false);
                    }}
                    loading={testSending}
                    variant="outline"
                    size="sm"
                  >
                    Test melding versturen
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>
  );
}
