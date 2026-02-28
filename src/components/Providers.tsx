'use client';

import { SessionProvider } from 'next-auth/react';
import { SWRConfig } from 'swr';
import { swrDefaults } from '@/lib/swr';
import { Toaster } from 'react-hot-toast';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SWRConfig value={swrDefaults}>
        {children}
      </SWRConfig>
      <Toaster
        position="top-right"
        toastOptions={{
          className: '!bg-navy-800 !text-white !border !border-navy-700',
          duration: 4000,
          style: {
            background: '#1E293B',
            color: '#fff',
            border: '1px solid #334155',
          },
        }}
      />
    </SessionProvider>
  );
}
