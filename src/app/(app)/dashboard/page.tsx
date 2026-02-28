'use client';

import { useSession } from 'next-auth/react';
import { useDashboard } from '@/lib/swr';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { formatDate, calculateHours, formatCurrency } from '@/lib/utils';
import {
  CalendarDaysIcon,
  ClockIcon,
  UsersIcon,
  CurrencyEuroIcon,
  PlusIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

interface DashboardData {
  totalEmployees: number;
  activeShifts: number;
  hoursThisWeek: number;
  pendingShifts: number;
  upcomingShifts: any[];
  recentAvailability: any[];
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
      color: 'text-brand-400',
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
              <p className="text-2xl font-bold text-white">{stat.value}</p>
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
              <Link href="/planning" className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1">
                Alles bekijken <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </CardHeader>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-navy-800/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : data?.upcomingShifts && data.upcomingShifts.length > 0 ? (
              <div className="space-y-3">
                {data.upcomingShifts.map((shift: any) => (
                  <div key={shift.id} className="flex items-center justify-between p-3 bg-navy-800/30 rounded-lg hover:bg-navy-800/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white truncate">{shift.location}</p>
                        {statusBadge(shift.status)}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(shift.date, 'EEEE d MMM')} • {shift.startTime} - {shift.endTime}
                      </p>
                      {shift.shiftUsers?.length > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {shift.shiftUsers.map((su: any) => su.user.name).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-sm font-medium text-brand-400">{calculateHours(shift.startTime, shift.endTime)}u</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm py-8 text-center">Geen komende diensten</p>
            )}
          </Card>

          {/* Quick availability overview for admin */}
          <Card>
            <CardHeader>
              <CardTitle>
                {isAdmin ? 'Recente Beschikbaarheid' : 'Mijn Beschikbaarheid'}
              </CardTitle>
              <Link href="/availability" className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1">
                Bekijken <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </CardHeader>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-navy-800/50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : data?.recentAvailability && data.recentAvailability.length > 0 ? (
              <div className="space-y-2">
                {data.recentAvailability.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-navy-800/30 rounded-lg">
                    <div>
                      {isAdmin && <p className="text-sm font-medium text-white">{a.user?.name}</p>}
                      <p className="text-xs text-gray-400">
                        {formatDate(a.date, 'EEEE d MMM')} • {a.startTime} - {a.endTime}
                      </p>
                      {a.note && <p className="text-xs text-gray-500 mt-0.5">{a.note}</p>}
                    </div>
                    <Badge variant={a.status === 'AVAILABLE' ? 'success' : a.status === 'UNAVAILABLE' ? 'danger' : 'warning'}>
                      {a.status === 'AVAILABLE' ? 'Beschikbaar' : a.status === 'UNAVAILABLE' ? 'Niet beschikbaar' : 'Gedeeltelijk'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm py-8 text-center">Geen beschikbaarheid ingevuld</p>
            )}
          </Card>
        </div>
      </div>
  );
}
