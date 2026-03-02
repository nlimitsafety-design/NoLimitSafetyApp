'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/lib/swr';
import {
  BellIcon,
  BellAlertIcon,
  CheckIcon,
  CalendarDaysIcon,
  UserMinusIcon,
  PencilSquareIcon,
  TrashIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  InboxArrowDownIcon,
  MegaphoneIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

const TYPE_CONFIG: Record<string, { icon: any; bg: string; text: string }> = {
  SHIFT_ASSIGNED:   { icon: CalendarDaysIcon,   bg: 'bg-green-500/15',  text: 'text-green-400' },
  SHIFT_REMOVED:    { icon: UserMinusIcon,      bg: 'bg-red-500/15',    text: 'text-red-400' },
  SHIFT_UPDATED:    { icon: PencilSquareIcon,   bg: 'bg-blue-500/15',   text: 'text-blue-400' },
  SHIFT_DELETED:    { icon: TrashIcon,          bg: 'bg-red-500/15',    text: 'text-red-400' },
  REQUEST_APPROVED: { icon: HandThumbUpIcon,    bg: 'bg-green-500/15',  text: 'text-green-400' },
  REQUEST_REJECTED: { icon: HandThumbDownIcon,  bg: 'bg-orange-500/15', text: 'text-orange-400' },
  NEW_REQUEST:      { icon: InboxArrowDownIcon, bg: 'bg-purple-500/15', text: 'text-purple-400' },
  NEW_OPEN_SHIFT:   { icon: MegaphoneIcon,      bg: 'bg-cyan-500/15',   text: 'text-cyan-400' },
};

const DEFAULT_TYPE = { icon: BellIcon, bg: 'bg-gray-500/15', text: 'text-gray-400' };

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
        <div className="fixed inset-x-0 top-14 mx-2 lg:absolute lg:inset-x-auto lg:top-full lg:mx-0 lg:left-0 lg:mt-2 lg:w-96 bg-gray-900 border border-gray-700/60 rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/40 bg-gray-800/40">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">Meldingen</h3>
              {unreadCount > 0 && (
                <span className="flex items-center justify-center h-5 min-w-[20px] rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
              >
                <CheckIcon className="h-3.5 w-3.5" />
                Alles gelezen
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[28rem] overflow-y-auto overscroll-contain">
            {recentNotifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="inline-flex p-3 rounded-2xl bg-gray-800/60 mb-3">
                  <BellIcon className="h-7 w-7 text-gray-600" />
                </div>
                <p className="text-sm font-medium text-gray-400">Geen meldingen</p>
                <p className="text-xs text-gray-600 mt-1">Je bent helemaal bij!</p>
              </div>
            ) : (
              recentNotifications.map((n: any) => {
                const config = TYPE_CONFIG[n.type] || DEFAULT_TYPE;
                const Icon = config.icon;
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
                      'w-full text-left px-4 py-3 hover:bg-white/5 transition-all duration-150 group',
                      !n.read && 'bg-brand-500/5'
                    )}
                  >
                    <div className="flex gap-3">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', config.bg)}>
                        <Icon className={cn('h-4 w-4', config.text)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={cn('text-sm font-medium truncate', n.read ? 'text-gray-500' : 'text-white')}>
                            {n.title}
                          </p>
                          {!n.read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0 animate-pulse" />
                          )}
                        </div>
                        <p className={cn('text-xs mt-0.5 line-clamp-2', n.read ? 'text-gray-600' : 'text-gray-400')}>
                          {n.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[11px] text-gray-600">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: nl })}
                          </p>
                          {n.shiftId && (
                            <span className="flex items-center gap-0.5 text-[11px] text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              Bekijk <ArrowRightIcon className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-700/40 bg-gray-800/40">
              <button
                onClick={() => {
                  router.push('/notifications');
                  setOpen(false);
                }}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-brand-400 hover:text-brand-300 hover:bg-white/5 transition-all duration-150"
              >
                Alle meldingen bekijken
                <ArrowRightIcon className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
