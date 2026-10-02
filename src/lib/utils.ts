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

export const TIME_SLOTS = (() => {
  const slots: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 5) {
      const h = String(hour).padStart(2, '0');
      const m = String(minute).padStart(2, '0');
      slots.push(`${h}:${m}`);
    }
  }
  return slots;
})() as const;

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
