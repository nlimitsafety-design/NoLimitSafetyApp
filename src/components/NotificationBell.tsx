'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/lib/swr';
import { BellIcon, BellAlertIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

const TYPE_ICONS: Record<string, { bg: string; text: string }> = {
  SHIFT_ASSIGNED: { bg: 'bg-green-500/15', text: 'text-green-400' },
  SHIFT_REMOVED: { bg: 'bg-red-500/15', text: 'text-red-400' },
  SHIFT_UPDATED: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  SHIFT_DELETED: { bg: 'bg-red-500/15', text: 'text-red-400' },
  REQUEST_APPROVED: { bg: 'bg-green-500/15', text: 'text-green-400' },
  REQUEST_REJECTED: { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  NEW_REQUEST: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  NEW_OPEN_SHIFT: { bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { data, mutate } = useNotifications();

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function markAllRead() {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      mutate();
    } catch {}
  }

  async function markRead(id: string) {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      mutate();
    } catch {}
  }

  const recentNotifications = notifications.slice(0, 8);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        aria-label="Meldingen"
      >
        {unreadCount > 0 ? (
          <BellAlertIcon className="h-5 w-5 text-brand-400" />
        ) : (
          <BellIcon className="h-5 w-5" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="fixed inset-x-0 top-14 mx-2 sm:absolute sm:inset-x-auto sm:top-full sm:mx-0 sm:right-0 sm:mt-2 sm:w-96 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
            <h3 className="text-sm font-semibold text-white">Meldingen</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                >
                  Alles gelezen
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {recentNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <BellIcon className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Geen meldingen</p>
              </div>
            ) : (
              recentNotifications.map((n: any) => {
                const typeStyle = TYPE_ICONS[n.type] || { bg: 'bg-gray-500/15', text: 'text-gray-400' };
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (!n.read) markRead(n.id);
                      if (n.shiftId) {
                        router.push('/planning');
                        setOpen(false);
                      }
                    }}
                    className={cn(
                      'w-full text-left px-4 py-3 border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors',
                      !n.read && 'bg-gray-800/30'
                    )}
                  >
                    <div className="flex gap-3">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', typeStyle.bg)}>
                        <BellIcon className={cn('h-4 w-4', typeStyle.text)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={cn('text-sm font-medium truncate', n.read ? 'text-gray-400' : 'text-white')}>
                            {n.title}
                          </p>
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: nl })}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-700/50">
              <button
                onClick={() => {
                  router.push('/notifications');
                  setOpen(false);
                }}
                className="w-full px-4 py-2.5 text-center text-xs text-brand-400 hover:text-brand-300 hover:bg-gray-800/50 transition-colors"
              >
                Alle meldingen bekijken
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
