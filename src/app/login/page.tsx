'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ShieldCheckIcon } from '@heroicons/react/24/solid';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Ongeldige inloggegevens. Probeer opnieuw.');
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError('Er is een fout opgetreden. Probeer opnieuw.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col items-center justify-center p-4">
      {/* Background gradient */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-brand-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-500 rounded-2xl shadow-lg shadow-brand-500/25 mb-4">
            <ShieldCheckIcon className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">SecureStaff</h1>
          <p className="text-gray-400 mt-1">Planning & Beheer</p>
        </div>

        {/* Login card */}
        <div className="bg-navy-900/80 border border-navy-700/50 rounded-2xl p-6 sm:p-8 backdrop-blur-sm shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-1">Inloggen</h2>
          <p className="text-gray-400 text-sm mb-6">Vul je gegevens in om door te gaan</p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="E-mailadres"
              type="email"
              placeholder="naam@bedrijf.nl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <div className="relative">
              <Input
                label="Wachtwoord"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-200 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            </div>
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Inloggen
            </Button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Wachtwoord vergeten? Neem contact op met de administrator.
        </p>
      </div>
    </div>
  );
}
