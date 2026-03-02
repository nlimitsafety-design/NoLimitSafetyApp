'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

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
 * This component registers the service worker and subscribes to push
 * notifications on mount if the user is logged in and the browser supports it.
 * Renders nothing visible.
 */
export default function PushNotificationManager() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user || !VAPID_PUBLIC_KEY) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    async function setupPush() {
      try {
        // Register service worker
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        // Check if already subscribed
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          // Request permission
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') return;

          // Subscribe
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        }

        // Send subscription to server
        await fetch('/api/push-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        });
      } catch (err) {
        console.error('Push notification setup failed:', err);
      }
    }

    setupPush();
  }, [session?.user]);

  return null;
}
