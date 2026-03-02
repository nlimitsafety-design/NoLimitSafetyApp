'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/lib/swr';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
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
import { formatDistanceToNow, format } from 'date-fns';
import { nl } from 'date-fns/locale';

const TYPE_CONFIG: Record<string, { label: string; icon: any; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'orange'; color: string; bgColor: string }> = {
  SHIFT_ASSIGNED:   { label: 'Toegewezen',    icon: CalendarDaysIcon,   variant: 'success', color: 'text-green-500',  bgColor: 'bg-green-500/10' },
  SHIFT_REMOVED:    { label: 'Verwijderd',    icon: UserMinusIcon,      variant: 'danger',  color: 'text-red-500',    bgColor: 'bg-red-500/10' },
  SHIFT_UPDATED:    { label: 'Gewijzigd',     icon: PencilSquareIcon,   variant: 'info',    color: 'text-blue-500',   bgColor: 'bg-blue-500/10' },
  SHIFT_DELETED:    { label: 'Verwijderd',    icon: TrashIcon,          variant: 'danger',  color: 'text-red-500',    bgColor: 'bg-red-500/10' },
  REQUEST_APPROVED: { label: 'Goedgekeurd',   icon: HandThumbUpIcon,    variant: 'success', color: 'text-green-500',  bgColor: 'bg-green-500/10' },
  REQUEST_REJECTED: { label: 'Afgewezen',     icon: HandThumbDownIcon,  variant: 'orange',  color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  NEW_REQUEST:      { label: 'Nieuw verzoek', icon: InboxArrowDownIcon, variant: 'warning', color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  NEW_OPEN_SHIFT:   { label: 'Open dienst',   icon: MegaphoneIcon,      variant: 'info',    color: 'text-brand-500',  bgColor: 'bg-brand-500/10' },
};

const DEFAULT_CONFIG = { label: 'Melding', icon: BellIcon, variant: 'default' as const, color: 'text-gray-500', bgColor: 'bg-gray-500/10' };

export default function NotificationsPage() {
  const router = useRouter();
  const { data, mutate, isLoading } = useNotifications();
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
    <div className="animate-fade-in">
      {/* Header — matches dashboard / planning pattern */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">
            <span className="gradient-text">Meldingen</span>
          </h1>
          <p className="page-subtitle">
            {unreadCount > 0
              ? `${unreadCount} ongelezen melding${unreadCount !== 1 ? 'en' : ''}`
              : 'Je bent helemaal bij'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filter toggle */}
          <div className="flex items-center bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
            {(['all', 'unread'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
                  filter === f
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                )}
              >
                {f === 'all' ? 'Alles' : 'Ongelezen'}
                {f === 'unread' && unreadCount > 0 && (
                  <span className={cn(
                    'ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] rounded-full text-[10px] font-bold px-1',
                    filter === 'unread' ? 'bg-white/20 text-white' : 'bg-red-500 text-white'
                  )}>
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          {/* Mark all read */}
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-brand-500 hover:text-brand-700 bg-white hover:bg-brand-50 rounded-lg border border-gray-200 shadow-sm transition-all duration-200"
            >
              <CheckIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Alles gelezen</span>
            </button>
          )}
        </div>
      </div>

      {/* Stat summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
        <div className="stat-card group">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-brand-500/10">
              <BellIcon className="h-5 w-5 text-brand-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{notifications.length}</p>
          <p className="text-sm text-gray-400 mt-1">Totaal</p>
        </div>
        <div className="stat-card group">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <BellAlertIcon className="h-5 w-5 text-red-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{unreadCount}</p>
          <p className="text-sm text-gray-400 mt-1">Ongelezen</p>
        </div>
        <div className="stat-card group hidden sm:block">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckIcon className="h-5 w-5 text-green-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{notifications.length - unreadCount}</p>
          <p className="text-sm text-gray-400 mt-1">Gelezen</p>
        </div>
      </div>

      {/* Notification list */}
      {isLoading ? (
        <Card>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-50 rounded-lg animate-pulse" />
            ))}
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-16">
          <div className="flex flex-col items-center">
            <div className="p-4 rounded-2xl bg-gray-50 mb-4">
              <BellIcon className="h-10 w-10 text-gray-300" />
            </div>
            <p className="text-gray-900 font-semibold text-lg">
              {filter === 'unread' ? 'Alles gelezen!' : 'Nog geen meldingen'}
            </p>
            <p className="text-sm text-gray-400 mt-1 max-w-sm">
              {filter === 'unread'
                ? 'Je hebt geen ongelezen meldingen. Goed bijgehouden!'
                : 'Meldingen verschijnen hier wanneer er wijzigingen aan diensten worden gemaakt.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
                {format(new Date(date), 'EEEE d MMMM yyyy', { locale: nl })}
              </p>
              <Card padding={false}>
                <div className="divide-y divide-gray-100">
                  {(items as any[]).map((n: any) => {
                    const config = TYPE_CONFIG[n.type] || DEFAULT_CONFIG;
                    const Icon = config.icon;
                    return (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (!n.read) markRead(n.id);
                          if (n.shiftId) router.push('/planning');
                        }}
                        className={cn(
                          'flex items-start gap-4 px-4 sm:px-6 py-4 transition-all duration-200',
                          !n.read && 'bg-brand-50/30',
                          n.shiftId && 'cursor-pointer hover:bg-gray-50'
                        )}
                      >
                        {/* Icon */}
                        <div className={cn('p-2 rounded-lg flex-shrink-0', config.bgColor)}>
                          <Icon className={cn('h-5 w-5', config.color)} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={cn(
                              'text-sm font-medium',
                              n.read ? 'text-gray-400' : 'text-gray-900'
                            )}>
                              {n.title}
                            </p>
                            <Badge variant={config.variant} size="sm">{config.label}</Badge>
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />
                            )}
                          </div>
                          <p className={cn('text-sm mt-0.5', n.read ? 'text-gray-300' : 'text-gray-500')}>
                            {n.message}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <p className="text-xs text-gray-400">
                              {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: nl })}
                            </p>
                            {n.shiftId && (
                              <span className="flex items-center gap-1 text-xs text-brand-500">
                                Bekijk dienst <ArrowRightIcon className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Mark-as-read button */}
                        {!n.read && (
                          <button
                            onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                            className="p-2 text-gray-300 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-all duration-200 flex-shrink-0"
                            title="Markeer als gelezen"
                          >
                            <CheckIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
