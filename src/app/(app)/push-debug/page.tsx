'use client';

import { useState, useEffect } from 'react';
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

export default function PushDebugPage() {
  const { data: session } = useSession();
  const [log, setLog] = useState<string[]>([]);
  const [working, setWorking] = useState(false);

  function addLog(msg: string) {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }

  useEffect(() => {
    addLog(`VAPID key in client bundle: ${VAPID_PUBLIC_KEY ? 'YES (' + VAPID_PUBLIC_KEY.length + ' chars)' : 'EMPTY - THIS IS THE PROBLEM'}`);
    addLog(`VAPID key preview: "${VAPID_PUBLIC_KEY.substring(0, 15)}..."`);
    addLog(`Service Worker supported: ${'serviceWorker' in navigator}`);
    addLog(`PushManager supported: ${'PushManager' in window}`);
    addLog(`Notification supported: ${'Notification' in window}`);
    if ('Notification' in window) {
      addLog(`Current notification permission: ${Notification.permission}`);
    }
    addLog(`User logged in: ${!!session?.user} (${session?.user?.name || 'none'})`);
  }, [session]);

  async function testPush() {
    setWorking(true);
    try {
      // Step 1: Check VAPID
      addLog('--- Starting manual push subscription test ---');
      if (!VAPID_PUBLIC_KEY) {
        addLog('❌ VAPID_PUBLIC_KEY is EMPTY. It was not set in Vercel env vars during build.');
        addLog('Fix: Add NEXT_PUBLIC_VAPID_PUBLIC_KEY to Vercel Environment Variables, then REDEPLOY.');
        setWorking(false);
        return;
      }
      addLog('✅ VAPID key present');

      // Step 2: Check browser support
      if (!('serviceWorker' in navigator)) {
        addLog('❌ Service Workers not supported in this browser');
        setWorking(false);
        return;
      }
      addLog('✅ Service Workers supported');

      // Step 3: Register SW
      addLog('Registering service worker...');
      let registration;
      try {
        registration = await navigator.serviceWorker.register('/sw.js');
        addLog(`✅ SW registered (scope: ${registration.scope})`);
      } catch (e: any) {
        addLog(`❌ SW registration failed: ${e.message}`);
        setWorking(false);
        return;
      }

      // Step 4: Wait for SW ready
      addLog('Waiting for SW to be ready...');
      await navigator.serviceWorker.ready;
      addLog('✅ SW is ready');

      // Step 5: Check existing subscription
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        addLog(`ℹ️ Already subscribed: ${existing.endpoint.substring(0, 60)}...`);
        addLog('Sending existing subscription to server...');
        const res = await fetch('/api/push-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: existing.toJSON() }),
        });
        const data = await res.json();
        addLog(`Server response: ${res.status} - ${JSON.stringify(data)}`);
        addLog('Now try /api/push-test again to send a test notification');
        setWorking(false);
        return;
      }

      // Step 6: Request permission
      addLog('Requesting notification permission...');
      const permission = await Notification.requestPermission();
      addLog(`Permission result: ${permission}`);
      if (permission !== 'granted') {
        addLog('❌ Permission denied. User must allow notifications.');
        setWorking(false);
        return;
      }
      addLog('✅ Permission granted');

      // Step 7: Subscribe
      addLog('Subscribing to push...');
      let subscription;
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        addLog(`✅ Subscribed! Endpoint: ${subscription.endpoint.substring(0, 60)}...`);
      } catch (e: any) {
        addLog(`❌ Subscribe failed: ${e.message}`);
        setWorking(false);
        return;
      }

      // Step 8: Save to server
      addLog('Saving subscription to server...');
      const res = await fetch('/api/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      const data = await res.json();
      addLog(`Server response: ${res.status} - ${JSON.stringify(data)}`);

      if (res.ok) {
        addLog('✅ ALL DONE! Subscription saved. Now visit /api/push-test to trigger a test push.');
      } else {
        addLog('❌ Failed to save subscription to server');
      }

    } catch (e: any) {
      addLog(`❌ Unexpected error: ${e.message}`);
    }
    setWorking(false);
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Push Notification Debug</h1>
      
      <button
        onClick={testPush}
        disabled={working}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50"
      >
        {working ? 'Bezig...' : 'Test Push Subscription'}
      </button>

      <div className="bg-gray-900 rounded-lg p-4 font-mono text-xs space-y-1 max-h-[70vh] overflow-y-auto">
        {log.map((line, i) => (
          <div key={i} className={
            line.includes('❌') ? 'text-red-400' :
            line.includes('✅') ? 'text-green-400' :
            line.includes('ℹ️') ? 'text-blue-400' :
            'text-gray-300'
          }>
            {line}
          </div>
        ))}
        {log.length === 0 && <div className="text-gray-500">Loading...</div>}
      </div>
    </div>
  );
}
