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
          className: '!bg-white !text-gray-900 !border !border-gray-200 !shadow-lg',
          duration: 4000,
          style: {
            background: '#FFFFFF',
            color: '#111827',
            border: '1px solid #E5E7EB',
          },
        }}
      />
    </SessionProvider>
  );
}
