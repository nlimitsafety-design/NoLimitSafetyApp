'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useShiftRequests, fetcher } from '@/lib/swr';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { formatDate, calculateHours } from '@/lib/utils';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  UserIcon,
  ClockIcon,
  MapPinIcon,
  InboxIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface ShiftRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: any;
  onAction: () => void;
}

export default function ShiftRequestModal({ isOpen, onClose, shift, onAction }: ShiftRequestModalProps) {
  const { data: session } = useSession();
  const { data: requests = [], isLoading, mutate } = useShiftRequests(isOpen ? shift?.id : null);
  const [processing, setProcessing] = useState<string | null>(null);

  if (!shift) return null;

  const hours = calculateHours(shift.startTime, shift.endTime);
  const typeLabel = shift.type;
  const pendingCount = requests.filter((r: any) => r.status === 'PENDING').length;

  async function handleAction(requestId: string, action: 'APPROVED' | 'REJECTED') {
    setProcessing(requestId);
    try {
      const res = await fetch(`/api/shift-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        toast.success(action === 'APPROVED' ? 'Aanvraag geaccepteerd' : 'Aanvraag afgewezen');
        mutate();
        onAction(); // Refresh parent data
        if (action === 'APPROVED') {
          onClose(); // Close modal after approval since shift is no longer OPEN
        }
      } else {
        const data = await res.json();
        toast.error(data.error || 'Actie mislukt');
      }
    } catch {
      toast.error('Er ging iets mis');
    } finally {
      setProcessing(null);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Aanvragen Beheren"
      size="lg"
    >
      {/* Shift info summary */}
      <div className="bg-gray-50 rounded-lg p-4 mb-5 border border-gray-200">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-gray-900 font-semibold">
            {formatDate(shift.date, 'EEEE d MMMM yyyy')}
          </span>
          <Badge variant="orange">{typeLabel}</Badge>
        </div>
        <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <ClockIcon className="h-4 w-4" />
            {shift.startTime} – {shift.endTime} ({hours.toFixed(1)}u)
          </span>
          <span className="flex items-center gap-1">
            <MapPinIcon className="h-4 w-4" />
            {shift.location}
          </span>
        </div>
      </div>

      {/* Requests list */}
      {isLoading ? (
        <div className="py-8 text-center text-gray-500">Laden...</div>
      ) : requests.length === 0 ? (
        <div className="py-8 text-center">
          <InboxIcon className="h-10 w-10 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400">Nog geen aanvragen ontvangen</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-400 mb-3">
            {pendingCount} openstaande aanvra{pendingCount === 1 ? 'ag' : 'gen'} van {requests.length} totaal
          </p>

          {requests.map((req: any) => (
            <div
              key={req.id}
              className={`rounded-lg border p-4 ${
                req.status === 'PENDING'
                  ? 'border-gray-200 bg-gray-50'
                  : req.status === 'APPROVED'
                  ? 'border-green-500/20 bg-green-50'
                  : 'border-red-500/20 bg-red-50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-brand-500 flex-shrink-0">
                    {req.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{req.user.name}</p>
                    <p className="text-xs text-gray-500 truncate">{req.user.email}</p>
                  </div>
                </div>

                <Badge
                  variant={
                    req.status === 'PENDING'
                      ? 'warning'
                      : req.status === 'APPROVED'
                      ? 'success'
                      : 'danger'
                  }
                >
                  {req.status === 'PENDING'
                    ? 'Pending'
                    : req.status === 'APPROVED'
                    ? 'Goedgekeurd'
                    : 'Afgewezen'}
                </Badge>
              </div>

              {/* Availability & conflicts */}
              <div className="mt-3 flex flex-wrap gap-2">
                {req.availabilityStatus === 'NIET_BESCHIKBAAR' ? (
                  <span className="inline-flex items-center gap-1 text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
                    <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                    Niet beschikbaar
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded">
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                    Beschikbaar
                  </span>
                )}

                {req.conflicts && req.conflicts.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded">
                    <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                    {req.conflicts.length} conflict{req.conflicts.length > 1 ? 'en' : ''}
                  </span>
                )}
              </div>

              {req.conflicts && req.conflicts.length > 0 && (
                <div className="mt-2 pl-3 border-l-2 border-yellow-500/30">
                  {req.conflicts.map((c: string, i: number) => (
                    <p key={i} className="text-xs text-yellow-300/70">{c}</p>
                  ))}
                </div>
              )}

              {/* Actions */}
              {req.status === 'PENDING' && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                  <Button
                    size="sm"
                    onClick={() => handleAction(req.id, 'APPROVED')}
                    loading={processing === req.id}
                    className="flex-1"
                  >
                    <CheckCircleIcon className="h-4 w-4 mr-1" />
                    Accepteren
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleAction(req.id, 'REJECTED')}
                    loading={processing === req.id}
                    className="flex-1"
                  >
                    <XCircleIcon className="h-4 w-4 mr-1" />
                    Afwijzen
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-4 mt-4 border-t border-gray-200">
        <Button variant="ghost" onClick={onClose}>
          Sluiten
        </Button>
      </div>
    </Modal>
  );
}
