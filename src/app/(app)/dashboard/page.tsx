'use client';

import { useSession } from 'next-auth/react';
import { useDashboard } from '@/lib/swr';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { formatDate, calculateHours } from '@/lib/utils';
import {
  CalendarDaysIcon,
  ClockIcon,
  UsersIcon,
  CurrencyEuroIcon,
  PlusIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { format, startOfWeek, addDays } from 'date-fns';
import { nl } from 'date-fns/locale';

function abbrev(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 6);
  return parts[0].slice(0, 1).toUpperCase() + '. ' + parts[parts.length - 1].slice(0, 8);
}

function AvailabilityGrid({ data, loading }: { data: any; loading: boolean }) {
  const grid = data?.weekAvailabilityGrid;
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const dayLabels = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Beschikbaarheid deze week</CardTitle>
        <Link href="/availability" className="text-sm text-brand-500 hover:text-brand-300 flex items-center gap-1">
          Beheren <ArrowRightIcon className="h-3 w-3" />
        </Link>
      </CardHeader>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-7 bg-gray-50 rounded animate-pulse" />)}
        </div>
      ) : !grid || grid.employees.length === 0 ? (
        <p className="text-gray-500 text-sm py-4 text-center">Geen medewerkers gevonden</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left py-1 px-1 text-gray-400 font-medium w-20 min-w-[5rem]">Naam</th>
                {dayLabels.map((d, i) => {
                  const dayDate = addDays(weekStart, i);
                  const isToday = format(dayDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                  return (
                    <th key={d} className={`text-center py-1 px-0.5 font-medium ${isToday ? 'text-brand-500' : 'text-gray-400'}`}>
                      {d}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grid.employees.map((emp: any) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="py-1 px-1 font-medium text-gray-700 truncate max-w-[5rem]" title={emp.name}>
                    {abbrev(emp.name)}
                  </td>
                  {emp.days.map((day: any, i: number) => {
                    const type = day?.type;
                    const isToday = grid.days[i] === format(new Date(), 'yyyy-MM-dd');
                    const cell = type === 'AVAILABLE'
                      ? { bg: 'bg-green-500', title: day.startTime && day.endTime ? `${day.startTime}-${day.endTime}` : 'Hele dag' }
                      : type === 'UNAVAILABLE'
                        ? { bg: 'bg-red-500', title: 'Niet beschikbaar' }
                        : type === 'PARTIAL'
                          ? { bg: 'bg-orange-400', title: day.startTime && day.endTime ? `${day.startTime}-${day.endTime}` : 'Gedeeltelijk' }
                          : { bg: 'bg-gray-200', title: 'Niet ingevuld' };
                    return (
                      <td key={i} className={`text-center py-1 px-0.5 ${isToday ? 'bg-brand-500/5' : ''}`}>
                        <div
                          className={`mx-auto rounded w-6 h-6 ${cell.bg} opacity-80`}
                          title={cell.title}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" />Beschikbaar</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-400 inline-block" />Gedeeltelijk</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" />Niet beschikbaar</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 inline-block" />Onbekend</span>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { data, isLoading: loading } = useDashboard();

  const userRole = session?.user?.role;
  const isAdmin = userRole === 'ADMIN';
  const isManager = userRole === 'MANAGER';

  const stats = [
    {
      name: 'Medewerkers',
      value: data?.totalEmployees ?? '-',
      icon: UsersIcon,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      show: isAdmin || isManager,
    },
    {
      name: 'Actieve Diensten',
      value: data?.activeShifts ?? '-',
      icon: CalendarDaysIcon,
      color: 'text-brand-500',
      bgColor: 'bg-brand-500/10',
      show: true,
    },
    {
      name: 'Uren deze week',
      value: data?.hoursThisWeek ? `${data.hoursThisWeek.toFixed(1)}u` : '-',
      icon: ClockIcon,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      show: true,
    },
    {
      name: 'Te bevestigen',
      value: data?.pendingShifts ?? '-',
      icon: CurrencyEuroIcon,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      show: isAdmin || isManager,
    },
  ];

  const statusBadge = (status: string) => {
    switch (status) {
      case 'CONCEPT': return <Badge variant="warning">Concept</Badge>;
      case 'BEVESTIGD': return <Badge variant="success">Bevestigd</Badge>;
      case 'AFGEROND': return <Badge variant="info">Afgerond</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="page-title">
              Welkom, <span className="gradient-text">{session?.user?.name?.split(' ')[0]}</span>
            </h1>
            <p className="page-subtitle">
              {isAdmin ? 'Beheer je team en planning' : 'Bekijk je planning en beschikbaarheid'}
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Link href="/planning">
                <Button size="md">
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Nieuwe dienst
                </Button>
              </Link>
            )}
            {!isAdmin && (
              <Link href="/availability">
                <Button size="md">
                  <ClockIcon className="h-4 w-4 mr-2" />
                  Beschikbaarheid
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.filter(s => s.show).map((stat) => (
            <div key={stat.name} className="stat-card group">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-400 mt-1">{stat.name}</p>
            </div>
          ))}
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming shifts */}
          <Card>
            <CardHeader>
              <CardTitle>Komende Diensten</CardTitle>
              <Link href="/planning" className="text-sm text-brand-500 hover:text-brand-300 flex items-center gap-1">
                Alles bekijken <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </CardHeader>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-gray-50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : data?.upcomingShifts && data.upcomingShifts.length > 0 ? (
              <div className="space-y-3">
                {data.upcomingShifts.map((shift: any) => (
                  <div key={shift.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{shift.location}</p>
                        {statusBadge(shift.status)}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(shift.date, 'EEEE d MMM')} - {shift.startTime} - {shift.endTime}
                      </p>
                      {shift.shiftUsers?.length > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {shift.shiftUsers.map((su: any) => su.user.name).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-sm font-medium text-brand-500">{calculateHours(shift.startTime, shift.endTime)}u</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm py-8 text-center">Geen komende diensten</p>
            )}
          </Card>

          {/* Availability overview */}
          {isAdmin ? (
            <AvailabilityGrid data={data} loading={loading} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Mijn Beschikbaarheid</CardTitle>
                <Link href="/availability" className="text-sm text-brand-500 hover:text-brand-300 flex items-center gap-1">
                  Bekijken <ArrowRightIcon className="h-3 w-3" />
                </Link>
              </CardHeader>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : data?.recentAvailability && data.recentAvailability.length > 0 ? (
                <div className="space-y-2">
                  {data.recentAvailability.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-xs text-gray-400">
                          {formatDate(a.date, 'EEEE d MMM')} {a.startTime && a.endTime ? `- ${a.startTime}-${a.endTime}` : ''}
                        </p>
                      </div>
                      <Badge variant={a.type === 'AVAILABLE' ? 'success' : a.type === 'UNAVAILABLE' ? 'danger' : 'warning'}>
                        {a.type === 'AVAILABLE' ? 'Beschikbaar' : a.type === 'UNAVAILABLE' ? 'Niet beschikbaar' : 'Gedeeltelijk'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm py-8 text-center">Geen beschikbaarheid ingevuld</p>
              )}
            </Card>
          )}
        </div>
      </div>
  );
}
