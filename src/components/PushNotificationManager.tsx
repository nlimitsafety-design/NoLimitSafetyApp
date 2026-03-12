'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { XMarkIcon } from '@heroicons/react/24/outline';

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

/**
 * This component registers the service worker and subscribes to push
 * notifications on mount if the user is logged in and the browser supports it.
 * Shows a toast explaining why permissions are needed on first request.
 */
export default function PushNotificationManager() {
  const { data: session } = useSession();
  const [iosBanner, setIosBanner] = useState<'install' | 'settings' | null>(null);

  // iOS-specific hint: prompt to install as PWA or go to settings
  useEffect(() => {
    if (!session?.user) return;

    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (!isIOS) return;

    if (localStorage.getItem('ios-push-hint-dismissed')) return;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (!isStandalone) {
      setIosBanner('install');
    } else if (!('Notification' in window) || Notification.permission !== 'granted') {
      setIosBanner('settings');
    }
  }, [session?.user]);

  useEffect(() => {
    if (!session?.user || !VAPID_PUBLIC_KEY) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    async function setupPush() {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        // Already subscribed? Just sync with server.
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          await fetch('/api/push-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: existing.toJSON() }),
          });
          return;
        }

        // If permission was already denied, don't ask again
        if (Notification.permission === 'denied') return;

        // If permission hasn't been asked yet, show a friendly toast first
        if (Notification.permission === 'default') {
          toast(
            'Schakel meldingen in om op de hoogte te blijven van je diensten en roosterwijzigingen.',
            { duration: 5000, icon: '🔔' }
          );
          // Small delay so the user reads the toast before seeing the browser popup
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const success = await subscribeToPush();
        if (!success) {
          // Permission may have changed to 'denied' during the subscribeToPush call
          if ((Notification.permission as string) === 'denied') {
            toast.error(
              'Meldingen geblokkeerd. Ga naar je browserinstellingen om meldingen toe te staan.',
              { duration: 6000 }
            );
          }
        }
      } catch (err) {
        console.error('Push notification setup failed:', err);
      }
    }

    setupPush();
  }, [session?.user]);

  if (iosBanner) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 lg:left-68 bg-white border border-gray-200 rounded-xl shadow-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl leading-none mt-0.5">🔔</span>
          <div className="flex-1 min-w-0">
            {iosBanner === 'install' ? (
              <>
                <p className="text-sm font-medium text-gray-900">Meldingen inschakelen op iPhone?</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Tap <strong>Delen</strong> → <strong>Zet op beginscherm</strong>, open dan de app via je beginscherm en schakel meldingen in.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-900">Meldingen niet ingeschakeld</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ga naar <strong>Instellingen</strong> om meldingen in te schakelen.
                </p>
                <a href="/settings" className="inline-block mt-2 text-xs font-medium text-brand-600 hover:text-brand-700">
                  Naar instellingen →
                </a>
              </>
            )}
          </div>
          <button
            onClick={() => {
              localStorage.setItem('ios-push-hint-dismissed', '1');
              setIosBanner(null);
            }}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label="Sluiten"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
