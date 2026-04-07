import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addDays,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { nl } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(
  date: Date | string,
  fmt: string = "dd MMM yyyy",
): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, fmt, { locale: nl });
}

export function formatTime(time: string): string {
  return time; // Already in HH:mm format
}

export function calculateHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  // If end <= start, treat as overnight shift (add 24 hours)
  const totalMinutes = endMinutes > startMinutes
    ? endMinutes - startMinutes
    : endMinutes + 1440 - startMinutes;
  return totalMinutes / 60;
}

export function calculateAmount(hours: number, rate: number): number {
  return Math.round(hours * rate * 100) / 100;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  return eachDayOfInterval({ start, end: addDays(start, 6) });
}

export function getMonthDays(date: Date): Date[] {
  return eachDayOfInterval({
    start: startOfMonth(date),
    end: endOfMonth(date),
  });
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  };
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function hasTimeOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
}

export function getDayName(date: Date): string {
  return format(date, "EEEE", { locale: nl });
}

export function getShortDayName(date: Date): string {
  return format(date, "EEE", { locale: nl });
}

export const SHIFT_TYPES = [
  { value: "TOEZICHT", label: "Toezicht" },
  { value: "TRAINING", label: "Training" },
  { value: "EVENT", label: "Evenement" },
  { value: "ANDERS", label: "Anders" },
] as const;

export const SHIFT_STATUSES = [
  { value: "CONCEPT", label: "Concept", color: "bg-yellow-500" },
  { value: "OPEN", label: "Open", color: "bg-purple-500" },
  { value: "TOEGEWEZEN", label: "Toegewezen", color: "bg-cyan-500" },
  { value: "BEVESTIGD", label: "Bevestigd", color: "bg-green-500" },
  { value: "AFGEROND", label: "Afgerond", color: "bg-blue-500" },
] as const;

export const AVAILABILITY_STATUSES = [
  { value: "AVAILABLE", label: "Beschikbaar" },
  { value: "UNAVAILABLE", label: "Niet beschikbaar" },
  { value: "PARTIAL", label: "Gedeeltelijk" },
] as const;

export const ROLES = [
  { value: "ADMIN", label: "Administrator" },
  { value: "MANAGER", label: "Manager" },
  { value: "EMPLOYEE", label: "Medewerker" },
] as const;

export const TIME_SLOTS = [
  "00:00",
  "00:30",
  "01:00",
  "01:30",
  "02:00",
  "02:30",
  "03:00",
  "03:30",
  "04:00",
  "04:30",
  "05:00",
  "05:30",
  "06:00",
  "06:30",
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
  "22:30",
  "23:00",
  "23:30",
] as const;

export const WEEKDAYS = [
  { value: 1, label: "Maandag", short: "Ma" },
  { value: 2, label: "Dinsdag", short: "Di" },
  { value: 3, label: "Woensdag", short: "Wo" },
  { value: 4, label: "Donderdag", short: "Do" },
  { value: 5, label: "Vrijdag", short: "Vr" },
  { value: 6, label: "Zaterdag", short: "Za" },
  { value: 7, label: "Zondag", short: "Zo" },
] as const;

/** Convert JS Date to ISO weekday (1=Mon, 7=Sun) */
export function getISOWeekday(date: Date): number {
  const day = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  return day === 0 ? 7 : day;
}
