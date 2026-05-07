'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

// Detect Capacitor without statically importing it (so web builds aren't broken).
function getCapacitor(): any | null {
  if (typeof window === 'undefined') return null;
  return (window as any).Capacitor || null;
}

export default function MobilePushManager() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user) return;
    const cap = getCapacitor();
    if (!cap?.isNativePlatform?.()) return;

    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const mod: any = await import('@capacitor/push-notifications');
        const PushNotifications = mod.PushNotifications;

        const perm = await PushNotifications.checkPermissions();
        let status = perm.receive;
        if (status === 'prompt' || status === 'prompt-with-rationale') {
          const req = await PushNotifications.requestPermissions();
          status = req.receive;
        }
        if (status !== 'granted') return;

        await PushNotifications.register();

        const regHandle = await PushNotifications.addListener('registration', async (token: { value: string }) => {
          try {
            await fetch('/api/fcm-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: token.value, platform: cap.getPlatform?.() || 'android' }),
            });
          } catch (err) {
            console.error('FCM token upload failed:', err);
          }
        });

        const errHandle = await PushNotifications.addListener('registrationError', (err: unknown) => {
          console.error('FCM registration error:', err);
        });

        const tapHandle = await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (action: { notification: { data?: Record<string, string> } }) => {
            const url = action?.notification?.data?.url;
            if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) {
              window.location.assign(url);
            }
          },
        );

        cleanup = () => {
          regHandle.remove();
          errHandle.remove();
          tapHandle.remove();
        };
      } catch (err) {
        console.error('MobilePushManager setup failed:', err);
      }
    })();

    return () => {
      cleanup?.();
    };
  }, [session?.user]);

  return null;
}
