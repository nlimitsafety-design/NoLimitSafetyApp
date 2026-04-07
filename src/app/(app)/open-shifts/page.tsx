'use client';

import { useState } from 'react';
import { useOpenShifts, useMyRequests, useFuncties } from '@/lib/swr';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { formatDate, calculateHours } from '@/lib/utils';
import {
  BriefcaseIcon,
  ClockIcon,
  MapPinIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function OpenShiftsPage() {
  const { data: openShifts = [], isLoading, mutate: mutateOpen } = useOpenShifts();
  const { data: myRequests = [], mutate: mutateRequests } = useMyRequests();
  const { data: functies = [] } = useFuncties();
  const [requesting, setRequesting] = useState<string | null>(null);


  async function handleRequest(shiftId: string) {
    setRequesting(shiftId);
    try {
      const res = await fetch('/api/shift-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId }),
      });

      if (res.ok) {
        toast.success('Aanvraag ingediend!');
        mutateOpen();
        mutateRequests();
      } else {
        const data = await res.json();
        toast.error(data.details || data.error || 'Aanvraag mislukt');
      }
    } catch {
      toast.error('Er ging iets mis');
    } finally {
      setRequesting(null);
    }
  }

  const typeBadge = (type: string) => {
    const f = functies.find((ft: any) => ft.name === type);
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
        style={f ? { backgroundColor: f.color + '33', color: f.color, border: `1px solid ${f.color}55` } : {}}
      >
        {type}
      </span>
    );
  };

  // Pending requests from myRequests (for "Mijn aanvragen" section)
  const pendingRequests = myRequests.filter((r: any) => r.status === 'PENDING');
  const resolvedRequests = myRequests.filter((r: any) => r.status !== 'PENDING');

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title">Open Diensten</h1>
        <p className="page-subtitle">Bekijk beschikbare diensten en dien een aanvraag in</p>
      </div>

      {/* Open shifts */}
      {isLoading ? (
        <Card>
          <div className="flex items-center justify-center py-12">
            <ArrowPathIcon className="h-6 w-6 text-gray-500 animate-spin" />
            <span className="ml-2 text-gray-500">Laden...</span>
          </div>
        </Card>
      ) : openShifts.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <BriefcaseIcon className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Geen open diensten</p>
            <p className="text-sm text-gray-600 mt-1">
              Er zijn momenteel geen diensten beschikbaar om aan te vragen.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          {openShifts.map((shift: any) => {
            const hours = calculateHours(shift.startTime, shift.endTime);
            const hasRequested = shift.myRequest !== null;
            const isPending = shift.myRequest?.status === 'PENDING';

            return (
              <Card key={shift.id} className="flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatDate(shift.date, 'EEEE d MMMM')}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {shift.totalRequests} aanvra{shift.totalRequests === 1 ? 'ag' : 'gen'}
                    </p>
                  </div>
                  {typeBadge(shift.type)}
                </div>

                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <ClockIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    <span>
                      {shift.startTime} - {shift.endTime}{' '}
                      <span className="text-gray-500">({hours.toFixed(1)}u)</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPinIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    <span>{shift.location}</span>
                  </div>
                  {shift.note && (
                    <p className="text-xs text-gray-500 mt-2 pl-6">{shift.note}</p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-200">
                  {hasRequested ? (
                    <div className="flex items-center gap-2 text-sm">
                      {isPending ? (
                        <>
                          <ArrowPathIcon className="h-4 w-4 text-yellow-400" />
                          <span className="text-yellow-400 font-medium">Aanvraag ingediend</span>
                        </>
                      ) : shift.myRequest?.status === 'APPROVED' ? (
                        <>
                          <CheckCircleIcon className="h-4 w-4 text-green-400" />
                          <span className="text-green-400 font-medium">Goedgekeurd</span>
                        </>
                      ) : (
                        <>
                          <XCircleIcon className="h-4 w-4 text-red-400" />
                          <span className="text-red-400 font-medium">Afgewezen</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleRequest(shift.id)}
                      loading={requesting === shift.id}
                      size="sm"
                      className="w-full"
                    >
                      <BriefcaseIcon className="h-4 w-4 mr-1.5" />
                      Aanvragen
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* My requests section */}
      {myRequests.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Mijn Aanvragen</h2>

          {/* Pending */}
          {pendingRequests.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-yellow-400 mb-2">
                In afwachting ({pendingRequests.length})
              </h3>
              <div className="space-y-2">
                {pendingRequests.map((req: any) => (
                  <Card key={req.id} className="!p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ArrowPathIcon className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-900 font-medium">
                            {formatDate(req.shift.date, 'EEE d MMM')} - {req.shift.startTime}-{req.shift.endTime}
                          </p>
                          <p className="text-xs text-gray-500">{req.shift.location}</p>
                        </div>
                      </div>
                      <Badge variant="warning">Pending</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Resolved */}
          {resolvedRequests.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Verwerkt ({resolvedRequests.length})
              </h3>
              <div className="space-y-2">
                {resolvedRequests.slice(0, 10).map((req: any) => (
                  <Card key={req.id} className="!p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {req.status === 'APPROVED' ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-400 flex-shrink-0" />
                        ) : (
                          <XCircleIcon className="h-5 w-5 text-red-400 flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-sm text-gray-900 font-medium">
                            {formatDate(req.shift.date, 'EEE d MMM')} - {req.shift.startTime}-{req.shift.endTime}
                          </p>
                          <p className="text-xs text-gray-500">{req.shift.location}</p>
                        </div>
                      </div>
                      <Badge variant={req.status === 'APPROVED' ? 'success' : 'danger'}>
                        {req.status === 'APPROVED' ? 'Goedgekeurd' : 'Afgewezen'}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
