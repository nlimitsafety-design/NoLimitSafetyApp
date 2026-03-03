import useSWR, { SWRConfiguration } from 'swr';

// Global fetcher — throws on non-OK responses
export const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('Fetch error');
    try {
      const data = await res.json();
      (error as any).info = data;
    } catch {}
    (error as any).status = res.status;
    throw error;
  }
  return res.json();
};

// Default SWR config: dedupe within 10s, cache for 30s, revalidate on focus
export const swrDefaults: SWRConfiguration = {
  fetcher,
  dedupingInterval: 10000, // Deduplicate identical requests within 10s
  revalidateOnFocus: false, // Don't refetch when window regains focus
  revalidateOnReconnect: true,
  keepPreviousData: true, // Show stale data while revalidating (instant nav)
  errorRetryCount: 2,
};

// Typed hooks for common endpoints
export function useDashboard() {
  return useSWR<any>('/api/dashboard', fetcher, {
    ...swrDefaults,
    revalidateOnMount: true,
  });
}

export function useEmployees() {
  return useSWR<any[]>('/api/employees', fetcher, swrDefaults);
}

export function useProfile() {
  return useSWR<any>('/api/profile', fetcher, swrDefaults);
}

export function useAvailability(start: string, end: string, userId?: string) {
  const params = new URLSearchParams({ start, end });
  if (userId) params.set('userId', userId);
  const key = `/api/availability?${params}`;
  return useSWR<any[]>(key, fetcher, swrDefaults);
}

export function useRecurringAvailability() {
  return useSWR<any[]>('/api/recurring-availability', fetcher, swrDefaults);
}

export function useAvailabilityExceptions(start?: string, end?: string) {
  const params = new URLSearchParams();
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  const key = `/api/availability-exceptions?${params}`;
  return useSWR<any[]>(key, fetcher, swrDefaults);
}

export function useShifts(start: string, end: string) {
  const key = start && end ? `/api/shifts?start=${start}&end=${end}` : null;
  return useSWR<any[]>(key, fetcher, swrDefaults);
}

export function useReports(params: URLSearchParams) {
  const key = `/api/reports?${params}`;
  return useSWR<any[]>(key, fetcher, swrDefaults);
}

export function useOpenShifts() {
  return useSWR<any[]>('/api/shift-requests/open', fetcher, {
    ...swrDefaults,
    revalidateOnMount: true,
  });
}

export function useShiftRequests(shiftId: string | null) {
  const key = shiftId ? `/api/shift-requests?shiftId=${shiftId}` : null;
  return useSWR<any[]>(key, fetcher, swrDefaults);
}

export function useMyRequests() {
  return useSWR<any[]>('/api/shift-requests', fetcher, swrDefaults);
}

export function useFuncties(showAll = false) {
  const key = showAll ? '/api/functies?all=true' : '/api/functies';
  return useSWR<any[]>(key, fetcher, swrDefaults);
}

export function useToeslagen(showAll = false) {
  const key = showAll ? '/api/toeslagen?all=true' : '/api/toeslagen';
  return useSWR<any[]>(key, fetcher, swrDefaults);
}

export function useNotifications() {
  return useSWR<any>('/api/notifications', fetcher, {
    ...swrDefaults,
    refreshInterval: 30000, // Poll every 30s for new notifications
    revalidateOnFocus: true,
  });
}

export function useConversations() {
  return useSWR<any[]>('/api/conversations', fetcher, {
    ...swrDefaults,
    refreshInterval: 10000, // Poll every 10s for new messages
    revalidateOnFocus: true,
  });
}

export function useConversation(id: string | null) {
  const key = id ? `/api/conversations/${id}` : null;
  return useSWR<any>(key, fetcher, {
    ...swrDefaults,
    refreshInterval: 5000, // Poll every 5s when viewing a conversation
    revalidateOnFocus: true,
  });
}
