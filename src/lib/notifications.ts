import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

/**
 * Notification types:
 * - SHIFT_ASSIGNED:   You've been assigned to a shift
 * - SHIFT_REMOVED:    You've been removed from a shift
 * - SHIFT_UPDATED:    A shift you're assigned to has been updated
 * - SHIFT_DELETED:    A shift you were assigned to has been deleted
 * - REQUEST_APPROVED: Your shift request was approved
 * - REQUEST_REJECTED: Your shift request was rejected
 * - NEW_REQUEST:      An employee requested an open shift (admin notification)
 * - NEW_OPEN_SHIFT:   A new open shift is available
 */

interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  shiftId?: string;
}

/**
 * Create a single notification. Fire-and-forget — errors are logged but never thrown.
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        shiftId: params.shiftId || null,
      },
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

/**
 * Create notifications for many users at once.
 */
export async function createNotifications(
  userIds: string[],
  type: string,
  title: string,
  message: string,
  shiftId?: string,
) {
  if (userIds.length === 0) return;

  try {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type,
        title,
        message,
        shiftId: shiftId || null,
      })),
    });
  } catch (err) {
    console.error('Failed to create bulk notifications:', err);
  }
}

// ── Helper to format shift info for notification messages ──

function formatShiftInfo(date: Date | string, startTime: string, endTime: string, location: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dateStr = format(d, 'd MMMM', { locale: nl });
  return `${dateStr} ${startTime}-${endTime} @ ${location}`;
}

// ── Pre-built notification creators ──

export async function notifyShiftAssigned(userIds: string[], shift: { id: string; date: Date | string; startTime: string; endTime: string; location: string }) {
  const info = formatShiftInfo(shift.date, shift.startTime, shift.endTime, shift.location);
  await createNotifications(
    userIds,
    'SHIFT_ASSIGNED',
    'Dienst toegewezen',
    `Je bent ingepland voor de dienst op ${info}.`,
    shift.id,
  );
}

export async function notifyShiftRemoved(userIds: string[], shift: { id: string; date: Date | string; startTime: string; endTime: string; location: string }) {
  const info = formatShiftInfo(shift.date, shift.startTime, shift.endTime, shift.location);
  await createNotifications(
    userIds,
    'SHIFT_REMOVED',
    'Verwijderd uit dienst',
    `Je bent verwijderd uit de dienst op ${info}.`,
    shift.id,
  );
}

export async function notifyShiftUpdated(userIds: string[], shift: { id: string; date: Date | string; startTime: string; endTime: string; location: string }) {
  const info = formatShiftInfo(shift.date, shift.startTime, shift.endTime, shift.location);
  await createNotifications(
    userIds,
    'SHIFT_UPDATED',
    'Dienst gewijzigd',
    `De dienst op ${info} is gewijzigd. Controleer je rooster.`,
    shift.id,
  );
}

export async function notifyShiftDeleted(userIds: string[], shiftInfo: { date: Date | string; startTime: string; endTime: string; location: string }) {
  const info = formatShiftInfo(shiftInfo.date, shiftInfo.startTime, shiftInfo.endTime, shiftInfo.location);
  await createNotifications(
    userIds,
    'SHIFT_DELETED',
    'Dienst verwijderd',
    `De dienst op ${info} is verwijderd.`,
  );
}

export async function notifyRequestApproved(userId: string, shift: { id: string; date: Date | string; startTime: string; endTime: string; location: string }) {
  const info = formatShiftInfo(shift.date, shift.startTime, shift.endTime, shift.location);
  await createNotification({
    userId,
    type: 'REQUEST_APPROVED',
    title: 'Aanvraag goedgekeurd',
    message: `Je aanvraag voor de dienst op ${info} is goedgekeurd.`,
    shiftId: shift.id,
  });
}

export async function notifyRequestRejected(userIds: string[], shift: { id: string; date: Date | string; startTime: string; endTime: string; location: string }) {
  const info = formatShiftInfo(shift.date, shift.startTime, shift.endTime, shift.location);
  await createNotifications(
    userIds,
    'REQUEST_REJECTED',
    'Aanvraag afgewezen',
    `Je aanvraag voor de dienst op ${info} is afgewezen.`,
    shift.id,
  );
}

export async function notifyNewRequest(adminUserIds: string[], employeeName: string, shift: { id: string; date: Date | string; startTime: string; endTime: string; location: string }) {
  const info = formatShiftInfo(shift.date, shift.startTime, shift.endTime, shift.location);
  await createNotifications(
    adminUserIds,
    'NEW_REQUEST',
    'Nieuwe aanvraag',
    `${employeeName} heeft de dienst op ${info} aangevraagd.`,
    shift.id,
  );
}

export async function notifyNewOpenShift(userIds: string[], shift: { id: string; date: Date | string; startTime: string; endTime: string; location: string }) {
  const info = formatShiftInfo(shift.date, shift.startTime, shift.endTime, shift.location);
  await createNotifications(
    userIds,
    'NEW_OPEN_SHIFT',
    'Nieuwe open dienst',
    `Er is een nieuwe open dienst beschikbaar op ${info}.`,
    shift.id,
  );
}
