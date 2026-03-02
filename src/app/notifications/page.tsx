'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/lib/swr';
import { BellIcon, CheckIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { nl } from 'date-fns/locale';

const TYPE_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  SHIFT_ASSIGNED: { label: 'Toegewezen', bg: 'bg-green-500/15', text: 'text-green-400' },
  SHIFT_REMOVED: { label: 'Verwijderd', bg: 'bg-red-500/15', text: 'text-red-400' },
  SHIFT_UPDATED: { label: 'Gewijzigd', bg: 'bg-blue-500/15', text: 'text-blue-400' },
  SHIFT_DELETED: { label: 'Verwijderd', bg: 'bg-red-500/15', text: 'text-red-400' },
  REQUEST_APPROVED: { label: 'Goedgekeurd', bg: 'bg-green-500/15', text: 'text-green-400' },
  REQUEST_REJECTED: { label: 'Afgewezen', bg: 'bg-orange-500/15', text: 'text-orange-400' },
  NEW_REQUEST: { label: 'Nieuw verzoek', bg: 'bg-purple-500/15', text: 'text-purple-400' },
  NEW_OPEN_SHIFT: { label: 'Open dienst', bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
};

export default function NotificationsPage() {
  const router = useRouter();
  const { data, mutate } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const filtered = filter === 'unread'
    ? notifications.filter((n: any) => !n.read)
    : notifications;

  // Group by date
  const grouped = filtered.reduce((acc: Record<string, any[]>, n: any) => {
    const date = format(new Date(n.createdAt), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(n);
    return acc;
  }, {});

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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Meldingen</h1>
          <p className="text-sm text-gray-400 mt-1">
            {unreadCount > 0 ? `${unreadCount} ongelezen melding${unreadCount !== 1 ? 'en' : ''}` : 'Geen ongelezen meldingen'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="flex items-center bg-gray-800 rounded-lg p-1 border border-gray-700/50">
            <button
              onClick={() => setFilter('all')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                filter === 'all' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              )}
            >
              Alles
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                filter === 'unread' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              )}
            >
              Ongelezen
            </button>
          </div>
          {/* Mark all read */}
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-brand-400 hover:text-brand-300 bg-brand-500/10 hover:bg-brand-500/15 rounded-lg transition-colors"
            >
              <CheckIcon className="h-3.5 w-3.5" />
              Alles gelezen
            </button>
          )}
        </div>
      </div>

      {/* Notification list */}
      {filtered.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-12 text-center">
          <BellIcon className="h-12 w-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">
            {filter === 'unread' ? 'Geen ongelezen meldingen' : 'Nog geen meldingen'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {filter === 'unread'
              ? 'Je hebt alles gelezen!'
              : 'Meldingen verschijnen hier wanneer er wijzigingen worden aangebracht.'}
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(([date, items]) => (
          <div key={date}>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
              {format(new Date(date), 'EEEE d MMMM yyyy', { locale: nl })}
            </h2>
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden divide-y divide-gray-700/30">
              {(items as any[]).map((n: any) => {
                const typeStyle = TYPE_LABELS[n.type] || { label: n.type, bg: 'bg-gray-500/15', text: 'text-gray-400' };
                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!n.read) markRead(n.id);
                      if (n.shiftId) router.push('/planning');
                    }}
                    className={cn(
                      'px-4 py-4 flex gap-4 items-start transition-colors',
                      !n.read && 'bg-gray-800/30',
                      n.shiftId && 'cursor-pointer hover:bg-gray-700/30'
                    )}
                  >
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', typeStyle.bg)}>
                      <BellIcon className={cn('h-5 w-5', typeStyle.text)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={cn('text-sm font-medium', n.read ? 'text-gray-400' : 'text-white')}>
                          {n.title}
                        </p>
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', typeStyle.bg, typeStyle.text)}>
                          {typeStyle.label}
                        </span>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-brand-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                      <p className="text-xs text-gray-600 mt-1.5">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: nl })}
                      </p>
                    </div>
                    {!n.read && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="p-1.5 text-gray-500 hover:text-brand-400 hover:bg-gray-700/50 rounded-lg transition-colors flex-shrink-0"
                        title="Markeer als gelezen"
                      >
                        <CheckIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
