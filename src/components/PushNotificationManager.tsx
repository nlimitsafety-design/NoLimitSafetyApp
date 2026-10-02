'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { BellIcon, XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

const VAPID_PUBLIC_KEY = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim().replace(/^"|"$/g, '');

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribe to push notifications. Can be called from settings.
 * Returns true if subscription succeeded, false otherwise.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY) return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return false;
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    await fetch('/api/push-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });

    return true;
  } catch (err) {
    console.error('Push notification setup failed:', err);
    return false;
  }
}

/**
 * Unsubscribe from push notifications.
 * Returns true if unsubscription succeeded.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!registration) return true;

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true;

    await subscription.unsubscribe();
    await fetch('/api/push-subscription', { method: 'DELETE' });
    return true;
  } catch (err) {
    console.error('Push notification unsubscribe failed:', err);
    return false;
  }
}

/**
 * Get current push notification status.
 */
export function getPushStatus(): 'unsupported' | 'denied' | 'prompt' | 'granted' {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }
  return Notification.permission as 'denied' | 'prompt' | 'granted';
}

type ModalState = 'hidden' | 'prompt' | 'denied' | 'ios-settings' | 'ios-info';

/**
 * This component enforces that users accept push notifications before using the app.
 * A blocking modal is shown until permission is granted. If the browser has blocked
 * notifications, instructions are shown to unblock them.
 * On iOS, a non-blocking informational banner is shown instead of enforcement.
 */
export default function PushNotificationManager() {
  const { data: session } = useSession();
  const [modal, setModal] = useState<ModalState>('hidden');
  const [requesting, setRequesting] = useState(false);
  const [showIOSInfo, setShowIOSInfo] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    if ((session.user as { role?: string }).role === 'ADMIN') return;

    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);

    // On iOS, push notifications are not reliably supported in Safari standalone PWA.
    // Show an informational banner instead of forcing the broken permission prompt.
    if (isIOS) {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;

      if (isStandalone) {
        setShowIOSInfo(true);
        console.info('iOS standalone PWA detected: showing informational banner instead of push enforcement.');
        return;
      }
      // Not standalone on iOS — push not supported in browser, skip entirely
      if (!isStandalone) return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    async function setupPush() {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        // Already subscribed? Sync with server and done.
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          await fetch('/api/push-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: existing.toJSON() }),
          });
          return;
        }

        // Permission denied by browser — show unblock instructions
        if (Notification.permission === 'denied') {
          setModal('denied');
          return;
        }

        // Permission not yet asked — show mandatory prompt modal
        if (Notification.permission === 'default') {
          setModal('prompt');
        }
      } catch (err) {
        console.error('Push notification setup failed:', err);
      }
    }

    setupPush();
  }, [session?.user]);

  async function handleAccept() {
    setRequesting(true);
    const success = await subscribeToPush();
    setRequesting(false);
    if (success) {
      setModal('hidden');
    } else {
      // Browser blocked the permission
      setModal('denied');
    }
  }

  // iOS informational banner (non-blocking, dismissible)
  if (showIOSInfo) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9998] bg-amber-50 border-b border-amber-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-start gap-3">
          <InformationCircleIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-amber-900 mb-1">
              Meldingen op iPhone
            </h3>
            <p className="text-xs text-amber-800 mb-2">
              Push-meldingen werken beperkt op iPhone in deze app. Je ontvangt live updates wanneer de app geopend is. Voor volledige pushmeldingen raden we een native app aan.
            </p>
            <a
              href="/settings"
              className="inline-block text-xs font-medium text-amber-700 hover:text-amber-900 underline"
            >
              Meer informatie in instellingen →
            </a>
          </div>
          <button
            onClick={() => setShowIOSInfo(false)}
            className="flex-shrink-0 text-amber-600 hover:text-amber-900 transition-colors"
            aria-label="Sluiten"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  if (modal === 'hidden') return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-brand-50 mx-auto mb-4">
          <BellIcon className="h-7 w-7 text-brand-600" />
        </div>

        {modal === 'prompt' && (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Meldingen zijn verplicht</h2>
            <p className="text-sm text-gray-500 mb-6">
              Om de app te gebruiken moet je meldingen inschakelen. Zo blijf je op de hoogte van je diensten en roosterwijzigingen.
            </p>
            <button
              onClick={handleAccept}
              disabled={requesting}
              className="w-full py-2.5 rounded-xl bg-brand-600 text-white font-medium text-sm hover:bg-brand-700 transition-colors disabled:opacity-60"
            >
              {requesting ? 'Even wachten…' : 'Meldingen inschakelen'}
            </button>
          </>
        )}

        {modal === 'denied' && (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Meldingen geblokkeerd</h2>
            <p className="text-sm text-gray-500 mb-4">
              Je hebt meldingen geblokkeerd in je browser. Volg deze stappen om ze handmatig in te schakelen:
            </p>
            <ol className="text-left text-sm text-gray-600 space-y-1 mb-6 list-decimal list-inside">
              <li>Klik op het slotje in de adresbalk</li>
              <li>Zet <strong>Meldingen</strong> op <strong>Toestaan</strong></li>
              <li>Herlaad de pagina</li>
            </ol>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 rounded-xl bg-brand-600 text-white font-medium text-sm hover:bg-brand-700 transition-colors"
            >
              Pagina herladen
            </button>
          </>
        )}

        {modal === 'ios-settings' && (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Schakel meldingen in</h2>
            <p className="text-sm text-gray-500 mb-6">
              Ga naar <strong>Instellingen</strong> → <strong>Safari</strong> → <strong>Meldingen</strong> en schakel meldingen in voor deze app.
            </p>
            <a
              href="/settings"
              className="block w-full py-2.5 rounded-xl bg-brand-600 text-white font-medium text-sm hover:bg-brand-700 transition-colors"
            >
              Naar instellingen
            </a>
          </>
        )}
      </div>
    </div>
  );
}
