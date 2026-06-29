'use client';

import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type Step = 'password' | 'enroll' | 'totp';

export default function LoginPage() {
  const [step, setStep] = useState<Step>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [code, setCode] = useState('');
  const [qr, setQr] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router]);

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Laatste stap: maak de NextAuth-sessie aan (apparaat-cookie is nu gezet).
  const finishSignIn = async () => {
    const result = await signIn('credentials', {
      email: email.toLowerCase().trim(),
      password,
      rememberMe: rememberMe ? 'true' : 'false',
      redirect: false,
    });
    if (result?.error) {
      setError('Inloggen mislukt. Probeer opnieuw.');
      setStep('password');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  };

  // Stap 1: email + wachtwoord -> bepaal of 2FA nodig is.
  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login-precheck', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || 'Ongeldige inloggegevens. Probeer opnieuw.');
        return;
      }

      if (data.status === 'ok') {
        await finishSignIn();
      } else if (data.status === 'totp') {
        setStep('totp');
      } else if (data.status === 'enroll') {
        setQr(data.qr || '');
        setManualKey(data.manualKey || '');
        setStep('enroll');
      }
    } catch {
      setError('Er is een fout opgetreden. Probeer opnieuw.');
    } finally {
      setLoading(false);
    }
  };

  // Stap 2: code controleren (koppelen bij eerste inlog, of nieuw apparaat).
  const handleCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const endpoint = step === 'enroll' ? '/api/auth/totp/confirm' : '/api/auth/totp/verify';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password,
          code: code.replace(/\s/g, ''),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Onjuiste code. Probeer opnieuw.');
        return;
      }
      await finishSignIn();
    } catch {
      setError('Er is een fout opgetreden. Probeer opnieuw.');
    } finally {
      setLoading(false);
    }
  };

  const resetToStart = () => {
    setStep('password');
    setCode('');
    setQr('');
    setManualKey('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      {/* Background gradient */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image
            src="/logo.png"
            alt="NoLimitSafety"
            width={280}
            height={80}
            className="mx-auto h-16 w-auto object-contain mb-4"
            priority
          />
          <p className="text-gray-500 mt-1">Planning & Beheer</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-xl">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* STAP 1 — wachtwoord */}
          {step === 'password' && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Inloggen</h2>
              <p className="text-gray-500 text-sm mb-6">Vul je gegevens in om door te gaan</p>
              <form onSubmit={handlePassword} className="space-y-4">
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
                    className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="w-5 h-5 rounded-md border-2 border-gray-300 bg-white peer-checked:bg-brand-500 peer-checked:border-brand-500 transition-all duration-200 flex items-center justify-center">
                      {rememberMe && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-gray-500 group-hover:text-gray-700 transition-colors">Ingelogd blijven</span>
                </label>

                <Button type="submit" loading={loading} className="w-full" size="lg">
                  Inloggen
                </Button>
              </form>
            </>
          )}

          {/* STAP 2a — authenticator koppelen (eerste inlog) */}
          {step === 'enroll' && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Beveiliging instellen</h2>
              <p className="text-gray-500 text-sm mb-5">
                Scan de QR-code met een authenticator-app (bijv. Google Authenticator
                of Microsoft Authenticator) en voer de code uit de app in.
              </p>
              {qr && (
                <div className="flex justify-center mb-4">
                  {/* data-URL afbeelding; geen next/image i.v.m. dynamische bron */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="QR-code" className="w-44 h-44 rounded-lg border border-gray-200" />
                </div>
              )}
              {manualKey && (
                <p className="text-center text-xs text-gray-400 mb-5 break-all">
                  Kan je niet scannen? Voer deze sleutel handmatig in:<br />
                  <span className="font-mono text-gray-600">{manualKey}</span>
                </p>
              )}
              <form onSubmit={handleCode} className="space-y-4">
                <Input
                  label="Code uit de app"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
                <Button type="submit" loading={loading} className="w-full" size="lg">
                  Koppelen & inloggen
                </Button>
                <button type="button" onClick={resetToStart} className="w-full text-sm text-gray-400 hover:text-gray-600">
                  Terug
                </button>
              </form>
            </>
          )}

          {/* STAP 2b — code op nieuw apparaat */}
          {step === 'totp' && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Verificatie</h2>
              <p className="text-gray-500 text-sm mb-5">
                Nieuw apparaat gedetecteerd. Voer de actuele code uit je
                authenticator-app in om verder te gaan.
              </p>
              <form onSubmit={handleCode} className="space-y-4">
                <Input
                  label="Code uit de app"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  autoFocus
                />
                <Button type="submit" loading={loading} className="w-full" size="lg">
                  Verifiëren & inloggen
                </Button>
                <button type="button" onClick={resetToStart} className="w-full text-sm text-gray-400 hover:text-gray-600">
                  Terug
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-gray-400 text-xs mt-6">
          Wachtwoord of toegang kwijt? Neem contact op met de administrator.
        </p>
      </div>
    </div>
  );
}
